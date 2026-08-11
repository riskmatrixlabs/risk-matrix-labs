// WNBA game-total lean (SHADOW, 'wnba-total-shadow-v0') — SESSION-AUTHORED model.
// NOT one of the owner's recovered MODELS.md formulas: the WNBA MODELS.md engine is
// props-only (src/lib/models/wnbaProps.js). This is a new totals model authored in-session
// on the same honest-input pattern as nhlTotal.js, snapshotted through the existing
// total-market lean pipeline and graded sport-agnostically by cron-grade-leans.
//
//   proj = away expected points + home expected points
//   side = own scoredAvg × oppDefAdj × restAdj
//
// HONEST-NULL, all-or-nothing: any underivable input → null.
//
// Input derivations:
//   scoredAvg     the team's points-for per game from OUR OWN synced final events —
//                 mean over its last ≤15 finals, ≥5 required (api/_lib/teamScoring.js,
//                 pure + tested). Real synced data, never a fabricated feed.
//   oppDefAdj     clamp(oppConcededAvg / LEAGUE_REF_POINTS, 0.85..1.15).
//                 LEAGUE_REF_POINTS = 81 (documented reference: 2026-season WNBA league
//                 scoring average, points per team per game).
//   restAdj       from rest days (synced events slate): back-to-back (≤1 day) → 0.97,
//                 else 1. Missing rest days → null (no fabricated schedule).
export const WNBA_TOTAL_MODEL_VERSION = 'wnba-total-shadow-v0'
export const LEAGUE_REF_POINTS = 81   // league-average points per team per game (reference scale)
export const EDGE_MIN_POINTS = 4      // emit only when |proj − line| ≥ 4 points

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const fin = (n) => Number.isFinite(n)
const round2 = (n) => Math.round(n * 100) / 100

// Opponent-defense multiplier from real conceded averages. null unless finite.
export function oppDefAdj(oppConcededAvg) {
  if (!fin(oppConcededAvg)) return null
  return clamp(oppConcededAvg / LEAGUE_REF_POINTS, 0.85, 1.15)
}

// Back-to-back damp. null unless rest days are known (never assume a rested team).
export function restAdj(restDays) {
  if (!fin(restDays)) return null
  return restDays <= 1 ? 0.97 : 1
}

// One side's expected points. null on any missing input.
export function sidePoints({ scoredAvg, oppConcededAvg, restDays }) {
  const def = oppDefAdj(oppConcededAvg)
  const rest = restAdj(restDays)
  if (!fin(scoredAvg) || def == null || rest == null) return null
  return scoredAvg * def * rest
}

// The SHADOW total lean. Emits { lean, proj, edgePoints, confidence, strong, modelVersion }
// only when odds_total is present AND |proj − odds_total| ≥ EDGE_MIN_POINTS; else null.
// Confidence 1–3: |edge| ≥4 → 1, ≥6.5 → 2, ≥9 → 3. strong at |edge| ≥ 8.
export function wnbaTotal({ homeScoredAvg, homeConcededAvg, awayScoredAvg, awayConcededAvg,
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
    confidence: mag >= 9 ? 3 : mag >= 6.5 ? 2 : 1,
    strong: mag >= 8,
    modelVersion: WNBA_TOTAL_MODEL_VERSION,
  }
}
