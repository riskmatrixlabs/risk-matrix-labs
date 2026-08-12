// Pure pieces of api/nfl-props.js: the ESPN NFL gamelog parser and the team-side spread signer.
// Fixture mirrors the REAL gamelog shape (site.web.api.espn.com/.../football/nfl/athletes/<id>/gamelog):
// `labels` REPEATS ('YDS','TD','LNG' for passing AND rushing) — only `names` is unambiguous.
import { describe, it, expect } from 'vitest'
import { formFromGamelog, teamSpreadFor, MARKET_COLS } from '../api/nfl-props.js'

const qbGamelog = {
  labels: ['CMP', 'ATT', 'YDS', 'CMP%', 'AVG', 'TD', 'INT', 'LNG', 'SACK', 'RTG', 'QBR', 'CAR', 'YDS', 'AVG', 'TD', 'LNG'],
  names: ['completions', 'passingAttempts', 'passingYards', 'completionPct', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions', 'longPassing', 'sacks', 'QBRating', 'adjQBR', 'rushingAttempts', 'rushingYards', 'yardsPerRushAttempt', 'rushingTouchdowns', 'longRushing'],
  events: {
    g1: { gameDate: '2025-09-07T17:00Z' }, g2: { gameDate: '2025-09-14T17:00Z' },
    g3: { gameDate: '2025-09-21T17:00Z' }, g4: { gameDate: '2025-09-28T17:00Z' },
  },
  seasonTypes: [{
    categories: [{
      events: [
        { eventId: 'g1', stats: ['16', '28', '100', '57.1', '6.8', '0', '1', '26', '5', '62.9', '56.1', '2', '15', '7.5', '1', '12'] },
        { eventId: 'g2', stats: ['20', '30', '200', '66.7', '6.8', '1', '0', '26', '2', '90.0', '70.0', '1', '5', '5.0', '0', '5'] },
        { eventId: 'g3', stats: ['24', '34', '300', '70.6', '8.8', '3', '0', '55', '1', '120.0', '85.0', '3', '20', '6.7', '0', '9'] },
        { eventId: 'g4', stats: ['22', '32', '400', '68.8', '12.5', '2', '1', '61', '0', '110.0', '80.0', '0', '0', '0.0', '0', '0'] },
      ],
    }],
  }],
}

describe('formFromGamelog (NFL)', () => {
  it('averages the stat and its opportunity column, newest-first for last-3', () => {
    const f = formFromGamelog(qbGamelog, 'passingYards', 'passingAttempts')
    expect(f.games).toBe(4)
    expect(f.seasonRate).toBeCloseTo(250, 3)               // (100+200+300+400)/4
    expect(f.last3Rate).toBeCloseTo(300, 3)                // g4,g3,g2 → (400+300+200)/3
    expect(f.volumePerGame).toBeCloseTo(31, 3)             // (28+30+34+32)/4
  })
  it('reads rushing columns off the SAME log without label collision', () => {
    const f = formFromGamelog(qbGamelog, 'rushingYards', 'rushingAttempts')
    expect(f.seasonRate).toBeCloseTo(10, 3)                // (15+5+20+0)/4 — the 0-carry game COUNTS
    expect(f.volumePerGame).toBeCloseTo(1.5, 3)
  })
  it('drops an all-zero (DNP) row but keeps a real zero-opportunity game', () => {
    const evts = qbGamelog.seasonTypes[0].categories[0].events
    const withDnp = {
      ...qbGamelog,
      events: { ...qbGamelog.events, g0: { gameDate: '2025-08-31T17:00Z' } },
      seasonTypes: [{ categories: [{ events: [...evts, { eventId: 'g0', stats: evts[0].stats.map(() => '0') }] }] }],
    }
    const f = formFromGamelog(withDnp, 'passingYards', 'passingAttempts')
    expect(f.games).toBe(4)                                 // the DNP row is not a played game
    expect(f.seasonRate).toBeCloseTo(250, 3)
  })
  it('returns null when the column does not exist for this player', () => {
    expect(formFromGamelog(qbGamelog, 'receivingYards', 'receivingTargets')).toBeNull()
  })
  it('returns null with fewer than three played games (honest, not a 1-game extrapolation)', () => {
    const short = { ...qbGamelog, seasonTypes: [{ categories: [{ events: qbGamelog.seasonTypes[0].categories[0].events.slice(0, 2) }] }] }
    expect(formFromGamelog(short, 'passingYards', 'passingAttempts')).toBeNull()
  })
  it('returns null on an empty or malformed gamelog', () => {
    expect(formFromGamelog(null, 'passingYards', 'passingAttempts')).toBeNull()
    expect(formFromGamelog({ names: [] }, 'passingYards', 'passingAttempts')).toBeNull()
    expect(formFromGamelog({ names: qbGamelog.names, seasonTypes: [] }, 'passingYards', 'passingAttempts')).toBeNull()
  })
})

describe('teamSpreadFor', () => {
  const ctx = { oddsTotal: 44, homeSpread: -3.5, homeAbbr: 'KC', awayAbbr: 'BUF' }
  it('gives the home team the home spread and the away team its negation', () => {
    expect(teamSpreadFor('KC', ctx)).toBe(-3.5)
    expect(teamSpreadFor('BUF', ctx)).toBe(3.5)
  })
  it('is null when the side cannot be resolved — never a guess', () => {
    expect(teamSpreadFor('NYJ', ctx)).toBeNull()
    expect(teamSpreadFor(null, ctx)).toBeNull()
    expect(teamSpreadFor('KC', null)).toBeNull()
  })
})

describe('MARKET_COLS', () => {
  it('maps each modeled market to a real gamelog stat + opportunity column', () => {
    expect(MARKET_COLS.player_pass_yds).toEqual({ stat: 'passingYards', volume: 'passingAttempts' })
    expect(MARKET_COLS.player_receptions).toEqual({ stat: 'receptions', volume: 'receivingTargets' })
    expect(MARKET_COLS.player_anytime_td).toBeUndefined()   // yes/no market — not modeled
  })
})
