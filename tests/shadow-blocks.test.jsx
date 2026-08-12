import { describe, it, expect } from 'vitest'
import { shadowBlocks } from '../src/components/LiveCenter.jsx'

// The sport-aware read of the ONE /api/game-info response the card flag already fetches.
describe('shadowBlocks', () => {
  it('WNBA reads j.wnbaTotal, incl. the ml side call when present', () => {
    const j = { wnbaTotal: { lean: 'OVER', line: 162.5, proj: 168, edgePoints: 5.5, ml: { pick: 'HOME', winProb: 0.61 } } }
    const { total, ml } = shadowBlocks(j, 'WNBA')
    expect(total.lean).toBe('OVER')
    expect(total.line).toBe(162.5)
    expect(ml).toEqual({ pick: 'HOME', winProb: 0.61 })
  })
  it('NHL reads j.nhlTotal', () => {
    const j = { nhlTotal: { lean: 'UNDER', line: 6.5, proj: 5.4, edgeGoals: -1.1 } }
    const { total, ml } = shadowBlocks(j, 'NHL')
    expect(total.lean).toBe('UNDER')
    expect(ml).toBeNull() // no ml block → honest null, no chip
  })
  it('NFL reads j.nfl.total for the O/U and j.nfl for the side call', () => {
    const j = { nfl: { lean: 'AWAY', score: 71, tier: 'STRONG', total: { lean: 'UNDER', line: 44.5, proj: 40.2, edgePoints: -4.3 } } }
    const { total, ml } = shadowBlocks(j, 'NFL')
    expect(total).toMatchObject({ lean: 'UNDER', line: 44.5 })
    expect(ml).toEqual({ pick: 'AWAY', score: 71, tier: 'STRONG' })
  })
  it('honest null — a block with lean null yields no total', () => {
    expect(shadowBlocks({ wnbaTotal: { lean: null, shadow: true } }, 'WNBA').total).toBeNull()
    expect(shadowBlocks({ nhlTotal: { lean: null } }, 'NHL').total).toBeNull()
    expect(shadowBlocks({ nfl: { lean: null, total: null } }, 'NFL')).toEqual({ total: null, ml: null })
  })
  it('an ml block without a pick is not a call', () => {
    expect(shadowBlocks({ nhlTotal: { lean: 'OVER', ml: {} } }, 'NHL').ml).toBeNull()
  })
  it('MLB and unknown sports get nothing here (MLB has its own template flag)', () => {
    expect(shadowBlocks({ ou: { lean: 'OVER' } }, 'MLB')).toEqual({ total: null, ml: null })
    expect(shadowBlocks({}, 'NBA')).toEqual({ total: null, ml: null })
    expect(shadowBlocks(null, 'NHL')).toEqual({ total: null, ml: null })
  })
})
