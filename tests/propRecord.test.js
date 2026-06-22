import { describe, it, expect } from 'vitest'
import { tallyProps, winPct } from '../src/lib/propRecord.js'

const row = (result, phlt_tier, game_date = '2026-06-20') => ({ result, phlt_tier, game_date })

describe('tallyProps', () => {
  it('counts W/L/P overall', () => {
    const out = tallyProps([row('W', 'A'), row('W', 'B'), row('L', 'A'), row('P', 'C')])
    expect(out.overall.w).toBe(2)
    expect(out.overall.l).toBe(1)
    expect(out.overall.p).toBe(1)
    expect(out.overall.n).toBe(4)
  })

  it('winPct excludes pushes from the denominator', () => {
    // 2W 1L 5P -> 2/(2+1) = 67
    const rows = [row('W', 'A'), row('W', 'A'), row('L', 'A'), ...Array(5).fill(0).map(() => row('P', 'A'))]
    expect(tallyProps(rows).overall.winPct).toBe(67)
  })

  it('splits by tier A/B/C', () => {
    const out = tallyProps([
      row('W', 'A'), row('L', 'A'),
      row('W', 'B'), row('W', 'B'),
      row('P', 'C'),
    ])
    expect(out.byTier.A).toEqual({ w: 1, l: 1, p: 0, winPct: 50 })
    expect(out.byTier.B).toEqual({ w: 2, l: 0, p: 0, winPct: 100 })
    expect(out.byTier.C).toEqual({ w: 0, l: 0, p: 1, winPct: null })
  })

  it('ignores AVOID / null tiers in byTier', () => {
    const out = tallyProps([row('W', 'AVOID'), row('L', null)])
    expect(out.byTier.A.w).toBe(0)
    expect(out.byTier.B.w).toBe(0)
    expect(out.byTier.C.w).toBe(0)
    // still counted in overall
    expect(out.overall.n).toBe(2)
  })

  it('splits today vs yesterday by game_date', () => {
    const out = tallyProps(
      [row('W', 'A', '2026-06-22'), row('L', 'A', '2026-06-21'), row('W', 'A', '2026-06-01')],
      { today: '2026-06-22', yesterday: '2026-06-21' },
    )
    expect(out.today).toEqual({ w: 1, l: 0, p: 0 })
    expect(out.yesterday).toEqual({ w: 0, l: 1, p: 0 })
  })

  it('empty input -> zeros and null winPct', () => {
    const out = tallyProps([])
    expect(out.overall).toEqual({ w: 0, l: 0, p: 0, n: 0, winPct: null })
    expect(out.byTier.A).toEqual({ w: 0, l: 0, p: 0, winPct: null })
    expect(out.today).toEqual({ w: 0, l: 0, p: 0 })
  })

  it('winPct guards divide-by-zero', () => {
    expect(winPct(0, 0)).toBe(null)
    expect(winPct(3, 1)).toBe(75)
  })
})
