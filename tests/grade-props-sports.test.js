// The model-prop grade path across sports: realistic ESPN summary box shapes → parseBox →
// resolveStat with the ODDS-API market keys the snapshot cron writes (player_points,
// player_rebounds, player_assists, player_shots_on_goal) → gradeProp.
import { describe, it, expect } from 'vitest'
import { parseBox } from '../api/box-score.js'
import { resolveStat } from '../src/lib/statProgress.js'
import { gradeProp } from '../api/_lib/gradeLean.js'

// Realistic ESPN basketball summary shape (NBA/WNBA share it): parallel keys + stats arrays.
const hoopsSummary = {
  boxscore: {
    players: [{
      statistics: [{
        keys: ['minutes', 'fieldGoalsMade-fieldGoalsAttempted', 'rebounds', 'assists', 'steals', 'blocks', 'points'],
        athletes: [
          { athlete: { displayName: "A'ja Wilson" }, stats: ['34', '10-18', '11', '3', '2', '1', '27'] },
          { athlete: { displayName: 'Caitlin Clark' }, stats: ['36', '7-16', '5', '9', '1', '0', '21'] },
        ],
      }],
    }],
  },
}

// Realistic ESPN hockey summary shape — skater categories carry shotsTotal.
const nhlSummary = {
  boxscore: {
    players: [{
      statistics: [{
        keys: ['goals', 'assists', 'points', 'plusMinus', 'shotsTotal', 'hits'],
        athletes: [
          { athlete: { displayName: 'Auston Matthews' }, stats: ['1', '0', '1', '2', '6', '1'] },
          { athlete: { displayName: 'David Pastrnak' }, stats: ['0', '2', '2', '-1', '2', '0'] },
        ],
      }],
    }],
  },
}

describe('basketball grade path (player_points / rebounds / assists)', () => {
  const players = parseBox(hoopsSummary)
  it('resolves points, rebounds and assists from the odds-api market keys', () => {
    expect(resolveStat(players["a'ja wilson"], 'player_points')).toBe(27)
    expect(resolveStat(players["a'ja wilson"], 'player_rebounds')).toBe(11)
    expect(resolveStat(players['caitlin clark'], 'player_assists')).toBe(9)
  })
  it('grades W/L on the OVER lean', () => {
    expect(gradeProp({ statValue: 27, prop_line: 22.5, lean: 'OVER' })).toBe('W')
    expect(gradeProp({ statValue: 21, prop_line: 22.5, lean: 'OVER' })).toBe('L')
  })
})

describe('NHL grade path (player_shots_on_goal)', () => {
  const players = parseBox(nhlSummary)
  it('resolves shots on goal from shotsTotal — NOT goals', () => {
    expect(resolveStat(players['auston matthews'], 'player_shots_on_goal')).toBe(6)
    expect(resolveStat(players['david pastrnak'], 'player_shots_on_goal')).toBe(2)
  })
  it('still resolves plain goal markets from goals', () => {
    expect(resolveStat(players['auston matthews'], 'player_goals')).toBe(1)
  })
})
