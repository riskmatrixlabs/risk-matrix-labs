// Model lean track record + per-game results. Powers Spotlight's Yesterday/All-time line and the
// ✓HIT / ✗MISS badges on Game Center cards. Free: pure DB read. Returns records split two ways —
// ALL directional leans vs STRONG-only (the subset that made Spotlight) — so you can see whether
// the Spotlight filter actually picks winners.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}
const etDate = (offDays = 0) => new Date(Date.now() - 4 * 3600e3 - offDays * 86400e3).toISOString().slice(0, 10)

function tally(rows) {
  const r = { w: 0, l: 0, p: 0, pending: 0 }
  for (const x of rows) {
    if (x.result === 'W') r.w++
    else if (x.result === 'L') r.l++
    else if (x.result === 'P') r.p++
    else r.pending++
  }
  return r
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sb = db(); if (!sb) return res.status(200).json({ ok: false })
  res.setHeader('Cache-Control', 'no-store')

  const today = etDate(0), yesterday = etDate(1)
  const { data: all } = await sb.from('lean_results')
    .select('external_event_id, game_date, market, lean, pick_side, total_line, confidence, strong, result, final_total, closing_line, clv')
    .order('game_date', { ascending: false }).limit(3000)
  const rows = all || []

  // Split by market: the O/U record is TOTALS only (ml/rl rows live in the same table since
  // v480 and would otherwise pollute it). Team = ML + Run Line combined.
  const totals = rows.filter(r => (r.market || 'total') === 'total')
  // Team ML/RL had a home-field-advantage bug fixed Jun 22 ET. Only COUNT graded ML/RL games from the
  // next slate forward so the broken version's losses don't pollute the record. O/U was unaffected
  // (HFA doesn't touch totals) → it counts all. The per-game `games` map still grades ALL games.
  const ML_FIX_DATE = '2026-06-23'
  const mlAll = rows.filter(r => r.market === 'ml')
  const rlAll = rows.filter(r => r.market === 'rl')
  const mlRows = mlAll.filter(r => r.game_date >= ML_FIX_DATE)
  const rlRows = rlAll.filter(r => r.game_date >= ML_FIX_DATE)
  const teamRows = [...mlAll, ...rlAll]
  const strong = totals.filter(r => r.strong)
  const rec = (set) => ({
    today: tally(set.filter(r => r.game_date === today)),
    yesterday: tally(set.filter(r => r.game_date === yesterday)),
    allTime: tally(set),
  })

  // Per-game map for today + yesterday so the cards can grade EVERY call they showed.
  // Top-level fields = the TOTALS lean (back-compat); .ml / .rl = the team calls' grades.
  const games = {}
  const ensure = (id) => (games[id] ??= {})
  for (const r of totals) {
    if (r.game_date !== today && r.game_date !== yesterday) continue
    Object.assign(ensure(r.external_event_id), {
      lean: r.lean, line: r.total_line, strong: r.strong,
      result: r.result || null, finalTotal: r.final_total ?? null, date: r.game_date,
      closingLine: r.closing_line ?? null, clv: r.clv ?? null,
    })
  }
  for (const r of teamRows) {
    if (r.game_date !== today && r.game_date !== yesterday) continue
    ensure(r.external_event_id)[r.market] = { pick: r.pick_side || r.lean || null, result: r.result || null, date: r.game_date }
  }

  return res.status(200).json({ ok: true, all: rec(totals), strong: rec(strong), team: rec(teamRows), ml: rec(mlRows), rl: rec(rlRows), games })
}
