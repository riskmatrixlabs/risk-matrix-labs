import { describe, it, expect } from 'vitest'
import { propEdges } from '../src/lib/propEdges.js'

const evt = (extra) => ({
  commence_time: '2999-01-01T00:00:00Z',   // far future → passes pre-game gate
  home_team: 'A', away_team: 'B',
  bookmakers: [
    { key: 'pinnacle', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'player_strikeouts', outcomes: [
      { name: 'Over',  description: 'Tarik Skubal', point: 6.5, price: -110 },
      { name: 'Under', description: 'Tarik Skubal', point: 6.5, price: -110 },
    ] }] },
    { key: 'draftkings', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'player_strikeouts', outcomes: [
      { name: 'Over',  description: 'Tarik Skubal', point: 6.5, price: 120, link: 'https://dk/over' },
      { name: 'Under', description: 'Tarik Skubal', point: 6.5, price: -140 },
    ] }] },
    ...(extra || []),
  ],
})

describe('propEdges', () => {
  it('finds a +EV prop: Pinnacle 50/50 fair, DK Over +120 = real edge', () => {
    const { edges } = propEdges(evt(), ['player_strikeouts'], Date.parse('2024-01-01'), {})
    const e = edges.find(x => x.side === 'Over')
    expect(e).toBeTruthy()
    expect(e.player).toBe('Tarik Skubal')
    expect(e.point).toBe(6.5)
    expect(e.market).toBe('player_strikeouts')
    expect(e.best.book).toBe('draftkings')
    expect(e.best.price).toBe(120)
    expect(e.best.link).toBe('https://dk/over')
    expect(e.evPct).toBeGreaterThan(1)
    expect(e.fairProb).toBeCloseTo(0.5, 2)
  })

  it('no Pinnacle line for a player → line-shop only, no EV claim', () => {
    const noSharp = {
      commence_time: '2999-01-01T00:00:00Z', home_team: 'A', away_team: 'B',
      bookmakers: [
        { key: 'draftkings', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'batter_hits', outcomes: [
          { name: 'Over', description: 'Aaron Judge', point: 1.5, price: 150, link: 'https://dk/j' },
          { name: 'Under', description: 'Aaron Judge', point: 1.5, price: -180 },
        ] }] },
        { key: 'fanduel', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'batter_hits', outcomes: [
          { name: 'Over', description: 'Aaron Judge', point: 1.5, price: 145 },
          { name: 'Under', description: 'Aaron Judge', point: 1.5, price: -175 },
        ] }] },
      ],
    }
    const { edges, lineShopOnly } = propEdges(noSharp, ['batter_hits'], Date.parse('2024-01-01'), {})
    expect(edges.length).toBe(0)
    const ls = lineShopOnly.find(x => x.side === 'Over')
    expect(ls.best.book).toBe('draftkings')
    expect(ls.best.price).toBe(150)
    expect(ls.evPct).toBeUndefined()
  })

  it('skips live games (pre-game gate)', () => {
    const live = { ...evt(), commence_time: '2000-01-01T00:00:00Z' }
    const { edges, lineShopOnly } = propEdges(live, ['player_strikeouts'], Date.parse('2024-01-01'), {})
    expect(edges.length).toBe(0)
    expect(lineShopOnly.length).toBe(0)
  })
})
