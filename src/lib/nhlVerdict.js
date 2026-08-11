// NHL shots-on-goal verdict — pure. Built ON the CONFIRMED NHL SOG engine
// (src/lib/models/nhlSog.js, weights 25/20/15/15/15/10 — NEVER altered here). This file only
// DERIVES the six 0–1 inputs from real observed data and maps the resulting score into the
// same verdict shape PHLT/WNBA use ({ score, tier, label, color, faded, breakdown, ... })
// so the existing render path works unchanged.
//
// HONEST-NULL CONTRACT: every input must have a real, documented derivation. Any missing /
// non-finite input → return null (no verdict). Never a neutral-constant filler.
//
// Derivations (0–1):
//   shotVolume         = clamp01(sogPerGame / 4)            — season SOG/game vs a 4.0 elite-volume reference
//   timeOnIce          = clamp01(last5ToiMinutes / 22)      — last-5 avg TOI vs a 22-min top-line reference
//   powerPlayRole      = clamp01(sogPerGame / 3.5) × 0.5 + 0.25
//                        ⚠ SESSION-AUTHORED STRUCTURAL PROXY (2026-08-11), not a measured PP stat:
//                        no free per-player PP-TOI source exists yet, so role is proxied from shot
//                        volume (high-volume shooters get PP1 deployment). Range [0.25, 0.75] —
//                        deliberately never claims elite (1) or zero (0) PP usage. Replace with
//                        real PP TOI when a source lands.
//   opponentSogAllowed = clamp01(0.5 + (oppSogAllowedPerGame − 30) / 20)
//                        — opponent SOG allowed/game vs league ref ~30 (30→0.5, 40→1, 20→0)
//   recentAttempts     = clamp01(0.5 + (last5SogPerGame − sogPerGame) / (2 × sogPerGame))
//                        — form-shaped like WNBA recentForm
//   lineValue          = clamp01(0.5 + evPct / 20)          — from the prop's real de-vig edge
import { nhlSogScore, nhlSogProjection } from './models/nhlSog.js'

const clamp01 = (n) => Math.max(0, Math.min(1, n))

// The only NHL market modeled here (key verified in src/lib/propMarkets.js).
export const NHL_SOG_MARKET = 'player_shots_on_goal'

// Defensive ESPN ice-time parser: skater gamelogs carry TOI as 'MM:SS'. Also accepts plain
// numeric minutes. Anything else (DNP, '--', empty) → null, never NaN.
export function parseToi(v) {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (!s) return null
  const m = s.match(/^(\d+):([0-5]\d)$/)
  if (m) return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10) / 60) * 100) / 100
  const n = parseFloat(s)
  return Number.isFinite(n) && /^\d+(\.\d+)?$/.test(s) ? n : null
}

// Tier map: ≥75 A, ≥62 B, ≥50 C, else AVOID — same shape as src/lib/phlt.js tierFor.
export function nhlTier(score) {
  if (score >= 75) return { tier: 'A', label: 'Prime', color: 'green' }
  if (score >= 62) return { tier: 'B', label: 'Strong', color: 'blue' }
  if (score >= 50) return { tier: 'C', label: 'Caution', color: 'yellow' }
  return { tier: 'AVOID', label: 'Fade', color: 'red' }
}

/**
 * Score one NHL shots-on-goal prop. Pure — server assembles the inputs.
 * @returns { score, tier, label, color, faded, fades, breakdown, projection, edge, market } | null
 */
export function nhlVerdict({
  market = NHL_SOG_MARKET,
  sogPerGame, seasonToiMinutes, last5ToiMinutes, last5SogPerGame,
  oppSogAllowedPerGame, evPct, line,
} = {}) {
  if (market !== NHL_SOG_MARKET) return null                              // market not modeled
  const need = [sogPerGame, seasonToiMinutes, last5ToiMinutes, last5SogPerGame, oppSogAllowedPerGame, evPct, line]
  if (!need.every(Number.isFinite)) return null                           // honest null — no filler
  if (sogPerGame <= 0 || seasonToiMinutes <= 0) return null               // form/rate divisions underivable

  const shotVolume = clamp01(sogPerGame / 4)
  const timeOnIce = clamp01(last5ToiMinutes / 22)
  const powerPlayRole = clamp01(sogPerGame / 3.5) * 0.5 + 0.25            // session-authored proxy — see header
  const opponentSogAllowed = clamp01(0.5 + (oppSogAllowedPerGame - 30) / 20)
  const recentAttempts = clamp01(0.5 + (last5SogPerGame - sogPerGame) / (2 * sogPerGame))
  const lineValue = clamp01(0.5 + evPct / 20)

  const score = nhlSogScore({ shotVolume, timeOnIce, powerPlayRole, opponentSogAllowed, recentAttempts, lineValue })
  if (score == null) return null

  // Projection = season SOG/min × projected (last-5 avg) TOI. Multipliers stay 1 in v0 —
  // no honest opponent/PP/game-script multipliers yet, and 1 = "no adjustment", not a
  // fabricated stat. Edge = projection − posted line.
  const projection = nhlSogProjection({ shotsPerMinute: sogPerGame / seasonToiMinutes, projectedToi: last5ToiMinutes })
  if (projection == null) return null
  const edge = Math.round((projection - line) * 100) / 100

  const t = nhlTier(score)
  return {
    score,
    ...t,
    faded: t.tier === 'AVOID',
    fades: [],
    breakdown: {
      volume: Math.round(shotVolume * 100), toi: Math.round(timeOnIce * 100),
      role: Math.round(powerPlayRole * 100), matchup: Math.round(opponentSogAllowed * 100),
      value: Math.round(lineValue * 100),
    },
    projection, edge, market,
  }
}
