import { describe, it, expect } from 'vitest'
import { pickSlate, slateLabel, etDayKey } from '../src/lib/shadowSlate.js'

// Wed Aug 12 2026, 01:36 ET = 05:36 UTC — the exact moment the owner saw an empty NFL section.
const NOW = Date.parse('2026-08-12T05:36:00Z')
const g = (id, iso) => ({ id, external_event_id: id, away_team: 'A', home_team: 'H', start_time: iso })

describe('etDayKey / slateLabel', () => {
  it('buckets by ET calendar day, not UTC (a 00:20Z game is the previous ET evening)', () => {
    expect(etDayKey('2026-08-14T00:20:00Z')).toBe('2026-08-13')
    expect(etDayKey('2026-08-13T17:00:00Z')).toBe('2026-08-13')
  })
  it('labels a slate as WEEKDAY M/D in ET', () => {
    expect(slateLabel('2026-08-13T17:00:00Z')).toBe('THU 8/13')
    expect(slateLabel('2026-08-14T00:20:00Z')).toBe('THU 8/13') // Thu night game, not Friday
  })
  it('unparseable input → null / empty, never a fake date', () => {
    expect(etDayKey('nope')).toBe(null)
    expect(slateLabel(null)).toBe('')
  })
})

describe('pickSlate', () => {
  const today = [g('t1', '2026-08-12T23:10:00Z'), g('t2', '2026-08-13T00:05:00Z')]
  const upcoming = [
    g('u1', '2026-08-13T17:00:00Z'),
    g('u2', '2026-08-13T20:25:00Z'),
    g('u3', '2026-08-14T00:20:00Z'), // still the THU 8/13 ET slate
    g('u4', '2026-08-16T17:00:00Z'), // a later slate — must NOT be mixed in
  ]

  it('today has pre-game games → unchanged behavior, no label, no fallback', () => {
    const s = pickSlate(today, upcoming, NOW)
    expect(s.games.map(x => x.id)).toEqual(['t1', 't2'])
    expect(s.fallback).toBe(false)
    expect(s.label).toBe('')
  })

  it('no games today → falls back to the EARLIEST upcoming slate day only, labeled', () => {
    const s = pickSlate([], upcoming, NOW)
    expect(s.games.map(x => x.id)).toEqual(['u1', 'u2', 'u3'])
    expect(s.fallback).toBe(true)
    expect(s.label).toBe('THU 8/13')
  })

  it("today's games have all started → still falls back (a started game is not shadow-able)", () => {
    const started = [g('s1', '2026-08-12T00:10:00Z')]
    const s = pickSlate(started, upcoming, NOW)
    expect(s.fallback).toBe(true)
    expect(s.games.map(x => x.id)).toEqual(['u1', 'u2', 'u3'])
  })

  it('drops started/malformed games from the fallback set too', () => {
    const s = pickSlate([], [g('past', '2026-08-11T17:00:00Z'), { id: 'x' }, ...upcoming], NOW)
    expect(s.games.map(x => x.id)).toEqual(['u1', 'u2', 'u3'])
  })

  it('nothing anywhere → honest empty, no label', () => {
    expect(pickSlate([], [], NOW)).toEqual({ games: [], fallback: false, label: '' })
    expect(pickSlate(null, null, NOW)).toEqual({ games: [], fallback: false, label: '' })
  })

  it('requires both team names (the loops filter on them today)', () => {
    const s = pickSlate([{ id: 'bad', home_team: 'H', start_time: '2026-08-12T23:10:00Z' }], upcoming, NOW)
    expect(s.fallback).toBe(true)
  })
})
