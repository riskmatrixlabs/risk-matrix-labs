// NFL side lean (SHADOW, 'nfl-shadow-v0') — derives the nine 0–1 factors for
// nflSideScore (src/lib/models/nflSide.js, RECONSTRUCTION weights, never altered here)
// from real sources: nflverse prior-season team stats + synced weather/injuries/odds/rest.
//
// HONEST-NULL, all-or-nothing: if ANY factor is underivable for either side, the whole
// lean is null — callers emit nothing. In particular, defEpaPerPlayAllowed is null from
// today's nflverse team-stats file (no opponent-EPA column), so no lean emits until a
// real defensive-EPA source is wired. That is by design, not a bug.
//
// Derivations (plan 2026-08-11-engine-wiring-phases.md, Task 3.2):
//   qbEdge         clamp01(0.5 + ((own.offEpaPerPlay − L) + (opp.defEpaPerPlayAllowed − L)) × 2.5)
//                  where L = league-average off EPA/play (computed from the fetched stats when
//                  available via leagueAvgOffEpa; documented const fallback LEAGUE_AVG_EPA).
//                  EPA differential as the QB/passing proxy until player-level data lands.
//                  Sign fix (session-authored derivation, NOT an owner-confirmed weight): the
//                  plan's original (own.off − opp.defAllowed) was backwards — it penalized
//                  facing a BAD (high-EPA-allowed) defense. Facing a leaky defense must RAISE
//                  the edge, so opp defAllowed enters with a + sign, centered on league avg.
//   offensiveLine  clamp01(1 − own.sackRateAllowed / 0.12)   (12% sack rate ≈ league worst)
//   defensiveMatchup clamp01(0.5 − ((opp.offEpaPerPlay − L) + (own.defEpaPerPlayAllowed − L)) × 2.5)
//                  mirror of qbEdge from the defense's perspective: a hot opp offense AND a
//                  leaky own defense both drag it down; both terms centered on league avg.
//   explosivePlay  clamp01(own.explosiveRate / 0.14)         (14% ≈ elite explosive share)
//   turnoverRegression clamp01(0.5 − own.turnoverMargin × 0.05)  (extreme margins regress)
//   injuryEdge     clamp01(0.5 + (oppWeighted − ownWeighted) × 0.08),
//                  weighted = out×1 + doubtful×0.6 + questionable×0.3 (synced metadata.injuries)
//   restTravel     clamp01(0.5 + (restDaysOwn − restDaysOpp) × 0.07)
//   weather        indoor → 0.75; outdoor → 1 − clamp01((windMph/25 + precipPct/100)/2).
//                  v0: SAME value for both sides — conditions are symmetric at team level
//                  (documented simplification); real synced weather, so it IS derivable.
//   lineValue      clamp01(0.5 + (modelMargin − marketMargin)/14) where
//                  modelMargin = epaDiff × 25, epaDiff = (own.off − own.defAllowed) −
//                  (opp.off − opp.defAllowed)  (circular guard: EPA diff, not the score itself);
//                  marketMargin = −oddsSpreadHome for HOME, +oddsSpreadHome for AWAY.
import { nflSideScore } from './models/nflSide.js'
import { brandTier } from './models/tiers.js'

export const NFL_MODEL_VERSION = 'nfl-shadow-v0'
export const NFL_LEAN_THRESHOLD = 68 // internal LEAN tier floor — emit only at/above

// League-average offensive EPA/play — the centering constant for qbEdge/defensiveMatchup.
// Documented fallback: recent NFL league means sit near +0.01 (2025 actual from nflverse
// weekly data ≈ +0.0075). Prefer the computed mean from the fetched stats (leagueAvgOffEpa).
export const LEAGUE_AVG_EPA = 0.01

// Compute the actual league mean off EPA/play from a fetched stats map ({ ABBR: { offEpaPerPlay } }).
// Falls back to LEAGUE_AVG_EPA when no finite values are available (never null — this is a
// centering reference scale, not a per-team stat).
export function leagueAvgOffEpa(statsByTeam) {
  const vals = Object.values(statsByTeam || {}).map((t) => t?.offEpaPerPlay).filter(Number.isFinite)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : LEAGUE_AVG_EPA
}

const clamp01 = (n) => Math.min(1, Math.max(0, n))
const fin = (n) => Number.isFinite(n)

