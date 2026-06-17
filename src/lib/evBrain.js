// ── EV Brain — the universal bet-quality & discipline grader (Phase 1: pure core) ──
//
// Sits ON TOP of the sport models (the "scout") and answers one question per bet:
// "Is this worth risking money on?" → a brand-safe verdict (Prime / Strong / Lean / Pass)
// plus an operator-discipline rating. Every function here is PURE and deterministic so it
// can be unit-tested and reused on the dashboard, in Spotlight ranking, and on bet cards.
//
// Spec: memory `rml-evbrain-spec` (owner, 2026-06-15). Decisions locked for Phase 1:
//  • ModelProb source = de-vig consensus fair prob (wired in Phase 2; passed in here).
//  • Brand rule kills the word "play" → verdicts use Prime/Strong/Lean/Pass.
//  • This file's "PHLT" = the universal grader (Player/Price/Probability/Line/Tempo).
//    The MLB hitter model keeps its own name (src/lib/phlt.js) — no UI collision here.

import { americanToImplied, americanToDecimal } from './devig.js'

// All weight sets live here so they're auditable in one place (every set sums to 1).
export const WEIGHTS = {
  phlt:       { marketQuality: 0.20, opportunity: 0.20, matchupEdge: 0.15, gameEnvironment: 0.15, lineValue: 0.15, disciplineFit: 0.15 },
  discipline: { betSizeControl: 0.30, noChase: 0.25, ticketStructure: 0.20, marketSelection: 0.15, emotionalState: 0.10 },
  operator:   { discipline: 0.35, clv: 0.25, bankrollGrowth: 0.20, ticketStructure: 0.10, riskControl: 0.10 },
  ladder:     { phlt: 0.35, ev: 0.25, lineSafety: 0.20, bankrollFit: 0.10, emotionalControl: 0.10 },
  roundRobin: { avgLegScore: 0.30, legIndependence: 0.25, payoutEfficiency: 0.20, correlationSafety: 0.15, bankrollFit: 0.10 },
  final:      { phlt: 0.30, ev: 0.25, clvProj: 0.15, ladderRRFit: 0.15, discipline: 0.15 },
}

// Discipline penalties (subtracted from the weighted base, then clamped ≥0).
export const DISCIPLINE_PENALTIES = {
  liveChase: 20, forcedParlay: 15, lateBoredom: 10, sizeJumpAfterWin: 15,
  tilt: 20, tooManyLegs: 10, sameGameOverstack: 10,
}

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const isNum = (n) => typeof n === 'number' && Number.isFinite(n)

// ── Generic weighted combiner ──
// Takes [[value, weight], …]. Null/undefined values drop out and the remaining
// weights renormalize, so a partially-known bet still grades on what we do know.
export function weightedScore(parts) {
  let acc = 0, wsum = 0
  for (const [value, weight] of parts) {
    if (!isNum(value) || !isNum(weight)) continue
    acc += value * weight
    wsum += weight
  }
  if (wsum === 0) return null
  return acc / wsum
}

// Combine a components object against a named WEIGHTS set.
function weightedFrom(components, weightSet) {
  const parts = Object.entries(weightSet).map(([k, w]) => [components?.[k], w])
  return weightedScore(parts)
}

// ── EV ──
// modelProb in [0,1], americanOdds e.g. -110 / +120. Stake-normalized to 100 units.
export function evScore(modelProb, americanOdds, stake = 100) {
  if (!isNum(modelProb) || !isNum(americanOdds)) return null
  const implied = americanToImplied(americanOdds)
  const edge = modelProb - implied
  const profit = americanOdds > 0 ? (americanOdds / 100) * stake : (100 / Math.abs(americanOdds)) * stake
  const evDollars = modelProb * profit - (1 - modelProb) * stake
  const evPct = (evDollars / stake) * 100
  // Tiered score per spec; below +1% is a pass (graded sub-50 by how negative it is).
  let score
  if (evPct >= 8) score = 100
  else if (evPct >= 5) score = 85
  else if (evPct >= 3) score = 70
  else if (evPct >= 1) score = 55
  else score = clamp(48 + evPct * 4) // <1%: glide down through 0 so −EV reads clearly sub-pass
  return { implied, edge, evPct, score, isPass: evPct < 1 }
}

