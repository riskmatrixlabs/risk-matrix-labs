import { describe, it, expect } from 'vitest'
import { sportChips } from '../src/components/PerformancePage.jsx'

const MODELED = ['MLB', 'WNBA', 'NFL', 'NBA', 'NHL']

describe('sportChips — Full Matrix sport filter chips', () => {
  it('every modeled sport ALWAYS shows, in fixed order, even with no data', () => {
    expect(sportChips([])).toEqual(MODELED)
    expect(sportChips([{ sport: 'MLB' }])).toEqual(MODELED)
  })
  it('unexpected sports found in data append alphabetically after the modeled set', () => {
    expect(sportChips([{ sport: 'KBO' }, { sport: 'CFL' }])).toEqual([...MODELED, 'CFL', 'KBO'])
  })
  it('NBASL never gets its own chip (folds under NBA)', () => {
    expect(sportChips([{ sport: 'NBASL' }])).toEqual(MODELED)
  })
  it('reads event.sport fallback, uppercases, skips missing sport', () => {
    expect(sportChips([{ event: { sport: 'kbo' } }, {}, { sport: null }])).toEqual([...MODELED, 'KBO'])
  })
})
