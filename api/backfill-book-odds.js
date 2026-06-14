// One-time SEED for the "By Sportsbook" line-movement chart.
// The live cron only logs odds going forward (one snapshot per run), so a freshly-opened
// game's chart is nearly flat. This endpoint backfills the PAST: it walks back in time at a
// fixed step, pulls the historical odds snapshot at each point (10 credits/market/region —
// ONE call covers every game in the sport), matches each game to our events, and appends
// per-book ML rows to odds_history with captured_at = the snapshot's real timestamp.
// Result: open a game and the chart is already full — exactly like the Sharp-app reference.
//
// Manual trigger (guarded to protect credits):
//   /api/backfill-book-odds?confirm=SEED&sport=MLB&hours=12&stepMin=20
// Defaults: MLB, 12h back, 20-min step  → ~36 calls × ~20 credits = ~720 credits.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getProvider } from './_lib/oddsProviders/index.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'

export const config = { maxDuration: 60 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  if ((req.query.confirm || '') !== 'SEED') {
    return res.status(400).json({ error: 'guarded — pass ?confirm=SEED to spend credits on a backfill' })
  }
  const sports = (req.query.sport ? [req.query.sport] : Object.keys(SPORT_KEYS)).filter(s => SPORT_KEYS[s])
  const hours = Math.min(48, Math.max(1, Number(req.query.hours) || 12))
  const stepMin = Math.min(60, Math.max(5, Number(req.query.stepMin) || 20))
  const regions = (req.query.regions || 'us,us2').split(',').map(s => s.trim()).filter(Boolean)
  const markets = (req.query.markets || 'h2h').split(',').map(s => s.trim()).filter(Boolean)  // h2h,spreads,totals
  const MK = { h2h: 'ml', spreads: 'spread', totals: 'total' }

  const supabase = db()
  const nowMs = Date.now()

  // Events we care about: anything starting from (hours ago) to 6h out — covers today's slate.
  const fromIso = new Date(nowMs - hours * 3600e3).toISOString()
  const tilIso = new Date(nowMs + 24 * 3600e3).toISOString()   // include upcoming games (not just <6h)
  const { data: events, error } = await supabase
    .from('events')
    .select('external_event_id, sport, away_team, home_team, start_time')
    .gte('start_time', fromIso).lte('start_time', tilIso)
  if (error) return res.status(500).json({ error: error.message })
  if (!events?.length) return res.status(200).json({ inserted: 0, reason: 'no events in window' })

  const bySport = {}
  for (const e of events) { (bySport[e.sport] ??= []).push(e) }

  const provider = getProvider()
  const snapshots = []
  const steps = Math.floor((hours * 60) / stepMin)
  let calls = 0, creditsRemaining = null
  const errors = []

  for (const sport of sports) {
    const evs = bySport[sport]
    if (!evs?.length) continue
    for (let i = 0; i <= steps; i++) {
      const date = new Date(nowMs - i * stepMin * 60e3).toISOString()
      let snap
      try {
        snap = await provider.fetchHistoricalOdds({ sport, date, markets, regions })
        calls++; creditsRemaining = snap.credits?.remaining ?? creditsRemaining
      } catch (e) { errors.push(`${sport}@${date}: ${e.message}`); continue }

      const capturedAt = snap.snapshotTime
      for (const ev of evs) {
        const g = snap.games.find(x => lastWord(x.home_team) === lastWord(ev.home_team) && lastWord(x.away_team) === lastWord(ev.away_team))
        if (!g) continue
        for (const b of g.bookmakers || []) {
          for (const m of b.markets || []) {
            const mkt = MK[m.key]; if (!mkt) continue
            for (const o of m.outcomes || []) {
              if (o.price == null) continue
              const side = m.key === 'totals'
                ? (/^o/i.test(o.name) ? 'over' : 'under')
                : (lastWord(o.name) === lastWord(ev.away_team) ? 'away' : lastWord(o.name) === lastWord(ev.home_team) ? 'home' : null)
              if (!side) continue
              snapshots.push({ external_event_id: ev.external_event_id, provider: 'oddsapi', sport, captured_at: capturedAt, market: mkt, side, value: o.price, book: b.key })
            }
          }
        }
      }
    }
  }

  // De-dupe within this run (same snapshot can recur if next/prev pointers overlap).
  const seen = new Set()
  const unique = snapshots.filter(s => {
    const k = `${s.external_event_id}|${s.book}|${s.side}|${s.captured_at}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  let inserted = 0
  // Chunk inserts to stay under payload limits.
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500)
    const { error: insErr } = await supabase.from('odds_history').insert(chunk)
    if (insErr) return res.status(500).json({ error: insErr.message, inserted, attempted: unique.length })
    inserted += chunk.length
  }

  return res.status(200).json({ inserted, calls, steps, sports, events: events.length, creditsRemaining, errors: errors.slice(0, 5) })
}
