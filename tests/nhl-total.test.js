import { describe, it, expect } from 'vitest'
import { nhlTotal, sideXg, oppDefAdj, restAdj, NHL_TOTAL_MODEL_VERSION, LEAGUE_REF_GOALS } from '../src/lib/nhlTotal.js'

describe('oppDefAdj', () => {
  it('league-reference conceding (3.0) → exactly 1', () => expect(oppDefAdj(3.0)).toBe(1))
  it('leaky defense scales up: 3.6/3.0 = 1.2', () => expect(oppDefAdj(3.6)).toBeCloseTo(1.2, 10))
  it('clamps to 0.8..1.2', () => {
    expect(oppDefAdj(6)).toBe(1.2)
    expect(oppDefAdj(1)).toBe(0.8)
  })
  it('null in → null out', () => expect(oppDefAdj(null)).toBe(null))
})

describe('restAdj', () => {
  it('back-to-back (1 day) → 0.95', () => expect(restAdj(1)).toBe(0.95))
  it('rested (2+ days) → 1', () => expect(restAdj(2)).toBe(1))
  it('unknown rest → null (never assume rested)', () => expect(restAdj(null)).toBe(null))
})

describe('sideXg', () => {
  it('hand-computed: 3.2 scored × (3.3/3.0 def) × 0.95 b2b = 3.344', () => {
    expect(sideXg({ scoredAvg: 3.2, oppConcededAvg: 3.3, restDays: 1 })).toBeCloseTo(3.344, 3)
  })
  it('any missing input → null', () => {
    expect(sideXg({ scoredAvg: null, oppConcededAvg: 3.0, restDays: 2 })).toBe(null)
    expect(sideXg({ scoredAvg: 3.0, oppConcededAvg: null, restDays: 2 })).toBe(null)
    expect(sideXg({ scoredAvg: 3.0, oppConcededAvg: 3.0, restDays: null })).toBe(null)
  })
})

describe('nhlTotal', () => {
  const base = { homeScoredAvg: 3.5, homeConcededAvg: 3.4, awayScoredAvg: 3.3, awayConcededAvg: 3.6, restDaysHome: 2, restDaysAway: 2 }
  // homeXg = 3.5 × (3.6/3) = 4.2; awayXg = 3.3 × (3.4/3) = 3.74 → proj = 7.94

  it('hand-computed OVER lean vs a 6.5 line', () => {
    const t = nhlTotal({ ...base, oddsTotal: 6.5 })
    expect(t).toMatchObject({ lean: 'OVER', modelVersion: NHL_TOTAL_MODEL_VERSION, confidence: 3, strong: true })
    expect(t.proj).toBeCloseTo(7.94, 2)
    expect(t.edgeGoals).toBeCloseTo(1.44, 2)
  })
  it('UNDER with confidence 1 at a 0.6–1.0 edge', () => {
    const t = nhlTotal({ ...base, oddsTotal: 8.5 }) // edge −0.56 → null actually; use 8.6
    expect(t).toBe(null) // |−0.56| < 0.6 → honest silence
    const t2 = nhlTotal({ ...base, oddsTotal: 8.7 }) // edge −0.76
    expect(t2).toMatchObject({ lean: 'UNDER', confidence: 1, strong: false })
    expect(t2.edgeGoals).toBeCloseTo(-0.76, 2)
  })
  it('confidence 2 band (≥1.0) and strong flag (≥1.2)', () => {
    const t = nhlTotal({ ...base, oddsTotal: 6.9 }) // edge +1.04
    expect(t).toMatchObject({ lean: 'OVER', confidence: 2, strong: false })
    const t2 = nhlTotal({ ...base, oddsTotal: 6.7 }) // edge +1.24
    expect(t2).toMatchObject({ confidence: 2, strong: true })
  })
  it('missing odds_total → null', () => {
    expect(nhlTotal({ ...base, oddsTotal: null })).toBe(null)
  })
  it('any missing scoring/rest input → null (all-or-nothing)', () => {
    expect(nhlTotal({ ...base, homeScoredAvg: null, oddsTotal: 6.5 })).toBe(null)
    expect(nhlTotal({ ...base, awayConcededAvg: null, oddsTotal: 6.5 })).toBe(null)
    expect(nhlTotal({ ...base, restDaysAway: null, oddsTotal: 6.5 })).toBe(null)
  })
  it('back-to-back dampens the side', () => {
    const t = nhlTotal({ ...base, restDaysHome: 1, oddsTotal: 6.5 })
    // homeXg = 4.2 × 0.95 = 3.99 → proj = 7.73, edge +1.23
    expect(t.proj).toBeCloseTo(7.73, 2)
  })
  it('LEAGUE_REF_GOALS documents the 3.0 reference', () => {
    expect(LEAGUE_REF_GOALS).toBe(3.0)
  })
})
