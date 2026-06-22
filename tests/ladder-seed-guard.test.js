/**
 * Ladder rung seeding idempotency guard.
 *
 * Regression test for the duplicate-rung bug: clicking "Start Session" twice
 * (or a re-fire) seeded a second set of 6 rungs into the SAME session key,
 * producing "Rung 1 ×2", "Rung 2 ×3", etc. in the bets table.
 *
 * `canSeedLadder` encodes the exact guard now applied in startSession:
 * only seed when no ladder rows already exist for the target session.
 */

import { describe, it, expect } from 'vitest'
import { canSeedLadder } from '../src/lib/utils.js'

const rung = (session, id) => ({ ladder: true, ladderSession: session, ladderId: id, event: `PHLT Ladder Rung ${id}` })

describe('canSeedLadder — duplicate rung guard', () => {
  it('allows seeding when no rungs exist for the session', () => {
    expect(canSeedLadder([], 'sess-A')).toBe(true)
    expect(canSeedLadder([rung('other', 1)], 'sess-A')).toBe(true)
  })

  it('blocks seeding when the session already has rungs', () => {
    const bets = [1, 2, 3, 4, 5, 6].map(i => rung('sess-A', i))
    expect(canSeedLadder(bets, 'sess-A')).toBe(false)
  })

  it('blocks a second seed even if only one rung is present (partial double-fire)', () => {
    expect(canSeedLadder([rung('sess-A', 1)], 'sess-A')).toBe(false)
  })

  it('ignores non-ladder bets with a colliding session field', () => {
    const bets = [{ ladder: false, ladderSession: 'sess-A', event: 'Knicks vs Nets' }]
    expect(canSeedLadder(bets, 'sess-A')).toBe(true)
  })

  it('refuses to seed without a session key', () => {
    expect(canSeedLadder([], '')).toBe(false)
    expect(canSeedLadder([], null)).toBe(false)
    expect(canSeedLadder([], undefined)).toBe(false)
  })

  it('tolerates a non-array bets argument', () => {
    expect(canSeedLadder(undefined, 'sess-A')).toBe(true)
    expect(canSeedLadder(null, 'sess-A')).toBe(true)
  })
})
