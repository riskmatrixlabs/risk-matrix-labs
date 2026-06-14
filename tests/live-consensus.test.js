import { describe, it, expect } from 'vitest'
import { median, consensusPrice, liveConsensus } from '../src/lib/liveConsensus.js'

const mkt = (outcomes, rows, modalPoint = {}) => ({ outcomes, rows, modalPoint })

describe('median', () => {
  it('odd / even / empty', () => {
    expect(median([-110, -105, -120])).toBe(-110)
    expect(median([-110, -106])).toBe(-108)
    expect(median([])).toBeNull()
  })
})

describe('consensusPrice — sharp-first, modal-line only', () => {
  it('prefers the sharp (Pinnacle) price', () => {
    const m = mkt(['NYY'], [
      { book: 'draftkings', sharp: false, prices: { NYY: -120 }, points: { NYY: null } },
      { book: 'pinnacle',   sharp: true,  prices: { NYY: -108 }, points: { NYY: null } },
    ])
    expect(consensusPrice(m, 'NYY')).toBe(-108)
  })
  it('falls back to median when no sharp book', () => {
    const m = mkt(['NYY'], [
      { book: 'draftkings', sharp: false, prices: { NYY: -120 }, points: { NYY: null } },
      { book: 'fanduel',    sharp: false, prices: { NYY: -110 }, points: { NYY: null } },
      { book: 'betmgm',     sharp: false, prices: { NYY: -106 }, points: { NYY: null } },
    ])
    expect(consensusPrice(m, 'NYY')).toBe(-110)
  })
  it('ignores books off the modal line', () => {
    const m = mkt(['Over'], [
      { book: 'pinnacle',   sharp: true,  prices: { Over: +120 }, points: { Over: 8.5 } },  // off modal → skipped
      { book: 'draftkings', sharp: false, prices: { Over: -110 }, points: { Over: 7.5 } },
    ], { Over: 7.5 })
    expect(consensusPrice(m, 'Over')).toBe(-110)
  })
})

describe('liveConsensus — maps markets to away/home/over-under', () => {
  const markets = {
    h2h: mkt(['New York Yankees', 'Toronto Blue Jays'], [
      { book: 'pinnacle', sharp: true, prices: { 'New York Yankees': -115, 'Toronto Blue Jays': -105 }, points: {} },
    ]),
    spreads: mkt(['New York Yankees', 'Toronto Blue Jays'], [
      { book: 'pinnacle', sharp: true, prices: { 'New York Yankees': +130, 'Toronto Blue Jays': -150 }, points: { 'New York Yankees': 1.5, 'Toronto Blue Jays': -1.5 } },
    ], { 'New York Yankees': 1.5, 'Toronto Blue Jays': -1.5 }),
    totals: mkt(['Over', 'Under'], [
      { book: 'pinnacle', sharp: true, prices: { Over: -108, Under: -112 }, points: { Over: 8.5, Under: 8.5 } },
    ], { Over: 8.5, Under: 8.5 }),
  }
  it('produces live ML / spread / total consensus', () => {
    const c = liveConsensus(markets, 'New York Yankees', 'Toronto Blue Jays')
    expect(c.ml).toEqual({ away: -115, home: -105 })
    expect(c.spread).toEqual({ point: -1.5, away: +130, home: -150 })
    expect(c.total).toEqual({ point: 8.5, over: -108, under: -112 })
  })
  it('returns nulls when markets missing', () => {
    expect(liveConsensus(null, 'a', 'b')).toEqual({ ml: null, spread: null, total: null })
    expect(liveConsensus({}, 'a', 'b')).toEqual({ ml: null, spread: null, total: null })
  })
})
