// Grade PHLT player-prop picks once their game is final (Plan A, grade side). Pure server + DB (free):
// for each ungraded prop_results row, fetch the event's ESPN box score ONCE, resolve the player's final
// stat for the prop market, and mark W/L from the model's lean (gradeProp). DNP / stat-not-found / game
// not final → leave the row ungraded (never guess). Read-only against ESPN; writes only prop_results.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { gradeProp } from './_lib/gradeLean.js'
import { parseBox } from './box-score.js'
import { resolveStat } from '../src/lib/statProgress.js'

export const config = { maxDuration: 60 }

const MAX_ESPN = 80 // cap external summary fetches per run as a safety net

// Match parseBox's key normalization (lowercase + accent-strip) so accented player
// names (e.g. "José Ramírez") still resolve against the box-score map.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// Fetch the ESPN MLB summary for one event. Returns the parsed summary only when the
// game is actually FINAL; otherwise null (so we skip and leave its rows ungraded).
async function finalSummary(id) {
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${id}`, { signal: AbortSignal.timeout(7000) })
    if (!r.ok) return null
    const d = await r.json()
    const t = d?.header?.competitions?.[0]?.status?.type
    if (!t || !(t.completed || String(t.name || '').startsWith('STATUS_FINAL'))) return null
    return d
  } catch { return null }
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  // Ungraded prop picks from the last few days (avoid scanning ancient rows).
  const since = new Date(Date.now() - 4 * 86400e3).toISOString().slice(0, 10)
  const { data: pending } = await sb.from('prop_results')
    .select('id, external_event_id, player, prop_market, prop_line, lean, game_date')
    .is('result', null).gte('game_date', since).limit(500)
  if (!pending?.length) return res.status(200).json({ ok: true, graded: 0, checked: 0, note: 'nothing pending' })

  // Group rows by event so we fetch each ESPN summary at most once.
  const byEvent = {}
  for (const r of pending) {
    const eid = r.external_event_id == null ? '' : String(r.external_event_id)
    if (!eid) continue
    ;(byEvent[eid] || (byEvent[eid] = [])).push(r)
  }

  let graded = 0, espnCalls = 0
  for (const [eid, rows] of Object.entries(byEvent)) {
    if (espnCalls >= MAX_ESPN) break
    espnCalls++
    const summary = await finalSummary(eid)
    if (!summary) continue // not final yet (or fetch failed) — leave rows ungraded
    const players = parseBox(summary)

    for (const row of rows) {
      const statValue = resolveStat(players[norm(row.player)], row.prop_market)
      const result = gradeProp({ statValue, prop_line: row.prop_line, lean: row.lean })
      if (result == null) continue // DNP / not found / unresolvable — leave ungraded
      const { error } = await sb.from('prop_results')
        .update({ result, final_value: statValue, graded_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!error) graded++
    }
  }

  return res.status(200).json({ ok: true, graded, checked: pending.length })
}
