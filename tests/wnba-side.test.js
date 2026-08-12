import { describe, it, expect } from 'vitest'
import { wnbaSide, WNBA_MARGIN_SD, ML_MIN_WIN_PROB } from '../src/lib/wnbaTotal.js'
import { WNBA_TOTAL_MODEL_VERSION } from '../src/lib/wnbaTotal.js'

// Neutral defenses (both concede the 81 league reference) + rested → each side's
// projection = its own scoredAvg, so the margin is exactly the scoredAvg difference.
const neutral = { homeConcededAvg: 81, awayConcededAvg: 81, restDaysHome: 2, restDaysAway: 2 }

describe('wnbaSide', () => {
  it('hand-computed HOME: margin 3.5 → winProb Φ(3.5/11.5) ≈ 0.6196', () => {
    const s = wnbaSide({ ...neutral, homeScoredAvg: 84, awayScoredAvg: 80.5 })
    expect(s).toMatchObject({ pick: 'HOME', modelVersion: WNBA_TOTAL_MODEL_VERSION })
    expect(s.winProb).toBeCloseTo(0.6196, 3)
    expect(s.projHome).toBeCloseTo(84, 6)
    expect(s.projAway).toBeCloseTo(80.5, 6)
  })
  it('mirror AWAY: margin −3.5 → pick AWAY, same winProb', () => {
    const s = wnbaSide({ ...neutral, homeScoredAvg: 80.5, awayScoredAvg: 84 })
    expect(s).toMatchObject({ pick: 'AWAY' })
    expect(s.winProb).toBeCloseTo(0.6196, 3)
  })
  it('margin 1 → Φ(1/11.5) ≈ 0.535 < 0.55 gate → honest null (no call)', () => {
    expect(wnbaSide({ ...neutral, homeScoredAvg: 84, awayScoredAvg: 83 })).toBe(null)
  })
  it('defense + rest flow through the SAME projections as wnbaTotal', () => {
    // home = 84 × (86/81) = 89.185; away = 80 × (82/81) = 80.988 → margin 8.1975
    const s = wnbaSide({ homeScoredAvg: 84, homeConcededAvg: 82, awayScoredAvg: 80, awayConcededAvg: 86, restDaysHome: 2, restDaysAway: 2 })
    expect(s.pick).toBe('HOME')
    expect(s.winProb).toBeCloseTo(0.762, 3)
    expect(s.projHome).toBeCloseTo(89.19, 1)
    expect(s.projAway).toBeCloseTo(80.99, 1)
  })
  it('any missing scoring/rest input → null (all-or-nothing, same as wnbaTotal)', () => {
    expect(wnbaSide({ ...neutral, homeScoredAvg: null, awayScoredAvg: 80 })).toBe(null)
    expect(wnbaSide({ ...neutral, homeScoredAvg: 84, awayScoredAvg: 80, awayConcededAvg: null })).toBe(null)
    expect(wnbaSide({ ...neutral, homeScoredAvg: 84, awayScoredAvg: 80, restDaysAway: null })).toBe(null)
    expect(wnbaSide()).toBe(null)
  })
  it('needs NO odds_total — pure projection arithmetic', () => {
    expect(wnbaSide({ ...neutral, homeScoredAvg: 84, awayScoredAvg: 80.5, oddsTotal: null })).not.toBe(null)
  })
  it('documented constants: sd 11.5, gate 0.55', () => {
    expect(WNBA_MARGIN_SD).toBe(11.5)
    expect(ML_MIN_WIN_PROB).toBe(0.55)
  })
})
