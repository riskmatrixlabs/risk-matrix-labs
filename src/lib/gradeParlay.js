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

// Push-aware payout odds for a MANUALLY-settled parlay. Mirrors gradeParlay's
// push-reduction rule (drop pushed legs, recompute combined odds from the
// survivors) but driven by user-marked per-leg `pushed` flags instead of game
// finals. Returns the American odds to use for the WIN payout:
//   - any surviving leg has its own price → combined survivor odds
//   - every surviving leg pushed (all-push) → null (caller treats as PUSH, $0)
//   - survivors have no per-leg prices logged → ticketOdds (can't reduce, pay full)
// Pure — no side effects, used by both the editor and its tests.
export function manualParlayWinOdds(legs, ticketOdds) {
  const list = Array.isArray(legs) ? legs : []
  const survivors = list.filter((l) => !l?.pushed)
  if (list.length >= 2 && survivors.length === 0) return null // all-push → push
  const survivorOdds = survivors
    .map((l) => Number(l?.odds))
    .filter((o) => Number.isFinite(o) && o !== 0)
  // Only reduce when EVERY survivor has a usable price; otherwise we can't
  // recompute honestly, so fall back to the entered ticket odds.
  if (survivorOdds.length > 0 && survivorOdds.length === survivors.length) {
    return combineAmericanOdds(survivorOdds)
  }
  return Number(ticketOdds)
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
