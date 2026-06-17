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
    .select('external_event_id, game_date, lean, total_line, confidence, strong, result, final_total, closing_line, clv')
    .order('game_date', { ascending: false }).limit(2000)
  const rows = all || []

  const strong = rows.filter(r => r.strong)
  const rec = (set) => ({
    today: tally(set.filter(r => r.game_date === today)),
    yesterday: tally(set.filter(r => r.game_date === yesterday)),
    allTime: tally(set),
  })

  // Per-game map for today + yesterday so the cards can render a badge.
  const games = {}
  for (const r of rows) {
    if (r.game_date !== today && r.game_date !== yesterday) continue
    games[r.external_event_id] = {
      lean: r.lean, line: r.total_line, strong: r.strong,
      result: r.result || null, finalTotal: r.final_total ?? null, date: r.game_date,
      closingLine: r.closing_line ?? null, clv: r.clv ?? null,
    }
  }

  return res.status(200).json({ ok: true, all: rec(rows), strong: rec(strong), games })
}
