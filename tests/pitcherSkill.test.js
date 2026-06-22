import { describe, it, expect } from 'vitest'
import { pitcherSkillDelta } from '../api/_lib/pitcherSkill.js'

describe('pitcherSkillDelta', () => {
  it('two swing-miss arms (high CSW + high K-BB) → negative delta (under), CSW reason', () => {
    const r = pitcherSkillDelta({ awayCsw: 33, homeCsw: 32, awayKbb: 22, homeKbb: 21 })
    expect(r.delta).toBeLessThan(0)
    expect(r.delta).toBeGreaterThanOrEqual(-0.7) // capped
    expect(r.reason).toBe('two swing-miss arms (CSW)')
  })

  it('two contact arms (low CSW + low K-BB) → positive delta (over)', () => {
    const r = pitcherSkillDelta({ awayCsw: 24, homeCsw: 25, awayKbb: 6, homeKbb: 5 })
    expect(r.delta).toBeGreaterThan(0)
    expect(r.delta).toBeLessThanOrEqual(0.7) // capped
    expect(r.reason).toBe('two contact arms')
  })

  it('missing all data → delta 0, null reason', () => {
    expect(pitcherSkillDelta({})).toEqual({ delta: 0, reason: null })
    expect(pitcherSkillDelta()).toEqual({ delta: 0, reason: null })
  })

  it('partial data (one side missing) → that metric sits out, no crash', () => {
    const r = pitcherSkillDelta({ awayCsw: 33, homeCsw: null, awayKbb: 22, homeKbb: 21 })
    // CSW pair incomplete → only K-BB drives; still under-leaning
    expect(r.delta).toBeLessThan(0)
    expect(r.reason).toBe('two strikeout arms (K-BB)')
  })

  it('league-average arms → neutral (delta ~0, null reason)', () => {
    const r = pitcherSkillDelta({ awayCsw: 28.5, homeCsw: 28.5, awayKbb: 13.5, homeKbb: 13.5 })
    expect(Math.abs(r.delta)).toBeLessThan(0.12)
    expect(r.reason).toBeNull()
  })

  it('delta is capped at ±0.7 for extreme inputs', () => {
    const elite = pitcherSkillDelta({ awayCsw: 40, homeCsw: 40, awayKbb: 40, homeKbb: 40 })
    expect(elite.delta).toBe(-0.7)
    const awful = pitcherSkillDelta({ awayCsw: 15, homeCsw: 15, awayKbb: -5, homeKbb: -5 })
    expect(awful.delta).toBe(0.7)
  })
})
