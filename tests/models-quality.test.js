import { describe, it, expect } from 'vitest'
import { ladderScore, roundRobinScore } from '../src/lib/models/qualityScores.js'

describe('ladderScore', () => {
  it('CONFIRMED weights 35/25/15/15/10', () => {
    // 80*.35+70*.25+90*.15+60*.15+100*.10 = 28+17.5+13.5+9+10 = 78
    expect(ladderScore({ phlt: 80, ev: 70, lineSafety: 90, bankrollFit: 60, discipline: 100 })).toBeCloseTo(78, 2)
  })
  it('rounds to 2dp like the source', () => {
    // 81*.35+73*.25+66*.15+59*.15+92*.10 = 28.35+18.25+9.9+8.85+9.2 = 74.55
    expect(ladderScore({ phlt: 81, ev: 73, lineSafety: 66, bankrollFit: 59, discipline: 92 })).toBe(74.55)
  })
  it('null on junk', () => {
    expect(ladderScore({ phlt: NaN, ev: 0, lineSafety: 0, bankrollFit: 0, discipline: 0 })).toBe(null)
    expect(ladderScore({ phlt: 80, ev: 70, lineSafety: Infinity, bankrollFit: 60, discipline: 100 })).toBe(null)
    expect(ladderScore({ phlt: 80, ev: 70, lineSafety: 90, bankrollFit: 60 })).toBe(null)
  })
})

describe('roundRobinScore', () => {
  it('CONFIRMED formula: mean×0.70 + indep×0.20 − corr×0.05 − expo×0.05', () => {
    // mean([80,70,90])=80 → 80*.7+75*.2-40*.05-20*.05 = 56+15-2-1 = 68
    expect(roundRobinScore({ legScores: [80, 70, 90], independenceScore: 75, correlationPenalty: 40, exposurePenalty: 20 }))
      .toBeCloseTo(68, 2)
  })
  it('single leg works (mean = the leg)', () => {
    // 60*.7+50*.2-10*.05-0*.05 = 42+10-0.5 = 51.5
    expect(roundRobinScore({ legScores: [60], independenceScore: 50, correlationPenalty: 10, exposurePenalty: 0 })).toBe(51.5)
  })
  it('null on empty legs', () => {
    expect(roundRobinScore({ legScores: [], independenceScore: 0, correlationPenalty: 0, exposurePenalty: 0 })).toBe(null)
  })
  it('null on junk', () => {
    expect(roundRobinScore({ legScores: [80, NaN], independenceScore: 0, correlationPenalty: 0, exposurePenalty: 0 })).toBe(null)
    expect(roundRobinScore({ legScores: [80], independenceScore: NaN, correlationPenalty: 0, exposurePenalty: 0 })).toBe(null)
    expect(roundRobinScore({ legScores: 'nope', independenceScore: 0, correlationPenalty: 0, exposurePenalty: 0 })).toBe(null)
  })
})
