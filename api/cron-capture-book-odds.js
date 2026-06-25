// Per-book odds capture — the data behind the "By Sportsbook" line-movement chart.
// Every run we pull moneyline odds for each sport ONCE (cheap: regions×markets credits per
// sport, not per game), match each provider game to our events row by team name, and append
// one odds_history snapshot PER BOOK per side. Over time these rows become each book's line
// over time — exactly what the chart plots.
//
// Credit budget: 4 sports × (h2h market) × (us+us2+eu regions) = ~12 credits/run (~11k/mo,
// under the 20k plan). us+us2 = all US retail books (ESPN BET, Hard Rock…); eu is ONLY for
// PINNACLE (the sharp reference line in the chart) — the other euro books are filtered out of
// the display. At every 30 min
// across game hours that's ~6–7k/month, inside the 20k plan.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getProvider } from './_lib/oddsProviders/index.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { creditFloorBlocked, recordCredits, getKnownCredits } from './_lib/creditGuard.js'

export const config = { maxDuration: 30 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const WINDOW_MS = 6 * 60 * 60 * 1000   // only capture games starting within the next 6h

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  const supabase = db()

  // Hard credit floor — never capture when the known balance is below the shared floor.
  if (await creditFloorBlocked(supabase)) {
    const { remaining } = await getKnownCredits(supabase)
    return res.status(200).json({ skipped: 'low credits', remaining })
  }

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const tilIso = new Date(nowMs + WINDOW_MS).toISOString()
  const capturedAt = nowIso

  // upcoming events in the window, grouped by sport
  const { data: events, error } = await supabase
    .from('events')
    .select('external_event_id, sport, away_team, home_team, start_time')
    .gte('start_time', nowIso)
    .lte('start_time', tilIso)
  if (error) return res.status(500).json({ error: error.message })
  if (!events?.length) return res.status(200).json({ captured: 0, reason: 'no upcoming games in window' })

  const bySport = {}
  for (const e of events) { (bySport[e.sport] ??= []).push(e) }

  const provider = getProvider()
  const snapshots = []
  let creditsRemaining = null
  const errors = []          // paid-fetch failures, surfaced so the run can't fail silently
  let sportsOk = 0

  for (const [sport, evs] of Object.entries(bySport)) {
    if (!SPORT_KEYS[sport]) continue
    let games
    try {
      const r = await provider.fetchOdds({ sport, markets: ['h2h'], regions: ['us', 'us2', 'eu'] })
      games = r.games; creditsRemaining = r.credits?.remaining ?? creditsRemaining; sportsOk++
      await recordCredits(supabase, r.credits?.remaining)
    } catch (e) { console.warn(`capture ${sport} failed:`, e.message); errors.push({ sport, error: e.message }); continue }

    for (const ev of evs) {
      const g = games.find(x => lastWord(x.home_team) === lastWord(ev.home_team) && lastWord(x.away_team) === lastWord(ev.away_team))
      if (!g) continue
      for (const b of g.bookmakers || []) {
        const m = (b.markets || []).find(x => x.key === 'h2h')
        if (!m) continue
        for (const o of m.outcomes || []) {
          const side = lastWord(o.name) === lastWord(ev.away_team) ? 'away' : lastWord(o.name) === lastWord(ev.home_team) ? 'home' : null
          if (!side || o.price == null) continue
          snapshots.push({ external_event_id: ev.external_event_id, provider: 'oddsapi', sport, captured_at: capturedAt, market: 'ml', side, value: o.price, book: b.key })
        }
      }
    }
  }

  if (snapshots.length) {
    const { error: insErr } = await supabase.from('odds_history').insert(snapshots)
    if (insErr) return res.status(500).json({ error: insErr.message, attempted: snapshots.length })
  }

  const LOW_CREDIT = 500
  const lowCredit = creditsRemaining != null && creditsRemaining < LOW_CREDIT
  if (lowCredit) console.warn(`[cron-capture-book-odds] LOW CREDITS: ${creditsRemaining} remaining`)

  // FAIL LOUDLY: a non-empty slate that captured nothing because every paid fetch errored
  // (bad ODDS_API_KEY / no credits / provider down) must NOT return 200 — that silent
  // captured:0 is exactly how this rotted 4 days unnoticed. A benign "no book matched" zero
  // (sportsOk > 0, no errors) still returns 200.
  if (snapshots.length === 0 && errors.length > 0 && sportsOk === 0) {
    console.error('[cron-capture-book-odds] ALL paid fetches failed:', JSON.stringify(errors))
    return res.status(502).json({ captured: 0, sportsAttempted: Object.keys(bySport).length, sportsOk, errors, creditsRemaining, lowCredit, alert: 'odds capture failed for all sports — check ODDS_API_KEY / credits' })
  }

  return res.status(200).json({ captured: snapshots.length, games: events.length, sportsOk, errors: errors.length ? errors : undefined, creditsRemaining, lowCredit })
}
