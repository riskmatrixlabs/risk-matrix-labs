// rrQuality — honest derivation of the four RR score inputs from real slip data.
import { describe, it, expect } from 'vitest'
import { rrQuality } from '../src/lib/rrQuality.js'

const leg = (sport, event, evPct) => ({ sport, event, evPct })

describe('rrQuality', () => {
  it('scores 3 cross-game legs with evPct (hand-computed)', () => {
    const legs = [leg('MLB', 'A@B', 8), leg('MLB', 'C@D', 5), leg('NBA', 'E@F', 3)]
    const q = rrQuality(legs, { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll: 1000 })
    // legScores: 100, 85, 70 → mean 85; independence 100; correlation 0; exposure 3
    // score = 85*0.70 + 100*0.20 − 0*0.05 − 3*0.05 = 79.35
    expect(q).not.toBeNull()
    expect(q.legScores).toEqual([100, 85, 70])
    expect(q.independence).toBe(100)
    expect(q.correlation).toBe(0)
    expect(q.exposure).toBe(3)
    expect(q.score).toBe(79.35)
    expect(q.tier).toBe('STRONG')
  })

  it('returns null when any leg is missing evPct (no fake leg quality)', () => {
    const legs = [leg('MLB', 'A@B', 8), leg('MLB', 'C@D', null), leg('NBA', 'E@F', 3)]
    expect(rrQuality(legs, { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll: 1000 })).toBeNull()
    const legs2 = [leg('MLB', 'A@B', 8), { sport: 'MLB', event: 'C@D' }, leg('NBA', 'E@F', 3)]
    expect(rrQuality(legs2, { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll: 1000 })).toBeNull()
  })

  it('same-game pair raises correlation and lowers independence', () => {
    const legs = [leg('MLB', 'A@B', 5), leg('MLB', 'A@B', 5), leg('NBA', 'E@F', 5)]
    const q = rrQuality(legs, { rrSize: 2, stakePerCombo: 10, totalCombos: 2, bankroll: 1000 })
    expect(q).not.toBeNull()
    expect(q.independence).toBeCloseTo((2 / 3) * 100, 5)
    expect(q.correlation).toBeCloseTo((1 / 3) * 100, 5)
    const cross = rrQuality(
      [leg('MLB', 'A@B', 5), leg('MLB', 'C@D', 5), leg('NBA', 'E@F', 5)],
      { rrSize: 2, stakePerCombo: 10, totalCombos: 2, bankroll: 1000 })
    expect(q.score).toBeLessThan(cross.score)
  })

  it('exposure caps at 100', () => {
    const legs = [leg('MLB', 'A@B', 5), leg('MLB', 'C@D', 5), leg('NBA', 'E@F', 5)]
    const q = rrQuality(legs, { rrSize: 2, stakePerCombo: 500, totalCombos: 3, bankroll: 100 })
    expect(q.exposure).toBe(100)
  })

  it('bankroll 0 / negative / non-finite → null', () => {
    const legs = [leg('MLB', 'A@B', 5), leg('MLB', 'C@D', 5), leg('NBA', 'E@F', 5)]
    for (const bankroll of [0, -50, NaN, Infinity, null, undefined]) {
      expect(rrQuality(legs, { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll })).toBeNull()
    }
  })

  it('empty or missing legs → null', () => {
    expect(rrQuality([], { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll: 1000 })).toBeNull()
    expect(rrQuality(null, { rrSize: 2, stakePerCombo: 10, totalCombos: 3, bankroll: 1000 })).toBeNull()
  })
})
