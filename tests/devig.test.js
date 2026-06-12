import { describe, it, expect } from 'vitest'
import { americanToImplied, americanToDecimal, impliedToAmerican, devigTwoWay } from '../src/lib/devig.js'

describe('americanToImplied', () => {
  it('favorite', () => { expect(americanToImplied(-150)).toBeCloseTo(0.6, 4) })
  it('underdog', () => { expect(americanToImplied(+150)).toBeCloseTo(0.4, 4) })
  it('even', () => { expect(americanToImplied(-110)).toBeCloseTo(0.52381, 4) })
  it('returns null for non-numeric', () => { expect(americanToImplied(null)).toBeNull() })
})

describe('americanToDecimal', () => {
  it('favorite', () => { expect(americanToDecimal(-200)).toBeCloseTo(1.5, 4) })
  it('underdog', () => { expect(americanToDecimal(+150)).toBeCloseTo(2.5, 4) })
})

describe('impliedToAmerican', () => {
  it('favorite side (>0.5)', () => { expect(impliedToAmerican(0.6)).toBeCloseTo(-150, 0) })
  it('underdog side (<0.5)', () => { expect(impliedToAmerican(0.4)).toBeCloseTo(150, 0) })
  it('even', () => { expect(Math.abs(impliedToAmerican(0.5))).toBeCloseTo(100, 0) })
})

describe('devigTwoWay', () => {
  it('-110/-110 → 50/50 fair, ~4.76% hold', () => {
    const r = devigTwoWay(-110, -110)
    expect(r.fairA).toBeCloseTo(0.5, 4)
    expect(r.fairB).toBeCloseTo(0.5, 4)
    expect(r.holdPct).toBeCloseTo(4.762, 2)
    expect(r.fairAmericanA).toBeCloseTo(100, 0) // even → ±100
  })
  it('-150/+130 fair probs sum to 1', () => {
    const r = devigTwoWay(-150, 130)
    expect(r.fairA + r.fairB).toBeCloseTo(1, 6)
    expect(r.fairA).toBeCloseTo(0.5798, 3)
    expect(r.holdPct).toBeCloseTo(3.48, 1)
  })
  it('returns null if a side missing', () => {
    expect(devigTwoWay(-110, null)).toBeNull()
  })
})
