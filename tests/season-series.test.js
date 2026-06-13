import { describe, it, expect } from 'vitest'
import { parseSeasonSeries } from '../api/cron-sync-live.js'

const summary = (events) => ({ seasonseries: [{ seriesScore: '2-1', events }] })
const meeting = (date, away, aScore, aWin, home, hScore, hWin, completed = true) => ({
  date, statusType: { completed },
  competitors: [
    { homeAway: 'away', team: { abbreviation: away }, score: aScore, winner: aWin },
    { homeAway: 'home', team: { abbreviation: home }, score: hScore, winner: hWin },
  ],
})

describe('parseSeasonSeries', () => {
  it('returns null when no seasonseries', () => {
    expect(parseSeasonSeries({}, 'TB', 'LAA')).toBeNull()
  })

  it('parses completed meetings and tallies wins for THIS matchup', () => {
    const s = summary([
      meeting('2026-05-29', 'LAA', 5, false, 'TB', 8, true),
      meeting('2026-05-30', 'LAA', 14, true, 'TB', 3, false),
      meeting('2026-05-31', 'LAA', 2, false, 'TB', 5, true),
    ])
    const r = parseSeasonSeries(s, 'LAA', 'TB')
    expect(r.meetings).toHaveLength(3)
    expect(r.awayWins).toBe(1)   // LAA won once
    expect(r.homeWins).toBe(2)   // TB won twice
    expect(r.meetings[0]).toMatchObject({ date: '2026-05-29', away: { abbr: 'LAA', score: 5, win: false }, home: { abbr: 'TB', score: 8, win: true } })
  })

  it('skips not-completed meetings → first meeting reads 0-0', () => {
    const s = summary([meeting('2026-06-12', 'MIA', null, false, 'PIT', null, false, false)])
    const r = parseSeasonSeries(s, 'MIA', 'PIT')
    expect(r.meetings).toHaveLength(0)
    expect(r.awayWins).toBe(0)
    expect(r.homeWins).toBe(0)
  })
})
