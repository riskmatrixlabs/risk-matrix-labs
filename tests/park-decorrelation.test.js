import { describe, it, expect } from 'vitest'
import { parkAdjustedWeather } from '../api/game-info.js'

// S64 PIT@COL fix: weather and park factor both encode air density, so the hot-weather boost must be
// damped at an extreme park to avoid double-counting altitude. These lock that contract.
describe('parkAdjustedWeather — park de-correlation', () => {
  it('neutral park (pf=1): weather counted in full', () => {
    expect(parkAdjustedWeather(1.0, 1.0, false)).toBeCloseTo(1.0, 5)
    expect(parkAdjustedWeather(-0.7, 1.0, false)).toBeCloseTo(-0.7, 5)
  })

  it('Coors (pf=1.4): weather damped to 60% (extremity capped at 0.4)', () => {
    expect(parkAdjustedWeather(1.0, 1.4, false)).toBeCloseTo(0.6, 5)
  })

  it('damping is symmetric — pulls cold (under) boost toward zero too', () => {
    expect(parkAdjustedWeather(-1.0, 1.4, false)).toBeCloseTo(-0.6, 5)
  })

  it('extremity is capped at 0.4 — an even more extreme pf cannot zero out weather', () => {
    expect(parkAdjustedWeather(1.0, 2.0, false)).toBeCloseTo(0.6, 5) // |2-1|=1 → capped 0.4 → ×0.6
  })

  it('mild park (pf=1.06): only a small ~6% trim', () => {
    expect(parkAdjustedWeather(1.0, 1.06, false)).toBeCloseTo(0.94, 5)
  })

  it('dome → 0 regardless of boost', () => {
    expect(parkAdjustedWeather(1.0, 1.4, true)).toBe(0)
  })

  it('no weather boost → 0 (no-op, never NaN)', () => {
    expect(parkAdjustedWeather(0, 1.4, false)).toBe(0)
    expect(parkAdjustedWeather(null, 1.4, false)).toBe(0)
  })

  it('missing pf defaults to neutral (no damping, never NaN)', () => {
    expect(parkAdjustedWeather(1.0, undefined, false)).toBeCloseTo(1.0, 5)
  })

  it('never amplifies — |adjusted| <= |original| at any park', () => {
    for (const pf of [0.85, 0.92, 1.0, 1.06, 1.2, 1.4]) {
      const out = Math.abs(parkAdjustedWeather(0.7, pf, false))
      expect(out).toBeLessThanOrEqual(0.7 + 1e-9)
    }
  })
})
