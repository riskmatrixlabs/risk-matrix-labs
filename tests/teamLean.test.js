import { describe, it, expect } from 'vitest'
import { teamLeanLines } from '../src/lib/teamLean.js'

describe('teamLeanLines', () => {
  it('returns [] when bets is null/undefined', () => {
    expect(teamLeanLines(null, 'PHI', 'NYM')).toEqual([])
    expect(teamLeanLines(undefined, 'PHI', 'NYM')).toEqual([])
  })

  it('shows ML when winProb >= 0.55 (HOME → homeAbbr)', () => {
    const bets = { ml: { pick: 'HOME', winProb: 0.612 }, rl: { pick: null } }
    const out = teamLeanLines(bets, 'PHI', 'NYM')
    expect(out).toMatchObject([{ market: 'ML', prob: 0.612, label: 'NYM ML 61%' }])
  })

  it('shows ML for AWAY → awayAbbr', () => {
    const bets = { ml: { pick: 'AWAY', winProb: 0.58 } }
    const out = teamLeanLines(bets, 'PHI', 'NYM')
    expect(out).toMatchObject([{ market: 'ML', prob: 0.58, label: 'PHI ML 58%' }])
  })

  it('hides ML when winProb < 0.55', () => {
    const bets = { ml: { pick: 'HOME', winProb: 0.54 } }
    expect(teamLeanLines(bets, 'PHI', 'NYM')).toEqual([])
  })

  it('shows ML at exactly 0.55 boundary', () => {
    const bets = { ml: { pick: 'AWAY', winProb: 0.55 } }
    expect(teamLeanLines(bets, 'PHI', 'NYM')).toMatchObject([
      { market: 'ML', prob: 0.55, label: 'PHI ML 55%' },
    ])
  })

  it('hides ML when pick is null', () => {
    const bets = { ml: { pick: null, winProb: 0.7 } }
    expect(teamLeanLines(bets, 'PHI', 'NYM')).toEqual([])
  })

  it('shows RL when coverProb >= 0.50, parsing the leading word', () => {
    const bets = { rl: { pick: 'AWAY -1.5', coverProb: 0.48 } }
    expect(teamLeanLines(bets, 'PHI', 'NYM')).toEqual([])
    const bets2 = { rl: { pick: 'AWAY -1.5', coverProb: 0.5 } }
    expect(teamLeanLines(bets2, 'PHI', 'NYM')).toMatchObject([
      { market: 'RL', prob: 0.5, label: 'PHI -1.5 50%' },
    ])
  })

  it('RL HOME leading word → homeAbbr', () => {
    const bets = { rl: { pick: 'HOME -1.5', coverProb: 0.523 } }
    expect(teamLeanLines(bets, 'PHI', 'NYM')).toMatchObject([
      { market: 'RL', prob: 0.523, label: 'NYM -1.5 52%' },
    ])
  })

  it('returns both ML and RL when both qualify', () => {
    const bets = {
      ml: { pick: 'HOME', winProb: 0.61 },
      rl: { pick: 'HOME -1.5', coverProb: 0.55 },
    }
    const out = teamLeanLines(bets, 'PHI', 'NYM')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ market: 'ML', prob: 0.61, label: 'NYM ML 61%' })
    expect(out[1]).toMatchObject({ market: 'RL', prob: 0.55, label: 'NYM -1.5 55%' })
  })

  it('falls back to the pick word when abbr missing', () => {
    const bets = { ml: { pick: 'HOME', winProb: 0.6 } }
    expect(teamLeanLines(bets, undefined, undefined)).toMatchObject([
      { market: 'ML', prob: 0.6, label: 'HOME ML 60%' },
    ])
  })

  it('rounds probabilities with Math.round (0.612 → 61%, 0.615 → 62%)', () => {
    expect(teamLeanLines({ ml: { pick: 'AWAY', winProb: 0.615 } }, 'PHI', 'NYM')[0].label).toBe('PHI ML 62%')
  })
})
