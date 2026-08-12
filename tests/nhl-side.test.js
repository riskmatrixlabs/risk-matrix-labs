import { describe, it, expect } from 'vitest'
import { nhlSide, NHL_MARGIN_SD, ML_MIN_WIN_PROB, NHL_TOTAL_MODEL_VERSION } from '../src/lib/nhlTotal.js'

// Neutral defenses (both concede the 3.0 league reference) + rested → each side's
// xG = its own scoredAvg, so the margin is exactly the scoredAvg difference.
const neutral = { homeConcededAvg: 3.0, awayConcededAvg: 3.0, restDaysHome: 2, restDaysAway: 2 }

describe('nhlSide', () => {
  it('hand-computed HOME: margin 0.7 → winProb Φ(0.7/2.1) ≈ 0.6306', () => {
    const s = nhlSide({ ...neutral, homeScoredAvg: 3.4, awayScoredAvg: 2.7 })
    expect(s).toMatchObject({ pick: 'HOME', modelVersion: NHL_TOTAL_MODEL_VERSION })
    expect(s.winProb).toBeCloseTo(0.6306, 3)
    expect(s.projHome).toBeCloseTo(3.4, 6)
    expect(s.projAway).toBeCloseTo(2.7, 6)
  })
  it('mirror AWAY: margin −0.7 → pick AWAY, same winProb', () => {
    const s = nhlSide({ ...neutral, homeScoredAvg: 2.7, awayScoredAvg: 3.4 })
    expect(s).toMatchObject({ pick: 'AWAY' })
    expect(s.winProb).toBeCloseTo(0.6306, 3)
  })
  it('margin 0.2 → Φ(0.2/2.1) ≈ 0.538 < 0.55 gate → honest null (no call)', () => {
    expect(nhlSide({ ...neutral, homeScoredAvg: 3.2, awayScoredAvg: 3.0 })).toBe(null)
  })
  it('any missing scoring/rest input → null (all-or-nothing, same as nhlTotal)', () => {
    expect(nhlSide({ ...neutral, homeScoredAvg: null, awayScoredAvg: 2.7 })).toBe(null)
    expect(nhlSide({ ...neutral, homeScoredAvg: 3.4, awayScoredAvg: 2.7, homeConcededAvg: null })).toBe(null)
    expect(nhlSide({ ...neutral, homeScoredAvg: 3.4, awayScoredAvg: 2.7, restDaysHome: null })).toBe(null)
    expect(nhlSide()).toBe(null)
  })
  it('needs NO odds_total — pure projection arithmetic', () => {
    expect(nhlSide({ ...neutral, homeScoredAvg: 3.4, awayScoredAvg: 2.7, oddsTotal: null })).not.toBe(null)
  })
  it('documented constants: sd 2.1, gate 0.55', () => {
    expect(NHL_MARGIN_SD).toBe(2.1)
    expect(ML_MIN_WIN_PROB).toBe(0.55)
  })
})
