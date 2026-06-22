import { describe, it, expect } from 'vitest'
import { windParkDelta, PARK_CF_AZIMUTH } from '../api/_lib/windPark.js'

// CHC (Wrigley) CF azimuth ~30°. Wind blowing TOWARD 30° comes FROM 210°.
const CHC_CF = PARK_CF_AZIMUTH.CHC // 30

describe('windParkDelta', () => {
  it('wind straight out to CF → positive delta (over)', () => {
    // comes FROM (30+180)=210 → blows toward 30 = dead out
    const { delta, reason } = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 12, windDirDeg: 210 })
    expect(delta).toBeGreaterThan(0)
    expect(reason).toContain('out')
    expect(reason).toContain('over')
  })

  it('wind straight in from CF → negative delta (under)', () => {
    // comes FROM 30 → blows toward 210 = dead in
    const { delta, reason } = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 14, windDirDeg: CHC_CF })
    expect(delta).toBeLessThan(0)
    expect(reason).toContain('in')
    expect(reason).toContain('under')
  })

  it('crosswind → ~0 delta, no reason', () => {
    // blow toward 30+90=120 → comes FROM 300. Perpendicular to CF axis.
    const { delta, reason } = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 20, windDirDeg: 300 })
    expect(Math.abs(delta)).toBeLessThan(0.05)
    expect(reason).toBeNull()
  })

  it('dome → 0 delta, null reason regardless of wind', () => {
    const { delta, reason } = windParkDelta({ parkAbbr: 'TB', windSpeedMph: 30, windDirDeg: 210, isDome: true })
    expect(delta).toBe(0)
    expect(reason).toBeNull()
  })

  it('delta is capped at ±0.8 runs', () => {
    const out = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 60, windDirDeg: 210 })
    expect(out.delta).toBeLessThanOrEqual(0.8)
    const inn = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 60, windDirDeg: 30 })
    expect(inn.delta).toBeGreaterThanOrEqual(-0.8)
  })

  it('negligible wind (<5mph component) → 0, null', () => {
    const { delta, reason } = windParkDelta({ parkAbbr: 'CHC', windSpeedMph: 3, windDirDeg: 210 })
    expect(delta).toBe(0)
    expect(reason).toBeNull()
  })

  it('unknown park / bad input → 0, null', () => {
    expect(windParkDelta({ parkAbbr: 'ZZZ', windSpeedMph: 12, windDirDeg: 210 })).toEqual({ delta: 0, reason: null })
    expect(windParkDelta({})).toEqual({ delta: 0, reason: null })
  })

  it('has all 30 parks (plus CHW alias)', () => {
    expect(Object.keys(PARK_CF_AZIMUTH).length).toBeGreaterThanOrEqual(30)
  })
})
