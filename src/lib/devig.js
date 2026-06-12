// American-odds math + two-way de-vig (no-vig fair odds + hold %). Pure, no deps.

export function americanToImplied(odds) {
  const n = Number(odds)
  if (odds === null || odds === undefined || Number.isNaN(n) || n === 0) return null
  return n < 0 ? (-n) / (-n + 100) : 100 / (n + 100)
}

export function americanToDecimal(odds) {
  const n = Number(odds)
  if (odds === null || odds === undefined || Number.isNaN(n) || n === 0) return null
  return n < 0 ? 1 + 100 / (-n) : 1 + n / 100
}

// Inverse: fair implied probability (0..1) → American odds.
export function impliedToAmerican(prob) {
  const p = Number(prob)
  if (Number.isNaN(p) || p <= 0 || p >= 1) return null
  return p > 0.5 ? -((p / (1 - p)) * 100) : ((1 - p) / p) * 100
}

// De-vig a two-way market. Returns fair (no-vig) probabilities for each side,
// the no-vig fair American line for each side, and the book hold % (the vig).
export function devigTwoWay(oddsA, oddsB) {
  const pa = americanToImplied(oddsA)
  const pb = americanToImplied(oddsB)
  if (pa === null || pb === null) return null
  const total = pa + pb
  const fairA = pa / total
  const fairB = pb / total
  return {
    fairA, fairB,
    fairAmericanA: impliedToAmerican(fairA),
    fairAmericanB: impliedToAmerican(fairB),
    holdPct: (total - 1) * 100,
  }
}
