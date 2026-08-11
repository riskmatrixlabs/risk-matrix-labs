// NFL side engine — ⚠️ RECONSTRUCTION (MODELS.md §5) — matches the system's shape,
// NOT the exact recovered original; open to calibration.
//
// A side score answers "how much does this matchup favor one team beyond the line?"
// Nine normalized 0–1 factors, weighted by how much each historically decides NFL games:
// QB play dominates (×20), then defensive matchup and line value (×15 each), with the
// situational factors (rest/travel, weather) intentionally small (×5 each).
//
//   score = qb×20 + ol×10 + defMatchup×15 + explosive×10 + turnoverReg×10
//         + injury×10 + restTravel×5 + weather×5 + lineValue×15        (0–100)
//
// Totals side: Expected Points = EPA/play × Expected Plays × Opp Adj × RZ Adj × Weather Adj,
// and Projected Total = Home Expected Points + Away Expected Points.
//
// Guardrail: any non-finite input → null (never NaN into the UI).

const round2 = (n) => Math.round(n * 100) / 100

// 0–100 side score from nine normalized 0–1 factors. Weights verbatim from MODELS.md §5.
export function nflSideScore({ qbEdge, offensiveLine, defensiveMatchup, explosivePlay,
  turnoverRegression, injuryEdge, restTravel, weather, lineValue }) {
  const inputs = [qbEdge, offensiveLine, defensiveMatchup, explosivePlay,
    turnoverRegression, injuryEdge, restTravel, weather, lineValue]
  if (!inputs.every(Number.isFinite)) return null
  return round2(
    qbEdge * 20 + offensiveLine * 10 + defensiveMatchup * 15 + explosivePlay * 10 +
    turnoverRegression * 10 + injuryEdge * 10 + restTravel * 5 + weather * 5 + lineValue * 15
  )
}

// Expected points for one team: EPA/play × plays × opponent/red-zone/weather adjustments.
export function nflExpectedPoints({ epaPerPlay, expectedPlays, oppAdj = 1, rzAdj = 1, weatherAdj = 1 }) {
  const inputs = [epaPerPlay, expectedPlays, oppAdj, rzAdj, weatherAdj]
  if (!inputs.every(Number.isFinite)) return null
  return epaPerPlay * expectedPlays * oppAdj * rzAdj * weatherAdj
}

// Projected game total = home expected points + away expected points.
export function nflProjectedTotal(homePts, awayPts) {
  if (!Number.isFinite(homePts) || !Number.isFinite(awayPts)) return null
  return round2(homePts + awayPts)
}
