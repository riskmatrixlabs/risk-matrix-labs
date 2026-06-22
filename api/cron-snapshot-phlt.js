// Snapshot the model's top pre-game PHLT hitter picks so they can be graded after the game finishes.
// For each pre-game MLB game today, score every hitter (phltVerdictsForGame), keep the top non-faded
// A/B/C picks (score >= 52, capped 8/game for volume discipline), and insert-if-absent a 'hits 0.5
// OVER' row into prop_results. The unique key (external_event_id, game_date, player, prop_market) locks
// the FIRST pre-game snapshot so a later live re-score can never overwrite it. Free: ESPN + Savant only.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { phltVerdictsForGame } from './phlt.js'

export const config = { maxDuration: 60 }

const MAX_GAMES = 20          // cap external work per run
const TOP_PER_GAME = 8        // volume discipline — at most 8 snapshotted picks per game
const MIN_SCORE = 52          // Caution floor (tier C) — below this we don't snapshot
const PICK_TIERS = new Set(['A', 'B', 'C', 'Prime', 'Strong', 'Caution'])

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// ET day (UTC-4) — matches snapshot-lean.js and the rest of the app's day windowing.
function etDate(iso) {
  const t = iso ? Date.parse(iso) : Date.now()
  return new Date(t - 4 * 3600e3).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  // Today's pre-game MLB games: NOT-final status + first pitch still in the future. We bound the read
  // to today's ET date window so we never pick up tomorrow's or yesterday's slate.
  const nowIso = new Date().toISOString()
  const todayEt = etDate(nowIso)
  const from = nowIso                                       // start_time > now → pre-game only
  const to = new Date(Date.now() + 24 * 3600e3).toISOString() // through the next 24h (covers today's late games)
  const { data: rows, error: evErr } = await sb.from('events')
    .select('external_event_id, sport, away_team, home_team, away_abbr, home_abbr, start_time, status')
    .eq('sport', 'MLB')
    .gt('start_time', from).lte('start_time', to)
    .order('start_time', { ascending: true })
  if (evErr) return res.status(200).json({ ok: false, error: evErr.message })

  const NOT_PREGAME = new Set(['IP', 'FT', 'AOT', 'FINAL', 'Final', 'final'])
  const games = (rows || [])
    .filter(e => e.external_event_id && e.away_team && e.home_team && !NOT_PREGAME.has(String(e.status)))
    // belt-and-suspenders ET-date guard: only games whose ET game-date is today
    .filter(e => etDate(e.start_time) === todayEt)
    .slice(0, MAX_GAMES)

  let snapshotted = 0, dropped = 0, processed = 0
  for (const ev of games) {
    processed++
    let verdicts
    try {
      ({ verdicts } = await phltVerdictsForGame({ sport: 'MLB', away: ev.away_team, home: ev.home_team, iso: ev.start_time }))
    } catch { continue }

    // Pick: not faded, tier in A/B/C, score >= MIN_SCORE. Sort by score desc, cap TOP_PER_GAME.
    const picks = Object.entries(verdicts || {})
      .map(([player, v]) => ({ player, v }))
      .filter(({ v }) => v && !v.faded && PICK_TIERS.has(String(v.tier)) && Number(v.score) >= MIN_SCORE)
      .sort((a, b) => Number(b.v.score) - Number(a.v.score))
    if (picks.length > TOP_PER_GAME) dropped += picks.length - TOP_PER_GAME
    const top = picks.slice(0, TOP_PER_GAME)

    const gameDate = etDate(ev.start_time)
    for (const { player, v } of top) {
      const row = {
        sport: 'MLB',
        game_date: gameDate,
        external_event_id: String(ev.external_event_id),
        away_team: ev.away_team, home_team: ev.home_team,
        away_abbr: ev.away_abbr || null, home_abbr: ev.home_abbr || null,
        player,
        prop_market: 'hits',
        prop_line: 0.5,
        lean: 'OVER',
        phlt_score: Math.round(Number(v.score)),
        phlt_tier: String(v.tier),
      }
      // Insert-if-absent — lock the first pre-game snapshot, never overwrite a later live re-score.
      const { error } = await sb.from('prop_results')
        .upsert(row, { onConflict: 'external_event_id,game_date,player,prop_market', ignoreDuplicates: true })
      if (!error) snapshotted++
    }
  }

  return res.status(200).json({ ok: true, snapshotted, dropped, games: processed })
}
