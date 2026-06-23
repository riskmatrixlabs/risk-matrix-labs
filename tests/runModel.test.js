import { describe, it, expect } from 'vitest'
import { LG, projectTeamRuns, gameProjection, winProbFromMargin, coverProb, deriveBets, anchorProjection } from '../api/_lib/runModel.js'

describe('projectTeamRuns', () => {
  it('a perfectly average matchup at a neutral park returns league team runs', () => {
    const r = projectTeamRuns({ offXwoba: LG.XWOBA, oppStarterXera: LG.XERA, oppBullpenEra: LG.PEN_ERA, parkMult: 1, weatherRunsPerSide: 0 })
    expect(r).toBeCloseTo(LG.TEAM_RUNS, 2)
  })
  it('an ace opposing starter (xERA 2.85) suppresses the team BELOW league runs', () => {
    const r = projectTeamRuns({ offXwoba: LG.XWOBA, oppStarterXera: 2.85, oppBullpenEra: LG.PEN_ERA, parkMult: 1, weatherRunsPerSide: 0 })
    expect(r).toBeLessThan(LG.TEAM_RUNS)
  })
  it('a strong offense (.345 xwOBA) vs a weak staff scores ABOVE league runs', () => {
    const r = projectTeamRuns({ offXwoba: 0.345, oppStarterXera: 4.8, oppBullpenEra: 4.7, parkMult: 1, weatherRunsPerSide: 0 })
    expect(r).toBeGreaterThan(LG.TEAM_RUNS)
  })
  it('park factor scales runs (Coors 1.13 > neutral)', () => {
    const base = { offXwoba: LG.XWOBA, oppStarterXera: LG.XERA, oppBullpenEra: LG.PEN_ERA, weatherRunsPerSide: 0 }
    expect(projectTeamRuns({ ...base, parkMult: 1.13 })).toBeGreaterThan(projectTeamRuns({ ...base, parkMult: 1 }))
  })
  it('missing inputs fall back to league neutral (never NaN)', () => {
    const r = projectTeamRuns({ offXwoba: null, oppStarterXera: null, oppBullpenEra: null, parkMult: 1, weatherRunsPerSide: 0 })
    expect(Number.isFinite(r)).toBe(true)
    expect(r).toBeCloseTo(LG.TEAM_RUNS, 2)
  })
  it('never returns a negative or absurd run total (clamped 0–15)', () => {
    const r = projectTeamRuns({ offXwoba: 0.500, oppStarterXera: 12, oppBullpenEra: 12, parkMult: 2, weatherRunsPerSide: 5 })
    expect(r).toBeLessThanOrEqual(15)
    expect(r).toBeGreaterThanOrEqual(0)
  })
})

describe('gameProjection', () => {
  const neutral = {
    away: { offXwoba: LG.XWOBA, starterXera: LG.XERA, bullpenEra: LG.PEN_ERA },
    home: { offXwoba: LG.XWOBA, starterXera: LG.XERA, bullpenEra: LG.PEN_ERA },
    parkMult: 1, weatherRunsPerSide: 0,
  }
  it('a fully neutral game projects ~league total, and the margin is exactly the home-field edge', () => {
    const p = gameProjection(neutral)
    expect(p.total).toBeCloseTo(LG.TEAM_RUNS * 2, 1)
    expect(p.margin).toBeCloseTo(LG.HFA_RUNS, 2) // home edge, not a 50/50 coin flip
  })
  it('the ACE is credited to the side he faces, not averaged away (Skenes case)', () => {
    const p = gameProjection({
      away: { offXwoba: 0.325, starterXera: 2.85, bullpenEra: 3.8 },  // PIT: ace starting
      home: { offXwoba: 0.330, starterXera: 4.54, bullpenEra: 4.6 },  // COL: weak arm
      parkMult: 1.13, weatherRunsPerSide: 0.3,
    })
    expect(p.homeRuns).toBeLessThan(p.awayRuns)
    expect(p.margin).toBeLessThan(0)
  })
  it('total = awayRuns + homeRuns and margin = homeRuns - awayRuns exactly', () => {
    const p = gameProjection(neutral)
    expect(p.total).toBeCloseTo(p.awayRuns + p.homeRuns, 5)
    expect(p.margin).toBeCloseTo(p.homeRuns - p.awayRuns + LG.HFA_RUNS, 5) // margin carries the home-field edge
  })
})

describe('winProbFromMargin', () => {
  it('a 0 margin is a coin flip', () => { expect(winProbFromMargin(0)).toBeCloseTo(0.5, 2) })
  it('positive margin → home favored (>0.5), negative → underdog (<0.5)', () => {
    expect(winProbFromMargin(1.5)).toBeGreaterThan(0.5)
    expect(winProbFromMargin(-1.5)).toBeLessThan(0.5)
  })
  it('is symmetric around 0.5', () => { expect(winProbFromMargin(2) + winProbFromMargin(-2)).toBeCloseTo(1.0, 5) })
  it('stays in (0,1) for extreme margins', () => {
    expect(winProbFromMargin(10)).toBeLessThan(1)
    expect(winProbFromMargin(10)).toBeGreaterThan(0.9)
    expect(winProbFromMargin(-10)).toBeGreaterThan(0)
  })
  it('a ~1.5 run edge maps to roughly a 62-68% favorite (sanity band)', () => {
    const p = winProbFromMargin(1.5)
    expect(p).toBeGreaterThan(0.60)
    expect(p).toBeLessThan(0.70)
  })
})

