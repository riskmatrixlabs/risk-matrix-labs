// End-to-end edge fetch: provider (swappable) → quality filter → ranked credible edges.
// This is what a cron / API route calls. Keeps the credit-spend explicit via `credits`.
import { getProvider } from './oddsProviders/index.js'
import { scanEdges } from '../../src/lib/edgeFilter.js'

// Fetch one sport's odds and return only the credible, ranked +EV edges (h2h for v1).
// nowMs is injectable for testing; defaults to wall-clock at call time.
export async function fetchEdges({ sport, regions = ['us', 'eu'], market = 'h2h', nowMs = Date.now(), filterOpts = {} }) {
  const provider = getProvider()
  const { games, credits } = await provider.fetchOdds({ sport, markets: [market], regions })
  const edges = scanEdges(games, market, nowMs, filterOpts)
  return { edges, credits, gameCount: games.length, provider: provider.NAME }
}
