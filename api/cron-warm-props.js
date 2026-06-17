// Pre-warm the slate's player-prop cache so opening ANY game shows props for FREE — the same way
// cron-warm-lines warms game-lines. Props bill PER GAME (unlike the one-call lines board), so this
// is the priciest warm: it loops every game in the window and does one paid per-event odds call
// (base markets, us region only — the manual ↻ REFRESH adds us2 + us_ex/Novig on demand). Three
// guards keep credits safe: (1) a hard credit floor that pauses warming when the balance is low,
// re-checked live as the loop spends; (2) scanGameProps self-throttles via a short re-warm age, so
// a game already warmed in the last ~50 min costs 0; (3) only sports we actually scan props for.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { scanGameProps } from './scan-props.js'
import { readLatestCredits } from './_lib/scanStore.js'

export const config = { maxDuration: 60 }

const WINDOW_BEFORE_H = 3, WINDOW_AHEAD_H = 10
const PROP_WARM_FLOOR = 1500              // pause prop-warming below this many credits (protect balance)
const WARM_REGIONS = ['us']               // us only — manual ↻ REFRESH adds us2 + us_ex/Novig on demand
const REWARM_AGE_MS = 50 * 60 * 1000      // re-warm a game only once its cache is older than this
const PROP_SPORTS = ['MLB', 'NBA', 'WNBA', 'NHL']

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  // Optional guard — if CRON_SECRET is set, require it (Vercel sends it as a Bearer header).
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // Hard credit floor — never start warming props when the known balance is already low.
  let credits = await readLatestCredits()
  if (credits != null && credits < PROP_WARM_FLOOR) {
    return res.status(200).json({ ok: true, skipped: 'low-credit', credits, floor: PROP_WARM_FLOOR })
  }

  const sb = db()
  if (!sb) return res.status(200).json({ ok: true, note: 'no supabase' })

  // Which games are in the window (free Supabase read) — no wasted credits on empty slates.
  let rows = []
  try {
    const from = new Date(Date.now() - WINDOW_BEFORE_H * 3600e3).toISOString()
    const to = new Date(Date.now() + WINDOW_AHEAD_H * 3600e3).toISOString()
    const { data } = await sb.from('events').select('sport, away_team, home_team, start_time')
      .gte('start_time', from).lte('start_time', to)
    rows = (data || []).filter(r => PROP_SPORTS.includes(String(r.sport).toUpperCase()) && r.away_team && r.home_team)
  } catch { /* fall through */ }
  if (!rows.length) return res.status(200).json({ ok: true, warmed: 0, note: 'no prop games in window' })

  const result = { games: rows.length, warmed: 0, cached: 0, failed: 0, stoppedLowCredit: false, creditsRemaining: credits }
  for (const r of rows) {
    if (credits != null && credits < PROP_WARM_FLOOR) { result.stoppedLowCredit = true; break }
    const sport = String(r.sport).toUpperCase()
    try {
      // force:false + cacheOnly:false → spends only if the game's cache is older than REWARM_AGE_MS,
      // otherwise returns the existing cache for $0 (self-throttling).
      const { payload, served } = await scanGameProps({
        sport, away: r.away_team, home: r.home_team, regions: WARM_REGIONS, ttlMs: REWARM_AGE_MS,
      })
      if (served === 'cache') result.cached++
      else if (served === 'live' && payload.found) { result.warmed++; if (payload.creditsRemaining != null) credits = payload.creditsRemaining }
    } catch { result.failed++ }
  }
  result.creditsRemaining = credits
  return res.status(200).json({ ok: true, ...result })
}
