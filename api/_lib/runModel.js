// Per-side run projection for the MLB O/U/ML/RL model (Phase 3). Pure, no I/O, fully unit-tested.
// Projects ONE team's expected runs from its own offense vs the OPPOSING staff + venue. Doing this
// per side (instead of averaging the two starters into one combined total) means an ace fully
// suppresses the side he faces, and park/weather are applied once per side. From the two projected
// scores it derives Total + Moneyline + Run Line from a single engine. Coefficients are run ESTIMATES
// (a hypothesis); the graded record tunes them. See memory rml-ou-model Phase 3.

export const LG = {
  TEAM_RUNS: 4.30,   // half of an 8.6-run league total = one team's avg runs
  XWOBA:     0.320,  // league avg lineup xwOBA
  XERA:      4.00,   // league avg starter xERA
  PEN_ERA:   4.10,   // league avg bullpen ERA
  STARTER_SHARE: 0.62, // fraction of a game's innings a starter throws (rest = pen)
  MARGIN_SD: 3.00,   // stdev of MLB final run margin (for win-prob + RL cover math)
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Blended opposing-staff ERA: starter for ~62% of innings, bullpen for the rest.
function staffEra(oppStarterXera, oppBullpenEra) {
  const s = Number.isFinite(oppStarterXera) ? oppStarterXera : LG.XERA
  const b = Number.isFinite(oppBullpenEra) ? oppBullpenEra : LG.PEN_ERA
  return s * LG.STARTER_SHARE + b * (1 - LG.STARTER_SHARE)
}

// projectTeamRuns({ offXwoba, oppStarterXera, oppBullpenEra, parkMult, weatherRunsPerSide }) → runs.
// Multiplicative in offense × opposing-staff × park (so park is a single clean scalar per side),
// plus an additive weather term. Falls back to league-neutral on any missing input.
export function projectTeamRuns({ offXwoba, oppStarterXera, oppBullpenEra, parkMult = 1, weatherRunsPerSide = 0 } = {}) {
  const LG_STAFF = LG.XERA * LG.STARTER_SHARE + LG.PEN_ERA * (1 - LG.STARTER_SHARE)
  const offFactor   = Number.isFinite(offXwoba) ? offXwoba / LG.XWOBA : 1   // 1.06 = 6% above-avg bats
  const pitchFactor = staffEra(oppStarterXera, oppBullpenEra) / LG_STAFF    // >1 = weak staff → more runs
  const park        = Number.isFinite(parkMult) ? parkMult : 1
  const wx          = Number.isFinite(weatherRunsPerSide) ? weatherRunsPerSide : 0
  const runs = LG.TEAM_RUNS * offFactor * pitchFactor * park + wx
  return clamp(Math.round(runs * 100) / 100, 0, 15)
}

// gameProjection({ away, home, parkMult, weatherRunsPerSide }) → { awayRuns, homeRuns, total, margin }.
// Each side's runs are projected from ITS OWN offense vs the OTHER side's staff. Park + weather apply
// equally to both sides (same venue/air), so they cancel in the margin but stack in the total — which
// is exactly right (a hitter park inflates the total but not who wins).
//   away/home = { offXwoba, starterXera, bullpenEra }
//   margin is HOME-perspective: homeRuns - awayRuns (positive = home favored on the field).
export function gameProjection({ away = {}, home = {}, parkMult = 1, weatherRunsPerSide = 0 } = {}) {
  const awayRuns = projectTeamRuns({
    offXwoba: away.offXwoba, oppStarterXera: home.starterXera, oppBullpenEra: home.bullpenEra,
    parkMult, weatherRunsPerSide,
  })
  const homeRuns = projectTeamRuns({
    offXwoba: home.offXwoba, oppStarterXera: away.starterXera, oppBullpenEra: away.bullpenEra,
    parkMult, weatherRunsPerSide,
  })
  const total = Math.round((awayRuns + homeRuns) * 100) / 100
  const margin = Math.round((homeRuns - awayRuns) * 100) / 100
  return { awayRuns, homeRuns, total, margin }
}

// anchorProjection(raw, marketTotal, weight) → market-anchored projection.
// The per-side engine builds an ABSOLUTE total from league baselines, so on sharp low-total games it
// reverts toward league-average (~8.6) and flips the Total lean to OVER even when the market (and the
// line-anchored `ou` model) correctly say UNDER. The MARGIN is the engine's real signal (it drives
// ML/RL); the TOTAL should defer to the market like `ou` does. So we blend the total toward the market
// (market-leaning weight) and re-split the two sides from the blended total while PRESERVING the margin.
//   anchoredTotal = W*marketTotal + (1-W)*raw.total  (W = 0.65, market-leaning hypothesis to tune)
//   homeRuns = (anchoredTotal + margin)/2 ; awayRuns = (anchoredTotal - margin)/2   (margin = home-away)
// If marketTotal isn't a positive finite number, returns `raw` unchanged.
export function anchorProjection(raw, marketTotal, weight = 0.65) {
  if (!Number.isFinite(marketTotal) || marketTotal <= 0) return raw
  const margin = raw.margin
  const anchoredTotal = Math.round((weight * marketTotal + (1 - weight) * raw.total) * 100) / 100
  const homeRuns = Math.round(((anchoredTotal + margin) / 2) * 100) / 100
  const awayRuns = Math.round(((anchoredTotal - margin) / 2) * 100) / 100
  return { awayRuns, homeRuns, total: anchoredTotal, margin }
}

// Normal CDF (Abramowitz-Stegun 7.1.26 approximation) — no dependency.
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return p
}

