import { describe, it, expect } from 'vitest'
import { tally, splitLeanRows, isNfl, isNhl, isWnba, isShadowSport, isShadowModel, ML_FIX_DATE } from '../api/_lib/leanSplit.js'

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

describe('splitLeanRows — shadow TOTALS isolation (NFL + NHL game totals)', () => {
  const mlb = [
    row({ market: 'total', strong: true, result: 'W' }),
    row({ market: null, result: 'L' }),
    row({ market: 'ml', game_date: '2026-07-01', result: 'W' }),
  ]
  const shadow = [
    row({ sport: 'NFL', market: 'total', strong: true, result: 'W' }),  // nfl-total-shadow-v0
    row({ sport: 'NFL', market: 'total' }),                              // pending
    row({ sport: 'NHL', market: 'total', result: 'L' }),                 // nhl-total-shadow-v0
    row({ sport: 'nhl', market: 'total', result: 'W' }),                 // case-insensitive
    row({ sport: 'NFL', market: 'rl', result: 'W' }),                    // side shadow, not a total
  ]
  const s = splitLeanRows([...mlb, ...shadow])

  it('MLB-facing sets are byte-identical with or without the shadow rows', () => {
    const before = splitLeanRows(mlb)
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k]).toEqual(before[k])
    }
  })
  it('no NFL or NHL row leaks into any MLB-facing set (incl. the O/U totals tallies)', () => {
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k].some(isShadowSport)).toBe(false)
    }
    expect(tally(s.totals)).toEqual({ w: 1, l: 1, p: 0, pending: 0 }) // MLB only
  })
  it('nflTotals carries exactly the NFL total rows (not the rl side rows)', () => {
    expect(s.nflTotals).toHaveLength(2)
    expect(tally(s.nflTotals)).toEqual({ w: 1, l: 0, p: 0, pending: 1 })
  })
  it('nhlTotals carries exactly the NHL total rows, case-insensitive', () => {
    expect(s.nhlTotals).toHaveLength(2)
    expect(tally(s.nhlTotals)).toEqual({ w: 1, l: 1, p: 0, pending: 0 })
  })
  it('nflRl still carries only the NFL rl rows', () => {
    expect(s.nflRl).toHaveLength(1)
  })
  it('isNhl matches NHL only, case-insensitive', () => {
    expect(isNhl({ sport: 'nhl' })).toBe(true)
    expect(isNhl({ sport: 'NFL' })).toBe(false)
    expect(isNhl({ sport: null })).toBe(false)
  })
})

describe('splitLeanRows — WNBA total shadow isolation (by model_version, not sport)', () => {
  // WNBA legitimately has prop rows in prop_results (a DIFFERENT table) — lean_results had
  // ZERO WNBA rows when this shipped (verified 2026-08-11). Shadow rows are excluded from
  // the MLB-facing sets by their '-shadow-' model_version, not by blanket sport.
  const mlb = [
    row({ market: 'total', strong: true, result: 'W', model_version: 'ou-s65-phase2' }),
    row({ market: null, result: 'L' }),                          // legacy row, no model_version
    row({ market: 'ml', game_date: '2026-07-01', result: 'W' }),
    row({ market: 'rl', game_date: '2026-07-01', result: 'L' }),
  ]
  const wnba = [
    row({ sport: 'WNBA', market: 'total', model_version: 'wnba-total-shadow-v0', strong: true, result: 'W' }),
    row({ sport: 'wnba', market: 'total', model_version: 'wnba-total-shadow-v0', result: 'L' }), // case-insensitive
    row({ sport: 'WNBA', market: 'total', model_version: 'wnba-total-shadow-v0' }),              // pending
  ]
  const s = splitLeanRows([...mlb, ...wnba])

  it('MLB-facing sets are byte-identical with or without the WNBA shadow rows', () => {
    const before = splitLeanRows(mlb)
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k]).toEqual(before[k])
    }
  })
  it('no WNBA shadow row leaks into any MLB-facing set (incl. the O/U totals tallies)', () => {
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k].some(isWnba)).toBe(false)
    }
    expect(tally(s.totals)).toEqual({ w: 1, l: 1, p: 0, pending: 0 }) // MLB only
  })
  it('wnbaTotals carries exactly the WNBA shadow total rows, case-insensitive', () => {
    expect(s.wnbaTotals).toHaveLength(3)
    expect(tally(s.wnbaTotals)).toEqual({ w: 1, l: 1, p: 0, pending: 1 })
  })
  it('nfl/nhl splits are untouched by WNBA rows', () => {
    expect(s.nflRl).toHaveLength(0)
    expect(s.nflTotals).toHaveLength(0)
    expect(s.nhlTotals).toHaveLength(0)
  })
  it('isShadowModel matches any -shadow- model_version and nothing else', () => {
    expect(isShadowModel({ model_version: 'wnba-total-shadow-v0' })).toBe(true)
    expect(isShadowModel({ model_version: 'nfl-shadow-v0' })).toBe(true)
    expect(isShadowModel({ model_version: 'ou-s65-phase2' })).toBe(false)
    expect(isShadowModel({ model_version: null })).toBe(false)
    expect(isShadowModel({})).toBe(false)
  })
  it('isWnba matches WNBA only, case-insensitive', () => {
    expect(isWnba({ sport: 'wnba' })).toBe(true)
    expect(isWnba({ sport: 'NBA' })).toBe(false)
    expect(isWnba({ sport: null })).toBe(false)
  })
})

