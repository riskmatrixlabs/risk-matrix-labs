import { describe, it, expect } from 'vitest'
import { scoredAvg, concededAvg } from '../api/_lib/teamScoring.js'

const g = (home, hs, away, as) => ({ home_team: home, home_score: hs, away_team: away, away_score: as })

// 6 finals for the Bruins (mix of home/away), newest first.
const rows = [
  g('Boston Bruins', 4, 'New York Rangers', 2),
  g('Toronto Maple Leafs', 3, 'Boston Bruins', 1),
  g('Boston Bruins', 0, 'Montreal Canadiens', 5),  // shutout AGAINST — 0 is a real value
  g('Boston Bruins', 6, 'Buffalo Sabres', 3),
  g('Detroit Red Wings', 2, 'Boston Bruins', 2),
  g('Boston Bruins', 3, 'Ottawa Senators', 1),
]

describe('scoredAvg', () => {
  it('averages the team OWN score across home and away rows (last-word match)', () => {
    // 4, 1, 0, 6, 2, 3 → 16/6 = 2.67
    expect(scoredAvg(rows, 'Bruins')).toBeCloseTo(2.67, 2)
  })
  it('counts a 0 (shutout) as a real game, not a skip', () => {
    expect(scoredAvg(rows.slice(0, 5), 'Boston Bruins')).toBeCloseTo((4 + 1 + 0 + 6 + 2) / 5, 2)
  })
  it('fewer than 5 usable games → null (honest no-lean)', () => {
    expect(scoredAvg(rows.slice(0, 4), 'Bruins')).toBe(null)
    expect(scoredAvg([], 'Bruins')).toBe(null)
    expect(scoredAvg(null, 'Bruins')).toBe(null)
  })
  it('rows for other teams are ignored', () => {
    const noise = [g('Anaheim Ducks', 9, 'San Jose Sharks', 9), ...rows]
    expect(scoredAvg(noise, 'Bruins')).toBeCloseTo(2.67, 2)
  })
  it('caps at 15 games (newest first)', () => {
    const many = Array.from({ length: 20 }, (_, i) => g('Boston Bruins', i < 15 ? 2 : 100, 'Ottawa Senators', 1))
    expect(scoredAvg(many, 'Bruins')).toBe(2) // the 100s past the cap never counted
  })
  it('unparseable score rows are skipped, not zero-filled', () => {
    const bad = [g('Boston Bruins', null, 'Ottawa Senators', 1), ...rows]
    expect(scoredAvg(bad, 'Bruins')).toBeCloseTo(2.67, 2)
  })
})

describe('concededAvg', () => {
  it('averages the OPPOSING side score', () => {
    // 2, 3, 5, 3, 2, 1 → 16/6 = 2.67
    expect(concededAvg(rows, 'Bruins')).toBeCloseTo(2.67, 2)
  })
  it('fewer than 5 usable games → null', () => {
    expect(concededAvg(rows.slice(0, 3), 'Bruins')).toBe(null)
  })
})
