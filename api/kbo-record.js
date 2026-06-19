// KBO locked grades — reads the FROZEN result rows from `kbo_leans` (written by cron-kbo-leans),
// NOT a live re-scan. This is the source of truth for past days: the lean was locked at snapshot
// time and the result graded once, so it can never drift. The live `kbo-scan` endpoint re-runs the
// model (and re-pulls weather), which for a PAST date produces different projections — that mismatch
// is what created phantom W/L on no-pick games. The Yesterday view uses THIS endpoint instead.
//
// GET /api/kbo-record?date=YYYY-MM-DD   (KST date; defaults to "today")
// Returns { date, games: [...locked rows...], record: { w, l, p } }.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { kstDate } from './kbo-scan.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300')
  const date = String(req.query?.date || kstDate())
  const sb = db()
  if (!sb) return res.status(200).json({ date, games: [], record: { w: 0, l: 0, p: 0 }, note: 'no db' })
  try {
    const { data, error } = await sb.from('kbo_leans')
      .select('event_id, away, home, venue, lean, proj_total, baseline, edge, factors, final_total, result, proj_error')
      .eq('game_date', date)
    if (error) throw error
    const rows = (data || []).map(r => ({
      id: r.event_id,
      matchup: `${r.away} @ ${r.home}`,
      away: r.away, home: r.home, venue: r.venue,
      lean: r.lean,
      projTotal: r.proj_total != null ? Number(r.proj_total) : null,
      baseline: r.baseline != null ? Number(r.baseline) : 9.8,
      edge: r.edge != null ? Number(r.edge) : 0,
      factors: r.factors ? String(r.factors).split(' · ').filter(Boolean) : [],
      finalTotal: r.final_total != null ? Number(r.final_total) : null,
      // Locked grade from the DB. LEAN = no side taken → never W/L (the cron stores 'P').
      result: r.lean === 'LEAN' ? null : (r.result || null),
      projError: r.proj_error != null ? Number(r.proj_error) : null,
    })).sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
    // Record counts PICKS ONLY — LEAN/no-pick games never count.
    const picks = rows.filter(r => r.lean !== 'LEAN')
    const record = {
      w: picks.filter(r => r.result === 'W').length,
      l: picks.filter(r => r.result === 'L').length,
      p: picks.filter(r => r.result === 'P').length,
    }
    return res.status(200).json({ date, games: rows, record })
  } catch (e) {
    return res.status(200).json({ date, games: [], record: { w: 0, l: 0, p: 0 }, error: String(e?.message || e) })
  }
}
