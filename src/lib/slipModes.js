// Pure helpers for the 4-way bet slip (Straight · Parlay · Same Game Parlay · Round Robin).
// Extracted from App.jsx so the combo math + tab eligibility are unit-testable.

export const gameKey = (l) => `${l?.sport || ''}|${l?.event || ''}`

// Group legs by their game → [ [gameKey, legs[]], ... ]
export function groupByGame(legs) {
  const m = {}
  for (const l of (legs || [])) { (m[gameKey(l)] ||= []).push(l) }
  return Object.entries(m)
}

// All k-combinations of an array (round-robin combos). Empty if k out of range.
export function kCombos(arr, k) {
  const res = []
  if (!Array.isArray(arr) || k < 1 || k > arr.length) return res
  const rec = (start, combo) => {
    if (combo.length === k) { res.push(combo.slice()); return }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop() }
  }
  rec(0, [])
  return res
}

// Round-robin combos of size k, EXCLUDING any combo with two legs from the same game
// (same-game legs are correlated → not allowed in a standard parlay combo).
export function validRoundRobinCombos(legs, k) {
  return kCombos(legs || [], k).filter(c => new Set(c.map(gameKey)).size === c.length)
}

// Which slip modes are valid for these enabled legs:
//  - Same Game Parlay needs ≥1 game with 2+ legs
//  - Round Robin needs ≥3 legs spanning ≥2 different games (combos are built cross-game only;
//    same-game pairings are excluded, so 2-and-2 across two games is valid).
export function slipEligibility(legs) {
  const list = legs || []
  const groups = groupByGame(list)
  const sgpGroups = groups.filter(([, ls]) => ls.length >= 2)
  const distinctGames = groups.length
  const oneLegPerGame = distinctGames > 0 && groups.every(([, ls]) => ls.length === 1)
  return {
    groups,
    sgpGroups,
    distinctGames,
    sgpOk: sgpGroups.length > 0,
    oneLegPerGame,
    rrOk: list.length >= 3 && distinctGames >= 2,
    maxRrSize: distinctGames,   // a valid combo can't be larger than the number of games
  }
}
