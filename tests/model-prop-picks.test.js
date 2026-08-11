import { describe, it, expect } from 'vitest'
import { PRIMARY_MARKET, pickPropPerPlayer, topModelPicks } from '../api/_lib/modelPropPicks.js'
import { concededSogAvg } from '../api/_lib/sogAllowed.js'

describe('PRIMARY_MARKET', () => {
  it('maps basketball to points and NHL to shots on goal', () => {
    expect(PRIMARY_MARKET.WNBA).toBe('player_points')
    expect(PRIMARY_MARKET.NBA).toBe('player_points')
    expect(PRIMARY_MARKET.NBASL).toBe('player_points')
    expect(PRIMARY_MARKET.NHL).toBe('player_shots_on_goal')
  })
})

describe('pickPropPerPlayer', () => {
  it('prefers the primary market over a higher-EV secondary market', () => {
    const rows = [
      { player: 'A', market: 'player_rebounds', point: 8.5, evPct: 9 },
      { player: 'A', market: 'player_points', point: 18.5, evPct: 2 },
    ]
    expect(pickPropPerPlayer(rows, 'player_points')['A'].market).toBe('player_points')
  })
  it('within the same market takes the highest evPct', () => {
    const rows = [
      { player: 'A', market: 'player_points', point: 18.5, evPct: 2 },
      { player: 'A', market: 'player_points', point: 19.5, evPct: 6 },
      { player: 'A', market: 'player_points', point: 20.5, evPct: null },
    ]
    expect(pickPropPerPlayer(rows, 'player_points')['A'].point).toBe(19.5)
  })
  it('keeps one row per player and ignores rows without a player', () => {
    const rows = [
      { player: 'A', market: 'player_points', point: 18.5, evPct: 2 },
      { player: 'B', market: 'player_shots_on_goal', point: 2.5, evPct: 4 },
      { market: 'player_points', point: 9.5, evPct: 12 },
    ]
    const pick = pickPropPerPlayer(rows, 'player_shots_on_goal')
    expect(Object.keys(pick).sort()).toEqual(['A', 'B'])
  })
})

describe('topModelPicks', () => {
  const v = (score, tier, faded = false) => ({ score, tier, faded })
  it('filters faded / low-score / AVOID and sorts by score desc', () => {
    const { top, dropped } = topModelPicks({
      a: v(80, 'A'), b: v(60, 'B'), c: v(51, 'C'), d: v(90, 'AVOID', true), e: v(55, 'C', true), f: v(70, 'B'),
    })
    expect(top.map(p => p.player)).toEqual(['a', 'f', 'b'])
    expect(dropped).toBe(0)
  })
  it('caps at topPerGame and reports dropped', () => {
    const verdicts = {}
    for (let i = 0; i < 12; i++) verdicts[`p${i}`] = v(52 + i, 'B')
    const { top, dropped } = topModelPicks(verdicts, { topPerGame: 8 })
    expect(top.length).toBe(8)
    expect(dropped).toBe(4)
    expect(top[0].v.score).toBe(63)
  })
  it('drops null verdicts and honest-null scores', () => {
    const { top } = topModelPicks({ a: null, b: { score: null, tier: null }, c: v(75, 'A') })
    expect(top.map(p => p.player)).toEqual(['c'])
  })
})

describe('concededSogAvg', () => {
  const row = (home, away, homeSog, awaySog) => ({
    home_team: home, away_team: away,
    metadata: { home_team_stats: { sog: homeSog }, away_team_stats: { sog: awaySog } },
  })
  it('averages the OPPOSING side sog across the team games (both home and away)', () => {
    const rows = [
      row('Boston Bruins', 'New York Rangers', 33, 28),  // Bruins home → conceded 28
      row('Toronto Maple Leafs', 'Boston Bruins', 31, 25), // Bruins away → conceded 31
      row('Boston Bruins', 'Montreal Canadiens', 30, 34),  // conceded 34
    ]
    expect(concededSogAvg(rows, 'Boston Bruins')).toBeCloseTo((28 + 31 + 34) / 3, 2)
  })
  it('fail-soft null when fewer than 3 usable games', () => {
    const rows = [
      row('Boston Bruins', 'New York Rangers', 33, 28),
      { home_team: 'Boston Bruins', away_team: 'Ottawa Senators', metadata: {} }, // no stats → unusable
    ]
    expect(concededSogAvg(rows, 'Boston Bruins')).toBeNull()
    expect(concededSogAvg([], 'Boston Bruins')).toBeNull()
    expect(concededSogAvg(null, 'Boston Bruins')).toBeNull()
  })
  it('caps at the 10 most recent usable games (rows are newest-first)', () => {
    const rows = []
    for (let i = 0; i < 12; i++) rows.push(row('Boston Bruins', 'X Team', 30, i < 10 ? 20 : 40))
    expect(concededSogAvg(rows, 'Boston Bruins')).toBe(20) // the two 40s fall outside the window
  })
  it('ignores games not involving the team', () => {
    const rows = [row('A Sharks', 'B Kings', 30, 20), row('C Ducks', 'D Flames', 30, 20)]
    expect(concededSogAvg(rows, 'Boston Bruins')).toBeNull()
  })
})
