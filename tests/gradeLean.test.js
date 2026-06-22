import { describe, it, expect } from 'vitest'
import { gradeLeanResult } from '../api/_lib/gradeLean.js'

describe('gradeLeanResult — total', () => {
  it('OVER wins when total > line', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: 8.5, awayScore: 5, homeScore: 5 })).toBe('W')
  })
  it('OVER loses when total < line', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: 10.5, awayScore: 4, homeScore: 5 })).toBe('L')
  })
  it('UNDER wins when total < line', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'UNDER', total_line: 9.5, awayScore: 4, homeScore: 4 })).toBe('W')
  })
  it('pushes when total === line', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: 9, awayScore: 5, homeScore: 4 })).toBe('P')
  })
  it('null line → null', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: null, awayScore: 5, homeScore: 4 })).toBe(null)
  })
  it('legacy undefined market behaves as total', () => {
    expect(gradeLeanResult({ market: undefined, lean: 'OVER', total_line: 8.5, awayScore: 5, homeScore: 5 })).toBe('W')
    expect(gradeLeanResult({ lean: 'UNDER', total_line: 8.5, awayScore: 3, homeScore: 4 })).toBe('W')
  })
  it('unknown lean side → null', () => {
    expect(gradeLeanResult({ market: 'total', lean: 'NEITHER', total_line: 8.5, awayScore: 5, homeScore: 5 })).toBe(null)
  })
})

describe('gradeLeanResult — ml', () => {
  it('HOME pick + home wins → W', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'HOME', awayScore: 3, homeScore: 5 })).toBe('W')
  })
  it('HOME pick + away wins → L', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'HOME', awayScore: 6, homeScore: 5 })).toBe('L')
  })
  it('AWAY pick + away wins → W', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'AWAY', awayScore: 7, homeScore: 2 })).toBe('W')
  })
  it('tie → P', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'HOME', awayScore: 4, homeScore: 4 })).toBe('P')
  })
  it('unmappable side → null', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'DRAW', awayScore: 4, homeScore: 5 })).toBe(null)
  })
})

describe('gradeLeanResult — rl', () => {
  it('HOME -1.5 cover (margin 2) → W', () => {
    expect(gradeLeanResult({ market: 'rl', pick_side: 'HOME -1.5', awayScore: 3, homeScore: 5 })).toBe('W')
  })
  it('HOME -1.5 no cover (margin 1) → L', () => {
    expect(gradeLeanResult({ market: 'rl', pick_side: 'HOME -1.5', awayScore: 3, homeScore: 4 })).toBe('L')
  })
  it('AWAY -1.5 away by 3 → W', () => {
    expect(gradeLeanResult({ market: 'rl', pick_side: 'AWAY -1.5', awayScore: 6, homeScore: 3 })).toBe('W')
  })
  it('AWAY -1.5 away by 1 → L', () => {
    expect(gradeLeanResult({ market: 'rl', pick_side: 'AWAY -1.5', awayScore: 4, homeScore: 3 })).toBe('L')
  })
  it('unparseable side → null', () => {
    expect(gradeLeanResult({ market: 'rl', pick_side: 'foo', awayScore: 4, homeScore: 3 })).toBe(null)
  })
})

describe('gradeLeanResult — guards', () => {
  it('non-finite scores → null', () => {
    expect(gradeLeanResult({ market: 'ml', pick_side: 'HOME', awayScore: NaN, homeScore: 5 })).toBe(null)
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: 8.5, awayScore: 5, homeScore: undefined })).toBe(null)
    expect(gradeLeanResult({ market: 'total', lean: 'OVER', total_line: 8.5, awayScore: '5', homeScore: 5 })).toBe(null)
  })
  it('unknown market → null', () => {
    expect(gradeLeanResult({ market: 'spread', pick_side: 'HOME', awayScore: 3, homeScore: 5 })).toBe(null)
  })
})
