import { describe, it, expect } from 'vitest'
import { bullpenFatigueDelta, ipToInnings, FATIGUE_CAP } from '../api/_lib/bullpenFatigue.js'

describe('ipToInnings', () => {
  it('parses MLB .1/.2 outs notation into real innings', () => {
    expect(ipToInnings('6.0')).toBe(6)
    expect(ipToInnings('1.1')).toBeCloseTo(1 + 1 / 3, 5)
    expect(ipToInnings('1.2')).toBeCloseTo(1 + 2 / 3, 5)
    expect(ipToInnings('0.2')).toBeCloseTo(2 / 3, 5)
  })
  it('garbage / missing → 0 (never NaN)', () => {
    expect(ipToInnings(undefined)).toBe(0)
    expect(ipToInnings(null)).toBe(0)
    expect(ipToInnings('')).toBe(0)
    expect(Number.isNaN(ipToInnings('abc'))).toBe(false)
  })
})

describe('bullpenFatigueDelta', () => {
  it('normal usage (≈6 IP each, no back-to-back) → neutral delta 0, null reason', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: 6, homeRecentRelieverIp: 6 })
    expect(r).toEqual({ delta: 0, reason: null })
  })

  it('heavy recent relief IP → positive (over), capped, gassed reason', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: 13, homeRecentRelieverIp: 12 })
    expect(r.delta).toBeGreaterThan(0)
    expect(r.delta).toBeLessThanOrEqual(FATIGUE_CAP)
    expect(r.reason).toBe('gassed bullpen (over)')
  })

  it('back-to-back flags are IGNORED (S65) — only IP volume drives the signal', () => {
    // Team-level back-to-back fires on ~every game (pens pitch daily) → removed. Same IP, with or
    // without the b2b flags, must give the SAME volume-based result (here: gassed over from 8 IP/side).
    const withFlags = bullpenFatigueDelta({
      awayRecentRelieverIp: 8, homeRecentRelieverIp: 8,
      awayPenBackToBack: true, homePenBackToBack: true,
    })
    const withoutFlags = bullpenFatigueDelta({ awayRecentRelieverIp: 8, homeRecentRelieverIp: 8 })
    expect(withFlags).toEqual(withoutFlags)
    expect(withFlags.delta).toBeGreaterThan(0)
    expect(withFlags.reason).toBe('gassed bullpen (over)')
  })

  it('rested pens (low recent relief IP) → negative (under)', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: 1, homeRecentRelieverIp: 1 })
    expect(r.delta).toBeLessThan(0)
    expect(r.reason).toBe('rested bullpen (under)')
  })

  it('missing all inputs → delta 0, null reason (never NaN)', () => {
    expect(bullpenFatigueDelta({})).toEqual({ delta: 0, reason: null })
    expect(bullpenFatigueDelta()).toEqual({ delta: 0, reason: null })
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: null, homeRecentRelieverIp: undefined })
    expect(r).toEqual({ delta: 0, reason: null })
    expect(Number.isNaN(r.delta)).toBe(false)
  })

  it('partial data (one side missing) → only the side with data drives it', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: 14, homeRecentRelieverIp: null })
    expect(r.delta).toBeGreaterThan(0)
    expect(r.reason).toContain('over')
  })

  it('back-to-back flag without IP for that side cannot fabricate a signal', () => {
    // No IP anywhere → no signal even though a b2b flag is passed.
    const r = bullpenFatigueDelta({ awayPenBackToBack: true, homePenBackToBack: true })
    expect(r).toEqual({ delta: 0, reason: null })
  })

  it('delta is capped at +FATIGUE_CAP for extreme overwork', () => {
    const r = bullpenFatigueDelta({
      awayRecentRelieverIp: 30, homeRecentRelieverIp: 30,
      awayPenBackToBack: true, homePenBackToBack: true,
    })
    expect(r.delta).toBe(FATIGUE_CAP)
  })

  it('delta is capped at -FATIGUE_CAP for extreme rest', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: -100, homeRecentRelieverIp: -100 })
    expect(r.delta).toBe(-FATIGUE_CAP)
  })

  it('near-normal usage stays inside the deadband (neutral)', () => {
    const r = bullpenFatigueDelta({ awayRecentRelieverIp: 7, homeRecentRelieverIp: 6 })
    expect(r).toEqual({ delta: 0, reason: null })
  })
})
