import { describe, it, expect } from 'vitest'
import {
  cacheKey, todayStr, isFresh, isLowCredit, DEFAULT_TTL_MS, CREDIT_FLOOR,
} from '../api/_lib/scanStore.js'

describe('scanStore pure helpers', () => {
  describe('cacheKey', () => {
    it('builds a key from sport + date and upper-cases the sport', () => {
      expect(cacheKey('mlb', '2026-06-13')).toBe('MLB:2026-06-13')
    })
    it('isolates by sport and by date', () => {
      expect(cacheKey('NHL', '2026-06-13')).not.toBe(cacheKey('MLB', '2026-06-13'))
      expect(cacheKey('MLB', '2026-06-14')).not.toBe(cacheKey('MLB', '2026-06-13'))
    })
  })

  describe('todayStr', () => {
    it('formats a fixed instant as YYYY-MM-DD (UTC)', () => {
      const ms = Date.UTC(2026, 5, 13, 18, 30) // 2026-06-13
      expect(todayStr(ms)).toBe('2026-06-13')
    })
  })

  describe('isFresh', () => {
    const now = Date.UTC(2026, 5, 13, 12, 0)
    it('is fresh within the TTL window', () => {
      const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString()
      expect(isFresh(fiveMinAgo, now)).toBe(true)
    })
    it('is stale past the TTL window', () => {
      const elevenMinAgo = new Date(now - 11 * 60 * 1000).toISOString()
      expect(isFresh(elevenMinAgo, now)).toBe(false)
    })
    it('is exactly at the TTL boundary -> stale', () => {
      const atTtl = new Date(now - DEFAULT_TTL_MS).toISOString()
      expect(isFresh(atTtl, now)).toBe(false)
    })
    it('treats null / invalid timestamps as not fresh', () => {
      expect(isFresh(null, now)).toBe(false)
      expect(isFresh('not-a-date', now)).toBe(false)
    })
  })

  describe('isLowCredit', () => {
    it('pauses below the floor', () => {
      expect(isLowCredit(CREDIT_FLOOR - 1)).toBe(true)
    })
    it('allows at or above the floor', () => {
      expect(isLowCredit(CREDIT_FLOOR)).toBe(false)
      expect(isLowCredit(5000)).toBe(false)
    })
    it('allows when credits are unknown (does not lock out the bot)', () => {
      expect(isLowCredit(null)).toBe(false)
      expect(isLowCredit(undefined)).toBe(false)
    })
  })
})
