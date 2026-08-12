// NFL registration across the paid-odds + props chain: the odds provider sport key, the
// curated/full prop-market sets, their labels, the category tabs, and the snapshot loop's
// primary market. Market keys are the REAL The Odds API american-football keys (verified
// against the provider's betting-markets docs, 2026-08-12).
import { describe, it, expect } from 'vitest'
import { SPORT_KEYS } from '../api/_lib/oddsProviders/theOddsApi.js'
import { PROP_MARKETS, PROP_MARKETS_FULL, MARKET_LABELS, labelFor } from '../src/lib/propMarkets.js'
import { categoriesForSport, categoryOf } from '../src/lib/propCategories.js'
import { PRIMARY_MARKET } from '../api/_lib/modelPropPicks.js'

describe('NFL is registered with the odds provider', () => {
  it('maps NFL to the real The Odds API sport key (preseason runs under the same key)', () => {
    expect(SPORT_KEYS.NFL).toBe('americanfootball_nfl')
  })
})

describe('NFL prop markets', () => {
  it('curated set is the liquid core', () => {
    expect(PROP_MARKETS.NFL).toEqual([
      'player_pass_yds', 'player_pass_tds', 'player_rush_yds',
      'player_reception_yds', 'player_receptions', 'player_anytime_td',
    ])
  })
  it('full set is a superset of the curated set', () => {
    for (const m of PROP_MARKETS.NFL) expect(PROP_MARKETS_FULL.NFL).toContain(m)
    expect(PROP_MARKETS_FULL.NFL.length).toBeGreaterThan(PROP_MARKETS.NFL.length)
  })
  it('full set adds the documented opt-in markets', () => {
    for (const m of ['player_pass_attempts', 'player_pass_completions', 'player_pass_interceptions',
      'player_rush_attempts', 'player_rush_reception_yds', 'player_kicking_points', 'player_1st_td']) {
      expect(PROP_MARKETS_FULL.NFL).toContain(m)
    }
  })
  it('every NFL market key has a human label (no raw keys leak to the UI)', () => {
    for (const m of PROP_MARKETS_FULL.NFL) {
      expect(MARKET_LABELS[m], `missing label for ${m}`).toBeTruthy()
      expect(labelFor(m)).not.toBe(m)
    }
    expect(labelFor('player_pass_yds')).toBe('Pass Yards')
    expect(labelFor('player_anytime_td')).toBe('Anytime TD')
  })
})

describe('NFL prop categories', () => {
  it('exposes the four NFL tabs', () => {
    expect(categoriesForSport('NFL')).toEqual(['Passing', 'Rushing', 'Receiving', 'Touchdowns'])
  })
  it('maps every NFL market into one of its tabs', () => {
    const tabs = categoriesForSport('NFL')
    for (const m of PROP_MARKETS_FULL.NFL) expect(tabs).toContain(categoryOf(m, 'NFL'))
  })
  it('maps the key markets to the right tab', () => {
    expect(categoryOf('player_pass_yds', 'NFL')).toBe('Passing')
    expect(categoryOf('player_pass_tds', 'NFL')).toBe('Touchdowns')
    expect(categoryOf('player_rush_yds', 'NFL')).toBe('Rushing')
    expect(categoryOf('player_reception_yds', 'NFL')).toBe('Receiving')
    expect(categoryOf('player_receptions', 'NFL')).toBe('Receiving')
    expect(categoryOf('player_anytime_td', 'NFL')).toBe('Touchdowns')
    expect(categoryOf('player_rush_reception_yds', 'NFL')).toBe('Rushing')
  })
  it('falls back inside NFL for an unmapped market', () => {
    expect(categoryOf('player_sacks', 'NFL')).toBe('Passing')
  })
})

describe('NFL in the model snapshot loop', () => {
  it('has a primary market so the snapshot cron can pick one prop per player', () => {
    expect(PRIMARY_MARKET.NFL).toBe('player_pass_yds')
  })
})
