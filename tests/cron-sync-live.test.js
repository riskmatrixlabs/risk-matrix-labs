import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/lib/weather.js', () => ({
  geocode: async () => null,
  fetchWeather: async () => null,
}))

import { runLiveSync, SPORTS } from '../api/cron-sync-live.js'

// Minimal fake ESPN scoreboard with `n` IN-PROGRESS events.
function liveScoreboard(n) {
  return {
    events: Array.from({ length: n }, (_, i) => ({
      id: `live-${i}`,
      date: '2026-07-16T23:00:00Z',
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { displayName: 'Home', abbreviation: 'HOM', id: '1' }, score: '3', linescores: [] },
          { homeAway: 'away', team: { displayName: 'Away', abbreviation: 'AWY', id: '2' }, score: '2', linescores: [] },
        ],
        status: { type: { name: 'STATUS_IN_PROGRESS', detail: '' } },
      }],
    })),
  }
}

function makeSupabase() {
  const upsertCalls = []
  const supabase = {
    from(table) {
      return {
        select() { return this },
        in() { return Promise.resolve({ data: [] }) },
        upsert(rows) {
          upsertCalls.push({ table, rows })
          return Promise.resolve({ error: null })
        },
        insert() { return Promise.resolve({ error: null }) },
        delete() { return { eq: () => Promise.resolve({ error: null }) } },
      }
    },
  }
  return { supabase, upsertCalls }
}

describe('runLiveSync incremental per-sport writes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('orders money sports first with NBASL last (timeout only starves the tail)', () => {
    const keys = SPORTS.map(s => s.key)
    expect(keys[0]).toBe('MLB')
    expect(keys[keys.length - 1]).toBe('NBASL')
  })

  it('upserts each sport\'s live rows as soon as that sport finishes, not once at the end', async () => {
    const { supabase, upsertCalls } = makeSupabase()

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/summary')) return { ok: true, json: async () => ({}) }
      return { ok: true, json: async () => liveScoreboard(1) }
    })

    const result = await runLiveSync(supabase)

    // One events upsert per sport with live games (incremental), not a single batch.
    const eventUpserts = upsertCalls.filter(c => c.table === 'events')
    expect(eventUpserts.length).toBe(SPORTS.length)
    for (const call of eventUpserts) {
      expect(call.rows.length).toBeGreaterThan(0)
      expect(call.rows[0].status).toBe('IP')
    }
    expect(result.live).toBe(SPORTS.length)
    expect(result.counts[SPORTS[0].key]).toBe(1)
  })

  it('a failure on one sport does not lose rows already written for prior sports', async () => {
    const { supabase, upsertCalls } = makeSupabase()

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/summary')) return { ok: true, json: async () => ({}) }
      return { ok: true, json: async () => liveScoreboard(1) }
    })

    // Make the SECOND sport's events upsert throw (simulated DB hiccup mid-run).
    let sportUpsertCount = 0
    const origFrom = supabase.from.bind(supabase)
    supabase.from = (table) => {
      const chain = origFrom(table)
      if (table === 'events') {
        const origUpsert = chain.upsert.bind(chain)
        chain.upsert = (rows) => {
          sportUpsertCount++
          if (sportUpsertCount === 2) throw new Error('simulated db timeout')
          return origUpsert(rows)
        }
      }
      return chain
    }

    const result = await runLiveSync(supabase)

    const eventUpserts = upsertCalls.filter(c => c.table === 'events')
    // First sport's rows persisted despite the second sport's failure.
    expect(eventUpserts.length).toBeGreaterThanOrEqual(1)
    expect(eventUpserts[0].rows.length).toBeGreaterThan(0)
    // Every sport was still attempted — the failure didn't abort the run.
    expect(Object.keys(result.counts).length).toBe(SPORTS.length)
    expect(result.counts[SPORTS[0].key]).toBe(1)
    expect(result.errors[SPORTS[1].key]).toMatch(/simulated db timeout/)
  })
})
