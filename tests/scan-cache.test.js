import { describe, it, expect, beforeEach } from 'vitest'
import { cacheKey, getScan, putScan, clearScanCache } from '../src/lib/scanCache.js'

describe('scanCache', () => {
  beforeEach(() => clearScanCache())

  it('builds a key from sport + date', () => {
    expect(cacheKey('MLB', '2026-06-13')).toBe('MLB:2026-06-13')
  })
  it('returns null on a miss', () => {
    expect(getScan('MLB', '2026-06-13')).toBeNull()
  })
  it('stores and returns a scan result (no re-charge on re-read)', () => {
    const payload = { edges: [{ evPct: 6.2 }], creditsRemaining: 480 }
    putScan('MLB', '2026-06-13', payload)
    expect(getScan('MLB', '2026-06-13')).toEqual(payload)
  })
  it('isolates by sport and date', () => {
    putScan('MLB', '2026-06-13', { edges: [] })
    expect(getScan('NHL', '2026-06-13')).toBeNull()
    expect(getScan('MLB', '2026-06-14')).toBeNull()
  })
})
