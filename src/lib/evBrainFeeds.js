import { devigTwoWay, americanToImplied } from './devig.js'
import { disciplineScore, operatorRating, operatorLabelFor, DISCIPLINE_PENALTIES } from './evBrain.js'

// devigTwoWay returns { fairA, fairB, fairAmericanA, fairAmericanB, holdPct }
// americanToImplied returns 0..1 fraction

const clampP = (p) => Math.max(0.01, Math.min(0.99, p))

// Per run of model edge; capped at ±3 runs → ±0.09
const EDGE_TO_PROB = 0.03

/**
 * modelProbForBet({ americanOdds, consensus, modelEdgeRuns, betSide }) → fair win prob (0..1) or null.
 *
 * Baseline = de-vig consensus fair prob for the side bet (consensus.sideA picks which side).
 * Falls back to vig-inclusive implied from americanOdds if no consensus.
 * If the MLB O/U model supplies edgeRuns and the bet is OVER/UNDER, nudge the prob
 * toward the side the model agrees with (capped). Coefficient is a hypothesis tuned
 * by the graded record.
 *
 * @param {object} opts
 * @param {number|null} opts.americanOdds  - American odds for this side (e.g. -110)
 * @param {object|null} opts.consensus     - { oddsA, oddsB, sideA } two-way market
 * @param {number|null} opts.modelEdgeRuns - positive = model leans OVER, negative = UNDER
 * @param {'OVER'|'UNDER'|null} opts.betSide
 * @returns {number|null}
 */
export function modelProbForBet({ americanOdds, consensus, modelEdgeRuns = null, betSide = null } = {}) {
  let base = null

  if (consensus && Number.isFinite(consensus.oddsA) && Number.isFinite(consensus.oddsB)) {
    const fair = devigTwoWay(consensus.oddsA, consensus.oddsB)
    if (fair) {
      base = consensus.sideA ? fair.fairA : fair.fairB
    }
  }

  if (base == null && Number.isFinite(americanOdds)) {
    base = americanToImplied(americanOdds)
  }

  if (base == null || !Number.isFinite(base)) return null

  if (Number.isFinite(modelEdgeRuns) && (betSide === 'OVER' || betSide === 'UNDER')) {
    const agree = betSide === 'OVER' ? modelEdgeRuns > 0 : modelEdgeRuns < 0
    const mag = Math.min(Math.abs(modelEdgeRuns), 3) * EDGE_TO_PROB
    base += agree ? mag : -mag
  }

  return clampP(base)
}

/**
 * clvForBet({ market, side }, snapshots) → closing price (number) or null.
 *
 * Given an array of odds snapshots ({ market, side, price, captured_at }),
 * returns the price from the latest snapshot matching the bet's market+side
 * (case-insensitive). Missing captured_at is treated as the oldest possible
 * so a lone snapshot still returns its price.
 *
 * @param {{ market: string, side: string }|null} bet
 * @param {Array<{ market: string, side: string, price: number, captured_at?: string }>} snapshots
 * @returns {number|null}
 */
/**
 * disciplineFromBetLog(bets, { unit }) → { score, penalties }
 *
 * Detects clear discipline violations from a bet sequence and returns a
 * disciplineScore (via evBrain.disciplineScore) and the penalty keys fired.
 *
 * Penalty keys from DISCIPLINE_PENALTIES used here:
 *   - 'liveChase'         → big stake right after a loss (≥ 2.5× unit AND next bet after L)
 *   - 'sizeJumpAfterWin'  → reused to mean oversized bet generally (≥ 3× unit, no chase)
 *   - 'tooManyLegs'       → parlay with ≥ 5 legs
 *
 * For the discipline base score, we derive what we can from the log:
 *   betSizeControl   — 100 when all bets ≤ 1.5× unit, scales down for oversized bets
 *   noChase          — 100 when no post-loss size jump, 0 when detected
 *   ticketStructure  — 100 when no long parlays, scales by parlay/straight ratio
 * Missing components (marketSelection, emotionalState) are omitted so weightedScore
 * renormalizes over the three we can derive.
 *
 * @param {Array<{stake:number, result:string|null, updated_at:string, date:string, legs:Array|null}>} bets
 * @param {{ unit: number }} opts
 * @returns {{ score: number, penalties: string[] }}
 */
