// NBA props engine — CONFIRMED ORIGINAL (MODELS.md §2) — do not alter weights.
// The WNBA core with stronger pace/injury/blowout handling: minutes and role still lead,
// but NBA rotations swing harder on pace and injury news, so those carry explicit weight.
// All score inputs are normalized 0–1; output is the internal 0–100 scale.
//
//   NBA Score = Minutes×20 + Usage×20 + Matchup×20 + Pace×10 + Recent Form×10 + Injury/Role×10 + Line Value×10
//   Projection = Per-Minute × Expected Minutes × Usage × Pace × Opponent
//   Blowout:  Adjusted Minutes = Base × (1 − Blowout Prob × Blowout Penalty)   (penalty default 0.18)
//
// Any non-finite input → null (never NaN into the UI).

// 0–100 prop score under the CONFIRMED weight vector. Null-guards every input.
export function nbaPropScore({ minutes, usage, matchup, pace, recentForm, injuryRole, lineValue }) {
  const inputs = [minutes, usage, matchup, pace, recentForm, injuryRole, lineValue]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round((minutes*20 + usage*20 + matchup*20 + pace*10 + recentForm*10 + injuryRole*10 + lineValue*10) * 100) / 100
}

// Stat projection: per-minute rate × expected minutes × usage/pace/opponent multipliers.
export function nbaProjection({ statPerMinute, expectedMinutes, usageMult = 1, paceMult = 1, opponentMult = 1 }) {
  const inputs = [statPerMinute, expectedMinutes, usageMult, paceMult, opponentMult]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round(statPerMinute * expectedMinutes * usageMult * paceMult * opponentMult * 100) / 100
}

// Blowout-adjusted minutes — shaves expected minutes by blowout probability × penalty.
export function adjustedMinutes(baseMinutes, blowoutProbability, blowoutPenalty = 0.18) {
  const inputs = [baseMinutes, blowoutProbability, blowoutPenalty]
  if (!inputs.every(Number.isFinite)) return null
  return Math.round(baseMinutes * (1 - blowoutProbability * blowoutPenalty) * 100) / 100
}
