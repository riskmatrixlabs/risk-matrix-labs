// NFL game-total lean (SHADOW, 'nfl-total-shadow-v0') — built ON the ported totals side of
// the NFL engine (src/lib/models/nflSide.js: nflExpectedPoints / nflProjectedTotal, verbatim,
// never altered here). Snapshotted through the existing total-market lean pipeline and graded
// sport-agnostically by cron-grade-leans (gradeLeanResult's total path is score-sum vs line).
//
// HONEST-NULL, all-or-nothing: any underivable input (stats, weather, odds_total) → null.
//
// Input derivations (per side):
//   epaPerPlay     own offEpaPerPlay (nflverse team stats — api/_lib/nflTeamStats.js)
//   expectedPlays  own playsPerGame (same source)
//   oppAdj         clamp(1 + (opp.defEpaPerPlayAllowed − L) × K, 0.85..1.15) where L is the
//                  league-average off EPA/play (nflLean's leagueAvgOffEpa centering approach)
//                  and K = 2.5 — typical def-EPA deviations from league avg run ~±0.06/play,
//                  so ×2.5 maps them onto ~±0.15, exactly the documented clamp band.
//   rzAdj          1 — NEUTRAL, awaiting data: we have NO red-zone-efficiency source yet.
//                  A multiplicative neutral 1 on an ADJUSTMENT is acceptable because the base
//                  signal (EPA × plays) is real — this is "no adjustment applied", which is
//                  categorically different from fabricating a base input. Replace when a real
//                  red-zone source lands.
//   weatherAdj     from SYNCED weather (never guessed): indoor → 1;
//                  outdoor → 1 − clamp01((windMph − 8)/40 + precipPct/200)
//                  (wind and precip dampen scoring; ≤8 mph calm air is neutral).
//                  Missing/partial weather → null (no fabricated calm day).
//
// Scale note (why BASELINE_POINTS exists): nflExpectedPoints returns EPA × plays — NET expected
// points ADDED vs an average drive baseline, NOT gross points scored. Gross per side is derived
// as BASELINE_POINTS + epaPart: a league-average NFL team scores ≈ 21.5 points/game, and the
// EPA differential shifts that baseline up or down.
import { nflExpectedPoints, nflProjectedTotal } from './models/nflSide.js'
import { LEAGUE_AVG_EPA } from './nflLean.js'

export const NFL_TOTAL_MODEL_VERSION = 'nfl-total-shadow-v0'
export const BASELINE_POINTS = 21.5 // league-average team points/game (gross anchor for the EPA part)
export const OPP_ADJ_K = 2.5        // def-EPA deviation → opponent multiplier slope (see header)
export const RZ_ADJ_NEUTRAL = 1     // documented neutral — no red-zone source yet (awaiting data)
export const EDGE_MIN_POINTS = 3    // emit only when |proj − line| ≥ 3 points

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const clamp01 = (n) => clamp(n, 0, 1)
const fin = (n) => Number.isFinite(n)
const round2 = (n) => Math.round(n * 100) / 100

// Opponent-defense multiplier on a side's expected points. null unless both inputs are finite.
export function oppTotalAdj(oppDefEpaAllowed, leagueAvgEpa) {
  if (!fin(oppDefEpaAllowed) || !fin(leagueAvgEpa)) return null
  return clamp(1 + (oppDefEpaAllowed - leagueAvgEpa) * OPP_ADJ_K, 0.85, 1.15)
}

// Scoring damp from synced conditions — SAME multiplier for both sides (totals are symmetric).
export function totalWeatherAdj(weather) {
  if (!weather) return null
  if (weather.indoor) return 1
  const { windMph, precipPct } = weather
  if (!fin(windMph) || !fin(precipPct)) return null
  return 1 - clamp01((windMph - 8) / 40 + precipPct / 200)
}

// Gross expected points for one side: baseline + the engine's net EPA part (verbatim call).
export function grossPoints({ epaPerPlay, expectedPlays, oppAdj, weatherAdj }) {
  const epaPart = nflExpectedPoints({ epaPerPlay, expectedPlays, oppAdj, rzAdj: RZ_ADJ_NEUTRAL, weatherAdj })
  return epaPart == null ? null : BASELINE_POINTS + epaPart
}

// The SHADOW total lean. Emits { lean, proj, edgePoints, confidence, strong, modelVersion }
// only when odds_total is present AND |proj − odds_total| ≥ EDGE_MIN_POINTS; else null.
// Confidence 1–3: |edge| ≥3 → 1, ≥5 → 2, ≥7 → 3. strong at |edge| ≥ 6.
export function nflTotal({ homeStats, awayStats, weather, oddsTotal, leagueAvgEpa } = {}) {
  if (!homeStats || !awayStats || !fin(oddsTotal)) return null
  const L = fin(leagueAvgEpa) ? leagueAvgEpa : LEAGUE_AVG_EPA
  const wx = totalWeatherAdj(weather)
  if (wx == null) return null
  const homePts = grossPoints({
    epaPerPlay: homeStats.offEpaPerPlay, expectedPlays: homeStats.playsPerGame,
    oppAdj: oppTotalAdj(awayStats.defEpaPerPlayAllowed, L), weatherAdj: wx,
  })
  const awayPts = grossPoints({
    epaPerPlay: awayStats.offEpaPerPlay, expectedPlays: awayStats.playsPerGame,
    oppAdj: oppTotalAdj(homeStats.defEpaPerPlayAllowed, L), weatherAdj: wx,
  })
  const proj = nflProjectedTotal(homePts, awayPts)
  if (proj == null) return null
  const edgePoints = round2(proj - oddsTotal)
  const mag = Math.abs(edgePoints)
  if (mag < EDGE_MIN_POINTS) return null // inside the noise band — honest silence
  return {
    lean: edgePoints > 0 ? 'OVER' : 'UNDER',
    proj, edgePoints,
    confidence: mag >= 7 ? 3 : mag >= 5 ? 2 : 1,
    strong: mag >= 6,
    modelVersion: NFL_TOTAL_MODEL_VERSION,
  }
}
