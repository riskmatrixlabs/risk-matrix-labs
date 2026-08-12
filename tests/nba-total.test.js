import { describe, it, expect } from 'vitest'
import {
  nbaTotal, nbaSide, sidePoints, oppDefAdj, restAdj,
  NBA_TOTAL_MODEL_VERSION, LEAGUE_REF_POINTS, EDGE_MIN_POINTS, NBA_MARGIN_SD, ML_MIN_WIN_PROB,
} from '../src/lib/nbaTotal.js'

describe('oppDefAdj', () => {
  it('league-reference conceding (114) → exactly 1', () => expect(oppDefAdj(114)).toBe(1))
  it('leaky defense scales up: 119.7/114 = 1.05', () => expect(oppDefAdj(119.7)).toBeCloseTo(1.05, 10))
  it('clamps to 0.85..1.15', () => {
    expect(oppDefAdj(160)).toBe(1.15)
    expect(oppDefAdj(80)).toBe(0.85)
  })
  it('null in → null out', () => expect(oppDefAdj(null)).toBe(null))
})

describe('restAdj', () => {
  it('back-to-back (1 day) → 0.96', () => expect(restAdj(1)).toBe(0.96))
  it('rested (2+ days) → 1', () => expect(restAdj(2)).toBe(1))
  it('unknown rest → null (never assume rested)', () => expect(restAdj(null)).toBe(null))
})

describe('sidePoints', () => {
  it('hand-computed: 115 × (120/114) × 0.96 b2b = 116.2105', () => {
    expect(sidePoints({ scoredAvg: 115, oppConcededAvg: 120, restDays: 1 })).toBeCloseTo(116.2105, 3)
  })
  it('any missing input → null', () => {
    expect(sidePoints({ scoredAvg: null, oppConcededAvg: 114, restDays: 2 })).toBe(null)
    expect(sidePoints({ scoredAvg: 115, oppConcededAvg: null, restDays: 2 })).toBe(null)
    expect(sidePoints({ scoredAvg: 115, oppConcededAvg: 114, restDays: null })).toBe(null)
  })
})

describe('nbaTotal', () => {
  // home = 115 × (118/114) = 119.0351; away = 110 × (112/114) = 108.0702 → proj = 227.11
  const base = { homeScoredAvg: 115, homeConcededAvg: 112, awayScoredAvg: 110, awayConcededAvg: 118, restDaysHome: 2, restDaysAway: 2 }

  it('hand-computed OVER lean vs a 214.5 line (conf 3, strong)', () => {
    const t = nbaTotal({ ...base, oddsTotal: 214.5 })
    expect(t).toMatchObject({ lean: 'OVER', modelVersion: NBA_TOTAL_MODEL_VERSION, confidence: 3, strong: true })
    expect(t.proj).toBeCloseTo(227.11, 2)
    expect(t.edgePoints).toBeCloseTo(12.61, 2)
  })

  it('edge 8.61 vs a 218.5 line → confidence 1, not strong', () => {
    const t = nbaTotal({ ...base, oddsTotal: 218.5 })
    expect(t).toMatchObject({ lean: 'OVER', confidence: 1, strong: false })
    expect(t.edgePoints).toBeCloseTo(8.61, 2)
  })

  it('edge 9.61 (line 217.5) → confidence 2', () => {
    expect(nbaTotal({ ...base, oddsTotal: 217.5 }).confidence).toBe(2)
  })

  it('UNDER lean when the line is above the projection', () => {
    const t = nbaTotal({ ...base, oddsTotal: 240.5 })
    expect(t.lean).toBe('UNDER')
    expect(t.edgePoints).toBeCloseTo(-13.39, 2)
    expect(t.strong).toBe(true)
  })

  it('inside the 6-point noise band → honest null', () => {
    expect(nbaTotal({ ...base, oddsTotal: 223 })).toBe(null)      // edge 4.11
    expect(nbaTotal({ ...base, oddsTotal: 221.2 })).toBe(null)    // edge 5.91
  })

  it('exactly at the 6-point band emits (gate is ≥)', () => {
    const t = nbaTotal({ ...base, oddsTotal: 221.11 })
    expect(t).not.toBe(null)
    expect(t.edgePoints).toBe(6)
    expect(Math.abs(t.edgePoints)).toBeGreaterThanOrEqual(EDGE_MIN_POINTS)
  })

  it('missing odds_total → null (no line, no lean)', () => {
    expect(nbaTotal({ ...base, oddsTotal: null })).toBe(null)
    expect(nbaTotal()).toBe(null)
  })

  it('null propagation: any missing scoring/rest input → null', () => {
    expect(nbaTotal({ ...base, homeScoredAvg: null, oddsTotal: 214.5 })).toBe(null)
    expect(nbaTotal({ ...base, awayScoredAvg: null, oddsTotal: 214.5 })).toBe(null)
    expect(nbaTotal({ ...base, homeConcededAvg: null, oddsTotal: 214.5 })).toBe(null)
    expect(nbaTotal({ ...base, awayConcededAvg: null, oddsTotal: 214.5 })).toBe(null)
    expect(nbaTotal({ ...base, restDaysHome: null, oddsTotal: 214.5 })).toBe(null)
    expect(nbaTotal({ ...base, restDaysAway: null, oddsTotal: 214.5 })).toBe(null)
  })

  it('documented constants: ref 114, band 6', () => {
    expect(LEAGUE_REF_POINTS).toBe(114)
    expect(EDGE_MIN_POINTS).toBe(6)
  })
})

