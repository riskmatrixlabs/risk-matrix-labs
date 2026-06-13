import { describe, it, expect } from 'vitest'
import { decorate } from '../src/lib/betLinks.js'

describe('decorate', () => {
  it('returns the url unchanged when no affiliate config (passthrough)', () => {
    expect(decorate('draftkings', 'https://sportsbook.draftkings.com/event/123')).toBe('https://sportsbook.draftkings.com/event/123')
  })
  it('returns null/empty safely', () => {
    expect(decorate('fanduel', null)).toBeNull()
    expect(decorate('fanduel', '')).toBeNull()
  })
})
