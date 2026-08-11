import { describe, it, expect } from 'vitest'
import { nhlSogScore, nhlSogProjection, nhlExpectedGoals } from '../src/lib/models/nhlSog.js'

describe('nhlSogScore', () => {
  it('CONFIRMED weights: vol25 toi20 pp15 oppAllowed15 recent15 line10', () => {
    // 0.8*25+0.7*20+0.5*15+0.6*15+0.9*15+0.3*10 = 67
    expect(nhlSogScore({ shotVolume:0.8, timeOnIce:0.7, powerPlayRole:0.5, opponentSogAllowed:0.6, recentAttempts:0.9, lineValue:0.3 }))
      .toBeCloseTo(67, 2)
  })
  it('all inputs 1 → 100, all 0 → 0', () => {
    expect(nhlSogScore({ shotVolume:1, timeOnIce:1, powerPlayRole:1, opponentSogAllowed:1, recentAttempts:1, lineValue:1 })).toBeCloseTo(100, 2)
    expect(nhlSogScore({ shotVolume:0, timeOnIce:0, powerPlayRole:0, opponentSogAllowed:0, recentAttempts:0, lineValue:0 })).toBeCloseTo(0, 2)
  })
  it('null on non-finite input', () => {
    expect(nhlSogScore({ shotVolume:NaN, timeOnIce:0, powerPlayRole:0, opponentSogAllowed:0, recentAttempts:0, lineValue:0 })).toBe(null)
    expect(nhlSogScore({ shotVolume:0.5, timeOnIce:undefined, powerPlayRole:0, opponentSogAllowed:0, recentAttempts:0, lineValue:0 })).toBe(null)
  })
})

describe('nhlSogProjection', () => {
  it('shots/min × TOI × multipliers', () => {
    expect(nhlSogProjection({ shotsPerMinute:0.18, projectedToi:19.5, opponentMult:1.06, powerPlayMult:1.1, gameScriptMult:0.98 }))
      .toBeCloseTo(0.18*19.5*1.06*1.1*0.98, 2)
  })
  it('multipliers default to 1', () => {
    expect(nhlSogProjection({ shotsPerMinute:0.2, projectedToi:18 })).toBeCloseTo(3.6, 2)
  })
  it('null on non-finite input', () => {
    expect(nhlSogProjection({ shotsPerMinute:NaN, projectedToi:19 })).toBe(null)
    expect(nhlSogProjection({ shotsPerMinute:0.18, projectedToi:19, opponentMult:Infinity })).toBe(null)
  })
})

describe('nhlExpectedGoals', () => {
  it('xGF × adjustments', () => {
    expect(nhlExpectedGoals({ teamXgf:3.1, oppDefAdj:0.95, goalieAdj:1.04, specialTeamsAdj:1.02, restAdj:0.99 }))
      .toBeCloseTo(3.1*0.95*1.04*1.02*0.99, 3)
  })
  it('adjustments default to 1', () => {
    expect(nhlExpectedGoals({ teamXgf:2.8 })).toBeCloseTo(2.8, 3)
  })
  it('null on non-finite input', () => {
    expect(nhlExpectedGoals({ teamXgf:NaN })).toBe(null)
    expect(nhlExpectedGoals({ teamXgf:3.1, goalieAdj:NaN })).toBe(null)
  })
})
