import { describe, it, expect } from 'vitest'
import { kellyFraction, kellyStake } from '../src/lib/kelly.js'

describe('kellyFraction', () => {
  it('is 0 when there is no edge (fair coin at even money)', () => {
    expect(kellyFraction(100, 0.5)).toBe(0)
  })
  it('is positive on a +EV price (even money, 55% true)', () => {
    // b=1, p=0.55 → f* = (1*0.55 - 0.45)/1 = 0.10
    expect(kellyFraction(100, 0.55)).toBeCloseTo(0.10, 6)
  })
  it('never goes negative on a -EV price', () => {
    expect(kellyFraction(100, 0.40)).toBe(0)
  })
  it('rejects out-of-range probabilities (never over-bets on bad input)', () => {
    expect(kellyFraction(100, 60)).toBe(0)     // 60 (a percent) is not a probability
    expect(kellyFraction(100, 1.05)).toBe(0)   // >1 must never stake >100%
    expect(kellyFraction(100, 0)).toBe(0)
    expect(kellyFraction(100, 1)).toBe(0)
  })
  it('handles favorites (-150, 65% true)', () => {
    // dec=1.6667, b=0.6667, p=0.65 → f* = (0.6667*0.65 - 0.35)/0.6667 = 0.125
    expect(kellyFraction(-150, 0.65)).toBeCloseTo(0.125, 3)
  })
})

describe('kellyStake', () => {
  it('quarter-Kelly stakes a fraction of bankroll', () => {
    // full f*=0.10 on $1000 → quarter = $25
    expect(kellyStake(100, 0.55, 1000, 0.25)).toBeCloseTo(25, 6)
  })
  it('is 0 with no bankroll or no edge', () => {
    expect(kellyStake(100, 0.55, 0)).toBe(0)
    expect(kellyStake(100, 0.50, 1000)).toBe(0)
  })
})