describe('coverProb (-1.5 run line)', () => {
  it('a pick-em game: favorite rarely covers -1.5 (<0.5)', () => { expect(coverProb(0)).toBeLessThan(0.5) })
  it('a big home margin: home covers -1.5 more often than not', () => { expect(coverProb(2.5)).toBeGreaterThan(0.5) })
  it('cover prob increases with margin', () => { expect(coverProb(3)).toBeGreaterThan(coverProb(1)) })
  it('home favored by exactly 1.5 → ~50% to cover -1.5', () => { expect(coverProb(1.5)).toBeCloseTo(0.5, 1) })
})

describe('anchorProjection', () => {
  // margin is HOME-perspective: homeRuns - awayRuns. Here away scores more → margin negative.
  const raw = { awayRuns: 5.0, homeRuns: 3.0, total: 8.0, margin: -2.0 } // engine: away by 2

  it('pulls the total toward the market but KEEPS the margin', () => {
    const a = anchorProjection(raw, 6.5) // market says 6.5, much lower
    expect(a.total).toBeGreaterThan(6.5) // blended, not fully market
    expect(a.total).toBeLessThan(8.0)    // pulled down toward market
    expect(a.margin).toBeCloseTo(-2.0, 1) // margin (the ML/RL signal) preserved
    expect(a.awayRuns + a.homeRuns).toBeCloseTo(a.total, 1)
    expect(a.homeRuns - a.awayRuns).toBeCloseTo(a.margin, 1) // margin = home - away
  })

  it('blends with W=0.65 toward market: 8.0 raw on 6.5 market → ~7.025', () => {
    const a = anchorProjection(raw, 6.5)
    expect(a.total).toBeCloseTo(0.65 * 6.5 + 0.35 * 8.0, 1) // 7.025, rounded to 2dp → 7.03
  })

  it('a raw 8.6 projection on a 6.5 market lands ~7.24 (no longer league-avg)', () => {
    const a = anchorProjection({ awayRuns: 4.3, homeRuns: 4.3, total: 8.6, margin: 0 }, 6.5)
    expect(a.total).toBeCloseTo(7.235, 1) // 0.65*6.5 + 0.35*8.6 = 7.235 → 7.24
  })

  it('no market total (null) → returns the raw projection unchanged', () => {
    expect(anchorProjection(raw, null)).toEqual(raw)
  })

  it('non-positive / non-finite market total → returns raw unchanged', () => {
    expect(anchorProjection(raw, 0)).toEqual(raw)
    expect(anchorProjection(raw, -3)).toEqual(raw)
    expect(anchorProjection(raw, NaN)).toEqual(raw)
  })
})

describe('deriveBets', () => {
  const proj = { awayRuns: 5.4, homeRuns: 4.1, total: 9.5, margin: -1.3 } // away favored
  it('Total: projected above the line → OVER with the run edge', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.total.lean).toBe('OVER')
    expect(b.total.edge).toBeCloseTo(1.0, 5)
  })
  it('Total: projected below the line → UNDER', () => {
    expect(deriveBets({ proj, marketTotal: 11.0 }).total.lean).toBe('UNDER')
  })
  it('Total: within the 1-run deadband → LEAN (no pick)', () => {
    expect(deriveBets({ proj, marketTotal: 9.0 }).total.lean).toBe('LEAN')
  })
  it('ML: names the side projected to score more + its win prob', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.ml.pick).toBe('AWAY')
    expect(b.ml.winProb).toBeGreaterThan(0.5)
  })
  it('RL: a thin favorite (1.3 runs) does NOT cover -1.5 → no pick, but coverProb is still reported', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.rl.pick).toBe(null)
    expect(b.rl.coverProb).toBeGreaterThan(0)
    expect(b.rl.coverProb).toBeLessThan(0.52)
  })
  it('RL: a thick favorite clears -1.5 → emits the run-line pick', () => {
    const b = deriveBets({ proj: { awayRuns: 6.0, homeRuns: 3.0, total: 9.0, margin: -3.0 }, marketTotal: 8.5 })
    expect(b.rl.pick).toBe('AWAY -1.5')
    expect(b.rl.coverProb).toBeGreaterThan(0.52)
  })
  it('a true pick-em (margin 0) yields no ML edge side (null pick)', () => {
    const b = deriveBets({ proj: { awayRuns: 4.3, homeRuns: 4.3, total: 8.6, margin: 0 }, marketTotal: 8.5 })
    expect(b.ml.pick).toBeNull()
  })
})
