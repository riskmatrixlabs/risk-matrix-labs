import { describe, it, expect } from 'vitest'
import { legFromRow, pickShareText, boardShareText } from '../src/lib/botSlip.js'

const gameRow = {
  key: 'gl:1', label: 'Over 8.5', book: 'hardrockbet', sub: 'DET@HOU',
  price: -126, evPct: 4.2, isProp: false,
  game: { away: 'Tigers', home: 'Astros', sport: 'MLB', external_event_id: '42' },
  link: 'https://hardrock/bet',
}
const propRow = {
  key: 'pr:1', label: 'Skubal O7.5', book: 'fanduel', sub: 'Strikeouts',
  price: 110, evPct: null, isProp: true,
  game: { away: 'Tigers', home: 'Astros', sport: 'MLB' },
}

describe('legFromRow', () => {
  it('maps a game-line row into a slip leg', () => {
    expect(legFromRow(gameRow)).toEqual({
      pick: 'Over 8.5', odds: -126, book: 'hardrockbet', link: 'https://hardrock/bet',
      sport: 'MLB', event: 'Tigers vs Astros', evPct: 4.2, isProp: false,
    })
  })
  it('handles a prop row with no link and null EV', () => {
    const leg = legFromRow(propRow)
    expect(leg.pick).toBe('Skubal O7.5')
    expect(leg.odds).toBe(110)
    expect(leg.link).toBeNull()
    expect(leg.evPct).toBeNull()
    expect(leg.isProp).toBe(true)
    expect(leg.event).toBe('Tigers vs Astros')
  })
  it('falls back to sub when no away/home', () => {
    expect(legFromRow({ label: 'X', price: 100, game: {}, sub: 'Some Game' }).event).toBe('Some Game')
  })
  it('returns null for empty input', () => {
    expect(legFromRow(null)).toBeNull()
  })
})

describe('share text', () => {
  it('formats a single pick with edge + book label', () => {
    const t = pickShareText(gameRow, (b) => (b === 'hardrockbet' ? 'Hard Rock' : b))
    expect(t).toContain('Over 8.5 -126 (Hard Rock)')
    expect(t).toContain('+4.2% edge')
    expect(t).toContain('Risk Matrix Labs')
  })
  it('omits edge when EV is null and prefixes + on positive odds', () => {
    const t = pickShareText(propRow)
    expect(t).toContain('Skubal O7.5 +110')
    expect(t).not.toContain('edge')
  })
  it('summarizes the board, capping at 8 lines', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `Pick ${i}`, price: 100 + i, evPct: i }))
    const t = boardShareText(many)
    expect(t).toContain('12 edges')
    expect(t.split('\n').filter(l => l.startsWith('•')).length).toBe(8)
  })
  it('handles an empty board', () => {
    expect(boardShareText([])).toContain('No edges')
  })
})