// winProbFromMargin(margin) → home win probability. Treats the final margin as Normal(mean=margin,
// sd=MARGIN_SD); P(home wins) = P(margin > 0) = Φ(margin / sd). Symmetric, bounded (0,1).
export function winProbFromMargin(margin) {
  const m = Number.isFinite(margin) ? margin : 0
  const p = Math.round(normCdf(m / LG.MARGIN_SD) * 1000) / 1000
  return clamp(p, 0.001, 0.999)   // a probability is never a certainty
}

// coverProb(margin, line=1.5) → P(home margin > line) = P(home covers -1.5). Same Normal model as
// winProbFromMargin. For the AWAY +1.5 dog, use 1 - coverProb(margin) at the same line.
export function coverProb(margin, line = 1.5) {
  const m = Number.isFinite(margin) ? margin : 0
  const p = Math.round(normCdf((m - line) / LG.MARGIN_SD) * 1000) / 1000
  return clamp(p, 0.001, 0.999)
}

// deriveBets({ proj, marketTotal, totalDeadband }) → { total, ml, rl }. Turns one per-side projection
// into all three bet leans. Total uses the same 1-run deadband + edge convention as the live ou model
// so they're comparable. ML/RL come from the projected margin via the Normal win/cover model.
export function deriveBets({ proj, marketTotal = null, totalDeadband = 1.0 } = {}) {
  const { awayRuns, homeRuns, total, margin } = proj || {}

  // ── Total ──
  let totalLean = 'LEAN', edge = null
  if (Number.isFinite(marketTotal) && Number.isFinite(total)) {
    edge = Math.round((total - marketTotal) * 10) / 10
    totalLean = edge >= totalDeadband ? 'OVER' : edge <= -totalDeadband ? 'UNDER' : 'LEAN'
  }

  // ── Moneyline ── side projected to score more; null when essentially a pick-em.
  let mlPick = null, winProb = null
  if (Number.isFinite(margin) && Math.abs(margin) >= 0.15) {
    const homeWins = margin > 0
    mlPick = homeWins ? 'HOME' : 'AWAY'
    const p = winProbFromMargin(margin)          // home win prob
    winProb = homeWins ? p : Math.round((1 - p) * 1000) / 1000
  }

  // ── Run line (-1.5 on the favorite) ──
  let rl = { pick: null, coverProb: null }
  if (mlPick) {
    const favCover = mlPick === 'HOME' ? coverProb(margin) : coverProb(-margin)
    rl = { pick: `${mlPick} -1.5`, coverProb: favCover }
  }

  return {
    total: { lean: totalLean, edge, projected: total ?? null },
    ml: { pick: mlPick, winProb, awayRuns: awayRuns ?? null, homeRuns: homeRuns ?? null },
    rl,
  }
}
