// Overnight KBO calibration cron — FREE (TheSportsDB + Open-Meteo, 0 Odds-API credits). Two jobs:
//  1) SNAPSHOT today's KST projections (insert-if-absent → the projection can't drift after lock).
//  2) GRADE finished games: actual total (from TheSportsDB final) vs the locked projection.
// Calibration metric = proj_error (actual − projected). The W/L is a *proxy* (directional vs the
// league baseline) — there's no free market line, so this is model-accuracy tracking, not a betting
// record. KBO plays ~14:00–22:00 KST (05:00–13:00 UTC); registered in vercel.json for 04:00 + 14:00 UTC.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { scanKBO, kstDate } from './kbo-scan.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}
const r1 = (n) => Math.round(n * 10) / 10

export default async function handler(req, res) {
  // Match sibling crons: reject public triggers when a CRON_SECRET is configured.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })
  let snapped = 0, graded = 0
  try {
    // 1) SNAPSHOT today's KST slate — lock the projection (never overwrite).
    const today = kstDate()
    const scan = await scanKBO(today).catch(() => null)
    for (const g of scan?.games || []) {
      if (!g.id) continue
      const { error } = await sb.from('kbo_leans').upsert({
        event_id: g.id, game_date: today, away: g.away, home: g.home, venue: g.venue,
        lean: g.lean, proj_total: g.projTotal, baseline: g.baseline, edge: g.edge,
        factors: (g.factors || []).join(' · '),
      }, { onConflict: 'event_id,game_date', ignoreDuplicates: true })
      if (!error) snapped++
    }

    // 2) GRADE ungraded rows from the last 3 days — re-scan brings the final total from TheSportsDB.
    const since = new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10)
    const { data: pending } = await sb.from('kbo_leans')
      .select('id, event_id, game_date, lean, proj_total, baseline').is('result', null).gte('game_date', since).limit(200)
    const byDate = {}
    for (const p of pending || []) (byDate[p.game_date] ??= []).push(p)
    for (const [d, rows] of Object.entries(byDate)) {
      const s = await scanKBO(d).catch(() => null)
      const fin = {}
      for (const g of s?.games || []) if (g.id && g.finalTotal != null) fin[g.id] = g.finalTotal
      for (const p of rows) {
        const actual = fin[p.event_id]
        if (actual == null) continue                      // not final yet
        const base = Number(p.baseline ?? 9.8)
        let result = 'P'                                   // proxy: directional vs baseline (no line)
        if (p.lean === 'OVER')  result = actual > base ? 'W' : actual < base ? 'L' : 'P'
        else if (p.lean === 'UNDER') result = actual < base ? 'W' : actual > base ? 'L' : 'P'
        const { error } = await sb.from('kbo_leans')
          .update({ final_total: actual, result, proj_error: r1(actual - Number(p.proj_total)) }).eq('id', p.id)
        if (!error) graded++
      }
    }
    return res.status(200).json({ ok: true, snapped, graded })
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e), snapped, graded })
  }
}
