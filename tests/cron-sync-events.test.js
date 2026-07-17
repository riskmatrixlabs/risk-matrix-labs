import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the summary/live parsers imported by cron-sync-events.js so we don't need
// real ESPN response shapes — they're not exercised by these tests.
vi.mock('../api/cron-sync-live.js', () => ({
  parseTeamStats: () => ({}),
  parseNHLSkaters: () => [],
  parseNHLGoalie: () => null,
  parseStandings: () => null,
  parseHoopsPlayers: () => [],
  parsePeriodLinescore: () => null,
  eventNote: () => null,
  parseNHLGoals: () => null,
  parseSimplePlays: () => [],
  buildOddsSnapshots: () => [],
  parseTrends: () => null,
  parseInjuries: () => null,
  parseSeasonSeries: () => null,
}))
vi.mock('../api/lib/weather.js', () => ({
  geocode: async () => null,
  fetchWeather: async () => null,
}))

import { runSync, SPORTS } from '../api/cron-sync-events.js'

// Build a minimal fake ESPN scoreboard response with `n` events for a sport.
function scoreboard(n) {
  return {
    events: Array.from({ length: n }, (_, i) => ({
      id: `evt-${i}`,
      date: '2026-07-16T23:00:00Z',
      competitions: [{
        competitors: [
          { homeAway: 'home', team: { displayName: 'Home', abbreviation: 'HOM', id: '1' }, score: '0' },
          { homeAway: 'away', team: { displayName: 'Away', abbreviation: 'AWY', id: '2' }, score: '0' },
        ],
        status: { type: { name: 'STATUS_SCHEDULED', detail: '' } },
        odds: [],
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
      }
    },
  }
  return { supabase, upsertCalls }
}

describe('runSync incremental per-sport writes', () => {
  const dates = ['20260716']

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('upserts each sport as soon as its rows are ready, not once at the end', async () => {
    const { supabase, upsertCalls } = makeSupabase()

    global.fetch = vi.fn(async (url) => {
      if (url.includes('/summary')) {
        return { ok: true, json: async () => ({}) }
      }
      // scoreboard endpoint — every sport returns 1 event
      return { ok: true, json: async () => scoreboard(1) }
    })

    const result = await runSync(supabase, dates)

    // One upsert call per sport that produced rows (incremental), not a single
    // end-of-run batch covering all sports at once.
    const eventUpserts = upsertCalls.filter(c => c.table === 'events')
    expect(eventUpserts.length).toBe(SPORTS.length)
    for (const call of eventUpserts) {
      expect(call.rows.length).toBeGreaterThan(0)
    }
    expect(result.counts[SPORTS[0].key]).toBe(1)
  })

  it('a thrown error upserting one sport does not lose rows already written for prior sports', async () => {
    const { supabase, upsertCalls } = makeSupabase()

    global.fetch = vi.fn(async (url) => {
      if (url.includes('/summary')) return { ok: true, json: async () => ({}) }
      return { ok: true, json: async () => scoreboard(1) }
    })

    // Make the SECOND sport's upsert throw (simulating a DB hiccup mid-run),
    // while the first sport's upsert succeeds normally.
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

    const result = await runSync(supabase, dates)

    const eventUpserts = upsertCalls.filter(c => c.table === 'events')
    // The first sport's rows must have been upserted despite the second sport's failure.
    expect(eventUpserts.length).toBeGreaterThanOrEqual(1)
    expect(eventUpserts[0].rows.length).toBeGreaterThan(0)
    // Every sport was still attempted — the failure didn't abort the whole run.
    expect(Object.keys(result.counts).length).toBe(SPORTS.length)
    expect(result.counts[SPORTS[0].key]).toBe(1)
  })
})
