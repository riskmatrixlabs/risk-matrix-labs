import { describe, it, expect } from 'vitest'
import { gradeProp } from '../api/_lib/gradeLean.js'

describe('gradeProp — PHLT player-prop grading from a final stat value', () => {
  it('OVER hit → W', () => {
    expect(gradeProp({ statValue: 2, prop_line: 1.5, lean: 'OVER' })).toBe('W')
  })
  it('OVER miss → L', () => {
    expect(gradeProp({ statValue: 1, prop_line: 1.5, lean: 'OVER' })).toBe('L')
  })
  it('UNDER hit (stat >= line) → L', () => {
    expect(gradeProp({ statValue: 2, prop_line: 1.5, lean: 'UNDER' })).toBe('L')
  })
  it('UNDER miss (stat < line) → W', () => {
    expect(gradeProp({ statValue: 1, prop_line: 1.5, lean: 'UNDER' })).toBe('W')
  })
  it('null statValue (DNP / not found) → null', () => {
    expect(gradeProp({ statValue: null, prop_line: 1.5, lean: 'OVER' })).toBeNull()
  })
  it('non-finite line → null', () => {
    expect(gradeProp({ statValue: 2, prop_line: NaN, lean: 'OVER' })).toBeNull()
    expect(gradeProp({ statValue: 2, prop_line: null, lean: 'OVER' })).toBeNull()
  })
  it('unknown lean → null', () => {
    expect(gradeProp({ statValue: 2, prop_line: 1.5, lean: 'PUSH' })).toBeNull()
  })
  it('lean is case-insensitive', () => {
    expect(gradeProp({ statValue: 2, prop_line: 1.5, lean: 'over' })).toBe('W')
  })
})
