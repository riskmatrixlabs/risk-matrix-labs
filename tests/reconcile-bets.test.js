import { describe, it, expect } from 'vitest'
import { reconcileBets } from '../src/lib/reconcileBets.js'

const bet = (id, extra = {}) => ({ id, pick: `pick-${id}`, ...extra })

describe('reconcileBets — delete-aware startup merge', () => {
  it('drops a local bet that was deleted elsewhere (tombstoned) instead of resurrecting it', () => {
    // Cloud has A. Local still holds A and B, but B was deleted on another device.
    const cloud = [bet('A')]
    const local = [bet('A'), bet('B')]
    const tombstones = ['B']
    const { bets, orphans } = reconcileBets(cloud, local, tombstones)
    expect(bets.map(b => b.id).sort()).toEqual(['A'])      // B must NOT come back
    expect(orphans.map(b => b.id)).toEqual([])             // and must NOT be re-uploaded
  })

  it('preserves a genuine offline-created local bet that is not tombstoned', () => {
    const cloud = [bet('A')]
    const local = [bet('A'), bet('C')]                     // C logged offline, never deleted
    const { bets, orphans } = reconcileBets(cloud, local, [])
    expect(bets.map(b => b.id).sort()).toEqual(['A', 'C']) // C kept
    expect(orphans.map(b => b.id)).toEqual(['C'])          // and flagged to up-sync
  })

  it('takes cloud as-is when there are no local bets', () => {
    const { bets, orphans } = reconcileBets([bet('A'), bet('B')], [], [])
    expect(bets.map(b => b.id).sort()).toEqual(['A', 'B'])
    expect(orphans).toEqual([])
  })

  it('a tombstoned id that is also present in the cloud still shows (cloud wins)', () => {
    // Edge: bet re-created with same id after a tombstone — cloud is authoritative.
    const cloud = [bet('A'), bet('B')]
    const local = [bet('A'), bet('B')]
    const { bets } = reconcileBets(cloud, local, ['B'])
    expect(bets.map(b => b.id).sort()).toEqual(['A', 'B'])
  })

  it('handles string/number id mismatches between layers', () => {
    const cloud = [bet('1')]
    const local = [bet(1), bet(2)]
    const { bets } = reconcileBets(cloud, local, [2])      // number tombstone, string ids
    expect(bets.map(b => String(b.id)).sort()).toEqual(['1'])
  })
})
