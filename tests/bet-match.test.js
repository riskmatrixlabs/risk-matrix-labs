import { describe, it, expect } from 'vitest'
import { parsePick, matchBetToEvent, evaluateBet, teamSide } from '../src/lib/betMatch.js'
import { devigTwoWay } from '../src/lib/devig.js'

const event = {
  sport: 'MLB',
  away_abbr: 'ARI', home_abbr: 'MIA',
  away_team: 'Arizona Diamondbacks', home_team: 'Miami Marlins',
  start_time: '2026-06-11T22:40:00Z',
  odds_ml_away: 110, odds_ml_home: -135,
  odds_spread_away: 1.5, odds_spread_home: -1.5,
  odds_total: 8.5,
  metadata: { spread_away_juice: -160, spread_home_juice: 135, over_juice: -105, under_juice: -115 },
}

describe('teamSide', () => {
  it('matches by abbr', () => expect(teamSide('MIA ML', event)).toBe('home'))
  it('matches by nickname', () => expect(teamSide('Marlins moneyline', event)).toBe('home'))
  it('away by abbr', () => expect(teamSide('ARI -1.5', event)).toBe('away'))
  it('no team → null', () => expect(teamSide('Over 8.5', event)).toBeNull())
})

describe('parsePick', () => {
  it('moneyline by team', () => expect(parsePick('MIA ML', event)).toEqual({ market: 'ml', side: 'home' }))
  it('bare team is moneyline', () => expect(parsePick('Marlins', event)).toEqual({ market: 'ml', side: 'home' }))
  it('over total', () => expect(parsePick('Over 9.5', event)).toEqual({ market: 'total', side: 'over', line: 9.5 }))
  it('U abbreviation', () => expect(parsePick('U 7', event)).toEqual({ market: 'total', side: 'under', line: 7 }))
  it('spread with sign', () => expect(parsePick('ARI -1.5', event)).toEqual({ market: 'spread', side: 'away', line: -1.5 }))
  it('empty → null', () => expect(parsePick('', event)).toBeNull())
})

describe('matchBetToEvent', () => {
  const base = { sport: 'MLB', event: 'Arizona Diamondbacks vs Miami Marlins', date: '2026-06-11' }
  it('matches full names + sport + date', () => expect(matchBetToEvent(base, event)).toBe(true))
  it('rejects wrong sport', () => expect(matchBetToEvent({ ...base, sport: 'NBA' }, event)).toBe(false))
  it('rejects when a team is missing', () => expect(matchBetToEvent({ ...base, event: 'Arizona Diamondbacks vs San Diego Padres' }, event)).toBe(false))
  it('rejects far-off date', () => expect(matchBetToEvent({ ...base, date: '2026-06-01' }, event)).toBe(false))
})

describe('evaluateBet', () => {
  const dvs = {
    dv: devigTwoWay(event.odds_ml_away, event.odds_ml_home),
    dvSpread: devigTwoWay(event.metadata.spread_away_juice, event.metadata.spread_home_juice),
    dvTotal: devigTwoWay(event.metadata.over_juice, event.metadata.under_juice),
  }
  it('grades a moneyline bet: -EV when you pay worse than fair', () => {
    const g = evaluateBet({ pick: 'MIA ML', odds: -135, book: 'DK', result: 'Open' }, event, dvs)
    expect(g.parsed).toEqual({ market: 'ml', side: 'home' })
    expect(g.fairProb).toBeGreaterThan(0.5)
    expect(g.evPct).toBeLessThan(0)        // -135 on a ~-122-fair team is -EV
    expect(g.clvPct).toBeCloseTo(0, 5)     // your -135 == current close -135
  })
  it('positive CLV when you beat the closing line', () => {
    const g = evaluateBet({ pick: 'MIA ML', odds: -122, result: 'Open' }, event, dvs)
    expect(g.clvPct).toBeGreaterThan(0)    // -122 beats the -135 close
  })
  it('unparseable pick → null', () => {
    expect(evaluateBet({ pick: '???', odds: -110 }, event, dvs)).toBeNull()
  })
})
