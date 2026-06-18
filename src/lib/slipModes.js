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

// Which slip modes are valid for these enabled legs:
//  - Same Game Parlay needs ≥1 game with 2+ legs
//  - Round Robin needs ≥3 legs AND one leg per game (no same-game correlation)
export function slipEligibility(legs) {
  const list = legs || []
  const groups = groupByGame(list)
  const sgpGroups = groups.filter(([, ls]) => ls.length >= 2)
  const oneLegPerGame = groups.length > 0 && groups.every(([, ls]) => ls.length === 1)
  return {
    groups,
    sgpGroups,
    sgpOk: sgpGroups.length > 0,
    oneLegPerGame,
    rrOk: oneLegPerGame && list.length >= 3,
  }
}
