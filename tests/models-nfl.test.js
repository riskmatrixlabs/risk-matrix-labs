import { describe, it, expect } from 'vitest'
import { nflSideScore, nflExpectedPoints, nflProjectedTotal } from '../src/lib/models/nflSide.js'

describe('nflSideScore', () => {
  it('applies the reconstruction weights exactly', () => {
    // 0.8*20 + 0.5*10 + 0.6*15 + 0.4*10 + 0.5*10 + 0.7*10 + 0.5*5 + 0.5*5 + 0.9*15
    // = 16 + 5 + 9 + 4 + 5 + 7 + 2.5 + 2.5 + 13.5 = 64.5
    // (plan doc said 63.5 — arithmetic error in the plan; MODELS.md §5 weights are authoritative)
    expect(nflSideScore({ qbEdge:0.8, offensiveLine:0.5, defensiveMatchup:0.6, explosivePlay:0.4,
      turnoverRegression:0.5, injuryEdge:0.7, restTravel:0.5, weather:0.5, lineValue:0.9 })).toBeCloseTo(64.5, 2)
  })
  it('all inputs 1 → 100', () => {
    expect(nflSideScore({ qbEdge:1, offensiveLine:1, defensiveMatchup:1, explosivePlay:1,
      turnoverRegression:1, injuryEdge:1, restTravel:1, weather:1, lineValue:1 })).toBeCloseTo(100, 2)
  })
  it('all inputs 0.5 → 50', () => {
    expect(nflSideScore({ qbEdge:0.5, offensiveLine:0.5, defensiveMatchup:0.5, explosivePlay:0.5,
      turnoverRegression:0.5, injuryEdge:0.5, restTravel:0.5, weather:0.5, lineValue:0.5 })).toBeCloseTo(50, 2)
  })
  it('null on non-finite input', () => {
    expect(nflSideScore({ qbEdge:NaN, offensiveLine:0, defensiveMatchup:0, explosivePlay:0,
      turnoverRegression:0, injuryEdge:0, restTravel:0, weather:0, lineValue:0 })).toBe(null)
  })
})

describe('nflExpectedPoints', () => {
  it('EPA/play × plays × adjustments', () => {
    expect(nflExpectedPoints({ epaPerPlay:0.05, expectedPlays:63, oppAdj:1.1, rzAdj:0.95, weatherAdj:1 }))
      .toBeCloseTo(0.05*63*1.1*0.95, 4)
  })
  it('adjustments default to 1', () => {
    expect(nflExpectedPoints({ epaPerPlay:0.05, expectedPlays:60 })).toBeCloseTo(3, 2)
  })
  it('null on non-finite input', () => {
    expect(nflExpectedPoints({ epaPerPlay:Infinity, expectedPlays:63 })).toBe(null)
  })
})

describe('nflProjectedTotal', () => {
  it('home + away', () => { expect(nflProjectedTotal(24.5, 20.25)).toBeCloseTo(44.75, 2) })
  it('null on non-finite input', () => { expect(nflProjectedTotal(24.5, undefined)).toBe(null) })
})
