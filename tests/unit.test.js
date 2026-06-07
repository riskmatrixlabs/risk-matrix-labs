/**
 * RML Unit Tests — core math functions
 * Run with: npm test
 *
 * These tests cover the functions that power every number in the app.
 * If something looks wrong in the UI, run these first to isolate the bug.
 */

import { describe, it, expect } from 'vitest'
import { calcStats, calcTilt, fmtOdds, impliedProb, ladderToWin } from '../src/lib/utils.js'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const makeBet = (overrides = {}) => ({
  id: Math.random(),
  result: 'W',
  pnl: 1,
  units: 1,
  stake: 10,
  odds: -110,
  ladder: false,
  ...overrides,
})

// ─── calcStats ────────────────────────────────────────────────────────────────

describe('calcStats — bankroll', () => {
  it('returns starting bankroll when no bets', () => {
    const s = calcStats([], 500)
    expect(s.currentBankroll).toBe(500)
  })

  it('adds winning bet P&L to bankroll', () => {
    const bets = [makeBet({ result: 'W', pnl: 2, units: 2, stake: 20 })]
    const s = calcStats(bets, 500)
    // pnl in units × (stake/units) = 2 × (20/2) = 20
    expect(s.currentBankroll).toBe(520)
  })

  it('subtracts losing bet from bankroll', () => {
    const bets = [makeBet({ result: 'L', pnl: -1, units: 1, stake: 10 })]
    const s = calcStats(bets, 500)
    expect(s.currentBankroll).toBe(490)
  })

  it('deducts open bet stake from bankroll display', () => {
    const bets = [makeBet({ result: 'Open', pnl: 0, units: 1, stake: 50 })]
    const s = calcStats(bets, 500)
    // $500 bankroll - $50 open stake = $450 displayed
    expect(s.currentBankroll).toBe(450)
  })

  it('bankroll never goes negative from open bets alone (shows reality)', () => {
    // User sets $500, bets $50 — shows $450, not -$450
    const bets = [makeBet({ result: 'Open', pnl: 0, units: 1, stake: 50 })]
    const s = calcStats(bets, 500)
    expect(s.currentBankroll).toBeGreaterThan(0)
    expect(s.currentBankroll).toBe(450)
  })

  it('push bets count as settled but do not change P&L', () => {
    const bets = [makeBet({ result: 'P', pnl: 0, units: 1, stake: 10 })]
    const s = calcStats(bets, 500)
    expect(s.currentBankroll).toBe(500)
    expect(s.total).toBe(0) // pushes excluded from W/L count
  })
})

describe('calcStats — win/loss counters', () => {
  it('counts wins and losses correctly', () => {
    const bets = [
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }),
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }),
      makeBet({ result: 'L', pnl: -1, units: 1, stake: 10 }),
    ]
    const s = calcStats(bets, 500)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.total).toBe(3)
  })

  it('win rate is wins / (wins + losses)', () => {
    const bets = [
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }),
      makeBet({ result: 'L', pnl: -1, units: 1, stake: 10 }),
    ]
    const s = calcStats(bets, 500)
    expect(s.winRate).toBeCloseTo(0.5)
  })

  it('open bets do not count toward win/loss total', () => {
    const bets = [makeBet({ result: 'Open', pnl: 0 })]
    const s = calcStats(bets, 500)
    expect(s.wins).toBe(0)
    expect(s.losses).toBe(0)
    expect(s.total).toBe(0)
  })
})

describe('calcStats — ROI', () => {
  it('ROI is netPnl / totalRisked', () => {
    const bets = [
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }), // win $10
      makeBet({ result: 'L', pnl: -1, units: 1, stake: 10 }), // lose $10
    ]
    const s = calcStats(bets, 500)
    expect(s.roi).toBeCloseTo(0) // break even
  })

  it('positive ROI on net winning session', () => {
    const bets = [
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }),
      makeBet({ result: 'W', pnl: 1, units: 1, stake: 10 }),
      makeBet({ result: 'L', pnl: -1, units: 1, stake: 10 }),
    ]
    const s = calcStats(bets, 500)
    expect(s.roi).toBeGreaterThan(0)
  })
})

