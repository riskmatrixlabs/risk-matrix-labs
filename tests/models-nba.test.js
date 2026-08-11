import { describe, it, expect } from 'vitest'
import { nbaPropScore, nbaProjection, adjustedMinutes } from '../src/lib/models/nbaProps.js'

describe('nbaPropScore', () => {
  it('CONFIRMED weights: min20 usage20 matchup20 pace10 form10 injury10 line10', () => {
    // 0.9*20+0.8*20+0.7*20+0.6*10+0.5*10+1*10+0.4*10 = 73
    expect(nbaPropScore({ minutes:0.9, usage:0.8, matchup:0.7, pace:0.6, recentForm:0.5, injuryRole:1, lineValue:0.4 }))
      .toBeCloseTo(73, 2)
  })
  it('null on junk', () => {
    expect(nbaPropScore({ minutes:undefined, usage:0, matchup:0, pace:0, recentForm:0, injuryRole:0, lineValue:0 })).toBe(null)
  })
})
describe('nbaProjection', () => {
  it('per-minute × minutes × multipliers', () => {
    expect(nbaProjection({ statPerMinute:0.62, expectedMinutes:34, usageMult:1.05, paceMult:1.02, opponentMult:0.97 }))
      .toBeCloseTo(0.62*34*1.05*1.02*0.97, 2)
  })
})
describe('adjustedMinutes', () => {
  it('MODELS.md blowout formula, default penalty 0.18', () => {
    expect(adjustedMinutes(34, 0.5)).toBeCloseTo(34*(1-0.5*0.18), 2)  // 30.94
  })
  it('zero blowout prob = base minutes', () => { expect(adjustedMinutes(34, 0)).toBe(34) })
})
