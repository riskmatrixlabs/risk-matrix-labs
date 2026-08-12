// Snapshot the WNBA/NBA/NHL models' top pre-game prop picks so they can be graded after the game
// finishes — the exact sibling of cron-snapshot-phlt.js, generalized across the modeled sports.
// For each pre-game game today (per sport), read the game's CACHED props from scan_cache (cacheOnly
// — NEVER a paid Odds-API fetch; no cache → skip the game honestly), pick ONE prop per player
// (primary market preferred, else highest evPct — pickPropPerPlayer), score them via the sport's
// verdictsForGame, and insert-if-absent the top non-faded A/B/C picks (score >= 52, capped 8/game)
// into prop_results with the REAL prop_market + prop_line. The unique key
// (external_event_id, game_date, player, prop_market) locks the FIRST pre-game snapshot.
// NBASL (Summer League) games route through the NBA model + cache under their own sport key.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { scanGameProps } from './scan-props.js'
import { PRIMARY_MARKET, pickPropPerPlayer, topModelPicks } from './_lib/modelPropPicks.js'
import { wnbaVerdictsForGame } from './wnba-props.js'
import { nbaVerdictsForGame } from './nba-props.js'
import { nhlVerdictsForGame } from './nhl-props.js'
import { nflVerdictsForGame } from './nfl-props.js'

export const config = { maxDuration: 60 }

const MAX_GAMES = 20          // cap external work per run (across all sports)
const TOP_PER_GAME = 8        // volume discipline — at most 8 snapshotted picks per game
const MIN_SCORE = 52          // Caution floor (tier C) — below this we don't snapshot
const PICK_TIERS = new Set(['A', 'B', 'C'])
const SPORTS = ['WNBA', 'NBA', 'NBASL', 'NHL', 'NFL']   // NBASL = NBA model, own events/cache sport key

// Which verdict builder scores a given events-sport value.
const VERDICTS_FOR = {
  WNBA: wnbaVerdictsForGame,
  NBA: nbaVerdictsForGame,
  NBASL: nbaVerdictsForGame,
  NHL: nhlVerdictsForGame,
  NFL: nflVerdictsForGame,
}

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// ET day (UTC-4) — matches cron-snapshot-phlt / snapshot-lean.js day windowing.
function etDate(iso) {
  const t = iso ? Date.parse(iso) : Date.now()
  return new Date(t - 4 * 3600e3).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  // Today's pre-game games for the modeled sports: NOT-final status + start still in the future.
  // Same windowing/guards as cron-snapshot-phlt (bounded to today's ET date).
  const nowIso = new Date().toISOString()
  const todayEt = etDate(nowIso)
  const from = nowIso                                         // start_time > now → pre-game only
  const to = new Date(Date.now() + 24 * 3600e3).toISOString() // through the next 24h
  const { data: rows, error: evErr } = await sb.from('events')
    .select('external_event_id, sport, away_team, home_team, away_abbr, home_abbr, start_time, status')
    .in('sport', SPORTS)
    .gt('start_time', from).lte('start_time', to)
    .order('start_time', { ascending: true })
  if (evErr) return res.status(200).json({ ok: false, error: evErr.message })

  const NOT_PREGAME = new Set(['IP', 'FT', 'AOT', 'FINAL', 'Final', 'final'])
  const games = (rows || [])
    .filter(e => e.external_event_id && e.away_team && e.home_team && !NOT_PREGAME.has(String(e.status)))
    .filter(e => etDate(e.start_time) === todayEt)   // belt-and-suspenders ET-date guard
    .slice(0, MAX_GAMES)

  let snapshotted = 0, dropped = 0, processed = 0, noCache = 0
  for (const ev of games) {
    const sport = String(ev.sport).toUpperCase()
    const verdictsForGame = VERDICTS_FOR[sport]
    const primary = PRIMARY_MARKET[sport]
    if (!verdictsForGame || !primary) continue
    processed++

    // CACHED props only — cacheOnly:true can never spend a credit. Not cached → skip honestly.
    let payload
    try { ({ payload } = await scanGameProps({ sport, away: ev.away_team, home: ev.home_team, cacheOnly: true })) }
    catch { continue }
    if (!payload?.found) { noCache++; continue }
    const props = [...(payload.edges || []), ...(payload.lineShopOnly || [])]
    if (!props.length) { noCache++; continue }

    // One prop per player (primary market preferred, else highest evPct), aligned arrays.
    const pick = pickPropPerPlayer(props, primary)
    const names = Object.keys(pick).slice(0, 30)
    if (!names.length) continue

    let verdicts
    try {
      ({ verdicts } = await verdictsForGame({
        away: ev.away_team, home: ev.home_team, iso: ev.start_time,
        names,
        markets: names.map(n => pick[n].market || ''),
        lines: names.map(n => pick[n].point ?? ''),
        evs: names.map(n => pick[n].evPct ?? ''),
      }))
    } catch { continue }

    const { top, dropped: d } = topModelPicks(verdicts, { minScore: MIN_SCORE, topPerGame: TOP_PER_GAME, tiers: PICK_TIERS })
    dropped += d

    const gameDate = etDate(ev.start_time)
    for (const { player, v } of top) {
      const line = Number(pick[player]?.point)
      if (!Number.isFinite(line)) continue   // no real line → no snapshot (never fabricate)
      const row = {
        sport,                               // 'WNBA' | 'NBA' | 'NBASL' | 'NHL' (grader maps ESPN path)
        game_date: gameDate,
        external_event_id: String(ev.external_event_id),
        away_team: ev.away_team, home_team: ev.home_team,
        away_abbr: ev.away_abbr || null, home_abbr: ev.home_abbr || null,
        player,
        prop_market: String(pick[player].market),   // REAL market, e.g. player_points
        prop_line: line,                            // REAL posted line
        lean: 'OVER',                               // the models project the over side
        phlt_score: Math.round(Number(v.score)),
        phlt_tier: String(v.tier),
      }
      // Insert-if-absent — lock the first pre-game snapshot, never overwrite a later re-score.
      const { error } = await sb.from('prop_results')
        .upsert(row, { onConflict: 'external_event_id,game_date,player,prop_market', ignoreDuplicates: true })
      if (!error) snapshotted++
    }
  }

  return res.status(200).json({ ok: true, snapshotted, dropped, games: processed, noCache })
}
