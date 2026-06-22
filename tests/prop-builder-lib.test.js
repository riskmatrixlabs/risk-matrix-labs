import { describe, it, expect } from 'vitest'
import { trackableStatOptions, assembleProp, pickStatValue } from '../src/lib/propBuilderLib.js'
import { parseProp, resolveStat } from '../src/lib/statProgress.js'

describe('trackableStatOptions', () => {
  it('offers only stats the box score can read (drops Total Bases + Threes)', () => {
    const mlb = trackableStatOptions('MLB').map(o => o.label)
    expect(mlb).toContain('Hits')
    expect(mlb).toContain('Strikeouts')
    expect(mlb).not.toContain('Total Bases')
    const nba = trackableStatOptions('NBA').map(o => o.label)
    expect(nba).toContain('Pts+Reb+Ast')
    expect(nba).not.toContain('Threes')
  })
  it('every offered stat round-trips: assembled pick parses + resolves', () => {
    const SYNTH = { hits: 2, runs: 1, RBIs: 1, homeRuns: 1, walks: 1, strikeouts: 7,
      points: 20, rebounds: 5, assists: 5, goals: 1, shotsTotal: 4, saves: 30 }
    for (const sport of ['MLB', 'NBA', 'NHL', 'WNBA']) {
      for (const opt of trackableStatOptions(sport)) {
        const { pick } = assembleProp({ player: 'Test Player', side: 'over', line: 1.5, statLabel: opt.label, sport, event: 'A vs B' })
        const parsed = parseProp(pick)
        expect(parsed, `parse ${pick}`).not.toBeNull()
        expect(resolveStat(SYNTH, parsed.market), `resolve ${opt.label}`).not.toBeNull()
      }
    }
  })
})

describe('assembleProp', () => {
  it('builds the canonical pick string and prop shape', () => {
    const prop = assembleProp({ player: 'Aaron Judge', side: 'over', line: 1.5, statLabel: 'Hits', sport: 'MLB', event: 'Reds vs Yankees', odds: -120 })
    expect(prop.pick).toBe('Aaron Judge Over 1.5 Hits')
    expect(prop).toMatchObject({ sport: 'MLB', event: 'Reds vs Yankees', side: 'over', line: 1.5, stat: 'Hits', odds: -120 })
  })
})

describe('pickStatValue', () => {
  const resp = { found: true, games: 10, last5games: 5,
    season: [{ label: 'H', value: 12 }, { label: 'HR', value: 3 }, { label: 'AB', value: 40 }],
    last5: [{ label: 'H', value: 7 }, { label: 'HR', value: 1 }] }
  it('returns per-game season + last5 for a simple stat', () => {
    const v = pickStatValue(resp, 'batter_hits')
    expect(v.seasonPerGame).toBeCloseTo(1.2, 2)
    expect(v.last5PerGame).toBeCloseTo(1.4, 2)
  })
  it('sums components for a combo stat (PRA)', () => {
    const nba = { found: true, games: 4, last5games: 4,
      season: [{ label: 'PTS', value: 80 }, { label: 'REB', value: 20 }, { label: 'AST', value: 16 }], last5: [] }
    expect(pickStatValue(nba, 'player_points_rebounds_assists').seasonPerGame).toBeCloseTo(29, 1)
  })
  it('returns null when the stat is not in the gamelog', () => {
    expect(pickStatValue({ found: false }, 'batter_hits')).toBeNull()
  })
})
