import { describe, it, expect } from 'vitest'
import { mlResult } from '../src/lib/mlResult.js'

describe('mlResult', () => {
  it('HOME pick with the home team in front → ahead', () => {
    expect(mlResult({ pick: 'HOME', homeScore: 4, awayScore: 2 })).toBe('ahead')
  })
  it('HOME pick trailing → behind', () => {
    expect(mlResult({ pick: 'HOME', homeScore: 1, awayScore: 3 })).toBe('behind')
  })
  it('AWAY pick with the away team in front → ahead', () => {
    expect(mlResult({ pick: 'AWAY', homeScore: 1, awayScore: 3 })).toBe('ahead')
  })
  it('AWAY pick trailing → behind', () => {
    expect(mlResult({ pick: 'AWAY', homeScore: 5, awayScore: 0 })).toBe('behind')
  })
  it('level score → tied, whichever side was picked', () => {
    expect(mlResult({ pick: 'HOME', homeScore: 2, awayScore: 2 })).toBe('tied')
    expect(mlResult({ pick: 'AWAY', homeScore: 0, awayScore: 0 })).toBe('tied')
  })
  it('0-0 is tied, not null (a real score of zero is not missing data)', () => {
    expect(mlResult({ pick: 'HOME', homeScore: 0, awayScore: 0 })).toBe('tied')
  })
  it('case-insensitive and tolerant of a suffixed pick string', () => {
    expect(mlResult({ pick: 'home', homeScore: 3, awayScore: 1 })).toBe('ahead')
    expect(mlResult({ pick: 'AWAY ML', homeScore: 1, awayScore: 3 })).toBe('ahead')
  })
  it('missing / unrecognised pick → null', () => {
    expect(mlResult({ pick: null, homeScore: 1, awayScore: 0 })).toBeNull()
    expect(mlResult({ pick: 'OVER', homeScore: 1, awayScore: 0 })).toBeNull()
    expect(mlResult({ homeScore: 1, awayScore: 0 })).toBeNull()
  })
  it('missing or non-numeric score → null (never guess a result)', () => {
    expect(mlResult({ pick: 'HOME', homeScore: null, awayScore: 2 })).toBeNull()
    expect(mlResult({ pick: 'HOME', homeScore: 2, awayScore: undefined })).toBeNull()
    expect(mlResult({ pick: 'HOME', homeScore: 'x', awayScore: 2 })).toBeNull()
  })
  it('no args → null', () => {
    expect(mlResult()).toBeNull()
  })
})
