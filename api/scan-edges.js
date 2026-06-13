// On-demand +EV Bot scan. The bot card calls this ("RUN SCAN") for a sport; we fetch
// multi-book odds through the swappable provider, run the quality filter, and return the
// ranked credible edges. Auth-gated on purpose — each scan spends API credits (500/mo
// free tier), so only logged-in operators can trigger one.
import { requireAuth } from './_lib/auth.js'
import { fetchEdges } from './_lib/edges.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'

export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  if (!SPORT_KEYS[sport]) {
    return res.status(400).json({ error: `unsupported sport "${sport}"`, supported: Object.keys(SPORT_KEYS) })
  }

  res.setHeader('Cache-Control', 'no-store')
  try {
    const { edges, credits, gameCount, provider } = await fetchEdges({ sport })
    return res.status(200).json({
      sport,
      provider,
      gameCount,
      creditsRemaining: credits.remaining,
      edges,                          // [] is a valid, honest answer — "NO VALID MATRIX"
      scannedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('scan-edges failed:', e.message)
    return res.status(502).json({ error: 'scan failed', detail: e.message })
  }
}
