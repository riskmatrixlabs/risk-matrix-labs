// Stake sizing — the discipline layer. A +EV edge is only half the job; how MUCH you
// stake is what protects the bankroll. We use FRACTIONAL Kelly (quarter by default):
// full Kelly is mathematically optimal for growth but far too swingy for a real bankroll,
// so disciplined operators bet a fraction of it.
//
//   full Kelly  f* = (b·p − q) / b      b = decimal − 1 (net odds), p = fairProb, q = 1−p
//   stake       = bankroll × f* × fraction      (never negative — no edge → no bet)
import { americanToDecimal } from './devig.js'

// Full-Kelly fraction of bankroll for a price at a given true win prob. 0 when not +EV.
export function kellyFraction(american, fairProb) {
  const dec = americanToDecimal(american)
  if (dec == null) return 0
  if (!(fairProb > 0 && fairProb < 1)) return 0   // never trust a non-probability — protects the bankroll
  const b = dec - 1
  if (b <= 0) return 0
  const f = (b * fairProb - (1 - fairProb)) / b
  return f > 0 ? f : 0
}

// Dollar stake under fractional Kelly. fraction = 0.25 → quarter Kelly (the safe default).
export function kellyStake(american, fairProb, bankroll, fraction = 0.25) {
  if (!(bankroll > 0)) return 0
  return Math.max(0, bankroll * kellyFraction(american, fairProb) * fraction)
}
