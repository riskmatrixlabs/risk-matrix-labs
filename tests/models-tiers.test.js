import { describe, it, expect } from 'vitest'
import { internalTier, brandTier } from '../src/lib/models/tiers.js'

describe('internalTier', () => {
  it('maps the MODELS.md uniform scale', () => {
    expect(internalTier(92)).toBe('ELITE')
    expect(internalTier(80)).toBe('STRONG')
    expect(internalTier(70)).toBe('LEAN')
    expect(internalTier(63)).toBe('WATCH')
    expect(internalTier(40)).toBe('PASS')
  })
  it('rejects junk', () => { expect(internalTier(NaN)).toBe(null) })
})
describe('brandTier', () => {
  it('maps to user-facing tiers (no gambling words)', () => {
    expect(brandTier(92)).toBe('PRIME')
    expect(brandTier(80)).toBe('STRONG')
    expect(brandTier(65)).toBe('CAUTION')
    expect(brandTier(40)).toBe('FADE')
  })
})
