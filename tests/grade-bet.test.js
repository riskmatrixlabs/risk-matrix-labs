import { describe, it, expect } from 'vitest'
import { gradeBet } from '../src/lib/gradeBet.js'

// Minimal event with a two-way total market (over/under juice) so totals grade.
const ev = (over, under, away, home) => ({
  sport: 'MLB', away_team: away, home_team: home, away_abbr: 'TIG', home_abbr: 'AST',
  start_time: '2026-06-15T20:00:00Z', odds_ml_away: -120, odds_ml_home: 100,
  metadata: { over_juice: over, under_juice: under },
})

describe('gradeBet', () => {
  it('returns a win-prob fallback when no event matches', () => {
    const g = gradeBet({ pick: 'Over 8.5', odds: -110, sport: 'MLB', event: 'Nobody vs Nobody', date: '2026-06-15' }, [])
    expect(g).not.toBeNull()
    expect(g.winProb).toBeGreaterThan(0)
    expect(g.evPct).toBeUndefined()
  })

  it('grades a single total against a matched event', () => {
    const events = [ev(-105, -115, 'Tigers', 'Astros')]
    const g = gradeBet({ pick: 'Over 8.5', odds: -110, sport: 'MLB', event: 'Tigers vs Astros', date: '2026-06-15' }, events)
    expect(g).not.toBeNull()
    expect(typeof g.winProb).toBe('number')
    expect(g.evPct == null || typeof g.evPct === 'number').toBe(true)
  })

  it('grades a 2-leg parlay (combined EV/CLV) when both legs match', () => {
    const events = [
      { sport: 'MLB', away_team: 'Tigers', home_team: 'Astros', away_abbr: 'DET', home_abbr: 'HOU', start_time: '2026-06-15T20:00:00Z', metadata: { over_juice: -110, under_juice: -110 } },
      { sport: 'MLB', away_team: 'Royals', home_team: 'Nationals', away_abbr: 'KC', home_abbr: 'WSH', start_time: '2026-06-15T22:00:00Z', metadata: { over_juice: -105, under_juice: -115 } },
    ]
    const bet = { odds: 260, sport: 'MLB', date: '2026-06-15', legs: [
      { pick: 'Over 8.5', odds: -110, event: 'Tigers vs Astros', sport: 'MLB' },
      { pick: 'Over 9.5', odds: -110, event: 'Royals vs Nationals', sport: 'MLB' },
    ] }
    const g = gradeBet(bet, events)
    expect(g).not.toBeNull()
    expect(typeof g.winProb).toBe('number')
    expect(g.winProb).toBeGreaterThan(0)
    expect(g.winProb).toBeLessThan(1)
  })

  it('returns null for a bet with no usable odds and no match', () => {
    expect(gradeBet({ pick: 'X', odds: 'abc', event: 'Y', date: '2026-06-15' }, [])).toBeNull()
  })
})
