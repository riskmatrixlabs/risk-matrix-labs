import { describe, it, expect } from 'vitest'
import { gameKey, groupEdgesByGame, applyFeedFilters } from '../src/lib/botFeed.js'

const edge = (over) => ({ outcome: 'Cubs', away: 'Chicago Cubs', home: 'San Francisco Giants', evPct: 6.2, market: 'h2h', best: { book: 'betfair_ex_uk', price: 126 }, ...over })

describe('gameKey', () => {
  it('builds a stable away@home key, case/space-insensitive', () => {
    expect(gameKey('Chicago Cubs', 'San Francisco Giants')).toBe('chicago cubs@san francisco giants')
  })
  it('derives the key from an edge object', () => {
    expect(gameKey(edge())).toBe('chicago cubs@san francisco giants')
  })
})

describe('groupEdgesByGame', () => {
  it('groups edges under their game key and keeps highest EV first within a game', () => {
    const g = groupEdgesByGame([edge({ evPct: 2 }), edge({ evPct: 6.2 }), edge({ away: 'New York Mets', home: 'Atlanta Braves', evPct: 4 })])
    expect(g.length).toBe(2)
    expect(g[0].edges[0].evPct).toBe(6.2)
    expect(g[0].edges[1].evPct).toBe(2)
    expect(g[1].away).toBe('New York Mets')
  })
  it('returns [] for no edges', () => {
    expect(groupEdgesByGame([])).toEqual([])
  })
})

describe('applyFeedFilters', () => {
  it('filters by minEvPct', () => {
    const out = applyFeedFilters([edge({ evPct: 1 }), edge({ evPct: 5 })], { minEvPct: 3 })
    expect(out.map(e => e.evPct)).toEqual([5])
  })
  it('scopes to a focused game key when provided', () => {
    const out = applyFeedFilters([edge(), edge({ away: 'New York Mets', home: 'Atlanta Braves' })], { focusKey: 'new york mets@atlanta braves' })
    expect(out.length).toBe(1)
    expect(out[0].away).toBe('New York Mets')
  })
  it('returns all when no opts', () => {
    expect(applyFeedFilters([edge(), edge()], {}).length).toBe(2)
  })
})
