import { describe, it, expect } from 'vitest'
import { nflLean, deriveNflFactors, leagueAvgOffEpa, LEAGUE_AVG_EPA } from '../src/lib/nflLean.js'

// Hand-built inputs where every one of the nine factors is derivable.
// HOME is clearly the stronger side (see hand math in the score test).
const base = () => ({
  homeStats: { offEpaPerPlay: 0.14, defEpaPerPlayAllowed: -0.06, sackRateAllowed: 0.03, explosiveRate: 0.14, turnoverMargin: -6, playsPerGame: 63 },
  awayStats: { offEpaPerPlay: -0.06, defEpaPerPlayAllowed: 0.06, sackRateAllowed: 0.12, explosiveRate: 0.056, turnoverMargin: 6, playsPerGame: 60 },
  weather: { indoor: true },
  injuries: { home: { out: 0, doubtful: 0, questionable: 0 }, away: { out: 2, doubtful: 0, questionable: 0 } },
  oddsSpreadHome: -2,
  oddsTotal: 44,
  restDaysHome: 10,
  restDaysAway: 4,
})

describe('nflLean — hand-computed lean (LEAGUE_AVG_EPA-centered qb/def matchup)', () => {
  it('leans HOME with the hand-computed score and tier', () => {
    // L = LEAGUE_AVG_EPA = 0.01. HOME factors:
    //   qbEdge      = 0.5 + ((0.14−L) + (0.06−L))·2.5 = 0.5 + (0.13+0.05)·2.5   = 0.95
    //                 (opp defAllowed ABOVE league avg = leaky defense → edge UP)
    //   ol          = 1 − 0.03/0.12                                             = 0.75
    //   defMatchup  = 0.5 − ((−0.06−L) + (−0.06−L))·2.5 = 0.5 − (−0.14)·2.5     = 0.85
    //                 (weak opp offense + stingy own defense → matchup UP)
    //   explosive   = 0.14/0.14                                                 = 1.00
    //   toRegress   = 0.5 − (−6)·0.05                                           = 0.80
    //   injuryEdge  = 0.5 + (2 − 0)·0.08                                        = 0.66
    //   restTravel  = 0.5 + (10 − 4)·0.07                                       = 0.92
    //   weather     = indoor                                                    = 0.75
    //   lineValue   = 0.5 + (8 − 2)/14                                          = 0.928571…
    //     (modelMargin = epaDiff·25 = ((0.14−(−0.06))−(−0.06−0.06))·25 = 0.32·25 = 8;
    //      market margin for HOME = −oddsSpreadHome = 2)
    // score = 0.95·20 + 0.75·10 + 0.85·15 + 1·10 + 0.80·10 + 0.66·10 + 0.92·5 + 0.75·5 + 0.928571·15
    //       = 19 + 7.5 + 12.75 + 10 + 8 + 6.6 + 4.6 + 3.75 + 13.92857 = 86.128… → 86.13
    const out = nflLean(base())
    expect(out).not.toBe(null)
    expect(out.side).toBe('HOME')
    expect(out.score).toBeCloseTo(86.13, 2)
    expect(out.tier).toBe('PRIME')
    expect(out.modelVersion).toBe('nfl-shadow-v0')
    expect(out.factors.qbEdge).toBeCloseTo(0.95, 6)
    expect(out.factors.defensiveMatchup).toBeCloseTo(0.85, 6)
    expect(out.factors.lineValue).toBeCloseTo(0.5 + 6 / 14, 6)
  })

  it('qbEdge REWARDS facing a leaky defense (the sign-error regression)', () => {
    const b = base()
    // Opp defense allows a LOT (defAllowed 0.10, way above league avg): edge must be
    // HIGHER than against a stingy defense (defAllowed −0.10). Under the old (backwards)
    // formula the stingy defense scored higher — that was the bug.
    const ctx = { injuriesOwn: b.injuries.home, injuriesOpp: b.injuries.away, restOwn: 7, restOpp: 7, weather: { indoor: true }, marketMargin: 2 }
    const vsLeaky = deriveNflFactors(b.homeStats, { ...b.awayStats, defEpaPerPlayAllowed: 0.10 }, ctx)
    const vsStingy = deriveNflFactors(b.homeStats, { ...b.awayStats, defEpaPerPlayAllowed: -0.10 }, ctx)
    expect(vsLeaky.qbEdge).toBeGreaterThan(vsStingy.qbEdge)
    // hand math: 0.5 + ((0.14−0.01) + (0.10−0.01))·2.5 = 0.5 + 0.22·2.5 = 1.05 → clamp 1
    expect(vsLeaky.qbEdge).toBe(1)
    expect(vsStingy.qbEdge).toBeCloseTo(0.5 + (0.13 + (-0.11)) * 2.5, 6) // 0.55
  })

  it('defensiveMatchup penalizes a strong opp offense + leaky own defense (mirror fix)', () => {
    const b = base()
    const ctx = { injuriesOwn: b.injuries.home, injuriesOpp: b.injuries.away, restOwn: 7, restOpp: 7, weather: { indoor: true }, marketMargin: 2 }
    // own def leaky (0.08), opp offense hot (0.12): 0.5 − ((0.12−0.01)+(0.08−0.01))·2.5 = 0.5 − 0.45 = 0.05
    const f = deriveNflFactors({ ...b.homeStats, defEpaPerPlayAllowed: 0.08 }, { ...b.awayStats, offEpaPerPlay: 0.12 }, ctx)
    expect(f.defensiveMatchup).toBeCloseTo(0.05, 6)
  })

  it('below the 68 LEAN threshold → null (perfectly symmetric matchup)', () => {
    const s = { offEpaPerPlay: 0.02, defEpaPerPlayAllowed: 0.02, sackRateAllowed: 0.06, explosiveRate: 0.07, turnoverMargin: 0, playsPerGame: 63 }
    const out = nflLean({ ...base(), homeStats: { ...s }, awayStats: { ...s },
      injuries: { home: { out: 0, doubtful: 0, questionable: 0 }, away: { out: 0, doubtful: 0, questionable: 0 } },
      oddsSpreadHome: 0, restDaysHome: 7, restDaysAway: 7 })
    // both sides: qbEdge 0.55, defMatchup 0.45, others 0.5 (weather 0.75) → 51.5 → no lean
    expect(out).toBe(null)
  })

  it('accepts a computed leagueAvgEpa override', () => {
    const b = { ...base(), leagueAvgEpa: 0.05 }
    const out = nflLean(b)
    // HOME qbEdge = 0.5 + ((0.14−0.05)+(0.06−0.05))·2.5 = 0.75
    expect(out.factors.qbEdge).toBeCloseTo(0.75, 6)
  })
})

