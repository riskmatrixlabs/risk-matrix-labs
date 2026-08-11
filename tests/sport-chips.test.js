import { describe, it, expect } from 'vitest'
import { sportChips } from '../src/components/PerformancePage.jsx'

describe('sportChips — Full Matrix sport filter derivation', () => {
  it('orders MLB, WNBA, NFL first, then others alphabetically', () => {
    const rows = [
      { sport: 'NHL' }, { sport: 'NFL' }, { sport: 'MLB' }, { sport: 'NBA' }, { sport: 'WNBA' },
    ]
    expect(sportChips(rows)).toEqual(['MLB', 'WNBA', 'NFL', 'NBA', 'NHL'])
  })
  it('derives dynamically — only sports present appear; NFL shows even with a single row', () => {
    expect(sportChips([{ sport: 'MLB' }, { sport: 'MLB' }, { sport: 'NFL' }])).toEqual(['MLB', 'NFL'])
  })
  it('falls back to event.sport, uppercases, and skips missing sport', () => {
    expect(sportChips([{ event: { sport: 'mlb' } }, {}, { sport: null }])).toEqual(['MLB'])
  })
  it('empty input → empty list', () => {
    expect(sportChips([])).toEqual([])
  })
})
