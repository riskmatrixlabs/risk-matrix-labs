import { describe, it, expect } from 'vitest'
import { umpireDelta, normName, UMP_DELTA_CAP, UMP_TENDENCY } from '../api/_lib/umpire.js'

describe('umpireDelta', () => {
  it('known UNDER ump (wide zone) → negative delta + under reason', () => {
    const { delta, reason } = umpireDelta({ umpName: 'Pat Hoberg' })
    expect(delta).toBeLessThan(0)
    expect(reason).toBe('wide-zone ump (under)')
  })

  it('known OVER ump (tight zone) → positive delta + over reason', () => {
    const { delta, reason } = umpireDelta({ umpName: 'Angel Hernandez' })
    expect(delta).toBeGreaterThan(0)
    expect(reason).toBe('hitter-friendly ump (over)')
  })

  it('unknown ump → 0 delta, null reason', () => {
    const { delta, reason } = umpireDelta({ umpName: 'Nobody McNoface' })
    expect(delta).toBe(0)
    expect(reason).toBeNull()
  })

  it('missing/empty input → 0 delta, null reason', () => {
    expect(umpireDelta({})).toEqual({ delta: 0, reason: null })
    expect(umpireDelta()).toEqual({ delta: 0, reason: null })
  })

  it('neutral ump → 0 delta, null reason', () => {
    expect(umpireDelta({ umpName: 'Joe West' })).toEqual({ delta: 0, reason: null })
  })

  it('explicit tendency bucket bypasses the table', () => {
    expect(umpireDelta({ tendency: 'strong_under' }).delta).toBeLessThan(0)
    expect(umpireDelta({ tendency: 'strong_over' }).delta).toBeGreaterThan(0)
  })

  it('every delta stays within the ±cap', () => {
    for (const name of Object.keys(UMP_TENDENCY)) {
      const { delta } = umpireDelta({ umpName: name })
      expect(Math.abs(delta)).toBeLessThanOrEqual(UMP_DELTA_CAP)
    }
  })

  it('normName strips accents and punctuation for matching', () => {
    expect(normName('Ángel Hernández')).toBe('angel hernandez')
    expect(normName('C.B. Bucknor')).toBe('cb bucknor')
    // accented feed name still resolves to the table entry
    expect(umpireDelta({ umpName: 'Ángel Hernández' }).delta).toBeGreaterThan(0)
  })
})
