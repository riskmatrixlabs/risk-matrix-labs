// NHL shots-on-goal engine — CONFIRMED ORIGINAL (MODELS.md §3) — do not alter weights.
// SOG props are the most stable market in hockey: shot volume is sticky, TOI is
// coach-controlled, and power-play deployment concentrates attempts. The score ranks
// how favorable a spot is (0–100); the projection converts rate × opportunity into an
// expected SOG number; expected goals adjusts a team's xGF baseline for tonight's context.
//
//   score      = shotVolume×25 + timeOnIce×20 + powerPlayRole×15
//              + opponentSogAllowed×15 + recentAttempts×15 + lineValue×10
//   projection = shots/min × projected TOI × opp allowance × PP adj × game script adj
//   xG         = team xGF × opp def adj × goalie adj × special teams adj × rest adj
//
// Score inputs are normalized 0–1. Any non-finite input → null (never NaN into the UI).

// Spot-quality score, 0–100. CONFIRMED weights: 25/20/15/15/15/10.
export function nhlSogScore({ shotVolume, timeOnIce, powerPlayRole, opponentSogAllowed, recentAttempts, lineValue }) {
  const inputs = [shotVolume, timeOnIce, powerPlayRole, opponentSogAllowed, recentAttempts, lineValue]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round((shotVolume * 25 + timeOnIce * 20 + powerPlayRole * 15 +
    opponentSogAllowed * 15 + recentAttempts * 15 + lineValue * 10) * 100) / 100
}

// Expected shots on goal: per-minute rate × projected ice time × context multipliers.
export function nhlSogProjection({ shotsPerMinute, projectedToi, opponentMult = 1, powerPlayMult = 1, gameScriptMult = 1 }) {
  const inputs = [shotsPerMinute, projectedToi, opponentMult, powerPlayMult, gameScriptMult]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round(shotsPerMinute * projectedToi * opponentMult * powerPlayMult * gameScriptMult * 100) / 100
}

// Team total: xGF baseline × opponent defense / goalie / special teams / rest adjustments.
export function nhlExpectedGoals({ teamXgf, oppDefAdj = 1, goalieAdj = 1, specialTeamsAdj = 1, restAdj = 1 }) {
  const inputs = [teamXgf, oppDefAdj, goalieAdj, specialTeamsAdj, restAdj]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round(teamXgf * oppDefAdj * goalieAdj * specialTeamsAdj * restAdj * 1000) / 1000
}
