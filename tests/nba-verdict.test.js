// NBA verdict lib — built ON the CONFIRMED nbaProps engine (weights 20/20/20/10/10/10/10,
// never altered here). Honest-null contract: ANY underivable input → null (no filler verdict).
import { describe, it, expect } from 'vitest'
import { nbaVerdict, nbaTier, LEAGUE_REF_PER_MIN } from '../src/lib/nbaVerdict.js'

// A fully-derivable points prop. Hand-computed below.
const base = {
  market: 'player_points',
  perMinRate: 0.6,        // season pts/min (ref 0.60 → usage = 1)
  last5Minutes: 32,       // avg minutes last 5
  seasonMinutes: 30,
  recentMaxMinutes: 34,   // stability = 32/34 = 0.941
  last5Rate: 0.66,
  seasonRate: 0.6,
  oddsTotal: 224.5,
  oppSpread: -4,          // |4| ≤ 6 → blowoutProb 0 → no minutes shave
  evPct: 3,
  line: 24.5,
  injuryStatus: null,     // not on the synced injuries list
}

describe('nbaVerdict', () => {
  it('hand-computed score, projection, edge on a full input set', () => {
    // blowoutProb = clamp01((|−4| − 6)/14) = 0 → adjMin = adjustedMinutes(32, 0) = 32
    // minutes = 32/36 = 0.888889 (stability .941 ≥ .6, no cap)
    // usage   = clamp01(0.6/0.60) = 1
    // matchup = 224.5/230 = 0.976087
    // pace    = 224.5/240 = 0.935417
    // form    = 0.5 + (0.66−0.6)/(2×0.6) = 0.55
    // injury  = not listed, stability .941 ≥ .8 → 0.7
    // value   = 0.5 + 3/20 = 0.65
    // score   = (0.888889+1+0.976087)×20 + (0.935417+0.55+0.7+0.65)×10 = 85.65
    const v = nbaVerdict(base)
    expect(v).not.toBeNull()
    expect(v.score).toBe(85.65)
    expect(v.tier).toBe('A')
    expect(v.label).toBe('Prime')
    expect(v.faded).toBe(false)
    expect(v.projection).toBe(19.2)          // 0.6 pts/min × 32 adjusted min
    expect(v.edge).toBe(-5.3)                // 19.2 − 24.5
    expect(v.breakdown).toEqual({ minutes: 89, usage: 100, form: 55, pace: 94, value: 65 })
  })

  it('blowout spread shaves minutes AND the projection (adjustedMinutes)', () => {
    // oppSpread −16 → blowoutProb = clamp01((16−6)/14) = 0.714286
    // adjMin = 32 × (1 − 0.714286×0.18) = 27.89
    // minutes = 27.89/36 = 0.774722 → score = (0.774722+1+0.976087)×20 + 28.354167 = 83.37
    const v = nbaVerdict({ ...base, oppSpread: -16 })
    expect(v.score).toBe(83.37)
    expect(v.projection).toBe(16.73)         // 0.6 × 27.89
    expect(v.breakdown.minutes).toBe(77)
    expect(v.score).toBeLessThan(nbaVerdict(base).score)
  })

  it('injury gating: Out/Doubtful → no verdict; Questionable → injuryRole 0.35', () => {
    expect(nbaVerdict({ ...base, injuryStatus: 'out' })).toBeNull()
    expect(nbaVerdict({ ...base, injuryStatus: 'doubtful' })).toBeNull()
    const q = nbaVerdict({ ...base, injuryStatus: 'questionable' })
    // injuryRole drops 0.7 → 0.35 → score drops (0.7−0.35)×10 = 3.5 → 82.15
    expect(q.score).toBe(82.15)
  })

  it('injuryRole from minutes stability when not listed: ≥0.8 → 0.7, ≥0.6 → 0.5, else 0.35', () => {
    // stability 32/34 = .941 → 0.7 (base). 25/34 = .735 → 0.5. Score delta = 2.
    const mid = nbaVerdict({ ...base, last5Minutes: 25 })
    // minutes = 25/36 = .694444 → 20-part shifts too; check via recompute:
    // (0.694444+1+0.976087)×20 + (0.935417+0.55+0.5+0.65)×10 = 53.410628 + 26.354167 = 79.76
    expect(mid.score).toBe(79.76)
    // stability 18/34 = .529 < .6 → injuryRole .35 AND minutes capped at .5
    const low = nbaVerdict({ ...base, last5Minutes: 18 })
    // (0.5+1+0.976087)×20 + (0.935417+0.55+0.35+0.65)×10 = 49.521739 + 24.854167 = 74.38
    expect(low.score).toBe(74.38)
  })

  it('each missing/underivable input → null (honest-null, never a filler)', () => {
    expect(nbaVerdict({ ...base, oddsTotal: null })).toBeNull()
    expect(nbaVerdict({ ...base, oddsTotal: 0 })).toBeNull()
    expect(nbaVerdict({ ...base, evPct: null })).toBeNull()
    expect(nbaVerdict({ ...base, oppSpread: undefined })).toBeNull()
    expect(nbaVerdict({ ...base, perMinRate: NaN })).toBeNull()
    expect(nbaVerdict({ ...base, seasonRate: 0 })).toBeNull()        // form division needs a real season rate
    expect(nbaVerdict({ ...base, last5Rate: null })).toBeNull()
    expect(nbaVerdict({ ...base, last5Minutes: null })).toBeNull()
    expect(nbaVerdict({ ...base, recentMaxMinutes: 0 })).toBeNull()  // stability undefined
    expect(nbaVerdict({ ...base, line: null })).toBeNull()
    expect(nbaVerdict({ ...base, market: 'player_blocks' })).toBeNull() // no reference scale → not modeled
    expect(nbaVerdict({})).toBeNull()
  })

  it('tier mapping bounds: ≥75 A, ≥62 B, ≥50 C, else AVOID', () => {
    expect(nbaTier(75)).toMatchObject({ tier: 'A', label: 'Prime' })
    expect(nbaTier(74.99)).toMatchObject({ tier: 'B', label: 'Strong' })
    expect(nbaTier(62)).toMatchObject({ tier: 'B' })
    expect(nbaTier(61.99)).toMatchObject({ tier: 'C', label: 'Caution' })
    expect(nbaTier(50)).toMatchObject({ tier: 'C' })
    expect(nbaTier(49.99)).toMatchObject({ tier: 'AVOID', label: 'Fade', color: 'red' })
  })

  it('AVOID verdicts are faded', () => {
    const v = nbaVerdict({ ...base, perMinRate: 0.15, last5Minutes: 12, recentMaxMinutes: 34, last5Rate: 0.08, seasonRate: 0.15, evPct: -8, oppSpread: -15 })
    expect(v.tier).toBe('AVOID')
    expect(v.faded).toBe(true)
  })

  it('reference per-minute table only covers modeled markets', () => {
    expect(LEAGUE_REF_PER_MIN.player_points).toBeGreaterThan(0)
    expect(LEAGUE_REF_PER_MIN.player_rebounds).toBeGreaterThan(0)
    expect(LEAGUE_REF_PER_MIN.player_assists).toBeGreaterThan(0)
  })
})
