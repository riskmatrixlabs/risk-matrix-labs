// WNBA prop verdict — pure. Built ON the CONFIRMED WNBA engine (src/lib/models/wnbaProps.js,
// weights 25/20/20/15/10/10 — NEVER altered here). This file only DERIVES the six 0–1 inputs
// from real observed data and maps the resulting score into the same verdict shape PHLT uses
// ({ score, tier, label, color, faded, breakdown, ... }) so the existing render path works.
//
// HONEST-NULL CONTRACT: every input must have a real, documented derivation. Any missing /
// non-finite input → return null (no verdict). Never a neutral-constant filler.
//
// Derivations (plan Task 2.1):
//   minutes    = clamp01(last5AvgMinutes / 36), capped at 0.5 when minutesStability < 0.6
//   usage      = clamp01(perMinRate / leagueRefPerMin[market])  — reference scale, not a fabricated stat
//   matchup    = clamp01(oddsTotal / 170)                       — expected-pace proxy from the synced total
//   recentForm = clamp01(0.5 + (last5Rate − seasonRate) / (2 × seasonRate))
//   gameScript = 1 − clamp01(|oppSpread| / 16)                  — blowout risk from synced spread
//   lineValue  = clamp01(0.5 + evPct / 20)                      — from the prop's real de-vig edge
import { wnbaPropScore, wnbaProjection, minutesStability, propEdge } from './models/wnbaProps.js'

const clamp01 = (n) => Math.max(0, Math.min(1, n))

// League reference per-minute production scales (documented constants — the denominator that
// turns a per-minute rate into a 0–1 usage/role signal; ~a high-usage starter's rate).
// Markets without a reference scale are NOT modeled → no verdict.
export const LEAGUE_REF_PER_MIN = {
  player_points: 0.55,
  player_rebounds: 0.16,
  player_assists: 0.10,
}

// Tier map (plan Task 2.1): ≥75 A, ≥62 B, ≥50 C, else AVOID — same shape as src/lib/phlt.js tierFor.
export function wnbaTier(score) {
  if (score >= 75) return { tier: 'A', label: 'Prime', color: 'green' }
  if (score >= 62) return { tier: 'B', label: 'Strong', color: 'blue' }
  if (score >= 50) return { tier: 'C', label: 'Caution', color: 'yellow' }
  return { tier: 'AVOID', label: 'Fade', color: 'red' }
}

/**
 * Score one WNBA player prop. Pure — server assembles the inputs.
 * Note: `seasonMinutes` is accepted for context but unused in v0 (last-5 minutes drive
 * both the minutes factor and the projection); `market`/`oddsTotal` are part of the
 * signature because usage and matchup are underivable without them.
 * @returns { score, tier, label, color, faded, fades, breakdown, projection, edge, stability } | null
 */
export function wnbaVerdict({
  market = 'player_points',
  perMinRate, last5Minutes, seasonMinutes, recentMaxMinutes, // eslint-disable-line no-unused-vars
  last5Rate, seasonRate, oddsTotal, oppSpread, evPct, line,
} = {}) {
  const ref = LEAGUE_REF_PER_MIN[market]
  if (!Number.isFinite(ref)) return null                                   // market not modeled
  const need = [perMinRate, last5Minutes, recentMaxMinutes, last5Rate, seasonRate, oddsTotal, oppSpread, evPct, line]
  if (!need.every(Number.isFinite)) return null                            // honest null — no filler
  if (seasonRate <= 0 || oddsTotal <= 0) return null                       // form/pace underivable

  const stability = minutesStability(last5Minutes, recentMaxMinutes)       // projected ÷ recent max
  if (stability == null) return null                                       // recentMax 0 → undefined
  let minutes = clamp01(last5Minutes / 36)
  if (stability < 0.6) minutes = Math.min(minutes, 0.5)                    // unstable rotation guard

  const usage = clamp01(perMinRate / ref)
  const matchup = clamp01(oddsTotal / 170)
  const recentForm = clamp01(0.5 + (last5Rate - seasonRate) / (2 * seasonRate))
  const gameScript = 1 - clamp01(Math.abs(oppSpread) / 16)
  const lineValue = clamp01(0.5 + evPct / 20)

  const score = wnbaPropScore({ minutes, usage, matchup, recentForm, gameScript, lineValue })
  if (score == null) return null

  // Projection = per-minute rate × projected (last-5 avg) minutes. Multipliers stay 1 in v0 —
  // we have no honest player-level usage/matchup/pace multipliers yet, and 1 = "no adjustment",
  // not a fabricated stat. Edge = projection − posted line.
  const projection = wnbaProjection({ statPerMinute: perMinRate, projectedMinutes: last5Minutes })
  const edge = propEdge(projection, line)
  if (projection == null || edge == null) return null

  const t = wnbaTier(score)
  return {
    score,
    ...t,
    faded: t.tier === 'AVOID',
    fades: [],
    breakdown: {
      minutes: Math.round(minutes * 100), usage: Math.round(usage * 100),
      form: Math.round(recentForm * 100), matchup: Math.round(matchup * 100),
      value: Math.round(lineValue * 100),
    },
    projection, edge, stability, market,
  }
}
