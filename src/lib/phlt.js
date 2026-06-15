// PHLT v2.2 — Pitcher Hit Likelihood Targeting (owner's hitter-"to record a HIT" prop model).
// PURE, no I/O — inputs in, {score,tier,fades,breakdown} out, so it's unit-testable and the
// callsite owns all fetching (ESPN gamelog + api/savant). Built to the locked spec in the
// rml-phlt-model memory — don't invent a different one.
//
// Confidence matrix (weights sum to 100):
//   Pitcher Profile 30 · Hitter Form 30 · Matchup Fit 15 · Park/Weather 10 · Hot Streak 15
// Tiers:  85+ A·Prime | 75–84 B·Strong | 65–74 C·Caution | <65 Fade
// (brand voice: operators, not gamblers — never "lock"/"pick"/"play".)
// Auto-fades (override the tier to Avoid):
//   Cold Zone: 0 hits in last 4 games OR BB% > 15%
//   Red-Flag Pitcher: among {K%>27, Whiff%>30, xBA-against<.220} — any TWO ⇒ fade.

export const WEIGHTS = { pitcher: 30, form: 30, matchup: 15, parkWeather: 10, streak: 15 }

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
// linear map x in [a,b] → [ya,yb], clamped. Handles a>b (descending) too.
function lerp(x, a, b, ya, yb) {
  if (x == null || !Number.isFinite(x)) return null
  if (a === b) return (ya + yb) / 2
  const t = (x - a) / (b - a)
  return clamp(ya + t * (yb - ya))
}
// average only the defined (non-null) weighted parts; renormalize over what's present.
function blend(parts) {
  let sum = 0, w = 0
  for (const [v, weight] of parts) if (v != null && Number.isFinite(v)) { sum += v * weight; w += weight }
  return w ? sum / w : null
}

// ── Pitcher Profile (0–100): how BEATABLE is the pitcher (higher = easier to get a hit). ──
// xBA-against and whiff% carry it; K% next; raw ERA is noisy so it's a light tiebreaker.
export function pitcherScore(p = {}) {
  const xba   = lerp(p.xbaAgainst, 0.200, 0.290, 0, 100)  // .200 nasty → .290 very hittable
  const whiff = lerp(p.whiffPct,   32,    16,    0, 100)  // 32% nasty → 16% contact-prone
  const k     = lerp(p.kPct,       30,    14,    0, 100)  // 30% nasty → 14% pitch-to-contact
  const era   = lerp(p.era,        2.0,   5.5,   20, 100) // soft signal
  return blend([[xba, 0.40], [whiff, 0.25], [k, 0.25], [era, 0.10]]) ?? 50
}

// ── Hitter Form (0–100): recent bat + quality of contact. ──
// last-5 AVG is the "hot right now" read; batter xBA is the skill/luck check. Blend; if xBA
// is missing (non-qualified hitter) lean entirely on form so we still produce a number.
export function formScore(h = {}) {
  const avg5 = lerp(h.avgLast5, 0.150, 0.400, 20, 100)
  const xba  = lerp(h.xba,      0.220, 0.330, 30, 100)
  return blend([[avg5, 0.6], [xba, 0.4]]) ?? 50
}

// ── Matchup Fit (0–100): platoon handedness + contact quality nudge. ──
// platoonEdge: +1 batter has the platoon advantage (e.g. LHB vs RHP), -1 disadvantage, 0/none.
export function matchupScore(m = {}) {
  const base = m.platoonEdge > 0 ? 72 : m.platoonEdge < 0 ? 38 : 55
  const woba = lerp(m.xwoba, 0.290, 0.400, -10, 12) // small ± nudge by contact quality
  return clamp(base + (woba ?? 0))
}

