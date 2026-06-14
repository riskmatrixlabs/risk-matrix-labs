import { describe, it, expect } from 'vitest'
import { curateBooks, computeBestAvailable } from '../src/components/BookMoveChart.jsx'

const m = (current) => ({ open: current, current, series: [current, current] })
const mt = (series, times) => ({ open: series[0], current: series[series.length - 1], series, times })

describe('curateBooks — Pikkit-style book filter for the line chart', () => {
  it('drops obscure offshore/EU books, keeps reputable US books', () => {
    const out = curateBooks({
      draftkings: m(-110), fanduel: m(-108), betmgm: m(-112),
      betclic_fr: m(-120), betsson: m(-115), coolbet: m(-118), gtbets: m(-130),
    })
    expect(Object.keys(out).sort()).toEqual(['betmgm', 'draftkings', 'fanduel'])
    expect(out).not.toHaveProperty('betclic_fr')
    expect(out).not.toHaveProperty('coolbet')
  })

  it('caps the number of lines so the chart stays readable', () => {
    const wide = {}
    for (const b of ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet', 'fanatics', 'betrivers', 'hardrockbet', 'pinnacle', 'betfair_ex_us', 'betfair_ex_eu']) wide[b] = m(-110)
    expect(Object.keys(curateBooks(wide)).length).toBeLessThanOrEqual(7)
  })

  it('excludes sharp/exchange books (Pinnacle, Betfair) and orders US retail by priority', () => {
    const keys = Object.keys(curateBooks({ pinnacle: m(-105), betfair_ex_us: m(-104), betmgm: m(-110), draftkings: m(-108), fanduel: m(-107) }))
    expect(keys).not.toContain('pinnacle')
    expect(keys).not.toContain('betfair_ex_us')
    expect(keys).toEqual(['draftkings', 'fanduel', 'betmgm'])  // priority order
  })

  it('handles empty / all-junk input without throwing', () => {
    expect(curateBooks({})).toEqual({})
    expect(curateBooks({ betclic_fr: m(-120), coolbet: m(-118) })).toEqual({})
  })
})

describe('computeBestAvailable — the Pikkit "Best Available" line', () => {
  const T = ['2026-06-13T13:00:00Z', '2026-06-13T13:30:00Z', '2026-06-13T14:00:00Z']

  it('picks the best (highest-payout) price at each timestamp', () => {
    const best = computeBestAvailable({
      draftkings: mt([-110, -110, -110], T),
      fanduel:    mt([-105, -108, -102], T),   // -102 is the best (least juice) at the end
    })
    expect(best.current).toBe(-102)
    expect(best.bestBook).toBe('fanduel')
    expect(best.series.length).toBe(3)
  })

  it('carries a book forward when it skips a snapshot', () => {
    const best = computeBestAvailable({
      draftkings: mt([-120, -120, -120], T),
      fanduel:    mt([+100], [T[0]]),          // only priced at first snapshot; carries forward
    })
    expect(best.series).toEqual([+100, +100, +100])  // fanduel +100 stays best throughout
    expect(best.bestBook).toBe('fanduel')
  })

  it('ignores non-reputable books and returns null when none qualify', () => {
    expect(computeBestAvailable({ betclic_fr: mt([+200], [T[0]]) })).toBeNull()
    expect(computeBestAvailable({})).toBeNull()
  })
})
