import { describe, it, expect } from 'vitest'
import { fmtRec, winPct, sumRec, applyFilters, unitsRoi, avgClv, dailySeries } from '../src/lib/performance.js'

describe('fmtRec', () => {
  it('includes pushes when p > 0', () => {
    expect(fmtRec({ w: 12, l: 8, p: 1 })).toBe('12-8-1')
  })
  it('omits pushes when p === 0', () => {
    expect(fmtRec({ w: 12, l: 8, p: 0 })).toBe('12-8')
  })
  it('handles empty input', () => {
    expect(fmtRec()).toBe('0-0')
  })
})

describe('winPct', () => {
  it('excludes pushes from the denominator', () => {
    // 2W 1L (pushes never passed in) -> 2/3 = 67
    expect(winPct(2, 1)).toBe(67)
  })
  it('returns null when fewer than 1 decision', () => {
    expect(winPct(0, 0)).toBe(null)
  })
})

describe('sumRec', () => {
  it('merges multiple records', () => {
    expect(sumRec({ w: 1, l: 2, p: 0 }, { w: 3, l: 0, p: 1 })).toEqual({ w: 4, l: 2, p: 1 })
  })
})

describe('applyFilters', () => {
  const rows = [
    { market: 'total', sport: 'MLB', game_date: '2026-06-20', strong: true, result: 'W' },
    { market: 'ml', sport: 'MLB', game_date: '2026-06-20', strong: false, result: 'L' }, // pre-gate ml → dropped
    { market: 'ml', sport: 'MLB', game_date: '2026-06-24', strong: false, result: 'W' }, // post-gate ml → kept
    { market: 'total', sport: 'NBA', game_date: '2026-06-24', strong: false, result: 'W' },
    { phlt_tier: 'A', sport: 'MLB', game_date: '2026-06-24', strong: false, result: 'W' },
  ]

  it('model=total filters to totals only', () => {
    const out = applyFilters(rows, { model: 'total' })
    expect(out.length).toBe(2)
    expect(out.every(r => (r.market || 'total') === 'total')).toBe(true)
  })

  it('model=phlt keeps only rows with a phlt_tier', () => {
    const out = applyFilters(rows, { model: 'phlt' })
    expect(out.length).toBe(1)
    expect(out[0].phlt_tier).toBe('A')
  })

  it('strong=true keeps only strong rows', () => {
    const out = applyFilters(rows, { strong: true })
    expect(out.length).toBe(1)
    expect(out[0].strong).toBe(true)
  })

  it('drops ml/rl rows before the 2026-06-23 fix date but keeps a total of the same date', () => {
    const sameDate = applyFilters(rows, { from: '2026-06-20', to: '2026-06-20' })
    // total row kept, ml row (pre-gate) dropped
    expect(sameDate.length).toBe(1)
    expect(sameDate[0].market).toBe('total')
  })

  it('sport filter is case-insensitive', () => {
    const out = applyFilters(rows, { sport: 'mlb' })
    expect(out.every(r => r.sport === 'MLB')).toBe(true)
  })

  it('date window filters on game_date', () => {
    const out = applyFilters(rows, { from: '2026-06-24', to: '2026-06-24' })
    expect(out.every(r => r.game_date === '2026-06-24')).toBe(true)
    expect(out.length).toBe(3)
  })
})

describe('unitsRoi', () => {
  it('a +100 win = +1u', () => {
    const { units } = unitsRoi([{ result: 'W', price: 100 }])
    expect(units).toBe(1)
  })
  it('a -110 win ≈ +0.91u (default price)', () => {
    const { units } = unitsRoi([{ result: 'W' }])
    expect(units).toBe(0.91)
  })
  it('a loss = -1u', () => {
    const { units } = unitsRoi([{ result: 'L' }])
    expect(units).toBe(-1)
  })
  it('pushes are ignored and roi is 0 with no decisions', () => {
    expect(unitsRoi([{ result: 'P' }])).toEqual({ units: 0, roi: 0 })
  })
  it('roi = units / decisions as a percent', () => {
    // +100 win (+1u) and a loss (-1u) over 2 decisions -> 0 units, 0% roi
    expect(unitsRoi([{ result: 'W', price: 100 }, { result: 'L' }])).toEqual({ units: 0, roi: 0 })
  })
})

describe('avgClv', () => {
  it('null on empty', () => {
    expect(avgClv([])).toBe(null)
  })
  it('averages non-null clv values', () => {
    expect(avgClv([{ clv: 2 }, { clv: 4 }, { clv: null }])).toBe(3)
  })
})

describe('dailySeries', () => {
  it('groups by game_date sorted ascending', () => {
    const out = dailySeries([
      { game_date: '2026-06-24', result: 'W' },
      { game_date: '2026-06-20', result: 'L' },
      { game_date: '2026-06-24', result: 'W' },
    ])
    expect(out.map(d => d.date)).toEqual(['2026-06-20', '2026-06-24'])
    expect(out[1]).toEqual({ date: '2026-06-24', w: 2, l: 0, p: 0, winPct: 100 })
  })
})
