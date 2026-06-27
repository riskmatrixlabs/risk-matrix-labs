import { describe, it, expect } from 'vitest'
import { abbrFor, teamLogoUrl, teamsFromText, resolveBetLogos, TEAM_ABBR } from '../src/lib/teamLogos.js'

describe('abbrFor', () => {
  it('resolves by full name', () => expect(abbrFor('MLB', 'Atlanta Braves')).toBe('atl'))
  it('resolves by city/place', () => expect(abbrFor('MLB', 'San Diego')).toBe('sd'))
  it('resolves by nickname', () => expect(abbrFor('MLB', 'Yankees')).toBe('nyy'))
  it('accepts an already-correct abbr', () => expect(abbrFor('MLB', 'BOS')).toBe('bos'))
  it('is case/punctuation insensitive', () => expect(abbrFor('MLB', "  st. louis  ")).toBe('stl'))
  it('returns null for unknown', () => expect(abbrFor('MLB', 'Toronto Maple Leafs')).toBeNull())
  it('returns null for unknown sport', () => expect(abbrFor('NFL', 'Cowboys')).toBeNull())
  it('does not collide nicknames across sports', () => {
    expect(abbrFor('NBA', 'Atlanta Hawks')).toBe('atl')
    expect(abbrFor('NHL', 'Boston Bruins')).toBe('bos')
  })
})

describe('teamLogoUrl', () => {
  it('builds the correct MLB URL (atl)', () =>
    expect(teamLogoUrl('MLB', 'Atlanta Braves')).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/atl.png'))
  it('builds the correct MLB URL (sd)', () =>
    expect(teamLogoUrl('MLB', 'Padres')).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/sd.png'))
  it('builds the correct MLB URL (nyy)', () =>
    expect(teamLogoUrl('MLB', 'New York Yankees')).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png'))
  it('returns null for unknown team', () => expect(teamLogoUrl('MLB', 'Nobody')).toBeNull())
})

describe('teamsFromText', () => {
  it('parses AWAY@HOME', () => expect(teamsFromText('BOS@SEA')).toEqual({ away: 'BOS', home: 'SEA' }))
  it('parses "Away vs Home"', () =>
    expect(teamsFromText('Atlanta Braves vs San Diego Padres')).toEqual({ away: 'Atlanta Braves', home: 'San Diego Padres' }))
  it('handles vs.', () => expect(teamsFromText('Cubs vs. Reds')).toEqual({ away: 'Cubs', home: 'Reds' }))
  it('returns nulls for junk', () => expect(teamsFromText('')).toEqual({ away: null, home: null }))
})

describe('resolveBetLogos', () => {
  it('returns both crests for a total', () => {
    const r = resolveBetLogos({ sport: 'MLB', title: 'Over 7.5', event: 'PIT@COL', isTotal: true })
    expect(r.logo).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/pit.png')
    expect(r.logo2).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/col.png')
  })
  it('returns the picked side for an ML pick (team-led title)', () => {
    const r = resolveBetLogos({ sport: 'MLB', title: 'ATL ML', event: 'Atlanta Braves vs San Diego Padres', isTotal: false })
    expect(r.logo).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/atl.png')
    expect(r.logo2).toBeNull()
  })
  it('resolves a spread pick to the named side', () => {
    const r = resolveBetLogos({ sport: 'MLB', title: 'PHI -1.5', event: 'Philadelphia Phillies vs New York Mets', isTotal: false })
    expect(r.logo).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/phi.png')
  })
  it('falls back to away team when title side is unknown', () => {
    const r = resolveBetLogos({ sport: 'MLB', title: 'BOS@SEA Over 7.5', event: 'BOS@SEA', isTotal: false })
    expect(r.logo).toBe('https://a.espncdn.com/i/teamlogos/mlb/500/bos.png')
  })
  it('returns nulls gracefully for unknown teams', () => {
    expect(resolveBetLogos({ sport: 'MLB', title: 'XXX ML', event: 'XXX vs YYY', isTotal: false })).toEqual({ logo: null, logo2: null })
  })
  it('never throws on bad input', () => {
    expect(() => resolveBetLogos({})).not.toThrow()
    expect(resolveBetLogos()).toEqual({ logo: null, logo2: null })
  })
})

describe('coverage sanity', () => {
  it('has all 30 MLB teams (each keyed by abbr at minimum)', () => {
    const abbrs = new Set(Object.values(TEAM_ABBR.MLB))
    expect(abbrs.size).toBe(30)
  })
})
