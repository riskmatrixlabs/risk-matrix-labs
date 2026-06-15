import { describe, it, expect } from 'vitest'
import { STATUS, betStatus, normalizeBet, ticketStatus, computeRecord, groupByDate, slipClv } from '../src/lib/betCard.js'

describe('betStatus', () => {
  it('maps W to won', () => expect(betStatus('W')).toBe(STATUS.won))
  it('maps L to lost', () => expect(betStatus('L')).toBe(STATUS.lost))
  it('maps P to push', () => expect(betStatus('P')).toBe(STATUS.push))
  it('maps Open/undefined to live', () => {
    expect(betStatus('Open')).toBe(STATUS.live)
    expect(betStatus(undefined)).toBe(STATUS.live)
  })
  it('each status carries a color and icon', () => {
    expect(STATUS.won.color).toBe('#BDFF00')
    expect(STATUS.lost.color).toBe('#FF3B3B')
    expect(STATUS.live.color).toBe('#FFB800')
    expect(STATUS.won.icon).toBe('ti-check')
    expect(STATUS.lost.icon).toBe('ti-x')
    expect(STATUS.live.icon).toBe('ti-clock')
  })
})

describe('normalizeBet', () => {
  it('straight bet → kind straight, single leg', () => {
    const n = normalizeBet({ id: 1, betType: 'Straight', sport: 'MLB', book: 'FanDuel',
      event: 'Yankees vs Red Sox', pick: 'Yankees ML', odds: -140, stake: 20, result: 'W', date: '2026-06-15' })
    expect(n.kind).toBe('straight')
    expect(n.title).toBe('Yankees ML')
    expect(n.subtitle).toBe('Yankees vs Red Sox')
    expect(n.legs).toHaveLength(1)
    expect(n.legs[0].odds).toBe(-140)
  })
  it('parlay with legs array → kind parlay, N legs', () => {
    const n = normalizeBet({ id: 2, betType: 'Parlay', sport: 'MLB', stake: 20, odds: 1200, result: 'Open',
      date: '2026-06-15', legs: [
        { pick: 'Yankees ML', odds: -140, event: 'NYY vs BOS', result: 'W' },
        { pick: 'Soto O1.5 TB', odds: 105, event: 'SD vs LAD', result: 'W' },
        { pick: 'Judge O1.5 TB', odds: 110, event: 'NYY vs BOS', result: 'Open' },
      ] })
    expect(n.kind).toBe('parlay')
    expect(n.legs).toHaveLength(3)
    expect(n.legs[1].title).toBe('Soto O1.5 TB')
  })
  it('parlay without legs array → splits pick on " + "', () => {
    const n = normalizeBet({ id: 3, betType: 'SGP', sport: 'NHL', stake: 10, odds: 142, result: 'Open',
      date: '2026-06-15', pick: 'Oilers ML + Over 5.5', event: 'Oilers vs Canucks' })
    expect(n.kind).toBe('parlay')
    expect(n.legs.map(l => l.title)).toEqual(['Oilers ML', 'Over 5.5'])
  })
})

describe('ticketStatus', () => {
  const legs = (r) => r.map(x => ({ status: STATUS[x] }))
  it('counts wins and total', () => {
    const t = ticketStatus(legs(['won','won','won','lost','lost','live']))
    expect(t.won).toBe(3); expect(t.total).toBe(6); expect(t.label).toBe('3 OF 6 HIT')
  })
  it('any lost leg + nothing live → ticket lost', () => {
    const t = ticketStatus(legs(['won','lost']))
    expect(t.overall).toBe(STATUS.lost)
  })
  it('all won → ticket won', () => {
    const t = ticketStatus(legs(['won','won']))
    expect(t.overall).toBe(STATUS.won)
  })
  it('still legs live (no lost yet decided) → ticket live', () => {
    const t = ticketStatus(legs(['won','live']))
    expect(t.overall).toBe(STATUS.live)
  })
})

describe('computeRecord', () => {
  it('tallies W-L-P, units and ROI from settled bets', () => {
    const bets = [
      { result: 'W', pnl: 0.9, units: 1, stake: 20 },
      { result: 'W', pnl: 1.25, units: 1, stake: 20 },
      { result: 'L', pnl: -1.5, units: 1.5, stake: 30 },
      { result: 'P', pnl: 0, units: 1, stake: 20 },
      { result: 'Open', pnl: 0, units: 1, stake: 20 },
    ]
    const r = computeRecord(bets)
    expect(r.w).toBe(2); expect(r.l).toBe(1); expect(r.p).toBe(1)
    expect(r.units).toBeCloseTo(0.65, 2)
    expect(r.roi).toBeCloseTo(18.6, 1)
  })
  it('empty → zeros, roi null', () => {
    const r = computeRecord([])
    expect(r).toEqual({ w: 0, l: 0, p: 0, units: 0, roi: null })
  })
})

describe('groupByDate', () => {
  const bets = [
    { id: 1, date: '2026-06-15', result: 'W', pnl: 0.9, units: 1 },
    { id: 2, date: '2026-06-15', result: 'L', pnl: -1, units: 1 },
    { id: 3, date: '2026-06-14', result: 'W', pnl: 1.1, units: 1 },
  ]
  it('groups newest first, labels today', () => {
    const g = groupByDate(bets, '2026-06-15')
    expect(g).toHaveLength(2)
    expect(g[0].date).toBe('2026-06-15')
    expect(g[0].label).toBe('TODAY')
    expect(g[1].label).toBe('2026-06-14')
  })
  it('per-day tally', () => {
    const g = groupByDate(bets, '2026-06-15')
    expect(g[0].tally).toEqual({ w: 1, l: 1, p: 0, units: -0.1 })
  })
})

describe('slipClv', () => {
  it('averages per-leg clv from entry vs close pairs', () => {
    const r = slipClv([{ entry: -140, close: -160 }, { entry: 105, close: -110 }])
    expect(r.beat).toBe(true)
    expect(r.clvPct).toBeGreaterThan(0)
  })
  it('ignores legs missing a close', () => {
    const r = slipClv([{ entry: -140, close: -160 }, { entry: 110, close: null }])
    expect(r.n).toBe(1)
  })
  it('no usable legs → null clv', () => {
    expect(slipClv([{ entry: 110, close: null }]).clvPct).toBe(null)
  })
})
