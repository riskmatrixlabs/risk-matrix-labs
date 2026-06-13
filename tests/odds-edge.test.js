import { describe, it, expect } from 'vitest'
import { getMarket, sharpFairProbs, bestLine, evPct, marketEdges } from '../src/lib/oddsEdge.js'

// Pinnacle is a perfect 50/50 (-110/-110). FanDuel hangs +120 on side A (a real edge),
// DraftKings +105. So the best A price (FD +120) is +EV vs the sharp 50% fair.
const GAME = [
  { key: 'pinnacle',   title: 'Pinnacle',   markets: [{ key: 'h2h', outcomes: [{ name: 'A', price: -110 }, { name: 'B', price: -110 }] }] },
  { key: 'fanduel',    title: 'FanDuel',    markets: [{ key: 'h2h', outcomes: [{ name: 'A', price:  120 }, { name: 'B', price: -130 }] }] },
  { key: 'draftkings', title: 'DraftKings', markets: [{ key: 'h2h', outcomes: [{ name: 'A', price:  105 }, { name: 'B', price: -125 }] }] },
]

describe('getMarket', () => {
  it('pulls a book\'s market', () => {
    expect(getMarket(GAME, 'pinnacle', 'h2h').outcomes).toHaveLength(2)
  })
  it('null when book or market absent', () => {
    expect(getMarket(GAME, 'caesars', 'h2h')).toBeNull()
    expect(getMarket(GAME, 'pinnacle', 'spreads')).toBeNull()
  })
})

describe('sharpFairProbs', () => {
  it('de-vigs Pinnacle to 50/50', () => {
    const f = sharpFairProbs(GAME, 'h2h')
    expect(f.A).toBeCloseTo(0.5, 4)
    expect(f.B).toBeCloseTo(0.5, 4)
    expect(f._hold).toBeCloseTo(4.762, 2)
  })
  it('null when no sharp book', () => {
    const noSharp = GAME.filter(b => b.key !== 'pinnacle')
    expect(sharpFairProbs(noSharp, 'h2h')).toBeNull()
  })
})

describe('bestLine', () => {
  it('finds the most favorable price for A (FanDuel +120)', () => {
    const b = bestLine(GAME, 'h2h', 'A')
    expect(b.book).toBe('fanduel')
    expect(b.price).toBe(120)
  })
  it('finds the most favorable price for B (Pinnacle -110)', () => {
    const b = bestLine(GAME, 'h2h', 'B')
    expect(b.book).toBe('pinnacle')
    expect(b.price).toBe(-110)
  })
})

describe('evPct', () => {
  it('+120 at a true 50% is +10% EV', () => {
    expect(evPct(120, 0.5)).toBeCloseTo(10, 4)  // 0.5 * 2.2 - 1
  })
  it('-110 at a true 50% is ~-4.5% EV', () => {
    expect(evPct(-110, 0.5)).toBeCloseTo(-4.545, 2)
  })
  it('null on bad input', () => {
    expect(evPct(null, 0.5)).toBeNull()
    expect(evPct(120, null)).toBeNull()
  })
})

describe('marketEdges', () => {
  it('flags FanDuel +120 on A as a real +EV edge vs the sharp', () => {
    const edges = marketEdges(GAME, 'h2h')
    const a = edges.find(e => e.outcome === 'A')
    expect(a.best.book).toBe('fanduel')
    expect(a.evPct).toBeCloseTo(10, 4)
    expect(a.plusEV).toBe(true)
    const b = edges.find(e => e.outcome === 'B')
    expect(b.plusEV).toBe(false)
  })
  it('returns [] when the sharp book cannot anchor', () => {
    const noSharp = GAME.filter(b => b.key !== 'pinnacle')
    expect(marketEdges(noSharp, 'h2h')).toEqual([])
  })
})
