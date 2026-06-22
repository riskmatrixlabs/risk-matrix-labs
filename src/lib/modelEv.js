// Separate model-adjusted EV ("M-EV") for MLB TOTAL bets with a model edge.
// ADDITIVE only — the market-honest headline EV (gradeBet.evPct) is untouched.
//
// Builds a base win-prob from the matched event's total juice (de-vig), nudges it by
// the O/U model's edge (via modelProbForBet), then converts to EV at the bet's own price.
import { modelProbForBet } from './evBrainFeeds.js'
import { parseTotal } from './statProgress.js'

/**
 * modelEvPct({ pick, americanOdds, overJuice, underJuice, modelEdgeRuns }) → number | null
 *
 * @param {string} pick           - total pick title, e.g. "PIT@COL Over 11.5"
 * @param {number} americanOdds   - American odds the bet was taken at
 * @param {number} overJuice      - event total over juice (American)
 * @param {number} underJuice     - event total under juice (American)
 * @param {number} modelEdgeRuns  - model run-delta (positive = OVER lean, negative = UNDER)
 * @returns {number|null} EV percent, or null when not a gradeable total / inputs missing
 */
export function modelEvPct({ pick, americanOdds, overJuice, underJuice, modelEdgeRuns } = {}) {
  const t = parseTotal(pick)
  if (!t) return null
  const ovr = Number(overJuice)
  const und = Number(underJuice)
  if (!Number.isFinite(ovr) || !Number.isFinite(und)) return null
  if (modelEdgeRuns == null || !Number.isFinite(Number(modelEdgeRuns))) return null

  const betSide = t.dir === 'over' ? 'OVER' : 'UNDER'
  const p = modelProbForBet({
    consensus: { oddsA: ovr, oddsB: und, sideA: betSide === 'OVER' },
    modelEdgeRuns: Number(modelEdgeRuns),
    betSide,
  })
  if (p == null || !Number.isFinite(Number(americanOdds))) return null

  const a = Number(americanOdds)
  const dec = a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
  return (p * dec - 1) * 100
}
