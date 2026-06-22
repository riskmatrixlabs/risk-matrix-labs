import { describe, it, expect } from 'vitest'
import { modelEvPct } from '../src/lib/modelEv.js'

// Plain de-vig EV (no model edge) for comparison — modelEdgeRuns=0 means no nudge.
const plain = (pick, odds, o, u) => modelEvPct({ pick, americanOdds: odds, overJuice: o, underJuice: u, modelEdgeRuns: 0 })

describe('modelEvPct', () => {
  it('OVER bet with positive (over) edge → M-EV higher than the plain de-vig EV', () => {
    const base = plain('PIT@COL Over 11.5', -110, -105, -115)
    const mev = modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: -105, underJuice: -115, modelEdgeRuns: 1.5 })
    expect(base).not.toBeNull()
    expect(mev).not.toBeNull()
    expect(mev).toBeGreaterThan(base)
  })

  it('UNDER bet with positive (under) edge → M-EV higher than plain', () => {
    const base = plain('NYY@BOS Under 9.5', -110, -110, -110)
    const mev = modelEvPct({ pick: 'NYY@BOS Under 9.5', americanOdds: -110, overJuice: -110, underJuice: -110, modelEdgeRuns: -2 })
    expect(mev).toBeGreaterThan(base)
  })

  it('edge AGAINST the side lowers M-EV below plain', () => {
    const base = plain('PIT@COL Over 11.5', -110, -110, -110)
    const mev = modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: -110, underJuice: -110, modelEdgeRuns: -2 })
    expect(mev).toBeLessThan(base)
  })

  it('caps the nudge at ±3 runs (edge 10 ≈ edge 3)', () => {
    const cap3 = modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: -110, underJuice: -110, modelEdgeRuns: 3 })
    const cap10 = modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: -110, underJuice: -110, modelEdgeRuns: 10 })
    expect(cap10).toBeCloseTo(cap3, 6)
  })

  it('non-total pick → null', () => {
    expect(modelEvPct({ pick: 'Aaron Judge Anytime HR', americanOdds: 150, overJuice: -110, underJuice: -110, modelEdgeRuns: 2 })).toBeNull()
  })

  it('missing juice → null', () => {
    expect(modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: undefined, underJuice: -110, modelEdgeRuns: 2 })).toBeNull()
  })

  it('missing edge → null', () => {
    expect(modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: -110, overJuice: -110, underJuice: -110, modelEdgeRuns: null })).toBeNull()
  })

  it('non-finite americanOdds → null', () => {
    expect(modelEvPct({ pick: 'PIT@COL Over 11.5', americanOdds: NaN, overJuice: -110, underJuice: -110, modelEdgeRuns: 2 })).toBeNull()
  })
})
