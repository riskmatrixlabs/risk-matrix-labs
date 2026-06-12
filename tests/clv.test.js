import { describe, it, expect } from 'vitest'
import { computeClv } from '../src/lib/clv.js'

describe('computeClv', () => {
  it('beating the close (favorite): took -135, closed -155 → positive', () => {
    const r = computeClv(-135, -155)
    expect(r.beat).toBe(true)
    expect(r.clvPct).toBeCloseTo(5.8, 1)
  })
  it('beating the close (dog): took +120, closed +100 → positive', () => {
    const r = computeClv(120, 100)
    expect(r.beat).toBe(true)
    expect(r.clvPct).toBeCloseTo(10, 1)
  })
  it('worse than close: took -155, closed -135 → negative', () => {
    const r = computeClv(-155, -135)
    expect(r.beat).toBe(false)
    expect(r.clvPct).toBeCloseTo(-5.5, 1)
  })
  it('same price → 0', () => {
    expect(computeClv(-110, -110).clvPct).toBeCloseTo(0, 5)
  })
  it('null inputs → null', () => {
    expect(computeClv(null, -110)).toBeNull()
    expect(computeClv(-110, null)).toBeNull()
  })
})
