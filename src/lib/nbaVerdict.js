// NBA prop verdict — pure. Built ON the CONFIRMED NBA engine (src/lib/models/nbaProps.js,
// weights 20/20/20/10/10/10/10 — NEVER altered here). This file only DERIVES the seven 0–1
// inputs from real observed data and maps the resulting score into the same verdict shape
// PHLT/WNBA use ({ score, tier, label, color, faded, breakdown, ... }) so the existing
// render path works unchanged.
//
// HONEST-NULL CONTRACT: every input must have a real, documented derivation. Any missing /
// non-finite input → return null (no verdict). Never a neutral-constant filler.
//
// Derivations (engine-wiring plan, NBA analog of WNBA Task 2.1):
//   blowoutProb = clamp01((|oppSpread| − 6) / 14)   — spreads ≤6 carry no blowout signal;
//                 20+ point spreads saturate the probability at 1. Documented mapping, not a stat.
//   adjMinutes  = adjustedMinutes(last5AvgMinutes, blowoutProb)  — CONFIRMED engine fn (penalty 0.18)
//   minutes     = clamp01(adjMinutes / 36), capped at 0.5 when minutesStability < 0.6
//   usage       = clamp01(perMinRate / LEAGUE_REF_PER_MIN[market]) — reference scale, not a fabricated stat
//   matchup     = clamp01(oddsTotal / 230)  — scoring-environment proxy from the synced total;
//                 230 ≈ a high-scoring NBA total, so typical slates land ~0.9–1.0
//   pace        = clamp01(oddsTotal / 240)  — same real input, different documented scale:
//                 240 is a near-ceiling total, leaving headroom so pace separates fast slates from
//                 slow ones instead of saturating like matchup does. Session-authored derivation —
//                 the CONFIRMED engine takes matchup and pace as distinct inputs; both are honest
//                 functions of the one synced pace signal we have (the market total).
//   recentForm  = clamp01(0.5 + (last5Rate − seasonRate) / (2 × seasonRate))
//   injuryRole  — from the synced event injuries list (metadata.injuries):
//                 status Out/Doubtful → NO verdict (null); Questionable → 0.35;
//                 not listed → minutes stability proxy: ≥0.8 → 0.7, ≥0.6 → 0.5, else 0.35
//                 (a stable rotation IS the observed role signal; never a neutral 0.5 filler)
//   lineValue   = clamp01(0.5 + evPct / 20)  — from the prop's real de-vig edge
import { nbaPropScore, nbaProjection, adjustedMinutes } from './models/nbaProps.js'
// Generic filters shared with the W engine (projected/recentMax ratio; projection − line).
import { minutesStability, propEdge } from './models/wnbaProps.js'

const clamp01 = (n) => Math.max(0, Math.min(1, n))

// League reference per-minute production scales, NBA (documented constants — the denominator
// that turns a per-minute rate into a 0–1 usage/role signal; ~a high-usage starter's rate:
// points ~0.60/min ≈ 21.5 pts in 36; rebounds ~0.32/min ≈ 11.5 in 36; assists ~0.25/min ≈ 9 in 36).
// Markets without a reference scale are NOT modeled → no verdict.
export const LEAGUE_REF_PER_MIN = {
  player_points: 0.60,
  player_rebounds: 0.32,
  player_assists: 0.25,
}

// Tier map (same as WNBA/PHLT): ≥75 A, ≥62 B, ≥50 C, else AVOID.
export function nbaTier(score) {
  if (score >= 75) return { tier: 'A', label: 'Prime', color: 'green' }
  if (score >= 62) return { tier: 'B', label: 'Strong', color: 'blue' }
  if (score >= 50) return { tier: 'C', label: 'Caution', color: 'yellow' }
  return { tier: 'AVOID', label: 'Fade', color: 'red' }
}

/**
 * Score one NBA player prop. Pure — server assembles the inputs.
 * `injuryStatus` is the player's synced designation ('out'|'doubtful'|'questionable') or
 * null/undefined when the player is not on the injuries list. `seasonMinutes` is accepted
 * for context but unused in v0 (last-5 minutes drive minutes/projection, like WNBA).
 * @returns { score, tier, label, color, faded, fades, breakdown, projection, edge, stability } | null
 */
export function nbaVerdict({
  market = 'player_points',
  perMinRate, last5Minutes, seasonMinutes, recentMaxMinutes, // eslint-disable-line no-unused-vars
  last5Rate, seasonRate, oddsTotal, oppSpread, evPct, line,
  injuryStatus = null,
} = {}) {
  const ref = LEAGUE_REF_PER_MIN[market]
  if (!Number.isFinite(ref)) return null                                   // market not modeled
  const status = injuryStatus ? String(injuryStatus).toLowerCase() : null
  if (status && (status.startsWith('out') || status.startsWith('doubt'))) return null // ruled out/doubtful → no verdict
  const need = [perMinRate, last5Minutes, recentMaxMinutes, last5Rate, seasonRate, oddsTotal, oppSpread, evPct, line]
  if (!need.every(Number.isFinite)) return null                            // honest null — no filler
  if (seasonRate <= 0 || oddsTotal <= 0) return null                       // form/pace underivable

  const stability = minutesStability(last5Minutes, recentMaxMinutes)       // projected ÷ recent max
  if (stability == null) return null                                       // recentMax 0 → undefined

  // Blowout probability from the synced spread, then the CONFIRMED adjusted-minutes fn.
  const blowoutProb = clamp01((Math.abs(oppSpread) - 6) / 14)
  const adjMin = adjustedMinutes(last5Minutes, blowoutProb)
  if (adjMin == null) return null

  let minutes = clamp01(adjMin / 36)
  if (stability < 0.6) minutes = Math.min(minutes, 0.5)                    // unstable rotation guard

  const usage = clamp01(perMinRate / ref)
  const matchup = clamp01(oddsTotal / 230)
  const pace = clamp01(oddsTotal / 240)
  const recentForm = clamp01(0.5 + (last5Rate - seasonRate) / (2 * seasonRate))
  const injuryRole = status && status.startsWith('question') ? 0.35
    : stability >= 0.8 ? 0.7 : stability >= 0.6 ? 0.5 : 0.35
  const lineValue = clamp01(0.5 + evPct / 20)

  const score = nbaPropScore({ minutes, usage, matchup, pace, recentForm, injuryRole, lineValue })
  if (score == null) return null

  // Projection = per-minute rate × blowout-adjusted minutes. Multipliers stay 1 in v0 —
  // we have no honest player-level usage/pace/opponent multipliers yet, and 1 = "no
  // adjustment", not a fabricated stat. Edge = projection − posted line.
  const projection = nbaProjection({ statPerMinute: perMinRate, expectedMinutes: adjMin })
  const edge = propEdge(projection, line)
  if (projection == null || edge == null) return null

  const t = nbaTier(score)
  return {
    score,
    ...t,
    faded: t.tier === 'AVOID',
    fades: [],
    breakdown: {
      minutes: Math.round(minutes * 100), usage: Math.round(usage * 100),
      form: Math.round(recentForm * 100), pace: Math.round(pace * 100),
      value: Math.round(lineValue * 100),
    },
    projection, edge, stability, market,
  }
}
