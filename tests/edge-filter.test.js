import { describe, it, expect } from 'vitest'
import { filterBooks, isCredibleEdge, gameEdges, scanEdges, compareBooks, REPUTABLE_BOOKS } from '../src/lib/edgeFilter.js'

const NOW   = Date.parse('2026-06-13T02:00:00Z')
const FRESH = '2026-06-13T01:55:00Z'   // 5 min ago — within 10
const STALE = '2026-06-13T01:40:00Z'   // 20 min ago — beyond 10
const mk = (a, b) => ({ key: 'h2h', outcomes: [{ name: 'A', price: a }, { name: 'B', price: b }] })

// Pinnacle = sharp 50/50 anchor. FanDuel hangs A +120 (real +10% edge). betsson is a
// junk offshore book with a stale +7900 mirage. DraftKings has a juicy A +125 but it's STALE.
const GAME = {
  sport_key: 'baseball_mlb', away_team: 'Cubs', home_team: 'Giants',
  commence_time: '2026-06-13T02:15:00Z',   // 15 min out — pre-game
  bookmakers: [
    { key: 'pinnacle',   last_update: FRESH, markets: [mk(-110, -110)] },
    { key: 'fanduel',    last_update: FRESH, markets: [mk( 120, -130)] },
    { key: 'betsson',    last_update: FRESH, markets: [mk(7900, -99999)] }, // not reputable
    { key: 'draftkings', last_update: STALE, markets: [mk( 125, -140)] },   // reputable but stale
  ],
}

describe('filterBooks', () => {
  it('keeps reputable + fresh, drops junk and stale', () => {
    const keep = filterBooks(GAME.bookmakers, NOW).map(b => b.key)
    expect(keep).toContain('pinnacle')
    expect(keep).toContain('fanduel')
    expect(keep).not.toContain('betsson')     // not reputable
    expect(keep).not.toContain('draftkings')  // stale
  })
  it('keeps a book with no timestamp (no penalty)', () => {
    const keep = filterBooks([{ key: 'caesars', markets: [mk(100, -120)] }], NOW).map(b => b.key)
    expect(keep).toContain('caesars')
  })
})

describe('isCredibleEdge', () => {
  it('accepts a 10% edge', () => { expect(isCredibleEdge({ evPct: 10 })).toBe(true) })
  it('rejects a +421% mirage (over cap)', () => { expect(isCredibleEdge({ evPct: 421 })).toBe(false) })
  it('rejects sub-1% noise', () => { expect(isCredibleEdge({ evPct: 0.4 })).toBe(false) })
  it('rejects null EV', () => { expect(isCredibleEdge({ evPct: null })).toBe(false) })
})

describe('gameEdges', () => {
  it('surfaces only the credible FanDuel +120 edge (junk + stale excluded)', () => {
    const edges = gameEdges(GAME, 'h2h', NOW)
    expect(edges).toHaveLength(1)
    expect(edges[0].outcome).toBe('A')
    expect(edges[0].best.book).toBe('fanduel')  // NOT betsson(+7900) or stale DK(+125)
    expect(edges[0].evPct).toBeCloseTo(10, 4)
    expect(edges[0].away).toBe('Cubs')
  })
  it('skips a game that has already started (pre-game-only)', () => {
    const live = { ...GAME, commence_time: '2026-06-13T01:00:00Z' } // started an hour ago
    expect(gameEdges(live, 'h2h', NOW)).toEqual([])
  })
  it('returns [] when the sharp anchor is filtered out', () => {
    const noPinny = { ...GAME, bookmakers: GAME.bookmakers.filter(b => b.key !== 'pinnacle') }
    expect(gameEdges(noPinny, 'h2h', NOW)).toEqual([])
  })
})

describe('scanEdges', () => {
  it('sorts credible edges across games by EV descending', () => {
    const g2 = {
      ...GAME, away_team: 'Reds', home_team: 'D-backs',
      bookmakers: [
        { key: 'pinnacle', last_update: FRESH, markets: [mk(-110, -110)] },
        { key: 'betmgm',   last_update: FRESH, markets: [mk(128, -150)] }, // A +128 → +14% EV (within cap)
      ],
    }
    const out = scanEdges([GAME, g2], 'h2h', NOW)
    expect(out).toHaveLength(2)
    expect(out[0].away).toBe('Reds')   // +14% sorts above +10%
    expect(out[0].evPct).toBeGreaterThan(out[1].evPct)
  })
})

describe('compareBooks', () => {
  it('lists reputable books with best price per side + sharp flag', () => {
    const c = compareBooks(GAME.bookmakers, 'h2h')
    expect(c.outcomes).toEqual(['A', 'B'])
    expect(c.rows.map(r => r.book).sort()).toEqual(['draftkings', 'fanduel', 'pinnacle']) // betsson excluded
    expect(c.rows.find(r => r.book === 'pinnacle').sharp).toBe(true)
    expect(c.best.A.book).toBe('draftkings')  // +125 beats FD +120 and Pinny -110
    expect(c.best.A.price).toBe(125)
    expect(c.best.B.book).toBe('pinnacle')     // -110 is the best of the three on B
  })
  it('null when no reputable book has the market', () => {
    const junkOnly = { bookmakers: [{ key: 'betsson', markets: [{ key: 'h2h', outcomes: [{ name: 'A', price: 100 }, { name: 'B', price: -120 }] }] }] }
    expect(compareBooks(junkOnly.bookmakers, 'h2h')).toBeNull()
  })
  it('totals: best is crowned only on the main line, off-line prices ignored', () => {
    const tot = [
      { key: 'pinnacle',   markets: [{ key: 'totals', outcomes: [{ name: 'Over', price: -105, point: 8.5 }, { name: 'Under', price: -105, point: 8.5 }] }] },
      { key: 'draftkings', markets: [{ key: 'totals', outcomes: [{ name: 'Over', price: -110, point: 8.5 }, { name: 'Under', price: -110, point: 8.5 }] }] },
      { key: 'fanduel',    markets: [{ key: 'totals', outcomes: [{ name: 'Over', price:  140, point: 9.5 }, { name: 'Under', price: -160, point: 9.5 }] }] }, // off the main 8.5 line
    ]
    const c = compareBooks(tot, 'totals')
    expect(c.modalPoint.Over).toBe(8.5)
    expect(c.best.Over.book).toBe('pinnacle')  // -105 on 8.5 beats DK -110; FanDuel +140 ignored (it's a 9.5)
    expect(c.best.Over.price).toBe(-105)
  })
})

describe('REPUTABLE_BOOKS', () => {
  it('includes Pinnacle (anchor) and Hard Rock (owner bets there)', () => {
    expect(REPUTABLE_BOOKS.has('pinnacle')).toBe(true)
    expect(REPUTABLE_BOOKS.has('hardrockbet')).toBe(true)
  })
})
