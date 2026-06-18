import { describe, it, expect } from 'vitest'
import { decorate, deepLinksToBet } from '../src/lib/betLinks.js'

describe('decorate', () => {
  it('returns the url unchanged when no affiliate config (passthrough)', () => {
    expect(decorate('draftkings', 'https://sportsbook.draftkings.com/event/123')).toBe('https://sportsbook.draftkings.com/event/123')
  })
  it('returns null/empty safely', () => {
    expect(decorate('fanduel', null)).toBeNull()
    expect(decorate('fanduel', '')).toBeNull()
  })
})

describe('deepLinksToBet', () => {
  it('TRUE for web-deep-link books that have a feed link (lands on the bet)', () => {
    expect(deepLinksToBet('fanduel', 'https://sportsbook.fanduel.com/abc')).toBe(true)
    expect(deepLinksToBet('draftkings', 'https://sportsbook.draftkings.com/x?y=1')).toBe(true)
    expect(deepLinksToBet('williamhill_us', 'https://caesars.com/x')).toBe(true)
    expect(deepLinksToBet('betmgm', 'https://sports.betmgm.com/x')).toBe(true)
  })
  it('FALSE for app-open-only books even when a link is present (Hard Rock, Novig)', () => {
    expect(deepLinksToBet('hardrockbet', 'https://hrb.onelink.me/aSsa/x?deep_link_value=y')).toBe(false)
    expect(deepLinksToBet('novig', 'https://novig.onelink.me/JHQQ/x')).toBe(false)
  })
  it('FALSE when there is no per-selection feed link (homepage/referral fallback)', () => {
    expect(deepLinksToBet('fanduel', null)).toBe(false)
    expect(deepLinksToBet('draftkings', undefined)).toBe(false)
  })
})