describe('calcStats — ladder bets', () => {
  it('ladder P&L is in dollars, added directly to bankroll', () => {
    const bets = [
      makeBet({ result: 'W', pnl: 150, ladder: true, units: 0, stake: 100 }),
    ]
    const s = calcStats(bets, 500)
    expect(s.ladderNetDollars).toBe(150)
    expect(s.currentBankroll).toBe(650)
  })

  it('ladder loss subtracts from bankroll in dollars', () => {
    const bets = [
      makeBet({ result: 'L', pnl: -100, ladder: true, units: 0, stake: 100 }),
    ]
    const s = calcStats(bets, 500)
    expect(s.ladderNetDollars).toBe(-100)
    expect(s.currentBankroll).toBe(400)
  })
})

// ─── calcTilt ─────────────────────────────────────────────────────────────────

describe('calcTilt', () => {
  it('GREEN with no bets', () => {
    expect(calcTilt([]).level).toBe('GREEN')
  })

  it('GREEN after 1 loss', () => {
    const bets = [makeBet({ result: 'L' })]
    expect(calcTilt(bets).level).toBe('GREEN')
  })

  it('YELLOW after 2 consecutive losses', () => {
    const bets = [
      makeBet({ result: 'L' }),
      makeBet({ result: 'L' }),
    ]
    expect(calcTilt(bets).level).toBe('YELLOW')
  })

  it('RED after 3 consecutive losses', () => {
    const bets = [
      makeBet({ result: 'L' }),
      makeBet({ result: 'L' }),
      makeBet({ result: 'L' }),
    ]
    expect(calcTilt(bets).level).toBe('RED')
  })

  it('resets to GREEN after a win breaks the streak', () => {
    const bets = [
      makeBet({ result: 'L' }),
      makeBet({ result: 'L' }),
      makeBet({ result: 'W' }), // streak broken
    ]
    expect(calcTilt(bets).level).toBe('GREEN')
  })

  it('RED when bet sizing increases after a loss (chasing)', () => {
    const bets = [
      makeBet({ result: 'L', units: 1 }),
      makeBet({ result: 'W', units: 2 }), // sized up after loss — chasing
    ]
    expect(calcTilt(bets).level).toBe('RED')
    expect(calcTilt(bets).reasons).toContain('bet sizing increased after a loss')
  })
})

// ─── fmtOdds ─────────────────────────────────────────────────────────────────

describe('fmtOdds', () => {
  it('adds + prefix to positive odds', () => {
    expect(fmtOdds(150)).toBe('+150')
    expect(fmtOdds(100)).toBe('+100')
  })

  it('keeps negative sign on negative odds', () => {
    expect(fmtOdds(-110)).toBe('-110')
    expect(fmtOdds(-450)).toBe('-450')
  })
})

// ─── impliedProb ──────────────────────────────────────────────────────────────

describe('impliedProb — American odds conversion', () => {
  it('+100 odds = 50% implied probability', () => {
    expect(impliedProb(100)).toBeCloseTo(0.5)
  })

  it('-110 odds ≈ 52.4%', () => {
    expect(impliedProb(-110)).toBeCloseTo(0.524, 2)
  })

  it('+120 odds ≈ 45.5% (not 4.5% — known bug was here)', () => {
    expect(impliedProb(120)).toBeCloseTo(0.455, 2)
  })

  it('-200 odds = 66.7%', () => {
    expect(impliedProb(-200)).toBeCloseTo(0.667, 2)
  })

  it('+200 odds = 33.3%', () => {
    expect(impliedProb(200)).toBeCloseTo(0.333, 2)
  })
})

// ─── ladderToWin ──────────────────────────────────────────────────────────────

describe('ladderToWin — PHLT ladder math', () => {
  it('$100 at -110 wins ~$90.91', () => {
    expect(ladderToWin(100, -110)).toBeCloseTo(90.91, 1)
  })

  it('$100 at +150 wins $150', () => {
    expect(ladderToWin(100, 150)).toBe(150)
  })

  it('$100 at -200 wins $50', () => {
    expect(ladderToWin(100, -200)).toBe(50)
  })

  it('$20 at -110 wins ~$18.18 (PHLT rung 1)', () => {
    expect(ladderToWin(20, -110)).toBeCloseTo(18.18, 1)
  })
})
