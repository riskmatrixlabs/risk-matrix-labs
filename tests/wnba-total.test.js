import { describe, it, expect } from 'vitest'
import { wnbaTotal, sidePoints, oppDefAdj, restAdj, WNBA_TOTAL_MODEL_VERSION, LEAGUE_REF_POINTS } from '../src/lib/wnbaTotal.js'

describe('oppDefAdj', () => {
  it('league-reference conceding (81) → exactly 1', () => expect(oppDefAdj(81)).toBe(1))
  it('leaky defense scales up: 85.05/81 = 1.05', () => expect(oppDefAdj(85.05)).toBeCloseTo(1.05, 10))
  it('clamps to 0.85..1.15', () => {
    expect(oppDefAdj(120)).toBe(1.15)
    expect(oppDefAdj(50)).toBe(0.85)
  })
  it('null in → null out', () => expect(oppDefAdj(null)).toBe(null))
})

describe('restAdj', () => {
  it('back-to-back (1 day) → 0.97', () => expect(restAdj(1)).toBe(0.97))
  it('rested (2+ days) → 1', () => expect(restAdj(2)).toBe(1))
  it('unknown rest → null (never assume rested)', () => expect(restAdj(null)).toBe(null))
})

describe('sidePoints', () => {
  it('hand-computed: 84 scored × (86/81 def) × 0.97 b2b = 86.510', () => {
    expect(sidePoints({ scoredAvg: 84, oppConcededAvg: 86, restDays: 1 })).toBeCloseTo(86.510, 2)
  })
  it('any missing input → null', () => {
    expect(sidePoints({ scoredAvg: null, oppConcededAvg: 81, restDays: 2 })).toBe(null)
    expect(sidePoints({ scoredAvg: 80, oppConcededAvg: null, restDays: 2 })).toBe(null)
    expect(sidePoints({ scoredAvg: 80, oppConcededAvg: 81, restDays: null })).toBe(null)
  })
})

describe('wnbaTotal', () => {
  const base = { homeScoredAvg: 84, homeConcededAvg: 82, awayScoredAvg: 80, awayConcededAvg: 86, restDaysHome: 2, restDaysAway: 2 }
  // home = 84 × (86/81) = 89.185; away = 80 × (82/81) = 80.988 → proj = 170.17

  it('hand-computed OVER lean vs a 160.5 line (conf 3, strong)', () => {
    const t = wnbaTotal({ ...base, oddsTotal: 160.5 })
    expect(t).toMatchObject({ lean: 'OVER', modelVersion: WNBA_TOTAL_MODEL_VERSION, confidence: 3, strong: true })
    expect(t.proj).toBeCloseTo(170.17, 2)
    expect(t.edgePoints).toBeCloseTo(9.67, 2)
  })
  it('inside the 4-point noise band → null; UNDER conf 1 just past it', () => {
    expect(wnbaTotal({ ...base, oddsTotal: 168 })).toBe(null) // edge +2.17 < 4 → honest silence
    const t = wnbaTotal({ ...base, oddsTotal: 174.5 }) // edge −4.33
    expect(t).toMatchObject({ lean: 'UNDER', confidence: 1, strong: false })
    expect(t.edgePoints).toBeCloseTo(-4.33, 2)
  })
  it('confidence 2 band (≥6.5) and strong flag (≥8)', () => {
    const t = wnbaTotal({ ...base, oddsTotal: 163 }) // edge +7.17
    expect(t).toMatchObject({ lean: 'OVER', confidence: 2, strong: false })
    const t2 = wnbaTotal({ ...base, oddsTotal: 162 }) // edge +8.17
    expect(t2).toMatchObject({ confidence: 2, strong: true })
  })
  it('missing odds_total → null', () => {
    expect(wnbaTotal({ ...base, oddsTotal: null })).toBe(null)
  })
  it('any missing scoring/rest input → null (all-or-nothing)', () => {
    expect(wnbaTotal({ ...base, homeScoredAvg: null, oddsTotal: 160.5 })).toBe(null)
    expect(wnbaTotal({ ...base, awayConcededAvg: null, oddsTotal: 160.5 })).toBe(null)
    expect(wnbaTotal({ ...base, restDaysAway: null, oddsTotal: 160.5 })).toBe(null)
  })
  it('back-to-back dampens the side', () => {
    const t = wnbaTotal({ ...base, restDaysHome: 1, oddsTotal: 160.5 })
    // home = 89.185 × 0.97 = 86.510 → proj = 167.50, edge +7.00
    expect(t.proj).toBeCloseTo(167.5, 2)
    expect(t.edgePoints).toBeCloseTo(7.0, 2)
  })
  it('LEAGUE_REF_POINTS documents the 81 reference', () => {
    expect(LEAGUE_REF_POINTS).toBe(81)
  })
})
