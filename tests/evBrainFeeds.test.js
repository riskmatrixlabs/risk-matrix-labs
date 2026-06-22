import { describe, it, expect } from 'vitest'
import { modelProbForBet, clvForBet, disciplineFromBetLog, operatorFromBetLog } from '../src/lib/evBrainFeeds.js'

describe('modelProbForBet', () => {
  it('returns ~50% from a -110/-110 two-way market after de-vig', () => {
    const p = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true } })
    expect(p).toBeGreaterThan(0.49); expect(p).toBeLessThan(0.51)
  })
  it('nudges HIGHER when our model edge agrees with the bet side (OVER + positive edgeRuns)', () => {
    const base = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true } })
    const withEdge = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true }, modelEdgeRuns: 1.5, betSide: 'OVER' })
    expect(withEdge).toBeGreaterThan(base)
  })
  it('nudges LOWER when the model disagrees with the bet side (OVER but negative edgeRuns = model likes under)', () => {
    const base = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true } })
    const against = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true }, modelEdgeRuns: -1.5, betSide: 'OVER' })
    expect(against).toBeLessThan(base)
  })
  it('falls back to vig-inclusive implied prob when no consensus is given', () => {
    const p = modelProbForBet({ americanOdds: -200, consensus: null })
    expect(p).toBeGreaterThan(0.6) // -200 ≈ 66% implied
  })
  it('clamps to (0.01, 0.99) and returns null on no usable input (never NaN)', () => {
    expect(modelProbForBet({ americanOdds: null, consensus: null })).toBeNull()
    const p = modelProbForBet({ americanOdds: -100000, consensus: null })
    expect(p).toBeLessThanOrEqual(0.99)
  })
})

describe('clvForBet', () => {
  const snaps = [
    { market: 'totals', side: 'over', price: -110, captured_at: '2026-06-21T10:00:00Z' },
    { market: 'totals', side: 'over', price: -130, captured_at: '2026-06-21T16:00:00Z' },
    { market: 'totals', side: 'under', price: 100, captured_at: '2026-06-21T16:00:00Z' },
    { market: 'h2h',    side: 'home', price: 120, captured_at: '2026-06-21T16:00:00Z' },
  ]
  it('returns the LATEST matching price for the bet market+side (the close)', () => {
    expect(clvForBet({ market: 'totals', side: 'over' }, snaps)).toBe(-130)
  })
  it('matches the right side', () => {
    expect(clvForBet({ market: 'totals', side: 'under' }, snaps)).toBe(100)
  })
  it('returns null when nothing matches', () => {
    expect(clvForBet({ market: 'spreads', side: 'home' }, snaps)).toBeNull()
    expect(clvForBet({ market: 'totals', side: 'over' }, [])).toBeNull()
    expect(clvForBet(null, snaps)).toBeNull()
  })
  it('is case-insensitive on market/side and tolerates missing captured_at', () => {
    const s = [{ market: 'TOTALS', side: 'OVER', price: -105 }]
    expect(clvForBet({ market: 'totals', side: 'over' }, s)).toBe(-105)
  })
})

describe('disciplineFromBetLog', () => {
  it('flags a big size jump right after a loss (chase)', () => {
    const bets = [
      { stake: 20, result: 'L', created_at: '2026-06-21T18:00:00Z', legs: null },
      { stake: 60, result: null, created_at: '2026-06-21T18:20:00Z', legs: null },
    ]
    const r = disciplineFromBetLog(bets, { unit: 20 })
    expect(r.score).toBeLessThan(100)
    expect(Array.isArray(r.penalties)).toBe(true)
    expect(r.penalties.length).toBeGreaterThan(0)
  })
  it('clean flat-staked log → high score, no penalties', () => {
    const clean = [
      { stake: 20, result: 'W', created_at: '2026-06-21T12:00:00Z', legs: null },
      { stake: 20, result: 'L', created_at: '2026-06-21T13:00:00Z', legs: null },
      { stake: 20, result: 'W', created_at: '2026-06-21T14:00:00Z', legs: null },
    ]
    const r = disciplineFromBetLog(clean, { unit: 20 })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.penalties).toHaveLength(0)
  })
  it('empty / missing input → neutral, never NaN', () => {
    const r = disciplineFromBetLog([], { unit: 20 })
    expect(Number.isNaN(r.score)).toBe(false)
  })
})

describe('operatorFromBetLog', () => {
  it('returns a 0-100 score and a string label', () => {
    const bets = [{ stake: 20, result: 'W', created_at: '2026-06-21T12:00:00Z', legs: null }]
    const r = operatorFromBetLog(bets, { unit: 20 })
    expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100)
    expect(typeof r.label).toBe('string')
  })
  it('a disciplined winning log rates higher than a reckless chasing log', () => {
    const good = [{ stake: 20, result: 'W', created_at: '2026-06-21T12:00:00Z', legs: null },
                  { stake: 20, result: 'W', created_at: '2026-06-21T13:00:00Z', legs: null }]
    const bad  = [{ stake: 20, result: 'L', created_at: '2026-06-21T12:00:00Z', legs: null },
                  { stake: 100, result: 'L', created_at: '2026-06-21T12:10:00Z', legs: null },
                  { stake: 200, result: 'L', created_at: '2026-06-21T12:20:00Z', legs: null }]
    expect(operatorFromBetLog(good, { unit: 20 }).score).toBeGreaterThan(operatorFromBetLog(bad, { unit: 20 }).score)
  })
})
