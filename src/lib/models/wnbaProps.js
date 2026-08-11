// WNBA props engine — CONFIRMED ORIGINAL (MODELS.md §1) — minutes/role first;
// do not alter weights. Minutes are the single biggest edge in the W: rotations
// are short, blowouts real, and a prop only cashes if the player is on the floor.
// Core order: Minutes → Usage → Matchup → Recent Form → Blowout Risk → Line Value.
//
//   WNBA Score = Minutes×25% + Usage/Role×20% + Matchup×20%
//              + Recent Form×15% + Game Script×10% + Line Value×10%
//   Projection = Per-Minute × Projected Minutes × Usage × Matchup × Pace
//   Filters:     Minutes Stability = Projected / Recent Max · Edge = Projected − Line
//
// Inputs to the score are normalized 0–1. Any non-finite input → null (never NaN into the UI).

// 0–100 score under the CONFIRMED weights (25/20/20/15/10/10). Rounded 2dp.
export function wnbaPropScore({ minutes, usage, matchup, recentForm, gameScript, lineValue } = {}) {
  const inputs = [minutes, usage, matchup, recentForm, gameScript, lineValue]
  if (!inputs.every(Number.isFinite)) return null
  const score = minutes * 25 + usage * 20 + matchup * 20 + recentForm * 15 + gameScript * 10 + lineValue * 10
  return Math.round(score * 100) / 100
}

// Stat projection: per-minute rate × projected minutes × usage/matchup/pace multipliers. Rounded 2dp.
export function wnbaProjection({ statPerMinute, projectedMinutes, usageMult = 1, matchupMult = 1, paceMult = 1 } = {}) {
  const inputs = [statPerMinute, projectedMinutes, usageMult, matchupMult, paceMult]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round(statPerMinute * projectedMinutes * usageMult * matchupMult * paceMult * 100) / 100
}

// Minutes stability filter: projected ÷ recent max. Null when recent max is 0 (no divide-by-zero). Rounded 3dp.
export function minutesStability(projectedMinutes, recentMaxMinutes) {
  if (!Number.isFinite(projectedMinutes) || !Number.isFinite(recentMaxMinutes) || recentMaxMinutes === 0) return null
  return Math.round((projectedMinutes / recentMaxMinutes) * 1000) / 1000
}

// Edge filter: model projection minus the posted line. Rounded 2dp.
export function propEdge(projected, line) {
  if (!Number.isFinite(projected) || !Number.isFinite(line)) return null
  return Math.round((projected - line) * 100) / 100
}
