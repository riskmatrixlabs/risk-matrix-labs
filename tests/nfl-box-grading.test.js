// NFL grade path: a REAL ESPN NFL summary box shape (captured from
// site.api.espn.com/.../football/nfl/summary?event=401671803, NYG@CAR 2024-11-10) →
// parseBox → resolveStat with the ODDS-API market keys the snapshot cron writes → gradeProp.
//
// Why NFL is different from MLB/NBA/NHL: the box groups athletes by CATEGORY
// (passing / rushing / receiving / kicking / defensive), each with its own parallel
// keys+stats arrays, and some keys are COMBINED pairs ('completions/passingAttempts' → '22/37',
// 'fieldGoalsMade/fieldGoalAttempts' → '1/2'). A player appears in several categories, so their
// flattened record merges passing+rushing+receiving keys.
import { describe, it, expect } from 'vitest'
import { parseBox } from '../api/box-score.js'
import { resolveStat } from '../src/lib/statProgress.js'
import { gradeProp } from '../api/_lib/gradeLean.js'

const nflSummary = {
  boxscore: {
    players: [{
      statistics: [
        {
          name: 'passing',
          keys: ['completions/passingAttempts', 'passingYards', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions', 'sacks-sackYardsLost', 'adjQBR', 'QBRating'],
          athletes: [{ athlete: { displayName: 'Daniel Jones' }, stats: ['22/37', '190', '5.1', '2', '2', '2-15', '32.3', '50.5'] }],
        },
        {
          name: 'rushing',
          keys: ['rushingAttempts', 'rushingYards', 'yardsPerRushAttempt', 'rushingTouchdowns', 'longRushing'],
          athletes: [
            { athlete: { displayName: 'Tyrone Tracy Jr.' }, stats: ['18', '103', '5.7', '1', '32'] },
            { athlete: { displayName: 'Daniel Jones' }, stats: ['4', '21', '5.3', '0', '9'] },
          ],
        },
        {
          name: 'receiving',
          keys: ['receptions', 'receivingYards', 'yardsPerReception', 'receivingTouchdowns', 'longReception', 'receivingTargets'],
          athletes: [
            { athlete: { displayName: "Wan'Dale Robinson" }, stats: ['5', '51', '10.2', '0', '23', '8'] },
            { athlete: { displayName: 'Tyrone Tracy Jr.' }, stats: ['3', '27', '9.0', '1', '14', '4'] },
          ],
        },
        {
          name: 'kicking',
          keys: ['fieldGoalsMade/fieldGoalAttempts', 'fieldGoalPct', 'longFieldGoalMade', 'extraPointsMade/extraPointAttempts', 'totalKickingPoints'],
          athletes: [{ athlete: { displayName: 'Graham Gano' }, stats: ['1/2', '50.0', '42', '2/2', '5'] }],
        },
      ],
    }],
  },
}

const players = parseBox(nflSummary)

describe('parseBox on an NFL summary', () => {
  it('merges a player across categories (QB has passing AND rushing keys)', () => {
    expect(players['daniel jones'].passingYards).toBe(190)
    expect(players['daniel jones'].rushingYards).toBe(21)
  })
  it('expands slash-combined keys ("22/37" under completions/passingAttempts)', () => {
    expect(players['daniel jones'].completions).toBe(22)
    expect(players['daniel jones'].passingAttempts).toBe(37)
    expect(players['graham gano'].fieldGoalsMade).toBe(1)
    expect(players['graham gano'].fieldGoalAttempts).toBe(2)
  })
  it('keeps plain numeric keys and drops unparseable combined ones', () => {
    expect(players['daniel jones'].passingTouchdowns).toBe(2)
    expect(players['daniel jones']['sacks-sackYardsLost']).toBeUndefined()
  })
})

describe('resolveStat on NFL odds-api market keys', () => {
  const jones = players['daniel jones']
  const tracy = players['tyrone tracy jr.']
  const wandale = players["wan'dale robinson"]

  it('passing markets', () => {
    expect(resolveStat(jones, 'player_pass_yds')).toBe(190)
    expect(resolveStat(jones, 'player_pass_tds')).toBe(2)
    expect(resolveStat(jones, 'player_pass_attempts')).toBe(37)
    expect(resolveStat(jones, 'player_pass_completions')).toBe(22)
    expect(resolveStat(jones, 'player_pass_interceptions')).toBe(2)
  })
  it('rushing markets', () => {
    expect(resolveStat(tracy, 'player_rush_yds')).toBe(103)
    expect(resolveStat(tracy, 'player_rush_attempts')).toBe(18)
  })
  it('receiving markets', () => {
    expect(resolveStat(wandale, 'player_reception_yds')).toBe(51)
    expect(resolveStat(wandale, 'player_receptions')).toBe(5)
  })
  it('combined rush+reception yards sums both real values', () => {
    expect(resolveStat(tracy, 'player_rush_reception_yds')).toBe(130)
  })
  it('anytime TD counts rushing + receiving (never passing) TDs', () => {
    expect(resolveStat(tracy, 'player_anytime_td')).toBe(2)
    expect(resolveStat(jones, 'player_anytime_td')).toBe(0)   // 2 pass TDs are not HIS scores
  })
  it('kicking points', () => {
    expect(resolveStat(players['graham gano'], 'player_kicking_points')).toBe(5)
  })
  it('1st TD scorer is NOT resolvable from a box score — honest null, never a guess', () => {
    expect(resolveStat(tracy, 'player_1st_td')).toBeNull()
  })
  it('also resolves the human label form used in tracked-bet titles', () => {
    expect(resolveStat(jones, 'Pass Yards')).toBe(190)
    expect(resolveStat(tracy, 'Rush Yards')).toBe(103)
    expect(resolveStat(wandale, 'Receiving Yards')).toBe(51)
    expect(resolveStat(wandale, 'Receptions')).toBe(5)
  })
})

describe('NFL grading end to end', () => {
  it('grades W/L against the OVER lean', () => {
    expect(gradeProp({ statValue: 190, prop_line: 224.5, lean: 'OVER' })).toBe('L')
    expect(gradeProp({ statValue: 103, prop_line: 62.5, lean: 'OVER' })).toBe('W')
  })
})

describe('no regression in other sports', () => {
  it('MLB/NBA/NHL market keys still resolve from their own shapes', () => {
    const stats = { strikeouts: 8, hits: 2, points: 27, rebounds: 11, assists: 9, shotsTotal: 6, goals: 1, saves: 30 }
    expect(resolveStat(stats, 'pitcher_strikeouts')).toBe(8)
    expect(resolveStat(stats, 'batter_hits')).toBe(2)
    expect(resolveStat(stats, 'player_points')).toBe(27)
    expect(resolveStat(stats, 'player_rebounds')).toBe(11)
    expect(resolveStat(stats, 'player_assists')).toBe(9)
    expect(resolveStat(stats, 'player_shots_on_goal')).toBe(6)
    expect(resolveStat(stats, 'player_goals')).toBe(1)
    expect(resolveStat(stats, 'player_total_saves')).toBe(30)
  })
})