// ── CLV — entry price vs closing price (did you beat the close?) ──
export function clvScore(entryAmerican, closeAmerican) {
  if (!isNum(entryAmerican) || !isNum(closeAmerican)) return null
  const entryDec = americanToDecimal(entryAmerican)
  const closeDec = americanToDecimal(closeAmerican)
  if (!isNum(entryDec) || !isNum(closeDec) || closeDec <= 0) return null
  const beatPct = (entryDec / closeDec - 1) * 100 // >0 = you got a better price than it closed
  if (beatPct >= 2) return clamp(90 + Math.min(beatPct - 2, 10))   // strong beat → 90–100
  if (beatPct >= 0.25) return clamp(70 + (beatPct / 2) * 19 / 1)   // small beat → 70–89
  if (beatPct > -0.25) return 60                                    // flat → middle of 50–69
  return clamp(50 + beatPct * 6)                                    // moved against → <50
}

// ── PHLT (universal bet grade) ──
export function phltScore(components) {
  return weightedFrom(components, WEIGHTS.phlt)
}

// ── Discipline (operator behavior on THIS ticket) ──
export function disciplineScore(components, penaltyKeys = []) {
  const base = weightedFrom(components, WEIGHTS.discipline)
  if (base == null) return null
  const penalty = penaltyKeys.reduce((sum, k) => sum + (DISCIPLINE_PENALTIES[k] || 0), 0)
  return clamp(base - penalty)
}

// ── Operator rating (the person, across tickets) ──
export function operatorRating(components) {
  return weightedFrom(components, WEIGHTS.operator)
}

// ── Structure fit ──
export function ladderScore(components) {
  return weightedFrom(components, WEIGHTS.ladder)
}
export function roundRobinScore(components) {
  return weightedFrom(components, WEIGHTS.roundRobin)
}

// ── Label tiers ──────────────────────────────────────────────────────────────
const VERDICTS = [
  { min: 85, key: 'PRIME',  label: 'Prime',  tone: 'neon'   },
  { min: 75, key: 'STRONG', label: 'Strong', tone: 'green'  },
  { min: 65, key: 'LEAN',   label: 'Lean',   tone: 'amber'  },
  { min: -Infinity, key: 'PASS', label: 'Pass', tone: 'muted' },
]
export function verdictFor(score) {
  return VERDICTS.find(v => score >= v.min)
}

export function phltGradeFor(score) {
  if (score >= 90) return 'Elite'
  if (score >= 80) return 'Strong'
  if (score >= 70) return 'Lean'
  if (score >= 60) return 'Watch'
  return 'Pass'
}

export function operatorLabelFor(score) {
  if (score >= 90) return 'Sharp'
  if (score >= 80) return 'Clean'
  if (score >= 70) return 'Developing'
  if (score >= 60) return 'Risky'
  return 'Degen Mode'
}

// ── Final bet score + verdict ──
export function finalBetScore({ phlt, ev, clvProj, ladderRRFit, discipline }) {
  const score = weightedFrom({ phlt, ev, clvProj, ladderRRFit, discipline }, WEIGHTS.final)
  if (score == null) return null
  return { score, verdict: verdictFor(score) }
}

// ── Top-level: grade a bet from raw inputs + sub-component objects ──
// Phase 2 will feed modelProb from de-vig consensus and the component objects from
// live model + bet-log behavior. Here it's a pure composition of the functions above.
export function gradeBetQuality(input = {}) {
  const {
    modelProb, americanOdds, entryAmerican, closeAmerican,
    phlt: phltComponents, discipline: disciplineComponents,
    disciplinePenalties = [], ladderRRFit = null,
  } = input

  const ev = evScore(modelProb, americanOdds)
  const clv = clvScore(entryAmerican, closeAmerican)
  const phlt = phltScore(phltComponents || {})
  const discipline = disciplineScore(disciplineComponents || {}, disciplinePenalties)

  const final = finalBetScore({
    phlt,
    ev: ev?.score ?? null,
    clvProj: clv,
    ladderRRFit,
    discipline,
  })

  return { ev, clv, phlt, discipline, final }
}
