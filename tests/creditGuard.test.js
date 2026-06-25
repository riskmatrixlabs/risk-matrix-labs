import { describe, it, expect } from 'vitest'
import { isBelowFloor, CREDIT_FLOOR } from '../api/_lib/creditGuard.js'

describe('isBelowFloor (credit circuit breaker — pure)', () => {
  it('blocks when remaining is below the default floor', () => {
    expect(isBelowFloor(999)).toBe(true)
    expect(isBelowFloor(0)).toBe(true)
  })

  it('allows when remaining is exactly at the floor', () => {
    expect(isBelowFloor(CREDIT_FLOOR)).toBe(false)
  })

  it('allows when remaining is above the floor', () => {
    expect(isBelowFloor(100000)).toBe(false)
  })

  it('fails OPEN when remaining is null (unknown credits must not block)', () => {
    expect(isBelowFloor(null)).toBe(false)
  })

  it('fails OPEN when remaining is undefined', () => {
    expect(isBelowFloor(undefined)).toBe(false)
  })

  it('fails OPEN on non-finite remaining (NaN)', () => {
    expect(isBelowFloor(NaN)).toBe(false)
  })

  it('respects a custom floor', () => {
    expect(isBelowFloor(1400, 1500)).toBe(true)
    expect(isBelowFloor(1500, 1500)).toBe(false)
  })
})