// Neutral defenses (both concede the 114 league reference) + rested → each side's projection
// equals its own scoredAvg, so the margin is exactly the scoredAvg difference.
const neutral = { homeConcededAvg: 114, awayConcededAvg: 114, restDaysHome: 2, restDaysAway: 2 }

describe('nbaSide', () => {
  it('hand-computed HOME: margin 4.5 → winProb Φ(4.5/13.5) = Φ(1/3) ≈ 0.6306', () => {
    const s = nbaSide({ ...neutral, homeScoredAvg: 115, awayScoredAvg: 110.5 })
    expect(s).toMatchObject({ pick: 'HOME', modelVersion: NBA_TOTAL_MODEL_VERSION })
    expect(s.winProb).toBeCloseTo(0.6306, 3)
    expect(s.projHome).toBeCloseTo(115, 6)
    expect(s.projAway).toBeCloseTo(110.5, 6)
  })

  it('mirror AWAY: margin −4.5 → pick AWAY, same winProb', () => {
    const s = nbaSide({ ...neutral, homeScoredAvg: 110.5, awayScoredAvg: 115 })
    expect(s).toMatchObject({ pick: 'AWAY' })
    expect(s.winProb).toBeCloseTo(0.6306, 3)
  })

  it('margin 1.5 → Φ(1.5/13.5) ≈ 0.544 < 0.55 gate → honest null (no call)', () => {
    expect(nbaSide({ ...neutral, homeScoredAvg: 115, awayScoredAvg: 113.5 })).toBe(null)
  })

  it('defense + rest flow through the SAME projections as nbaTotal', () => {
    // home = 119.0351, away = 108.0702 → margin 10.9649 → z = 0.8122 → Φ ≈ 0.792
    const s = nbaSide({ homeScoredAvg: 115, homeConcededAvg: 112, awayScoredAvg: 110, awayConcededAvg: 118, restDaysHome: 2, restDaysAway: 2 })
    expect(s.pick).toBe('HOME')
    expect(s.winProb).toBeCloseTo(0.792, 2)
    expect(s.projHome).toBeCloseTo(119.04, 1)
    expect(s.projAway).toBeCloseTo(108.07, 1)
  })

  it('any missing scoring/rest input → null (all-or-nothing, same as nbaTotal)', () => {
    expect(nbaSide({ ...neutral, homeScoredAvg: null, awayScoredAvg: 110 })).toBe(null)
    expect(nbaSide({ ...neutral, homeScoredAvg: 115, awayScoredAvg: 110, awayConcededAvg: null })).toBe(null)
    expect(nbaSide({ ...neutral, homeScoredAvg: 115, awayScoredAvg: 110, restDaysAway: null })).toBe(null)
    expect(nbaSide()).toBe(null)
  })

  it('needs NO odds_total — pure projection arithmetic', () => {
    expect(nbaSide({ ...neutral, homeScoredAvg: 115, awayScoredAvg: 110.5, oddsTotal: null })).not.toBe(null)
  })

  it('documented constants: sd 13.5, gate 0.55', () => {
    expect(NBA_MARGIN_SD).toBe(13.5)
    expect(ML_MIN_WIN_PROB).toBe(0.55)
  })
})
