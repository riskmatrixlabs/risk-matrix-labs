import { describe, it, expect } from 'vitest'
import { matchBoxPlayer, playerInBox, lastNameInBox } from '../src/lib/matchBoxPlayer.js'

// boxMap keys arrive already accent-stripped + lowercased (parseBox's norm), but STILL carry
// suffixes ("jr.") and hyphens ("kuroda-grauer") — exactly what broke grading. The prop feed
// strips those, so the raw keys never matched. matchBoxPlayer reconciles by normalizing BOTH
// sides harder (drop suffixes + punctuation) and matching the FULL name only — never guessing
// across a shared last name.
describe('matchBoxPlayer — the prop-grading name bug', () => {
  const box = {
    'vladimir guerrero jr.': { hits: 2 },
    'joshua kuroda-grauer':  { hits: 1 },
    'jose ramirez':          { hits: 0 },
    'a.j. pollock':          { hits: 3 },
    'luis garcia':           { hits: 1 },
  }

  it('matches across a Jr./Sr. suffix (Guerrero)', () => {
    expect(matchBoxPlayer('vladimir guerrero', box)).toEqual({ hits: 2 })
  })
  it('matches across a hyphen (Kuroda-Grauer)', () => {
    expect(matchBoxPlayer('joshua kurodagrauer', box)).toEqual({ hits: 1 })
  })
  it('matches across periods (A.J. Pollock)', () => {
    expect(matchBoxPlayer('aj pollock', box)).toEqual({ hits: 3 })
  })
  it('exact full name still works (Jose Ramirez)', () => {
    expect(matchBoxPlayer('jose ramirez', box)).toEqual({ hits: 0 })
  })
  it('returns null for a DNP player not in the box (Tolbert)', () => {
    expect(matchBoxPlayer('tyler tolbert', box)).toBeNull()
  })
  it('does NOT match a different first name sharing a last name (carlos ≠ luis garcia)', () => {
    expect(matchBoxPlayer('carlos garcia', box)).toBeNull()
  })
  it('null-safe on empty/undefined', () => {
    expect(matchBoxPlayer('x', null)).toBeNull()
    expect(matchBoxPlayer('', box)).toBeNull()
    expect(matchBoxPlayer('nobody here', box)).toBeNull()
  })

  it('playerInBox: true when matched, false for a genuine DNP', () => {
    expect(playerInBox('vladimir guerrero', box)).toBe(true)
    expect(playerInBox('tyler tolbert', box)).toBe(false)
  })

  it('lastNameInBox: gates DNP-voiding — absent last name → true DNP; present → matcher gap', () => {
    expect(lastNameInBox('tyler tolbert', box)).toBe(false)   // no "tolbert" anywhere → safe to void
    expect(lastNameInBox('carlos garcia', box)).toBe(true)    // a "garcia" exists → don't void, don't guess
    expect(lastNameInBox('vladimir guerrero', box)).toBe(true)
  })
})
