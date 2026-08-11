import { describe, it, expect } from 'vitest'
import { wnbaPropScore, wnbaProjection, minutesStability, propEdge } from '../src/lib/models/wnbaProps.js'

describe('wnbaPropScore', () => {
  it('CONFIRMED weights: min25 usage20 matchup20 form15 script10 line10', () => {
    // 0.9*25+0.7*20+0.6*20+0.8*15+0.5*10+0.4*10 = 69.5
    expect(wnbaPropScore({ minutes:0.9, usage:0.7, matchup:0.6, recentForm:0.8, gameScript:0.5, lineValue:0.4 }))
      .toBeCloseTo(69.5, 2)
  })
  it('null on non-finite input', () => {
    expect(wnbaPropScore({ minutes:NaN, usage:0.7, matchup:0.6, recentForm:0.8, gameScript:0.5, lineValue:0.4 })).toBe(null)
    expect(wnbaPropScore({ minutes:0.9, usage:0.7, matchup:0.6, recentForm:0.8, gameScript:0.5 })).toBe(null)
  })
})
describe('wnbaProjection', () => {
  it('per-minute × minutes × multipliers', () => {
    expect(wnbaProjection({ statPerMinute:0.45, projectedMinutes:31, usageMult:1.08, matchupMult:0.96, paceMult:1.03 }))
      .toBeCloseTo(0.45*31*1.08*0.96*1.03, 2)
  })
  it('defaults multipliers to 1', () => {
    expect(wnbaProjection({ statPerMinute:0.5, projectedMinutes:30 })).toBeCloseTo(15, 2)
  })
  it('null on non-finite input', () => {
    expect(wnbaProjection({ statPerMinute:Infinity, projectedMinutes:30 })).toBe(null)
  })
})
describe('filters', () => {
  it('minutes stability = projected / recent max', () => { expect(minutesStability(28, 32)).toBeCloseTo(0.875, 3) })
  it('stability null when recent max is 0', () => { expect(minutesStability(28, 0)).toBe(null) })
  it('stability null on junk', () => { expect(minutesStability(NaN, 32)).toBe(null) })
  it('edge = projected − line', () => { expect(propEdge(14.8, 13.5)).toBeCloseTo(1.3, 2) })
  it('edge null on junk', () => { expect(propEdge(14.8, undefined)).toBe(null) })
})
