// NBA game-total + moneyline lean (SHADOW, 'nba-total-shadow-v0') — SESSION-AUTHORED model.
// NOT one of the owner's recovered MODELS.md formulas: the MODELS.md NBA engine is PROPS-ONLY
// (src/lib/models/nbaProps.js). This is a new game model authored in-session on exactly the
// same honest-input pattern as src/lib/wnbaTotal.js (itself the nhlTotal pattern), snapshotted
// through the existing lean pipeline and graded sport-agnostically by cron-grade-leans.
//
//   proj = away expected points + home expected points
//   side = own scoredAvg × oppDefAdj × restAdj
//
// Works for BOTH 'NBA' and 'NBASL' (Summer League) events: the model takes plain scoring
// averages, and the caller queries finals by the event's OWN sport value, so Summer League
// games are scored against Summer League history and never mixed with the regular season.
//
// HONEST-NULL, all-or-nothing: any underivable input → null.
//
// Input derivations:
//   scoredAvg     the team's points-for per game from OUR OWN synced final events —
//                 mean over its last ≤15 finals, ≥5 required (api/_lib/teamScoring.js,
//                 pure + tested). Real synced data, never a fabricated feed.
//   oppDefAdj     clamp(oppConcededAvg / LEAGUE_REF_POINTS, 0.85..1.15).
//                 LEAGUE_REF_POINTS = 114 (documented reference: modern NBA league scoring
//                 average, points per team per game — an NBA game totals ≈ 228).
//   restAdj       from rest days (synced events slate): back-to-back (≤1 day) → 0.96,
//                 else 1. Missing rest days → null (no fabricated schedule). The NBA b2b
//                 damp is slightly heavier than the WNBA's 0.97: NBA teams play b2bs far
//                 more often and on longer travel legs.
export const NBA_TOTAL_MODEL_VERSION = 'nba-total-shadow-v0'
export const LEAGUE_REF_POINTS = 114  // league-average points per team per game (reference scale)
// Emit only at |proj − line| ≥ 6 points. NBA totals sit near 228 — roughly 1.4× a WNBA total
// (~165) and materially noisier game to game — so the WNBA's 4-point band would fire on pure
// noise here. 6 points is the documented NBA equivalent of that band.
export const EDGE_MIN_POINTS = 6
// SESSION-AUTHORED const: NBA final-score margin standard deviation ≈ 13.5 points (typical
// spread of home−away margins around expectation in modern NBA seasons). Used only to map the
// projected margin onto a win probability via a normal CDF.
export const NBA_MARGIN_SD = 13.5
// Matches the snapshot-lean ml gate (buildLeanRows requires ml_win_prob ≥ 0.55):
// below it the model has no call — honest null, nothing snapshotted.
export const ML_MIN_WIN_PROB = 0.55

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const fin = (n) => Number.isFinite(n)
const round2 = (n) => Math.round(n * 100) / 100

// Standard normal CDF Φ(z) via the Abramowitz–Stegun 7.1.26 erf approximation
// (|error| < 1.5e-7 — far tighter than the model's own precision).
export function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 0.5 * (1 + (z < 0 ? -erf : erf))
}

// Opponent-defense multiplier from real conceded averages. null unless finite.
export function oppDefAdj(oppConcededAvg) {
  if (!fin(oppConcededAvg)) return null
  return clamp(oppConcededAvg / LEAGUE_REF_POINTS, 0.85, 1.15)
}

// Back-to-back damp. null unless rest days are known (never assume a rested team).
export function restAdj(restDays) {
  if (!fin(restDays)) return null
  return restDays <= 1 ? 0.96 : 1
}

// One side's expected points. null on any missing input.
export function sidePoints({ scoredAvg, oppConcededAvg, restDays }) {
  const def = oppDefAdj(oppConcededAvg)
  const rest = restAdj(restDays)
  if (!fin(scoredAvg) || def == null || rest == null) return null
  return scoredAvg * def * rest
}

// The SHADOW moneyline lean — pure arithmetic on the SAME per-side projections nbaTotal
// already computes (owner's standard: every model = moneyline + over/under + props where
// relevant; no new data sources). winProb = Φ(projectedMargin / NBA_MARGIN_SD).
// Emits { pick, winProb, projHome, projAway, modelVersion } only when winProb ≥ 0.55
// (the snapshot ml gate) — below it the model has no call. All-or-nothing null on any
// missing input, same as nbaTotal. Takes the same input object (oddsTotal unused: a side
// call needs no market line).
export function nbaSide({ homeScoredAvg, homeConcededAvg, awayScoredAvg, awayConcededAvg,
  restDaysHome, restDaysAway } = {}) {
  const projHome = sidePoints({ scoredAvg: homeScoredAvg, oppConcededAvg: awayConcededAvg, restDays: restDaysHome })
  const projAway = sidePoints({ scoredAvg: awayScoredAvg, oppConcededAvg: homeConcededAvg, restDays: restDaysAway })
  if (projHome == null || projAway == null) return null
  const pHome = normCdf((projHome - projAway) / NBA_MARGIN_SD)
  const pick = pHome >= 0.5 ? 'HOME' : 'AWAY'
  const winProb = pick === 'HOME' ? pHome : 1 - pHome
  if (winProb < ML_MIN_WIN_PROB) return null // no confident call — honest silence
  return { pick, winProb: Math.round(winProb * 10000) / 10000, projHome: round2(projHome), projAway: round2(projAway), modelVersion: NBA_TOTAL_MODEL_VERSION }
}

// The SHADOW total lean. Emits { lean, proj, edgePoints, confidence, strong, modelVersion }
// only when odds_total is present AND |proj − odds_total| ≥ EDGE_MIN_POINTS; else null.
// Confidence 1–3: |edge| ≥6 → 1, ≥9 → 2, ≥12 → 3. strong at |edge| ≥ 11.
export function nbaTotal({ homeScoredAvg, homeConcededAvg, awayScoredAvg, awayConcededAvg,
  restDaysHome, restDaysAway, oddsTotal } = {}) {
  if (!fin(oddsTotal)) return null
  const homePts = sidePoints({ scoredAvg: homeScoredAvg, oppConcededAvg: awayConcededAvg, restDays: restDaysHome })
  const awayPts = sidePoints({ scoredAvg: awayScoredAvg, oppConcededAvg: homeConcededAvg, restDays: restDaysAway })
  if (homePts == null || awayPts == null) return null
  const proj = round2(awayPts + homePts)
  const edgePoints = round2(proj - oddsTotal)
  const mag = Math.abs(edgePoints)
  if (mag < EDGE_MIN_POINTS) return null // inside the noise band — honest silence
  return {
    lean: edgePoints > 0 ? 'OVER' : 'UNDER',
    proj, edgePoints,
    confidence: mag >= 12 ? 3 : mag >= 9 ? 2 : 1,
    strong: mag >= 11,
    modelVersion: NBA_TOTAL_MODEL_VERSION,
  }
}