// Weighted injury burden from synced status counts. null unless all three are finite.
function injuryWeight(inj) {
  if (!inj) return null
  const { out, doubtful, questionable } = inj
  if (![out, doubtful, questionable].every(fin)) return null
  return out * 1 + doubtful * 0.6 + questionable * 0.3
}

// Symmetric weather factor (same both sides at v0). null when underivable.
function weatherFactor(weather) {
  if (!weather) return null
  if (weather.indoor) return 0.75
  const { windMph, precipPct } = weather
  if (!fin(windMph) || !fin(precipPct)) return null
  return 1 - clamp01((windMph / 25 + precipPct / 100) / 2)
}

// The nine factors for ONE side ("own" vs "opp"). Any underivable factor → null overall.
// ctx: { injuriesOwn, injuriesOpp, restOwn, restOpp, weather, marketMargin, leagueAvgEpa? }
export function deriveNflFactors(own, opp, ctx) {
  if (!own || !opp || !ctx) return null
  const ownInj = injuryWeight(ctx.injuriesOwn)
  const oppInj = injuryWeight(ctx.injuriesOpp)
  const wx = weatherFactor(ctx.weather)
  const needed = [
    own.offEpaPerPlay, own.defEpaPerPlayAllowed, own.sackRateAllowed, own.explosiveRate, own.turnoverMargin,
    opp.offEpaPerPlay, opp.defEpaPerPlayAllowed,
    ownInj, oppInj, ctx.restOwn, ctx.restOpp, wx, ctx.marketMargin,
  ]
  if (!needed.every(fin)) return null
  const L = fin(ctx.leagueAvgEpa) ? ctx.leagueAvgEpa : LEAGUE_AVG_EPA
  const epaDiff = (own.offEpaPerPlay - own.defEpaPerPlayAllowed) - (opp.offEpaPerPlay - opp.defEpaPerPlayAllowed)
  return {
    qbEdge: clamp01(0.5 + ((own.offEpaPerPlay - L) + (opp.defEpaPerPlayAllowed - L)) * 2.5),
    offensiveLine: clamp01(1 - own.sackRateAllowed / 0.12),
    defensiveMatchup: clamp01(0.5 - ((opp.offEpaPerPlay - L) + (own.defEpaPerPlayAllowed - L)) * 2.5),
    explosivePlay: clamp01(own.explosiveRate / 0.14),
    turnoverRegression: clamp01(0.5 - own.turnoverMargin * 0.05),
    injuryEdge: clamp01(0.5 + (oppInj - ownInj) * 0.08),
    restTravel: clamp01(0.5 + (ctx.restOwn - ctx.restOpp) * 0.07),
    weather: wx,
    lineValue: clamp01(0.5 + (epaDiff * 25 - ctx.marketMargin) / 14),
  }
}

// Build the SHADOW lean: score BOTH sides, take the higher, emit only at/above the
// LEAN threshold. Returns { side, score, tier, factors, modelVersion } | null.
export function nflLean({ homeStats, awayStats, weather, injuries,
  oddsSpreadHome, oddsTotal, restDaysHome, restDaysAway, leagueAvgEpa } = {}) { // eslint-disable-line no-unused-vars -- oddsTotal reserved for the totals side (Phase 3 backlog)
  if (!injuries || !fin(oddsSpreadHome)) return null
  const homeF = deriveNflFactors(homeStats, awayStats, {
    injuriesOwn: injuries.home, injuriesOpp: injuries.away,
    restOwn: restDaysHome, restOpp: restDaysAway,
    weather, marketMargin: -oddsSpreadHome, leagueAvgEpa,
  })
  const awayF = deriveNflFactors(awayStats, homeStats, {
    injuriesOwn: injuries.away, injuriesOpp: injuries.home,
    restOwn: restDaysAway, restOpp: restDaysHome,
    weather, marketMargin: oddsSpreadHome, leagueAvgEpa,
  })
  if (!homeF || !awayF) return null
  const homeScore = nflSideScore(homeF)
  const awayScore = nflSideScore(awayF)
  if (!fin(homeScore) || !fin(awayScore)) return null
  const side = homeScore >= awayScore ? 'HOME' : 'AWAY'
  const score = Math.max(homeScore, awayScore)
  if (score < NFL_LEAN_THRESHOLD) return null // no lean worth emitting — honest silence
  const factors = side === 'HOME' ? homeF : awayF
  return { side, score, tier: brandTier(score), factors, modelVersion: NFL_MODEL_VERSION }
}
