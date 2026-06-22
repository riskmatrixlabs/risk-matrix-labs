import { describe, it, expect } from 'vitest'
import { parsePick, matchBetToEvent, findEventForBet, evaluateBet, teamSide } from '../src/lib/betMatch.js'
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

  // ET-date window: a late-night ET game stored on the NEXT UTC day still matches its ET date.
  it('Jun-20 night game (01:10 UTC Jun-21 = 9:10pm ET Jun-20) matches a Jun-20 bet', () => {
    const nightEv = { ...event, start_time: '2026-06-21T01:10:00Z' }
    expect(matchBetToEvent({ ...base, date: '2026-06-20' }, nightEv)).toBe(true)
  })
  it('Jun-21 19:10 UTC game matches a Jun-21 bet', () => {
    const dayEv = { ...event, start_time: '2026-06-21T19:10:00Z' }
    expect(matchBetToEvent({ ...base, date: '2026-06-21' }, dayEv)).toBe(true)
  })
})

describe('findEventForBet', () => {
  // Two candidate events: same teams, both within the date window of a Jun-21 bet.
  // Live game tonight (total 11.5, starts 19:10 UTC Jun-21) and last-night's final
  // (total 10.5, started 01:10 UTC Jun-21 = 9:10pm ET Jun-20).
  const liveGame = {
    id: '401815849', sport: 'MLB',
    away_abbr: 'PIT', home_abbr: 'COL',
    away_team: 'Pittsburgh Pirates', home_team: 'Colorado Rockies',
    start_time: '2026-06-21T19:10:00Z', status: 'in', odds_total: 11.5,
  }
  const nightFinal = {
    id: '401815834', sport: 'MLB',
    away_abbr: 'PIT', home_abbr: 'COL',
    away_team: 'Pittsburgh Pirates', home_team: 'Colorado Rockies',
    start_time: '2026-06-21T01:10:00Z', status: 'post', odds_total: 10.5,
  }
  const betOver115 = { sport: 'MLB', event: 'Pittsburgh Pirates @ Colorado Rockies', pick: 'Over 11.5', date: '2026-06-21' }

  it('picks the 11.5 live game for an Over 11.5 bet, not the 10.5 final', () => {
    expect(findEventForBet(betOver115, [nightFinal, liveGame]).id).toBe('401815849')
    // order-independent
    expect(findEventForBet(betOver115, [liveGame, nightFinal]).id).toBe('401815849')
  })

  it('picks the prev-night 10.5 game for an Over 10.5 bet (symmetry)', () => {
    const betOver105 = { ...betOver115, pick: 'Over 10.5', date: '2026-06-20' }
    expect(findEventForBet(betOver105, [liveGame, nightFinal]).id).toBe('401815834')
  })

  it('single matching event → returned as-is', () => {
    expect(findEventForBet(betOver115, [liveGame]).id).toBe('401815849')
  })

  it('no matching events → null', () => {
    const other = { ...liveGame, away_abbr: 'NYY', home_abbr: 'BOS', away_team: 'New York Yankees', home_team: 'Boston Red Sox' }
    expect(findEventForBet(betOver115, [other])).toBeNull()
    expect(findEventForBet(betOver115, [])).toBeNull()
  })

  it('ML bet (no line) with two same-team candidates → prefers matching ET date', () => {
    // bet dated Jun-20 → should pick the night game whose ET date is Jun-20
    const betMl = { sport: 'MLB', event: 'Pittsburgh Pirates @ Colorado Rockies', pick: 'PIT ML', date: '2026-06-20' }
    expect(findEventForBet(betMl, [liveGame, nightFinal]).id).toBe('401815834')
  })

  it('never throws', () => {
    expect(() => findEventForBet(null, null)).not.toThrow()
    expect(findEventForBet(null, null)).toBeNull()
  })
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
  it('does NOT crash when dvs is null (the bot TRACK channel passes null)', () => {
    // Regression: fairForSide used to destructure null → "Cannot destructure 'dv' of null"
    // crashed the whole bot when grading any logged bet on CH3 TRACK.
    expect(() => evaluateBet({ pick: 'MIA ML', odds: -135 }, event, null)).not.toThrow()
    const g = evaluateBet({ pick: 'MIA ML', odds: -135 }, event, null)
    expect(g).not.toBeNull()
    expect(g.evPct).toBeNull()              // no devig data → no EV, but still grades CLV
    expect(g.clvPct).toBeCloseTo(0, 5)
  })
})
