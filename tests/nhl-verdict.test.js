// NHL SOG verdict lib — built ON the CONFIRMED nhlSog engine (weights 25/20/15/15/15/10,
// never altered here). Honest-null contract: ANY underivable input → null (no filler verdict).
import { describe, it, expect } from 'vitest'
import { nhlVerdict, nhlTier, parseToi } from '../src/lib/nhlVerdict.js'

// A fully-derivable shots-on-goal prop. Hand-computed below.
const base = {
  market: 'player_shots_on_goal',
  sogPerGame: 3.2,          // season SOG/game
  seasonToiMinutes: 18,     // season avg TOI (minutes)
  last5ToiMinutes: 19.8,    // last-5 avg TOI (minutes)
  last5SogPerGame: 3.6,
  oppSogAllowedPerGame: 32, // opponent SOG allowed per game (real field, when it exists)
  evPct: 4,
  line: 2.5,
}

describe('parseToi', () => {
  it('parses MM:SS ice time defensively', () => {
    expect(parseToi('18:42')).toBe(18.7)
    expect(parseToi('20:00')).toBe(20)
    expect(parseToi('9:30')).toBe(9.5)
  })
  it('accepts plain numeric strings/numbers', () => {
    expect(parseToi('18.5')).toBe(18.5)
    expect(parseToi(21)).toBe(21)
    expect(parseToi('18')).toBe(18)
  })
  it('garbage/missing → null, never NaN', () => {
    expect(parseToi('')).toBeNull()
    expect(parseToi(null)).toBeNull()
    expect(parseToi(undefined)).toBeNull()
    expect(parseToi('--')).toBeNull()
    expect(parseToi('DNP')).toBeNull()
    expect(parseToi('18:xx')).toBeNull()
  })
})

describe('nhlVerdict', () => {
  it('hand-computed score, projection, edge on a full input set', () => {
    // volume  = 3.2/4 = 0.8
    // toi     = 19.8/22 = 0.9
    // role    = clamp01(3.2/3.5)×0.5 + 0.25 = 0.9142857×0.5+0.25 = 0.7071429 (documented proxy)
    // matchup = 0.5 + (32−30)/20 = 0.6
    // recent  = 0.5 + (3.6−3.2)/(2×3.2) = 0.5625
    // value   = 0.5 + 4/20 = 0.7
    // score   = .8×25 + .9×20 + .7071429×15 + .6×15 + .5625×15 + .7×10 = 73.04
    const v = nhlVerdict(base)
    expect(v).not.toBeNull()
    expect(v.score).toBe(73.04)
    expect(v.tier).toBe('B')
    expect(v.label).toBe('Strong')
    expect(v.faded).toBe(false)
    expect(v.projection).toBe(3.52)          // (3.2/18) SOG/min × 19.8 projected TOI
    expect(v.edge).toBe(1.02)                // 3.52 − 2.5
    expect(v.breakdown).toEqual({ volume: 80, toi: 90, role: 71, matchup: 60, value: 70 })
  })

  it('non-SOG NHL markets → null (market not modeled)', () => {
    expect(nhlVerdict({ ...base, market: 'player_points' })).toBeNull()
    expect(nhlVerdict({ ...base, market: 'player_goals' })).toBeNull()
    expect(nhlVerdict({ ...base, market: 'player_total_saves' })).toBeNull()
  })

  it('each missing/underivable input → null (honest-null, never a filler)', () => {
    expect(nhlVerdict({ ...base, sogPerGame: null })).toBeNull()
    expect(nhlVerdict({ ...base, sogPerGame: 0 })).toBeNull()        // recent-form division needs a real season rate
    expect(nhlVerdict({ ...base, seasonToiMinutes: null })).toBeNull()
    expect(nhlVerdict({ ...base, seasonToiMinutes: 0 })).toBeNull()  // SOG/min division
    expect(nhlVerdict({ ...base, last5ToiMinutes: null })).toBeNull()
    expect(nhlVerdict({ ...base, last5SogPerGame: undefined })).toBeNull()
    expect(nhlVerdict({ ...base, oppSogAllowedPerGame: null })).toBeNull()
    expect(nhlVerdict({ ...base, evPct: NaN })).toBeNull()
    expect(nhlVerdict({ ...base, line: null })).toBeNull()
    expect(nhlVerdict({})).toBeNull()
  })

  it('clamps: elite volume caps at 1, dead matchup floors at 0', () => {
    const hot = nhlVerdict({ ...base, sogPerGame: 6, last5SogPerGame: 6 })
    expect(hot.breakdown.volume).toBe(100)
    expect(hot.breakdown.role).toBe(75)      // proxy ceiling: clamp01(6/3.5)=1 → 1×0.5+0.25 = 0.75
    const cold = nhlVerdict({ ...base, oppSogAllowedPerGame: 18 })
    expect(cold.breakdown.matchup).toBe(0)   // 0.5 + (18−30)/20 = −0.1 → clamp 0
  })

  it('AVOID verdicts are faded', () => {
    const v = nhlVerdict({ ...base, sogPerGame: 1, last5SogPerGame: 0.6, last5ToiMinutes: 10, oppSogAllowedPerGame: 24, evPct: -8 })
    expect(v.tier).toBe('AVOID')
    expect(v.faded).toBe(true)
  })

  it('tier mapping bounds: ≥75 A, ≥62 B, ≥50 C, else AVOID', () => {
    expect(nhlTier(75)).toMatchObject({ tier: 'A', label: 'Prime' })
    expect(nhlTier(74.99)).toMatchObject({ tier: 'B', label: 'Strong' })
    expect(nhlTier(62)).toMatchObject({ tier: 'B' })
    expect(nhlTier(61.99)).toMatchObject({ tier: 'C', label: 'Caution' })
    expect(nhlTier(50)).toMatchObject({ tier: 'C' })
    expect(nhlTier(49.99)).toMatchObject({ tier: 'AVOID', label: 'Fade', color: 'red' })
  })
})
