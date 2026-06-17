// Offense-side O/U signals — lineup xwOBA (platoon-adjusted) + recent scoring form.
// Pure scoring fns below are I/O-free and unit-tested; getOffense() (added in a later task) fetches.

export const OFF = {
  xwobaStrong: 0.335,
  xwobaWeak:   0.305,
  formHigh:    9.8,
  formLow:     8.0,
  minBatters:  6,
}

export function platoonMult(batSide, starterHand) {
  if (!batSide || !starterHand) return 1
  if (batSide === 'S') return 1.03
  return batSide !== starterHand ? 1.05 : 0.95
}

export function lineupXwoba(batters, savantBatters, starterHand, norm) {
  if (!Array.isArray(batters) || !batters.length) return null
  let sum = 0, n = 0
  for (const b of batters) {
    const s = savantBatters?.[norm(b.name)]
    if (!s || s.xwoba == null) continue
    sum += s.xwoba * platoonMult(b.batSide, starterHand)
    n++
  }
  if (n < OFF.minBatters) return null
  return { xwoba: +(sum / n).toFixed(3), n }
}

export function offenseFactor(awayXwoba, homeXwoba) {
  if (awayXwoba == null || homeXwoba == null) return { score: 0, reason: null }
  const both = (cmp) => cmp(awayXwoba) && cmp(homeXwoba)
  if (both((x) => x >= OFF.xwobaStrong)) return { score: 1, reason: 'hot bats' }
  if (both((x) => x <= OFF.xwobaWeak))   return { score: -1, reason: 'cold lineups' }
  return { score: 0, reason: null }
}

export function formFactor(combinedRpg) {
  if (combinedRpg == null) return { score: 0, reason: null }
  if (combinedRpg >= OFF.formHigh) return { score: 1, reason: `high-scoring form (${combinedRpg.toFixed(1)})` }
  if (combinedRpg <= OFF.formLow)  return { score: -1, reason: `low-scoring form (${combinedRpg.toFixed(1)})` }
  return { score: 0, reason: null }
}
