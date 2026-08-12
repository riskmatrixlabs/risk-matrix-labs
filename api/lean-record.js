// Model lean track record + per-game results. Powers Spotlight's Yesterday/All-time line and the
// ✓HIT / ✗MISS badges on Game Center cards. Free: pure DB read. Returns records split two ways —
// ALL directional leans vs STRONG-only (the subset that made Spotlight) — so you can see whether
// the Spotlight filter actually picks winners.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'
import { tally, splitLeanRows, buildGamesMap } from './_lib/leanSplit.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}
const etDate = (offDays = 0) => new Date(Date.now() - 4 * 3600e3 - offDays * 86400e3).toISOString().slice(0, 10)

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sb = db(); if (!sb) return res.status(200).json({ ok: false })
  res.setHeader('Cache-Control', 'no-store')

  const today = etDate(0), yesterday = etDate(1)
  const { data: all } = await sb.from('lean_results')
    .select('external_event_id, game_date, sport, market, model_version, lean, pick_side, total_line, confidence, strong, result, final_total, closing_line, clv')
    .order('game_date', { ascending: false }).limit(3000)
  const rows = all || []

  // Split by market: the O/U record is TOTALS only (ml/rl rows live in the same table since
  // v480 and would otherwise pollute it). Team = ML + Run Line combined. NFL SHADOW rows
  // (sport 'NFL', market 'rl') are excluded from every existing field and tallied separately
  // as `nfl` — the ML-fix cutoff logic lives in _lib/leanSplit.js.
  const { totals, mlRows, rlRows, teamRows, strong, nflRl, nflTotals, nhlTotals, wnbaTotals, wnbaMl, nhlMl } = splitLeanRows(rows)
  const rec = (set) => ({
    today: tally(set.filter(r => r.game_date === today)),
    yesterday: tally(set.filter(r => r.game_date === yesterday)),
    allTime: tally(set),
  })

  // Per-game map for today + yesterday so the cards can grade EVERY call they showed.
  // Top-level fields = the TOTALS lean (back-compat); .ml / .rl = the team calls' grades.
  // Built from ALL rows — SHADOW included — because this is per-game DISPLAY data, not a tally:
  // an NFL/NHL/WNBA graded lean must be able to reach its own card chip. The record blocks above
  // stay shadow-free.
  const games = buildGamesMap(rows, today, yesterday)

  return res.status(200).json({ ok: true, all: rec(totals), strong: rec(strong), team: rec(teamRows), ml: rec(mlRows), rl: rec(rlRows), nfl: rec(nflRl), nflTotals: rec(nflTotals), nhlTotals: rec(nhlTotals), wnbaTotals: rec(wnbaTotals), wnbaMl: rec(wnbaMl), nhlMl: rec(nhlMl), games })
}
