import { describe, it, expect } from 'vitest'
import { tally, splitLeanRows, buildGamesMap } from '../api/_lib/leanSplit.js'

const TODAY = '2026-08-12'
const YDAY = '2026-08-11'
const OLD = '2026-08-01'

// The bug this file locks down: the games map used to be built from `base` (shadow rows
// excluded), so a graded NFL/NHL/WNBA lean could NEVER reach a card chip. The map is per-game
// DISPLAY data keyed by external_event_id — it must include shadow rows, while the record
// tallies stay split.
const mlb = [
  { external_event_id: 'mlb1', game_date: TODAY, sport: 'MLB', market: 'total', model_version: 'ou-s65-phase2', lean: 'OVER', total_line: 8.5, strong: true, result: 'W', final_total: 11, closing_line: 9, clv: 0.5 },
  { external_event_id: 'mlb1', game_date: TODAY, sport: 'MLB', market: 'ml', model_version: 'ou-s65-phase2', pick_side: 'HOME', result: 'L' },
  { external_event_id: 'mlb1', game_date: TODAY, sport: 'MLB', market: 'rl', model_version: 'ou-s65-phase2', pick_side: 'HOME -1.5', result: 'W' },
  { external_event_id: 'mlb2', game_date: YDAY, sport: 'MLB', market: 'total', lean: 'UNDER', total_line: 7.5, result: 'L', final_total: 10 },
  { external_event_id: 'mlb3', game_date: OLD, sport: 'MLB', market: 'total', lean: 'OVER', total_line: 8, result: 'W' }, // outside the window
]
const shadow = [
  { external_event_id: 'nfl1', game_date: YDAY, sport: 'NFL', market: 'total', model_version: 'nfl-total-shadow-v0', lean: 'UNDER', total_line: 44.5, strong: true, result: 'W', final_total: 37 },
  { external_event_id: 'nfl1', game_date: YDAY, sport: 'NFL', market: 'rl', model_version: 'nfl-shadow-v0', pick_side: 'AWAY', result: 'L' },
  { external_event_id: 'wnba1', game_date: TODAY, sport: 'WNBA', market: 'total', model_version: 'wnba-total-shadow-v0', lean: 'OVER', total_line: 162.5, result: null },
  { external_event_id: 'wnba1', game_date: TODAY, sport: 'WNBA', market: 'ml', model_version: 'wnba-total-shadow-v0', pick_side: 'HOME', result: 'W' },
  { external_event_id: 'nhl1', game_date: YDAY, sport: 'NHL', market: 'total', model_version: 'nhl-total-shadow-v0', lean: 'OVER', total_line: 6.5, result: 'L', final_total: 4 },
  { external_event_id: 'nhl1', game_date: YDAY, sport: 'NHL', market: 'ml', model_version: 'nhl-total-shadow-v0', pick_side: 'AWAY', result: 'W' },
]
const rows = [...mlb, ...shadow]

describe('buildGamesMap — shadow rows reach the cards', () => {
  const games = buildGamesMap(rows, TODAY, YDAY)

  it('(a) record tallies are unchanged with shadow rows present', () => {
    const before = splitLeanRows(mlb)
    const after = splitLeanRows(rows)
    for (const k of ['totals', 'mlAll', 'rlAll', 'mlRows', 'rlRows', 'teamRows', 'strong']) {
      expect(after[k]).toEqual(before[k])
    }
    expect(tally(after.totals)).toEqual({ w: 2, l: 1, p: 0, pending: 0 }) // MLB only
  })

  it('(b) a WNBA shadow row DOES appear in the games map', () => {
    expect(games.wnba1).toBeTruthy()
    expect(games.wnba1.lean).toBe('OVER')
    expect(games.wnba1.line).toBe(162.5)
    expect(games.wnba1.ml).toEqual({ pick: 'HOME', result: 'W', date: TODAY })
  })

  it('(b) an NFL shadow row DOES appear in the games map, graded', () => {
    expect(games.nfl1).toMatchObject({ lean: 'UNDER', line: 44.5, result: 'W', finalTotal: 37, strong: true })
    expect(games.nfl1.rl).toEqual({ pick: 'AWAY', result: 'L', date: YDAY })
  })

  it('NHL shadow rows carry both the total and the ml entry', () => {
    expect(games.nhl1).toMatchObject({ lean: 'OVER', line: 6.5, result: 'L' })
    expect(games.nhl1.ml).toEqual({ pick: 'AWAY', result: 'W', date: YDAY })
  })

  it('MLB entries are byte-identical to the pre-change (base-only) shape', () => {
    expect(games.mlb1).toEqual({
      lean: 'OVER', line: 8.5, strong: true, result: 'W', finalTotal: 11, date: TODAY,
      closingLine: 9, clv: 0.5,
      ml: { pick: 'HOME', result: 'L', date: TODAY },
      rl: { pick: 'HOME -1.5', result: 'W', date: TODAY },
    })
    expect(games.mlb2).toEqual({
      lean: 'UNDER', line: 7.5, strong: undefined, result: 'L', finalTotal: 10, date: YDAY,
      closingLine: null, clv: null,
    })
  })

  it('rows outside today/yesterday are excluded', () => {
    expect(games.mlb3).toBeUndefined()
  })

  it('null market counts as a total', () => {
    const g = buildGamesMap([{ external_event_id: 'x', game_date: TODAY, market: null, lean: 'OVER', total_line: 9, result: 'W' }], TODAY, YDAY)
    expect(g.x.lean).toBe('OVER')
  })

  it('an ungraded row still lands in the map (pending, result null)', () => {
    expect(games.wnba1.result).toBeNull()
  })
})
