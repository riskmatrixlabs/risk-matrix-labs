import { describe, it, expect } from 'vitest'
import { gameKey, groupByGame, kCombos, slipEligibility } from '../src/lib/slipModes.js'

const leg = (pick, event, sport = 'MLB') => ({ pick, event, sport })

describe('kCombos', () => {
  it('generates all k-combinations', () => {
    expect(kCombos([1, 2, 3], 2)).toEqual([[1, 2], [1, 3], [2, 3]])
    expect(kCombos([1, 2, 3, 4], 3).length).toBe(4)   // C(4,3)=4
    expect(kCombos([1, 2, 3, 4], 2).length).toBe(6)   // C(4,2)=6
  })
  it('returns [] for out-of-range k', () => {
    expect(kCombos([1, 2], 3)).toEqual([])
    expect(kCombos([1, 2], 0)).toEqual([])
    expect(kCombos([], 2)).toEqual([])
  })
  it('k===n returns the single full combo', () => {
    expect(kCombos([1, 2, 3], 3)).toEqual([[1, 2, 3]])
  })
})

describe('groupByGame / gameKey', () => {
  it('groups legs by sport+event', () => {
    const legs = [leg('A ML', 'A vs B'), leg('Over 8', 'A vs B'), leg('C ML', 'C vs D')]
    const g = groupByGame(legs)
    expect(g.length).toBe(2)
    expect(g.find(([k]) => k === gameKey(legs[0]))[1].length).toBe(2)
  })
})

describe('slipEligibility', () => {
  it('Same Game ON when a game has 2+ legs; Round Robin OFF (same-game correlation)', () => {
    const legs = [leg('A ML', 'A vs B'), leg('Over 8', 'A vs B'), leg('C ML', 'C vs D')]
    const e = slipEligibility(legs)
    expect(e.sgpOk).toBe(true)
    expect(e.sgpGroups.length).toBe(1)
    expect(e.rrOk).toBe(false)        // two legs share "A vs B"
    expect(e.oneLegPerGame).toBe(false)
  })
  it('Round Robin ON with 3 legs from 3 different games; Same Game OFF', () => {
    const legs = [leg('A ML', 'A vs B'), leg('C ML', 'C vs D'), leg('E ML', 'E vs F')]
    const e = slipEligibility(legs)
    expect(e.rrOk).toBe(true)
    expect(e.oneLegPerGame).toBe(true)
    expect(e.sgpOk).toBe(false)
  })
  it('2 legs different games → no RR (needs 3), no SGP', () => {
    const e = slipEligibility([leg('A ML', 'A vs B'), leg('C ML', 'C vs D')])
    expect(e.rrOk).toBe(false)
    expect(e.sgpOk).toBe(false)
  })
})
