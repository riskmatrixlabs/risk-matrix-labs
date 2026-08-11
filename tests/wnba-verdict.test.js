// WNBA verdict lib — built ON the CONFIRMED wnbaProps engine (weights 25/20/20/15/10/10,
// never altered here). Honest-null contract: ANY underivable input → null (no filler verdict).
import { describe, it, expect } from 'vitest'
import { wnbaVerdict, wnbaTier, LEAGUE_REF_PER_MIN } from '../src/lib/wnbaVerdict.js'

// A fully-derivable points prop. Hand-computed below.
const base = {
  market: 'player_points',
  perMinRate: 0.6,        // season pts/min
  last5Minutes: 32,       // avg minutes last 5
  seasonMinutes: 30,
  recentMaxMinutes: 34,
  last5Rate: 0.66,
  seasonRate: 0.6,
  oddsTotal: 165.5,
  oppSpread: -4,
  evPct: 3,
  line: 14.5,
}

describe('wnbaVerdict', () => {
  it('hand-computed score, projection, edge on a full input set', () => {
    // minutes = 32/36 = 0.8889 (stability 32/34 = .941 ≥ .6, no cap)
    // usage   = clamp01(0.6/0.55) = 1
    // matchup = 165.5/170 = 0.97353
    // form    = 0.5 + (0.66-0.6)/(2*0.6) = 0.55
    // script  = 1 - 4/16 = 0.75
    // value   = 0.5 + 3/20 = 0.65
    // score   = .8889*25 + 1*20 + .97353*20 + .55*15 + .75*10 + .65*10 = 83.94
    const v = wnbaVerdict(base)
    expect(v).not.toBeNull()
    expect(v.score).toBe(83.94)
    expect(v.tier).toBe('A')
    expect(v.label).toBe('Prime')
    expect(v.faded).toBe(false)
    expect(v.projection).toBe(19.2)          // 0.6 pts/min × 32 min
    expect(v.edge).toBe(4.7)                 // 19.2 − 14.5
    expect(v.breakdown).toEqual({ minutes: 89, usage: 100, form: 55, matchup: 97, value: 65 })
  })

  it('caps the minutes factor at 0.5 when minutes stability < 0.6', () => {
    const v = wnbaVerdict({ ...base, last5Minutes: 20, recentMaxMinutes: 36 }) // stability .556
    // minutes = min(20/36=.556, .5) = .5 → contribution 12.5 not 13.89
    const uncapped = wnbaVerdict({ ...base, last5Minutes: 20, recentMaxMinutes: 22 })
    expect(v.score).toBeLessThan(uncapped.score)
    expect(v.breakdown.minutes).toBe(50)
  })

  it('each missing/underivable input → null (honest-null, never a filler)', () => {
    expect(wnbaVerdict({ ...base, oddsTotal: null })).toBeNull()
    expect(wnbaVerdict({ ...base, oddsTotal: 0 })).toBeNull()
    expect(wnbaVerdict({ ...base, evPct: null })).toBeNull()
    expect(wnbaVerdict({ ...base, oppSpread: undefined })).toBeNull()
    expect(wnbaVerdict({ ...base, perMinRate: NaN })).toBeNull()
    expect(wnbaVerdict({ ...base, seasonRate: 0 })).toBeNull()      // form division needs a real season rate
    expect(wnbaVerdict({ ...base, last5Rate: null })).toBeNull()
    expect(wnbaVerdict({ ...base, last5Minutes: null })).toBeNull()
    expect(wnbaVerdict({ ...base, recentMaxMinutes: 0 })).toBeNull() // stability undefined
    expect(wnbaVerdict({ ...base, line: null })).toBeNull()
    expect(wnbaVerdict({ ...base, market: 'player_threes' })).toBeNull() // no reference scale → not modeled
    expect(wnbaVerdict({})).toBeNull()
  })

  it('tier mapping bounds: ≥75 A, ≥62 B, ≥50 C, else AVOID', () => {
    expect(wnbaTier(75)).toMatchObject({ tier: 'A', label: 'Prime' })
    expect(wnbaTier(74.99)).toMatchObject({ tier: 'B', label: 'Strong' })
    expect(wnbaTier(62)).toMatchObject({ tier: 'B' })
    expect(wnbaTier(61.99)).toMatchObject({ tier: 'C', label: 'Caution' })
    expect(wnbaTier(50)).toMatchObject({ tier: 'C' })
    expect(wnbaTier(49.99)).toMatchObject({ tier: 'AVOID', label: 'Fade', color: 'red' })
  })

  it('AVOID verdicts are faded', () => {
    const v = wnbaVerdict({ ...base, perMinRate: 0.1, last5Minutes: 10, recentMaxMinutes: 30, last5Rate: 0.05, seasonRate: 0.1, evPct: -8, oppSpread: -15 })
    expect(v.tier).toBe('AVOID')
    expect(v.faded).toBe(true)
  })

  it('reference per-minute table only covers modeled markets', () => {
    expect(LEAGUE_REF_PER_MIN.player_points).toBeGreaterThan(0)
    expect(LEAGUE_REF_PER_MIN.player_rebounds).toBeGreaterThan(0)
    expect(LEAGUE_REF_PER_MIN.player_assists).toBeGreaterThan(0)
  })
})
