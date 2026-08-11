// NHL game-total lean (SHADOW, 'nhl-total-shadow-v0') — built ON nhlExpectedGoals
// (src/lib/models/nhlSog.js — CONFIRMED ORIGINAL formula, called verbatim, never altered here):
//   xG = teamXgf × oppDefAdj × goalieAdj × specialTeamsAdj × restAdj
// proj = away xG + home xG, snapshotted through the existing total-market lean pipeline and
// graded sport-agnostically by cron-grade-leans (total path = score-sum vs line).
//
// HONEST-NULL, all-or-nothing: any underivable input → null.
//
// Input derivations:
//   teamXgf          the team's goals-for per game from OUR OWN synced final events —
//                    scoredAvg over its last ≤15 finals, ≥5 required (api/_lib/teamScoring.js,
//                    pure + tested). Real synced data, not a fabricated xG feed.
//   oppDefAdj        clamp(oppConcededAvg / LEAGUE_REF_GOALS, 0.8..1.2). LEAGUE_REF_GOALS = 3.0
//                    (documented reference: modern NHL league scoring ≈ 3 goals/team/game).
//   goalieAdj        1 — NEUTRAL, awaiting data: no starting-goalie source yet. A multiplicative
//                    neutral 1 on an ADJUSTMENT is acceptable because the base signal (real
//                    scored/conceded averages) is real — this is "no adjustment applied", not a
//                    fabricated base input. Replace when a goalie source lands.
//   specialTeamsAdj  1 — same documented neutral (no PP/PK source yet, awaiting data).
//   restAdj          from rest days (synced events slate): back-to-back (≤1 day) → 0.95, else 1.
//                    Missing rest days → null (no fabricated schedule).
import { nhlExpectedGoals } from './models/nhlSog.js'

export const NHL_TOTAL_MODEL_VERSION = 'nhl-total-shadow-v0'
export const LEAGUE_REF_GOALS = 3.0   // league-average goals per team per game (reference scale)
export const GOALIE_ADJ_NEUTRAL = 1   // documented neutral — no goalie source yet (awaiting data)
export const ST_ADJ_NEUTRAL = 1       // documented neutral — no special-teams source yet
export const EDGE_MIN_GOALS = 0.6     // emit only when |proj − line| ≥ 0.6 goals

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const fin = (n) => Number.isFinite(n)
const round2 = (n) => Math.round(n * 100) / 100

// Opponent-defense multiplier from real conceded averages. null unless finite.
export function oppDefAdj(oppConcededAvg) {
  if (!fin(oppConcededAvg)) return null
  return clamp(oppConcededAvg / LEAGUE_REF_GOALS, 0.8, 1.2)
}

// Back-to-back damp. null unless rest days are known (never assume a rested team).
export function restAdj(restDays) {
  if (!fin(restDays)) return null
  return restDays <= 1 ? 0.95 : 1
}

// One side's expected goals via the CONFIRMED engine. null on any missing input.
export function sideXg({ scoredAvg, oppConcededAvg, restDays }) {
  const def = oppDefAdj(oppConcededAvg)
  const rest = restAdj(restDays)
  if (!fin(scoredAvg) || def == null || rest == null) return null
  return nhlExpectedGoals({
    teamXgf: scoredAvg, oppDefAdj: def,
    goalieAdj: GOALIE_ADJ_NEUTRAL, specialTeamsAdj: ST_ADJ_NEUTRAL, restAdj: rest,
  })
}

// The SHADOW total lean. Emits { lean, proj, edgeGoals, confidence, strong, modelVersion }
// only when odds_total is present AND |proj − odds_total| ≥ EDGE_MIN_GOALS; else null.
// Confidence 1–3: |edge| ≥0.6 → 1, ≥1.0 → 2, ≥1.4 → 3. strong at |edge| ≥ 1.2.
export function nhlTotal({ homeScoredAvg, homeConcededAvg, awayScoredAvg, awayConcededAvg,
  restDaysHome, restDaysAway, oddsTotal } = {}) {
  if (!fin(oddsTotal)) return null
  const homeXg = sideXg({ scoredAvg: homeScoredAvg, oppConcededAvg: awayConcededAvg, restDays: restDaysHome })
  const awayXg = sideXg({ scoredAvg: awayScoredAvg, oppConcededAvg: homeConcededAvg, restDays: restDaysAway })
  if (homeXg == null || awayXg == null) return null
  const proj = round2(awayXg + homeXg)
  const edgeGoals = round2(proj - oddsTotal)
  const mag = Math.abs(edgeGoals)
  if (mag < EDGE_MIN_GOALS) return null // inside the noise band — honest silence
  return {
    lean: edgeGoals > 0 ? 'OVER' : 'UNDER',
    proj, edgeGoals,
    confidence: mag >= 1.4 ? 3 : mag >= 1.0 ? 2 : 1,
    strong: mag >= 1.2,
    modelVersion: NHL_TOTAL_MODEL_VERSION,
  }
}
