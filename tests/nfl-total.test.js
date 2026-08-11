import { describe, it, expect } from 'vitest'
import { nflTotal, grossPoints, totalWeatherAdj, oppTotalAdj, NFL_TOTAL_MODEL_VERSION, BASELINE_POINTS, OPP_ADJ_K } from '../src/lib/nflTotal.js'

// Hand-built stat blocks (nflverse-shaped, only the fields nflTotal reads).
const home = { offEpaPerPlay: 0.10, defEpaPerPlayAllowed: -0.03, playsPerGame: 65 }
const away = { offEpaPerPlay: 0.02, defEpaPerPlayAllowed: 0.05, playsPerGame: 60 }
const indoor = { indoor: true }
const L = 0.01

describe('totalWeatherAdj', () => {
  it('indoor → exactly 1', () => expect(totalWeatherAdj(indoor)).toBe(1))
  it('calm outdoor (wind ≤ 8, no precip) → 1', () => expect(totalWeatherAdj({ indoor: false, windMph: 8, precipPct: 0 })).toBe(1))
  it('wind 28 + precip 40 → 1 − (0.5 + 0.2) = 0.3', () => {
    expect(totalWeatherAdj({ indoor: false, windMph: 28, precipPct: 40 })).toBeCloseTo(0.3, 10)
  })
  it('extreme conditions floor at 0 (clamp01 on the damp term)', () => {
    expect(totalWeatherAdj({ indoor: false, windMph: 60, precipPct: 100 })).toBe(0)
  })
  it('missing weather or fields → null', () => {
    expect(totalWeatherAdj(null)).toBe(null)
    expect(totalWeatherAdj({ indoor: false, windMph: null, precipPct: 10 })).toBe(null)
    expect(totalWeatherAdj({ indoor: false, windMph: 10 })).toBe(null)
  })
})

describe('oppTotalAdj', () => {
  it('league-average defense → 1', () => expect(oppTotalAdj(L, L)).toBe(1))
  it('leaky defense raises it: def 0.05 vs L 0.01 → 1 + 0.04×K = 1.10', () => {
    expect(oppTotalAdj(0.05, L)).toBeCloseTo(1 + 0.04 * OPP_ADJ_K, 10)
  })
  it('clamps to 0.85..1.15', () => {
    expect(oppTotalAdj(0.5, L)).toBe(1.15)
    expect(oppTotalAdj(-0.5, L)).toBe(0.85)
  })
  it('non-finite → null', () => expect(oppTotalAdj(null, L)).toBe(null))
})

describe('grossPoints', () => {
  it('baseline 21.5 + EPA part (EPA×plays is NET points added, not gross)', () => {
    // 0.10 × 65 × 1.10 (oppAdj) × 1 (rz) × 1 (weather) = 7.15 → 21.5 + 7.15 = 28.65
    expect(grossPoints({ epaPerPlay: 0.10, expectedPlays: 65, oppAdj: 1.10, weatherAdj: 1 })).toBeCloseTo(28.65, 10)
  })
  it('non-finite input → null', () => {
    expect(grossPoints({ epaPerPlay: null, expectedPlays: 65, oppAdj: 1, weatherAdj: 1 })).toBe(null)
  })
})

describe('nflTotal', () => {
  it('hand-computed OVER lean (indoor, line 46.5)', () => {
    // home: oppAdj vs away def 0.05 → 1.10; 0.10×65×1.10 = 7.15 → 28.65
    // away: oppAdj vs home def −0.03 → 1 − 0.04×2.5 = 0.90; 0.02×60×0.90 = 1.08 → 22.58
    // proj = 51.23; edge = +4.73 → OVER, confidence 1 (≥3), not strong (<6)
    const t = nflTotal({ homeStats: home, awayStats: away, weather: indoor, oddsTotal: 46.5, leagueAvgEpa: L })
    expect(t).toMatchObject({ lean: 'OVER', modelVersion: NFL_TOTAL_MODEL_VERSION, confidence: 1, strong: false })
    expect(t.proj).toBeCloseTo(51.23, 2)
    expect(t.edgePoints).toBeCloseTo(4.73, 2)
  })
  it('UNDER with confidence tiers and strong flag', () => {
    // Same projection 51.23 vs a 58.5 line → edge −7.27 → UNDER, confidence 3 (≥7), strong (≥6)
    const t = nflTotal({ homeStats: home, awayStats: away, weather: indoor, oddsTotal: 58.5, leagueAvgEpa: L })
    expect(t).toMatchObject({ lean: 'UNDER', confidence: 3, strong: true })
    expect(t.edgePoints).toBeCloseTo(-7.27, 2)
  })
  it('|edge| < 3 → null (no lean worth emitting)', () => {
    expect(nflTotal({ homeStats: home, awayStats: away, weather: indoor, oddsTotal: 50.5, leagueAvgEpa: L })).toBe(null)
  })
  it('missing odds_total → null even with a big model number', () => {
    expect(nflTotal({ homeStats: home, awayStats: away, weather: indoor, oddsTotal: null, leagueAvgEpa: L })).toBe(null)
  })
  it('any missing stat → null (all-or-nothing honest null)', () => {
    expect(nflTotal({ homeStats: { ...home, playsPerGame: null }, awayStats: away, weather: indoor, oddsTotal: 46.5, leagueAvgEpa: L })).toBe(null)
    expect(nflTotal({ homeStats: home, awayStats: { ...away, defEpaPerPlayAllowed: null }, weather: indoor, oddsTotal: 46.5, leagueAvgEpa: L })).toBe(null)
    expect(nflTotal({ homeStats: null, awayStats: away, weather: indoor, oddsTotal: 46.5, leagueAvgEpa: L })).toBe(null)
  })
  it('missing weather → null (no fabricated neutral conditions)', () => {
    expect(nflTotal({ homeStats: home, awayStats: away, weather: null, oddsTotal: 46.5, leagueAvgEpa: L })).toBe(null)
  })
  it('weather dampens the EPA part of both sides', () => {
    // weatherAdj = 1 − (20−8)/40 = 0.7 → home 21.5 + 7.15×0.7 = 26.505; away 21.5 + 1.08×0.7 = 22.256
    // proj = 48.761 → vs 44.5 edge +4.26 → OVER
    const t = nflTotal({ homeStats: home, awayStats: away, weather: { indoor: false, windMph: 20, precipPct: 0 }, oddsTotal: 44.5, leagueAvgEpa: L })
    expect(t.lean).toBe('OVER')
    expect(t.proj).toBeCloseTo(48.76, 2)
  })
  it('BASELINE_POINTS documents the league-average team ≈ 21.5', () => {
    expect(BASELINE_POINTS).toBe(21.5)
  })
})
