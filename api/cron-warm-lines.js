// Pre-warm the whole slate's game-lines cache so opening ANY game shows best lines for FREE.
// ONE bulk Odds-API call per sport that has games in the window → caches every game (the cheap
// h2h/spreads/totals board). Opening a game then serves that warm cache (cacheOnly, $0). A manual
// ↻ REFRESH still pulls live. Credit-safe: only warms sports with games, throttled per sport.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { warmSlate } from './game-lines.js'
import { readScan, writeScan, todayStr } from './_lib/scanStore.js'
import { creditFloorBlocked, getKnownCredits } from './_lib/creditGuard.js'

export const config = { maxDuration: 40 }

const WINDOW_BEFORE_H = 3, WINDOW_AHEAD_H = 10
const THROTTLE_MS = 10 * 60 * 1000   // never re-warm a sport within 10 min, even if pinged repeatedly

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  // Optional guard — if CRON_SECRET is set, require it (Vercel sends it as a Bearer header).
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // Hard credit floor — never warm lines when the known balance is below the shared floor.
  if (await creditFloorBlocked()) {
    const { remaining } = await getKnownCredits()
    return res.status(200).json({ skipped: 'low credits', remaining })
  }

  // Only warm sports that actually have games in the window (free Supabase read) — no wasted credits.
  let sports = []
  const sb = db()
  if (sb) {
    try {
      const from = new Date(Date.now() - WINDOW_BEFORE_H * 3600e3).toISOString()
      const to = new Date(Date.now() + WINDOW_AHEAD_H * 3600e3).toISOString()
      const { data } = await sb.from('events').select('sport').gte('start_time', from).lte('start_time', to)
      sports = [...new Set((data || []).map(r => String(r.sport).toUpperCase()).filter(Boolean))]
    } catch { /* fall through */ }
  }
  if (!sports.length) return res.status(200).json({ ok: true, warmed: {}, note: 'no games in window' })

  const date = todayStr()
  const warmed = {}
  for (const s of sports) {
    // per-sport throttle marker so repeated pings can't burn credits
    const tkey = `WARMED-${s}`
    const mark = await readScan(tkey, date)
    if (mark?.scanned_at && Date.now() - new Date(mark.scanned_at).getTime() < THROTTLE_MS) {
      warmed[s] = { skipped: 'throttled' }
      continue
    }
    try {
      warmed[s] = await warmSlate(s)
      await writeScan(tkey, date, { at: new Date().toISOString() }, null)
    } catch (e) {
      warmed[s] = { error: String(e?.message || e) }
    }
  }
  return res.status(200).json({ ok: true, warmed })
}
