import { describe, it, expect } from 'vitest'
import { handednessDelta, HAND } from '../api/_lib/handedness.js'

// Helper: a lineup "side" posting `vsHand` wOBA against a baseline of `baseline`.
const side = (vsHand, baseline) => ({ vsHand, baseline })

describe('handednessDelta (pure platoon run-delta)', () => {
  it('strong vs the hand it faces → positive delta (push OVER), capped', () => {
    const r = handednessDelta({
      awayStarterThrows: 'R', homeStarterThrows: 'R',
      lineupVsHandData: {
        away: side(0.360, 0.320),   // mashes the RHP it faces (+.040)
        home: side(0.355, 0.320),   // also strong vs its RHP (+.035)
      },
    })
    expect(r.delta).toBeGreaterThan(0)
    expect(r.delta).toBeLessThanOrEqual(HAND.cap)
    expect(r.reason).toMatch(/mashes/)
  })

  it('weak vs the hand it faces → negative delta (push UNDER)', () => {
    const r = handednessDelta({
      awayStarterThrows: 'L', homeStarterThrows: 'L',
      lineupVsHandData: {
        away: side(0.290, 0.330),   // struggles vs LHP (−.040)
        home: side(0.295, 0.330),   // also weak vs LHP (−.035)
      },
    })
    expect(r.delta).toBeLessThan(0)
    expect(r.delta).toBeGreaterThanOrEqual(-HAND.cap)
    expect(r.reason).toMatch(/weak vs LHP/)
  })

  it('no lineup data on either side → neutral { delta: 0, reason: null }', () => {
    expect(handednessDelta({ lineupVsHandData: null })).toEqual({ delta: 0, reason: null })
    expect(handednessDelta({ lineupVsHandData: { away: null, home: null } })).toEqual({ delta: 0, reason: null })
    expect(handednessDelta({})).toEqual({ delta: 0, reason: null })
  })

  it('one side missing splits still works off the other side', () => {
    const r = handednessDelta({
      awayStarterThrows: 'R', homeStarterThrows: 'R',
      lineupVsHandData: { away: side(0.360, 0.315), home: null },
    })
    expect(r.delta).toBeGreaterThan(0)
  })

  it('lineup at its own baseline (no split edge) → neutral', () => {
    const r = handednessDelta({
      awayStarterThrows: 'R', homeStarterThrows: 'L',
      lineupVsHandData: { away: side(0.320, 0.320), home: side(0.315, 0.315) },
    })
    expect(r.delta).toBe(0)
    expect(r.reason).toBeNull()
  })

  it('delta is hard-capped at ±cap even for an extreme split', () => {
    const r = handednessDelta({
      awayStarterThrows: 'R', homeStarterThrows: 'R',
      lineupVsHandData: { away: side(0.450, 0.300), home: side(0.450, 0.300) },
    })
    expect(r.delta).toBe(HAND.cap)
  })

  it('ignores implausibly low (bad-data) split wOBA via minBaseline floor', () => {
    const r = handednessDelta({
      awayStarterThrows: 'R', homeStarterThrows: 'R',
      lineupVsHandData: { away: side(0.10, 0.05), home: null },
    })
    expect(r).toEqual({ delta: 0, reason: null })
  })
})
