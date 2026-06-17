import { describe, it, expect } from 'vitest'
import { OFF, platoonMult, lineupXwoba, offenseFactor, formFactor } from '../api/_lib/offense.js'

const norm = (s) => String(s || '').toLowerCase().trim()

describe('offense scoring', () => {
  it('platoonMult: advantage when opposite hands, penalty when same, switch neutral-plus', () => {
    expect(platoonMult('L', 'R')).toBeGreaterThan(1)
    expect(platoonMult('R', 'R')).toBeLessThan(1)
    expect(platoonMult('S', 'L')).toBeGreaterThan(1)
    expect(platoonMult(null, 'R')).toBe(1)
  })

  it('lineupXwoba: averages matched batters, null when too few match', () => {
    const sav = { 'a': { xwoba: 0.340 }, 'b': { xwoba: 0.360 } }
    const few = lineupXwoba([{ name: 'A' }, { name: 'B' }], sav, 'R', norm)
    expect(few).toBeNull()
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: 'p' + i }))
    const sav9 = Object.fromEntries(nine.map((b, i) => [norm(b.name), { xwoba: 0.330 }]))
    const r = lineupXwoba(nine, sav9, 'R', norm)
    expect(r.n).toBe(9)
    expect(r.xwoba).toBeCloseTo(0.330, 3)
  })

  it('offenseFactor: both strong → +1, both weak → -1, mixed → 0', () => {
    expect(offenseFactor(0.345, 0.340).score).toBe(1)
    expect(offenseFactor(0.300, 0.295).score).toBe(-1)
    expect(offenseFactor(0.345, 0.295).score).toBe(0)
    expect(offenseFactor(null, 0.300).score).toBe(0)
  })

  it('formFactor: high combined R/G → +1, low → -1, mid → 0', () => {
    expect(formFactor(10.2).score).toBe(1)
    expect(formFactor(7.5).score).toBe(-1)
    expect(formFactor(9.0).score).toBe(0)
    expect(formFactor(null).score).toBe(0)
  })
})
