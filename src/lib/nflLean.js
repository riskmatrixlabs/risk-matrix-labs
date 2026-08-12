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

// Points-per-EPA/play scaling — the SAME conversion nflLean's `lineValue` already uses
// (modelMargin = epaDiff × 25), pulled out as a named const so the side model and the
// moneyline model can never drift apart. Rationale: an NFL team runs ~63 plays a game, so
// a +0.20 EPA/play net edge ≈ 12–13 points of margin; ×25 reproduces that scale.
export const NFL_POINTS_PER_EPA = 25
// SESSION-AUTHORED const: NFL final-score margin standard deviation ≈ 13.5 points (the
// classic NFL margin sd). Used only to map the projected margin onto a win probability.
export const NFL_MARGIN_SD = 13.5
// Matches the snapshot-lean ml gate (buildLeanRows requires ml_win_prob ≥ 0.55).
export const NFL_ML_MIN_WIN_PROB = 0.55

const clamp01 = (n) => Math.min(1, Math.max(0, n))
const fin = (n) => Number.isFinite(n)

// Standard normal CDF Φ(z) via the Abramowitz–Stegun 7.1.26 erf approximation
// (|error| < 1.5e-7 — far tighter than the model's own precision).
export function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 0.5 * (1 + (z < 0 ? -erf : erf))
}

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
    lineValue: clamp01(0.5 + (epaDiff * NFL_POINTS_PER_EPA - ctx.marketMargin) / 14),
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

// The SHADOW MONEYLINE lean ('nfl-shadow-v0') — the owner's standard is that every model
// makes an explicit moneyline call, not only a spread lean. Today nflLean emits a SIDE
// (snapshotted as market 'rl'); this is the straight win/lose call on the same game.
//
// Derivation (no new data sources — pure arithmetic on the EPA differential already used
// by nflLean's lineValue factor, so the two can never disagree about who is better):
//   epaDiff       = (home.off − home.defAllowed) − (away.off − away.defAllowed)
//   projMargin    = epaDiff × NFL_POINTS_PER_EPA   (25 pts per EPA/play — see the const)
//   winProb(HOME) = Φ(projMargin / NFL_MARGIN_SD)  (NFL margin sd 13.5)
// Emits only when the winning side's probability ≥ 0.55 (the snapshot ml gate) — below it
// the model has no call. HONEST NULL on any missing EPA input. It takes the same input
// object as nflLean; weather/injuries/odds/rest are unused here because the margin comes
// from the EPA differential alone — a call is made from what is genuinely derivable, and
// nothing is fabricated to fill the rest.
export function nflMoneyline({ homeStats, awayStats } = {}) {
  if (!homeStats || !awayStats) return null
  const vals = [homeStats.offEpaPerPlay, homeStats.defEpaPerPlayAllowed, awayStats.offEpaPerPlay, awayStats.defEpaPerPlayAllowed]
  if (!vals.every(fin)) return null
  const epaDiff = (homeStats.offEpaPerPlay - homeStats.defEpaPerPlayAllowed) - (awayStats.offEpaPerPlay - awayStats.defEpaPerPlayAllowed)
  const projMargin = epaDiff * NFL_POINTS_PER_EPA
  const pHome = normCdf(projMargin / NFL_MARGIN_SD)
  const pick = pHome >= 0.5 ? 'HOME' : 'AWAY'
  const winProb = pick === 'HOME' ? pHome : 1 - pHome
  if (winProb < NFL_ML_MIN_WIN_PROB) return null // no confident call — honest silence
  return { pick, winProb: Math.round(winProb * 10000) / 10000, modelVersion: NFL_MODEL_VERSION }
}