// ── Park / Weather (0–100): hitter-friendly conditions. ──
// parkFactor ~100 = neutral (>100 favors hitters). weatherBoost is an optional −1..+1 from the
// weather lib (wind out + heat = +, cold + wind in = −).
export function parkWeatherScore(pw = {}) {
  const park = lerp(pw.parkFactor, 90, 112, 25, 92) ?? 55
  const wx = pw.weatherBoost != null ? clamp(pw.weatherBoost, -1, 1) * 18 : 0
  return clamp(park + wx)
}

// ── Hot Streak (0–100): length of the active hitting streak. ──
export function streakScore(games = 0) {
  const g = Number(games) || 0
  if (g >= 8) return 100
  if (g >= 5) return 85
  if (g >= 3) return 70
  if (g >= 1) return 52
  return 30
}

// Which of the three Red-Flag pitcher conditions are tripped.
export function redFlags(p = {}) {
  const f = []
  if (p.kPct     != null && p.kPct     > 27)    f.push('K% > 27')
  if (p.whiffPct != null && p.whiffPct > 30)    f.push('Whiff% > 30')
  if (p.xbaAgainst != null && p.xbaAgainst < 0.220) f.push('xBA-against < .220')
  return f
}

// Cold-Zone fade conditions for the hitter.
export function coldZone(h = {}) {
  const f = []
  if (h.hitsLast4 != null && h.hitsLast4 === 0) f.push('0 hits last 4 games')
  if (h.bbPct != null && h.bbPct > 15) f.push('BB% > 15% (passive)')
  return f
}

export function tierFor(score) {
  if (score >= 85) return { tier: 'A', label: 'Prime', color: 'green' }
  if (score >= 75) return { tier: 'B', label: 'Strong', color: 'blue' }
  if (score >= 65) return { tier: 'C', label: 'Caution', color: 'yellow' }
  return { tier: 'AVOID', label: 'Fade', color: 'red' }
}

/**
 * Score one hitter's chance to record a HIT.
 * @param {object} inp
 *   hitter:  { avgLast5, hitStreak, bbPct, hitsLast4, xba }
 *   pitcher: { kPct, whiffPct, xbaAgainst, era }
 *   matchup: { platoonEdge, xwoba }
 *   park:    { parkFactor, weatherBoost }
 * @returns { score, tier, label, color, fades:[], faded:boolean, breakdown }
 */
export function scoreHit({ hitter = {}, pitcher = {}, matchup = {}, park = {} } = {}) {
  const sub = {
    pitcher: pitcherScore(pitcher),
    form: formScore({ ...hitter, avgLast5: hitter.avgLast5, xba: hitter.xba }),
    matchup: matchupScore(matchup),
    parkWeather: parkWeatherScore(park),
    streak: streakScore(hitter.hitStreak),
  }
  const raw = Math.round(
    (sub.pitcher * WEIGHTS.pitcher + sub.form * WEIGHTS.form + sub.matchup * WEIGHTS.matchup +
     sub.parkWeather * WEIGHTS.parkWeather + sub.streak * WEIGHTS.streak) / 100
  )

  const flags = redFlags(pitcher)
  const cold = coldZone(hitter)
  const redFlagFade = flags.length >= 2          // "any TWO ⇒ fade"
  const coldFade = cold.length >= 1
  const faded = redFlagFade || coldFade
  const fades = [
    ...(redFlagFade ? [`Red-Flag pitcher: ${flags.join(', ')}`] : []),
    ...cold.map(c => `Cold Zone: ${c}`),
  ]

  // Fades override the tier to Avoid but we keep the computed score for transparency.
  const t = faded ? { tier: 'AVOID', label: 'Fade', color: 'red' } : tierFor(raw)
  return {
    score: raw,
    ...t,
    faded,
    fades,
    breakdown: {
      pitcher: Math.round(sub.pitcher), form: Math.round(sub.form),
      matchup: Math.round(sub.matchup), parkWeather: Math.round(sub.parkWeather),
      streak: Math.round(sub.streak),
    },
    redFlags: flags,
  }
}
