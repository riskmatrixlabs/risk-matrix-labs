// End-to-end edge fetch: provider (swappable) → quality filter → ranked credible edges.
// This is what a cron / API route calls. Keeps the credit-spend explicit via `credits`.
import { getProvider } from './oddsProviders/index.js'
import { scanEdges } from '../../src/lib/edgeFilter.js'

// Fetch one sport's odds and return credible, ranked +EV edges across ALL core markets —
// moneyline, spreads, and totals — so the board is a real EV bot, not ML-only. One
// provider call covers all three (costs regions×markets credits on The Odds API).
// nowMs is injectable for testing; defaults to wall-clock at call time.
export async function fetchEdges({ sport, regions = ['us', 'eu'], markets = ['h2h', 'spreads', 'totals'], nowMs = Date.now(), filterOpts = {} }) {
  const provider = getProvider()
  const { games, credits } = await provider.fetchOdds({ sport, markets, regions })
  const edges = markets
    .flatMap(m => scanEdges(games, m, nowMs, filterOpts))
    .sort((a, b) => b.evPct - a.evPct)
  return { edges, credits, gameCount: games.length, provider: provider.NAME }
}