describe('splitLeanRows — shadow MONEYLINE isolation (WNBA + NHL ml from the totals projections)', () => {
  const mlb = [
    row({ market: 'total', strong: true, result: 'W', model_version: 'ou-s65-phase2' }),
    row({ market: null, result: 'L' }),
    row({ market: 'ml', game_date: '2026-07-01', result: 'W' }),
    row({ market: 'rl', game_date: '2026-07-01', result: 'L' }),
  ]
  const shadowMl = [
    row({ sport: 'WNBA', market: 'ml', model_version: 'wnba-total-shadow-v0', result: 'W' }),
    row({ sport: 'wnba', market: 'ml', model_version: 'wnba-total-shadow-v0', result: 'L' }), // case-insensitive
    row({ sport: 'WNBA', market: 'ml', model_version: 'wnba-total-shadow-v0' }),              // pending
    row({ sport: 'NHL', market: 'ml', model_version: 'nhl-total-shadow-v0', result: 'W' }),
    row({ sport: 'nhl', market: 'ml', model_version: 'nhl-total-shadow-v0' }),                // pending, case-insensitive
    row({ sport: 'WNBA', market: 'total', model_version: 'wnba-total-shadow-v0', result: 'W' }), // totals row, NOT ml
    row({ sport: 'NHL', market: 'total', model_version: 'nhl-total-shadow-v0', result: 'L' }),   // totals row, NOT ml
  ]
  const s = splitLeanRows([...mlb, ...shadowMl])

  it('MLB-facing sets are byte-identical with or without the shadow ml rows (isShadowModel on base)', () => {
    const before = splitLeanRows(mlb)
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(s[k]).toEqual(before[k])
    }
  })
  it('no shadow ml row leaks into the MLB ML record', () => {
    expect(s.mlAll.some(isShadowModel)).toBe(false)
    expect(tally(s.mlRows)).toEqual({ w: 1, l: 0, p: 0, pending: 0 }) // MLB only
  })
  it('wnbaMl carries exactly the WNBA shadow ml rows, case-insensitive (not the totals rows)', () => {
    expect(s.wnbaMl).toHaveLength(3)
    expect(tally(s.wnbaMl)).toEqual({ w: 1, l: 1, p: 0, pending: 1 })
  })
  it('nhlMl carries exactly the NHL shadow ml rows, case-insensitive (not the totals rows)', () => {
    expect(s.nhlMl).toHaveLength(2)
    expect(tally(s.nhlMl)).toEqual({ w: 1, l: 0, p: 0, pending: 1 })
  })
  it('ml rows do not leak into the totals splits', () => {
    expect(s.wnbaTotals).toHaveLength(1)
    expect(s.nhlTotals).toHaveLength(1)
  })
})