export function disciplineFromBetLog(bets, { unit } = {}) {
  if (!Array.isArray(bets) || bets.length === 0 || !unit || unit <= 0) {
    return { score: 100, penalties: [] }
  }

  // Sort chronologically. The bets table has no `created_at` — it uses `updated_at` (timestamptz) and
  // `date` (text day); fall back to `created_at` only so test fixtures using it still order correctly.
  const betTime = (b) => b.updated_at || b.date || b.created_at || ''
  const sorted = [...bets].sort((a, b) => {
    const ta = betTime(a), tb = betTime(b)
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  const penalties = []

  // --- Detect violations ---
  let chaseDetected = false
  let oversizeDetected = false
  let longParlayDetected = false

  for (let i = 0; i < sorted.length; i++) {
    const bet = sorted[i]
    const stake = Number(bet.stake) || 0
    const legCount = Array.isArray(bet.legs) ? bet.legs.length : 0

    // Over-long parlay
    if (legCount >= 5) longParlayDetected = true

    // Chase: this bet is ≥ 2.5× unit and the immediately preceding bet was a loss
    if (!chaseDetected && stake >= unit * 2.5 && i > 0) {
      const prev = sorted[i - 1]
      if (prev.result === 'L') chaseDetected = true
    }

    // Oversized (not already flagged as chase)
    if (!oversizeDetected && stake >= unit * 3) oversizeDetected = true
  }

  if (chaseDetected) penalties.push('liveChase')
  // Only flag oversize if it wasn't already flagged as a chase (avoid double-dipping on the same event)
  if (oversizeDetected && !chaseDetected) penalties.push('sizeJumpAfterWin')
  if (longParlayDetected) penalties.push('tooManyLegs')

  // --- Build discipline components from the log ---
  const maxStake = Math.max(...sorted.map((b) => Number(b.stake) || 0))

  // betSizeControl: 100 if max ≤ 1.5× unit, slides to 0 at 4× unit
  const sizeRatio = maxStake / unit
  const betSizeControl = sizeRatio <= 1.5 ? 100 : Math.max(0, 100 - (sizeRatio - 1.5) * 28)

  // noChase: 100 when clean, 0 when a chase was detected
  const noChase = chaseDetected ? 0 : 100

  // ticketStructure: 100 for all straights, lower with parlays, penalize long ones
  const parlayCount = sorted.filter((b) => Array.isArray(b.legs) && b.legs.length > 0).length
  const parlayRatio = parlayCount / sorted.length
  const ticketStructure = longParlayDetected ? 40 : Math.max(0, 100 - parlayRatio * 50)

  // Pass only components we can derive; marketSelection + emotionalState omitted
  // so weightedScore renormalizes over the three present
  const components = { betSizeControl, noChase, ticketStructure }
  const score = disciplineScore(components, penalties) ?? 100

  return { score, penalties }
}

/**
 * operatorFromBetLog(bets, { unit }) → { score, label }
 *
 * Builds an operatorRating from what can be derived from the bet log.
 * Component keys from WEIGHTS.operator used:
 *   - discipline        → from disciplineFromBetLog above
 *   - bankrollGrowth    → net units from settled bets, normalized to 0–100
 *   - ticketStructure   → parlay vs straight mix (same as discipline component)
 *   - riskControl       → inverse of oversized-bet frequency
 *   clv is omitted (not in the log) so weightedScore renormalizes over the 4 present.
 *
 * @param {Array<{stake:number, result:string|null, updated_at:string, date:string, legs:Array|null}>} bets
 * @param {{ unit: number }} opts
 * @returns {{ score: number, label: string }}
 */
export function operatorFromBetLog(bets, { unit } = {}) {
  if (!Array.isArray(bets) || bets.length === 0 || !unit || unit <= 0) {
    return { score: 70, label: operatorLabelFor(70) }
  }

  const { score: discScore } = disciplineFromBetLog(bets, { unit })

  // bankrollGrowth: net units from settled bets, normalized 0–100 (0 units = 50, +5 = 100, -5 = 0)
  const settled = bets.filter((b) => b.result === 'W' || b.result === 'L')
  let netUnits = 0
  for (const b of settled) {
    const stake = Number(b.stake) || 0
    netUnits += b.result === 'W' ? stake / unit : -(stake / unit)
  }
  const bankrollGrowth = Math.max(0, Math.min(100, 50 + netUnits * 10))

  // ticketStructure: penalize parlays, reward straights
  const parlayCount = bets.filter((b) => Array.isArray(b.legs) && b.legs.length > 0).length
  const parlayRatio = parlayCount / bets.length
  const longParlays = bets.some((b) => Array.isArray(b.legs) && b.legs.length >= 5)
  const ticketStructure = longParlays ? 40 : Math.max(0, 100 - parlayRatio * 50)

  // riskControl: what fraction of bets are within 2× unit?
  const inBounds = bets.filter((b) => (Number(b.stake) || 0) <= unit * 2).length
  const riskControl = (inBounds / bets.length) * 100

  // clv omitted — not available in the log; weightedScore renormalizes
  const components = { discipline: discScore, bankrollGrowth, ticketStructure, riskControl }
  const raw = operatorRating(components)
  const score = raw != null ? Math.max(0, Math.min(100, raw)) : 70

  return { score, label: operatorLabelFor(score) }
}

export function clvForBet(bet, snapshots) {
  if (!bet || !Array.isArray(snapshots) || snapshots.length === 0) return null
  const m = String(bet.market).toLowerCase()
  const s = String(bet.side).toLowerCase()
  const matches = snapshots.filter(
    (snap) =>
      String(snap.market).toLowerCase() === m &&
      String(snap.side).toLowerCase() === s
  )
  if (matches.length === 0) return null
  matches.sort((a, b) => {
    const ta = a.captured_at || ''
    const tb = b.captured_at || ''
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })
  return matches[matches.length - 1].price
}
