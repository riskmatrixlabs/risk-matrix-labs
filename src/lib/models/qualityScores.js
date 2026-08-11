// Ladder + Round Robin quality scores — the "is this structure worth it" layer.
// CONFIRMED ORIGINAL (MODELS.md §Ladder Engine / §Round Robin Engine) — do not alter weights.
//
//   Ladder Score = PHLT×35% + EV×25% + Line Safety×15% + Bankroll Fit×15% + Discipline×10%
//   RR Score     = mean(leg scores)×0.70 + Independence×0.20 − Correlation×0.05 − Exposure×0.05
//
// All inputs are on the same internal 0–100 scale. Any non-finite input (or an
// empty leg list) → null, never NaN into the UI. Results rounded to 2dp like the source.

const round2 = (x) => Math.round(x * 100) / 100

// Ladder quality score. Weights CONFIRMED 35/25/15/15/10 — never alter.
export function ladderScore({ phlt, ev, lineSafety, bankrollFit, discipline } = {}) {
  const parts = [phlt, ev, lineSafety, bankrollFit, discipline]
  if (!parts.every(Number.isFinite)) return null
  return round2(phlt * 0.35 + ev * 0.25 + lineSafety * 0.15 + bankrollFit * 0.15 + discipline * 0.10)
}

// Round-robin quality score. Formula CONFIRMED — never alter.
export function roundRobinScore({ legScores, independenceScore, correlationPenalty, exposurePenalty } = {}) {
  if (!Array.isArray(legScores) || legScores.length === 0) return null
  if (!legScores.every(Number.isFinite)) return null
  if (![independenceScore, correlationPenalty, exposurePenalty].every(Number.isFinite)) return null
  const base = legScores.reduce((a, b) => a + b, 0) / legScores.length
  return round2(base * 0.70 + independenceScore * 0.20 - correlationPenalty * 0.05 - exposurePenalty * 0.05)
}
