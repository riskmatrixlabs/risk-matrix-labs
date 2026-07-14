// Grade PHLT player-prop picks once their game is final (Plan A, grade side). Pure server + DB (free):
// for each ungraded prop_results row, fetch the event's ESPN box score ONCE, resolve the player's final
// stat for the prop market, and mark W/L from the model's lean (gradeProp). DNP / stat-not-found / game
// not final → leave the row ungraded (never guess). Read-only against ESPN; writes only prop_results.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { gradeProp } from './_lib/gradeLean.js'
import { parseBox } from './box-score.js'
import { resolveStat } from '../src/lib/statProgress.js'
import { matchBoxPlayer, lastNameInBox } from '../src/lib/matchBoxPlayer.js'

export const config = { maxDuration: 60 }

const MAX_ESPN = 120 // cap external summary fetches per run (bumped so a full slate clears faster)

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

  // Ungraded prop picks. Window was 4 days — anything older got ABANDONED forever (a game's box
  // score can lag, a name can miss a pass); 30d lets stragglers re-grade and clears the backlog.
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
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
      // Robust match: reconciles the prop feed's stripped names ("Vladimir Guerrero", "kurodagrauer")
      // with ESPN's box-score names ("Vladimir Guerrero Jr.", "Kuroda-Grauer") — the main grading gap.
      const matched = matchBoxPlayer(row.player, players)
      const statValue = resolveStat(matched, row.prop_market)
      let result = gradeProp({ statValue, prop_line: row.prop_line, lean: row.lean })
      let finalVal = statValue
      // Genuine DNP: game is FINAL and no box player even shares this last name → void ('P', excluded
      // from win% by propRecord) so the row RESOLVES instead of sitting ungraded forever. If the last
      // name IS present but the full match failed, that's a matcher gap → leave ungraded (never guess).
      if (result == null && matched == null && !lastNameInBox(row.player, players)) {
        result = 'P'; finalVal = null
      }
      if (result == null) continue // matched but stat unresolvable, or uncertain miss — leave ungraded
      const { error } = await sb.from('prop_results')
        .update({ result, final_value: finalVal, graded_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!error) graded++
    }
  }

  return res.status(200).json({ ok: true, graded, checked: pending.length })
}