describe('leagueAvgOffEpa', () => {
  it('mean of finite team offEpaPerPlay values; fallback const when underivable', () => {
    expect(leagueAvgOffEpa({ A: { offEpaPerPlay: 0.1 }, B: { offEpaPerPlay: -0.02 }, C: { offEpaPerPlay: null } }))
      .toBeCloseTo(0.04, 6)
    expect(leagueAvgOffEpa(null)).toBe(LEAGUE_AVG_EPA)
    expect(leagueAvgOffEpa({ A: { offEpaPerPlay: null } })).toBe(LEAGUE_AVG_EPA)
  })
})

describe('nflLean — honest null propagation (all-or-nothing)', () => {
  const cases = {
    'missing homeStats': (b) => { b.homeStats = null },
    'missing awayStats': (b) => { b.awayStats = null },
    'defEpaPerPlayAllowed null (real nflverse gap today)': (b) => { b.homeStats.defEpaPerPlayAllowed = null },
    'offEpaPerPlay null': (b) => { b.awayStats.offEpaPerPlay = null },
    'sackRateAllowed null': (b) => { b.homeStats.sackRateAllowed = null },
    'explosiveRate null': (b) => { b.awayStats.explosiveRate = null },
    'turnoverMargin null': (b) => { b.homeStats.turnoverMargin = null },
    'missing injuries': (b) => { b.injuries = null },
    'missing one injury side': (b) => { b.injuries = { home: { out: 0, doubtful: 0, questionable: 0 }, away: null } },
    'missing weather': (b) => { b.weather = null },
    'outdoor weather without wind': (b) => { b.weather = { indoor: false, precipPct: 20 } },
    'missing oddsSpreadHome': (b) => { b.oddsSpreadHome = null },
    'missing restDaysHome': (b) => { b.restDaysHome = null },
    'missing restDaysAway': (b) => { b.restDaysAway = undefined },
  }
  for (const [name, mutate] of Object.entries(cases)) {
    it(`${name} → null`, () => {
      const b = base()
      mutate(b)
      expect(nflLean(b)).toBe(null)
    })
  }
})

describe('deriveNflFactors — individual derivations', () => {
  it('outdoor weather: 1 − clamp01((wind/25 + precip/100)/2)', () => {
    const b = base()
    b.weather = { indoor: false, windMph: 10, precipPct: 40 }
    const f = deriveNflFactors(b.homeStats, b.awayStats, {
      injuriesOwn: b.injuries.home, injuriesOpp: b.injuries.away,
      restOwn: 7, restOpp: 7, weather: b.weather, marketMargin: 2,
    })
    // 1 − (10/25 + 40/100)/2 = 1 − 0.4 = 0.6
    expect(f.weather).toBeCloseTo(0.6, 6)
  })
  it('injury statuses weighted Out=1 / Doubtful=0.6 / Questionable=0.3', () => {
    const b = base()
    const f = deriveNflFactors(b.homeStats, b.awayStats, {
      injuriesOwn: { out: 1, doubtful: 1, questionable: 2 },   // 1 + 0.6 + 0.6 = 2.2
      injuriesOpp: { out: 3, doubtful: 0, questionable: 1 },   // 3 + 0.3 = 3.3
      restOwn: 7, restOpp: 7, weather: { indoor: true }, marketMargin: 2,
    })
    expect(f.injuryEdge).toBeCloseTo(0.5 + (3.3 - 2.2) * 0.08, 6)
  })
  it('factors clamp to [0,1]', () => {
    const b = base()
    b.homeStats.sackRateAllowed = 0.3 // 1 − 0.3/0.12 < 0 → clamp 0
    b.homeStats.explosiveRate = 0.5   // /0.14 > 1 → clamp 1
    const f = deriveNflFactors(b.homeStats, b.awayStats, {
      injuriesOwn: b.injuries.home, injuriesOpp: b.injuries.away,
      restOwn: 7, restOpp: 7, weather: { indoor: true }, marketMargin: 2,
    })
    expect(f.offensiveLine).toBe(0)
    expect(f.explosivePlay).toBe(1)
  })
})
