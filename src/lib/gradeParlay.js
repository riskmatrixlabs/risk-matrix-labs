// Pure parlay grader. Grades each leg vs its OWN final game using the strict
// straight-bet grader, then applies standard parlay rules: any leg lost → L
// (early, even if others aren't final); push legs drop; surviving wins recompute
// the payout; all-push → P; any ungradeable leg (and no loss) → null (stay Open).
import { gradeBetResult } from './gradeBetResult.js'
import { findEventForBet } from './betMatch.js'

const decFromAm = (a) => (a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1)

export function combineAmericanOdds(americanList) {
  const dec = americanList.reduce((p, a) => p * decFromAm(Number(a)), 1)
  if (dec >= 2) return Math.round((dec - 1) * 100)
  return Math.round(-100 / (dec - 1))
}

export function gradeParlay(bet, events) {
  const legs = Array.isArray(bet?.legs) ? bet.legs : null
  if (!legs || legs.length < 2) return { result: null, effectiveOdds: null }

  const graded = legs.map((leg) => {
    const legBet = { pick: leg.pick, odds: leg.odds, sport: leg.sport || bet.sport, event: leg.event, date: bet.date }
    const ev = findEventForBet(legBet, events)
    return ev ? gradeBetResult(legBet, ev) : null
  })

  if (graded.some((r) => r === 'L')) return { result: 'L', effectiveOdds: null }
  if (graded.some((r) => r == null)) return { result: null, effectiveOdds: null }

  const survivorOdds = legs.filter((_, i) => graded[i] === 'W').map((l) => Number(l.odds))
  if (survivorOdds.length === 0) return { result: 'P', effectiveOdds: null }
  return { result: 'W', effectiveOdds: combineAmericanOdds(survivorOdds) }
}
