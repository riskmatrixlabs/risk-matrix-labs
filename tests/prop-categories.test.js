import { describe, it, expect } from 'vitest'
import { categoriesForSport, categoryOf, groupPropsByCategory } from '../src/lib/propCategories.js'

describe('categoriesForSport', () => {
  it('returns MLB categories in order', () => {
    expect(categoriesForSport('MLB')).toEqual(['Strikeouts', 'Home Runs', 'Batter Props', 'Pitcher Props'])
  })
  it('returns NBA categories', () => {
    expect(categoriesForSport('NBA')).toEqual(['Points', 'Rebounds', 'Assists', 'Threes'])
  })
  it('falls back to a generic Props bucket for unknown sports', () => {
    expect(categoriesForSport('TENNIS')).toEqual(['Props'])
  })
})

describe('categoryOf', () => {
  it('maps an MLB market key to its category', () => {
    expect(categoryOf('pitcher_strikeouts', 'MLB')).toBe('Strikeouts')
    expect(categoryOf('batter_home_runs', 'MLB')).toBe('Home Runs')
    expect(categoryOf('batter_hits', 'MLB')).toBe('Batter Props')
  })
  it('maps NHL market keys to their categories', () => {
    expect(categoryOf('player_shots_on_goal', 'NHL')).toBe('Shots')
    expect(categoryOf('player_points', 'NHL')).toBe('Points')
    expect(categoryOf('player_goals', 'NHL')).toBe('Goals')
    expect(categoryOf('player_total_saves', 'NHL')).toBe('Saves')
  })
  it('returns the fallback bucket for an unmapped market', () => {
    expect(categoryOf('some_unknown_market', 'MLB')).toBe('Batter Props')
    expect(categoryOf('whatever', 'TENNIS')).toBe('Props')
  })
})

describe('groupPropsByCategory', () => {
  it('buckets rows under their category', () => {
    const rows = [
      { market: 'pitcher_strikeouts', marketLabel: 'Strikeouts', point: 5.5 },
      { market: 'batter_home_runs', marketLabel: 'Home Runs', point: 0.5 },
    ]
    const out = groupPropsByCategory(rows, 'MLB')
    expect(out['Strikeouts']).toHaveLength(1)
    expect(out['Home Runs']).toHaveLength(1)
  })
})
