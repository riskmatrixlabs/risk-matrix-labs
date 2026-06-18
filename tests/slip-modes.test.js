import { describe, it, expect } from 'vitest'
import { gameKey, groupByGame, kCombos, slipEligibility, validRoundRobinCombos } from '../src/lib/slipModes.js'

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
  it('Round Robin ON with 2-and-2 across two games (combos exclude same-game pairs)', () => {
    const legs = [leg('A1', 'A vs B'), leg('A2', 'A vs B'), leg('C1', 'C vs D'), leg('C2', 'C vs D')]
    const e = slipEligibility(legs)
    expect(e.rrOk).toBe(true)            // 4 legs across 2 games → RR allowed
    expect(e.distinctGames).toBe(2)
    expect(e.maxRrSize).toBe(2)          // a valid combo can't exceed # of games
    expect(e.sgpOk).toBe(true)           // each game has 2 legs → SGP also available
  })
  it('Round Robin ON with 3 legs from 3 different games', () => {
    const legs = [leg('A', 'A vs B'), leg('C', 'C vs D'), leg('E', 'E vs F')]
    const e = slipEligibility(legs)
    expect(e.rrOk).toBe(true)
    expect(e.distinctGames).toBe(3)
    expect(e.sgpOk).toBe(false)
  })
  it('Round Robin OFF when all legs are from ONE game (no cross-game combo)', () => {
    const legs = [leg('A1', 'A vs B'), leg('A2', 'A vs B'), leg('A3', 'A vs B')]
    const e = slipEligibility(legs)
    expect(e.rrOk).toBe(false)
    expect(e.sgpOk).toBe(true)
  })
  it('2 legs different games → no RR (needs 3)', () => {
    expect(slipEligibility([leg('A', 'A vs B'), leg('C', 'C vs D')]).rrOk).toBe(false)
  })
})

describe('validRoundRobinCombos', () => {
  it('excludes same-game pairs (2-and-2 by 2s → only the 4 cross-game combos)', () => {
    const legs = [leg('A1', 'A vs B'), leg('A2', 'A vs B'), leg('C1', 'C vs D'), leg('C2', 'C vs D')]
    const cs = validRoundRobinCombos(legs, 2)
    expect(cs.length).toBe(4)   // A1C1, A1C2, A2C1, A2C2 — NOT A1A2 or C1C2
    expect(cs.every(c => new Set(c.map(gameKey)).size === c.length)).toBe(true)
  })
  it('by 3s across only 2 games → 0 valid (any 3 must repeat a game)', () => {
    const legs = [leg('A1', 'A vs B'), leg('A2', 'A vs B'), leg('C1', 'C vs D')]
    expect(validRoundRobinCombos(legs, 3).length).toBe(0)
  })
})
