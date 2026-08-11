import { describe, it, expect } from 'vitest'
import { tally, splitLeanRows, isNfl, ML_FIX_DATE } from '../api/_lib/leanSplit.js'

const row = (o) => ({ game_date: '2026-08-01', ...o })

describe('tally', () => {
  it('counts W/L/P and everything else as pending', () => {
    expect(tally([{ result: 'W' }, { result: 'W' }, { result: 'L' }, { result: 'P' }, { result: null }, {}]))
      .toEqual({ w: 2, l: 1, p: 1, pending: 2 })
  })
  it('empty set → all zeros', () => {
    expect(tally([])).toEqual({ w: 0, l: 0, p: 0, pending: 0 })
  })
})

describe('splitLeanRows — NFL isolation', () => {
  const mlb = [
    row({ market: 'total', strong: true, result: 'W' }),
    row({ market: 'total', strong: false, result: 'L' }),
    row({ market: null, result: 'W' }),                          // null market counts as total
    row({ market: 'ml', game_date: '2026-06-22', result: 'L' }), // pre-fix, excluded from mlRows
    row({ market: 'ml', game_date: '2026-06-23', result: 'W' }),
    row({ market: 'rl', game_date: '2026-06-22', result: 'L' }), // pre-fix, excluded from rlRows
    row({ market: 'rl', game_date: '2026-07-01', result: 'W' }),
  ]
  const nfl = [
    row({ sport: 'NFL', market: 'rl', result: 'W' }),
    row({ sport: 'NFL', market: 'rl', result: 'L' }),
    row({ sport: 'NFL', market: 'rl' }),                          // pending
  ]
  const s = splitLeanRows([...mlb, ...nfl])

  it('existing sets are byte-identical to the pre-NFL split (NFL rows fully excluded)', () => {
    const before = splitLeanRows(mlb)
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k]).toEqual(before[k])
    }
  })
  it('no NFL row leaks into any existing set', () => {
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k].some(isNfl)).toBe(false)
    }
  })
  it('rl record excludes NFL and pre-fix rows', () => {
    expect(tally(s.rlRows)).toEqual({ w: 1, l: 0, p: 0, pending: 0 })
  })
  it('nflRl carries exactly the NFL rl rows', () => {
    expect(s.nflRl).toHaveLength(3)
    expect(tally(s.nflRl)).toEqual({ w: 1, l: 1, p: 0, pending: 1 })
  })
  it('sport is case-insensitive and null sport is not NFL', () => {
    expect(isNfl({ sport: 'nfl' })).toBe(true)
    expect(isNfl({ sport: null })).toBe(false)
    expect(isNfl({ sport: 'MLB' })).toBe(false)
  })
  it('ML_FIX_DATE is the Jun 23 cutoff', () => {
    expect(ML_FIX_DATE).toBe('2026-06-23')
  })
})
