// Live win-prob ring (the "win prob isn't moving" fix): an OPEN moneyline bet on a
// live game should take its win-prob from ESPN's live game-winner probability (winPct),
// NOT the frozen pre-game moneyline. Totals/props must ignore winPct.
import { describe, it, expect } from 'vitest'
import { withLogos } from '../src/components/MatrixBot.jsx'
import { liveRingColor } from '../src/components/BetCard.jsx'
import { normalizeBet } from '../src/lib/betCard.js'

const NEON = '#BDFF00', RED = '#FF3B3B', AMBER = '#FFAE2B'

const EV = {
  external_event_id: '401815842',
  sport: 'MLB',
  status: 'IP',
  start_time: new Date().toISOString(),
  away_team: 'New York Mets', home_team: 'Philadelphia Phillies',
  away_abbr: 'NYM', home_abbr: 'PHI',
  away_score: 0, home_score: 2,
  odds_ml_away: 149, odds_ml_home: -181,
}
const winPctByEvent = { '401815842': { home: 0.862, away: 0.138 } }

const norm = (bet) => withLogos(normalizeBet(bet), EV, [], null, [EV], winPctByEvent)

describe('live win-prob ring', () => {
  it('uses live ESPN win% for a home moneyline pick', () => {
    const n = norm({ id: 1, sport: 'MLB', pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', result: 'Open' })
    expect(n.legs[0].liveWP).toBeCloseTo(0.862, 3)
  })

  it('uses live ESPN win% for an away moneyline pick', () => {
    const n = norm({ id: 2, sport: 'MLB', pick: 'NYM ML', odds: 149, event: 'NYM vs PHI', result: 'Open' })
    expect(n.legs[0].liveWP).toBeCloseTo(0.138, 3)
  })

  it('does NOT apply live win% to a total (Over) pick', () => {
    const n = norm({ id: 3, sport: 'MLB', pick: 'Over 8', odds: -115, event: 'NYM vs PHI', result: 'Open' })
    expect(n.legs[0].liveWP).toBeNull()
  })

  it('leaves liveWP null when no winPct is supplied (pre-game)', () => {
    const n = withLogos(normalizeBet({ id: 4, sport: 'MLB', pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', result: 'Open' }), EV, [], null, [EV], null)
    expect(n.legs[0].liveWP).toBeNull()
  })

  it('applies live win% to the ML leg of a parlay (resolved per-leg)', () => {
    const bet = { id: 5, sport: 'MLB', odds: 190, event: '2-Leg Parlay', result: 'Open', legs: [
      { pick: 'Over 8', odds: -115, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
      { pick: 'PHI ML', odds: -181, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
    ] }
    const n = withLogos(normalizeBet(bet), null, [], null, [EV], winPctByEvent)
    const ml = n.legs.find(l => /PHI ML/i.test(l.title))
    const tot = n.legs.find(l => /Over/i.test(l.title))
    expect(ml.liveWP).toBeCloseTo(0.862, 3)   // ML leg goes live
    expect(tot.liveWP).toBeNull()              // total leg stays implied
  })
})

describe('Pikkit-style live ring color', () => {
  const live = { key: 'live' }
  it('greens when ahead (>=60%)', () => expect(liveRingColor(live, 0.86)).toBe(NEON))
  it('ambers a toss-up (40-60%)', () => expect(liveRingColor(live, 0.50)).toBe(AMBER))
  it('reds when behind (<40%)', () => expect(liveRingColor(live, 0.20)).toBe(RED))
  it('settled bet ignores prob and locks to result', () => {
    expect(liveRingColor({ key: 'won' }, 0.20)).toBe(NEON)
    expect(liveRingColor({ key: 'lost' }, 0.95)).toBe(RED)
  })
})
