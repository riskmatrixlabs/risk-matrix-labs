import { describe, it, expect } from 'vitest'
import { gradeParlay, combineAmericanOdds } from '../src/lib/gradeParlay.js'

const EV = {
  external_event_id: '401815842', sport: 'MLB', status: 'FT',
  start_time: '2026-06-21T23:20:00Z',
  away_team: 'New York Mets', home_team: 'Philadelphia Phillies',
  away_abbr: 'NYM', home_abbr: 'PHI', away_score: 2, home_score: 6,
  odds_total: 8,
}
const parlay = (legs) => ({ date: '2026-06-21', sport: 'MLB', legs })

describe('combineAmericanOdds', () => {
  it('combines two favorites into the right American number', () => {
    expect(combineAmericanOdds([-150, -150])).toBe(178)
  })
  it('a single leg returns its own odds', () => {
    expect(combineAmericanOdds([-181])).toBe(-181)
  })
})

describe('gradeParlay', () => {
  it('push leg + win leg → W at the surviving leg odds (real NYM@PHI case)', () => {
    const r = gradeParlay(parlay([
      { pick: 'Over 8', odds: -115, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
      { pick: 'PHI ML',  odds: -181, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('W')
    expect(r.effectiveOdds).toBe(-181)
  })
  it('all legs win → W at combined odds', () => {
    const r = gradeParlay(parlay([
      { pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Under 9', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('W')
    expect(r.effectiveOdds).toBe(combineAmericanOdds([-181, -110]))
  })
  it('any leg loses → L early (other leg need not be final)', () => {
    const r = gradeParlay(parlay([
      { pick: 'NYM ML', odds: 149, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Over 99', odds: -110, event: 'Some Other vs Game', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('L')
  })
  it('all legs push → P', () => {
    const r = gradeParlay(parlay([
      { pick: 'Over 8', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Under 8', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('P')
  })
  it('an ungradeable leg with no loss → null (stay Open)', () => {
    const r = gradeParlay(parlay([
      { pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Over 5', odds: -110, event: 'Nonexistent vs Matchup', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBeNull()
  })
})
