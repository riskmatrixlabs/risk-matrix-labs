// rrQuality — derive the four Round-Robin score inputs HONESTLY from real slip data,
// then score via the canonical roundRobinScore (src/lib/models/qualityScores.js —
// MODELS.md weights, never altered here). Any underivable input → null (no score shown).
//
// Derivations (all on the internal 0–100 scale):
//   legScores          evScoreFromPct(leg.evPct) per leg. Any leg with evPct == null
//                      → null (we never fabricate a leg's quality).
//   independenceScore  (distinctGames / legs.length) × 100 via groupByGame — share of
//                      legs that are structurally independent.
//   correlationPenalty 100 × (legs.length − distinctGames) / legs.length — the
//                      same-game stacking share.
//   exposurePenalty    min(100, (stakePerCombo × totalCombos / bankroll) × 100) —
//                      total ticket outlay as % of bankroll, capped. bankroll ≤ 0 or
//                      non-finite → null (can't measure exposure without a bankroll).

import { roundRobinScore } from './models/qualityScores.js'
import { brandTier } from './models/tiers.js'
import { evScoreFromPct } from './evBrain.js'
import { groupByGame } from './slipModes.js'

export function rrQuality(legs, { stakePerCombo, totalCombos, bankroll } = {}) {
  const list = Array.isArray(legs) ? legs : []
  if (list.length === 0) return null

  // Leg quality — honest-null: every leg must carry a real evPct.
  const legScores = list.map(l => evScoreFromPct(l?.evPct))
  if (!legScores.every(Number.isFinite)) return null

  // Independence / correlation from game identity.
  const distinctGames = groupByGame(list).length
  const independence = (distinctGames / list.length) * 100
  const correlation = (100 * (list.length - distinctGames)) / list.length

  // Exposure — needs a real bankroll and real stake math.
  if (!Number.isFinite(bankroll) || bankroll <= 0) return null
  if (!Number.isFinite(stakePerCombo) || !Number.isFinite(totalCombos)) return null
  const exposure = Math.min(100, ((stakePerCombo * totalCombos) / bankroll) * 100)

  const score = roundRobinScore({
    legScores,
    independenceScore: independence,
    correlationPenalty: correlation,
    exposurePenalty: exposure,
  })
  if (score == null) return null

  return { score, tier: brandTier(score), legScores, independence, correlation, exposure }
}
