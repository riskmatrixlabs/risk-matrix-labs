// On-demand +EV Bot scan. The bot card calls this ("RUN SCAN") for a sport; we fetch
// multi-book odds through the swappable provider, run the quality filter, and return the
// ranked credible edges. Auth-gated on purpose — each scan spends API credits (20K/mo paid
// plan; 3 markets × 2 regions = 6 credits/scan), so only logged-in operators can trigger one.
//
// Credit protection (HIGH-severity fix): we wrap the provider call in a server-side cache
// keyed by (sport + today) with a short TTL, and a credit floor. A cache hit returns the
// stored edges WITHOUT calling the provider (0 credits). Below the floor we pause scanning.
// See api/_lib/scanStore.js for the mechanism + why it's Supabase-backed.
import { requireAuth } from './_lib/auth.js'
import { fetchEdges } from './_lib/edges.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import {
  todayStr, readScan, readLatestCredits, writeScan, isFresh, isLowCredit,
} from './_lib/scanStore.js'

export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  if (!SPORT_KEYS[sport]) {
    return res.status(400).json({ error: `unsupported sport "${sport}"`, supported: Object.keys(SPORT_KEYS) })
  }

  res.setHeader('Cache-Control', 'no-store')
  const date = todayStr()

  try {
    // 1) Cache hit → return stored edges, 0 credits spent.
    const cached = await readScan(sport, date)
    if (cached && isFresh(cached.scanned_at)) {
      return res.status(200).json({ ...cached.payload, cached: true })
    }

    // 2) Credit floor → pause before spending. Uses the last-known balance we persisted.
    const lastCredits = cached?.credits_remaining ?? (await readLatestCredits())
    if (isLowCredit(lastCredits)) {
      return res.status(200).json({ error: 'scans paused — low credit', paused: true })
    }

    // 3) Real (paid) scan.
    const { edges, credits, gameCount, provider } = await fetchEdges({ sport })
    const payload = {
      sport,
      provider,
      gameCount,
      creditsRemaining: credits.remaining,
      edges,                          // [] is a valid, honest answer — "NO VALID MATRIX"
      scannedAt: new Date().toISOString(),
      cached: false,
    }
    await writeScan(sport, date, payload, credits.remaining)
    return res.status(200).json(payload)
  } catch (e) {
    console.error('scan-edges failed:', e.message)
    return res.status(502).json({ error: 'scan failed', detail: e.message })
  }
}
