import { describe, it, expect } from 'vitest'
import {
  scoreHit, pitcherScore, formScore, streakScore, redFlags, coldZone, tierFor, WEIGHTS,
} from '../src/lib/phlt.js'

describe('PHLT v2.2 scorer', () => {
  it('weights sum to 100', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })

  describe('pitcherScore — higher = more beatable', () => {
    it('an ace (low xBA-against, high whiff/K) scores low', () => {
      expect(pitcherScore({ xbaAgainst: 0.205, whiffPct: 31, kPct: 29, era: 2.1 })).toBeLessThan(30)
    })
    it('a batting-practice arm scores high', () => {
      expect(pitcherScore({ xbaAgainst: 0.285, whiffPct: 17, kPct: 15, era: 5.4 })).toBeGreaterThan(80)
    })
    it('degrades gracefully when only ERA is known', () => {
      const s = pitcherScore({ era: 4.0 })
      expect(s).toBeGreaterThan(0); expect(s).toBeLessThanOrEqual(100)
    })
  })

  describe('formScore', () => {
    it('hot bat + strong xBA scores high', () => {
      expect(formScore({ avgLast5: 0.380, xba: 0.310 })).toBeGreaterThan(85)
    })
    it('still scores with no xBA (non-qualified hitter)', () => {
      expect(formScore({ avgLast5: 0.300 })).toBeGreaterThan(50)
    })
  })

  describe('streakScore', () => {
    it('ramps with streak length', () => {
      expect(streakScore(0)).toBeLessThan(streakScore(3))
      expect(streakScore(3)).toBeLessThan(streakScore(8))
      expect(streakScore(12)).toBe(100)
    })
  })

  describe('redFlags / coldZone (the fade inputs)', () => {
    it('Cristopher Sanchez trips all three red flags (real Savant data)', () => {
      expect(redFlags({ kPct: 30.1, whiffPct: 33, xbaAgainst: 0.217 })).toHaveLength(3)
    })
    it('a neutral pitcher trips none', () => {
      expect(redFlags({ kPct: 22, whiffPct: 24, xbaAgainst: 0.250 })).toHaveLength(0)
    })
    it('cold zone catches 0-hits-last-4 and passive BB%', () => {
      expect(coldZone({ hitsLast4: 0 })).toHaveLength(1)
      expect(coldZone({ bbPct: 18 })).toHaveLength(1)
      expect(coldZone({ hitsLast4: 3, bbPct: 9 })).toHaveLength(0)
    })
  })

  describe('tierFor thresholds', () => {
    it('maps scores to A/B/C/Avoid (re-centered 72/62/52)', () => {
      expect(tierFor(75).tier).toBe('A')   // >= 72
      expect(tierFor(66).tier).toBe('B')   // 62-71
      expect(tierFor(55).tier).toBe('C')   // 52-61
      expect(tierFor(45).tier).toBe('AVOID') // < 52
    })
  })

  describe('scoreHit — end to end', () => {
    it('hot hitter vs a beatable arm in a hitter park = high tier, no fade', () => {
      const r = scoreHit({
        hitter: { avgLast5: 0.360, hitStreak: 6, bbPct: 8, hitsLast4: 5, xba: 0.300 },
        pitcher: { kPct: 16, whiffPct: 18, xbaAgainst: 0.282, era: 5.1 },
        matchup: { platoonEdge: 1, xwoba: 0.370 },
        park: { parkFactor: 108, weatherBoost: 0.5 },
      })
      expect(r.faded).toBe(false)
      expect(r.score).toBeGreaterThanOrEqual(75)
      expect(['A', 'B']).toContain(r.tier)
      expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
    })

    it('FADES a hot hitter when facing a Red-Flag pitcher (≥2 flags) regardless of score', () => {
      const r = scoreHit({
        hitter: { avgLast5: 0.350, hitStreak: 7, bbPct: 7, hitsLast4: 6, xba: 0.305 },
        pitcher: { kPct: 30.1, whiffPct: 33, xbaAgainst: 0.217, era: 1.54 }, // Sanchez
        matchup: { platoonEdge: 0 },
        park: { parkFactor: 100 },
      })
      expect(r.faded).toBe(true)
      expect(r.tier).toBe('AVOID')
      expect(r.fades.join(' ')).toMatch(/Red-Flag/)
    })

    it('FADES on Cold Zone (0 hits last 4) even against a weak pitcher', () => {
      const r = scoreHit({
        hitter: { avgLast5: 0.120, hitStreak: 0, bbPct: 6, hitsLast4: 0, xba: 0.230 },
        pitcher: { kPct: 18, whiffPct: 20, xbaAgainst: 0.270, era: 4.8 },
        park: { parkFactor: 105 },
      })
      expect(r.faded).toBe(true)
      expect(r.tier).toBe('AVOID')
      expect(r.fades.join(' ')).toMatch(/Cold Zone/)
    })

    it('an AVERAGE, non-faded hitter is NOT Fade after the re-center (was the all-Fade bug)', () => {
      const r = scoreHit({
        hitter: { avgLast5: 0.250, hitStreak: 0, bbPct: 8, hitsLast4: 2, xba: 0.250 },
        pitcher: { kPct: 22, whiffPct: 24, xbaAgainst: 0.255, era: 4.3 },
        matchup: { platoonEdge: 0, xwoba: 0.320 },
        park: { parkFactor: 100, weatherBoost: 0 },
      })
      expect(r.faded).toBe(false)        // no auto-fade triggered
      expect(r.tier).not.toBe('AVOID')   // average ≠ Fade anymore
      expect(r.score).toBeGreaterThanOrEqual(52) // lands in Caution or better
    })

    it('breakdown is present and each part is 0–100', () => {
      const r = scoreHit({ hitter: { avgLast5: 0.25, hitStreak: 2 }, pitcher: { era: 4 } })
      for (const v of Object.values(r.breakdown)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    })
  })
})
