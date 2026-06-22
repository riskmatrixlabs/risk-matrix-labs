import { describe, it, expect } from 'vitest'
import { parseTotal, totalProgress } from '../src/lib/statProgress.js'

// Regression: bet titles include the matchup prefix ("PIT@COL Over 11.5"). parseTotal used to be
// anchored (^over 11.5$) and failed on those, so the live total progress bar never rendered.
describe('parseTotal — must read prefixed bet titles', () => {
  it('parses a bare total', () => {
    expect(parseTotal('Over 11.5')).toEqual({ dir: 'over', line: 11.5 })
    expect(parseTotal('Under 6.5')).toEqual({ dir: 'under', line: 6.5 })
  })
  it('parses a total WITH the matchup prefix (the bug)', () => {
    expect(parseTotal('PIT@COL Over 11.5')).toEqual({ dir: 'over', line: 11.5 })
    expect(parseTotal('BOS@SEA Under 6.5')).toEqual({ dir: 'under', line: 6.5 })
  })
  it('returns null for a non-total pick', () => {
    expect(parseTotal('PHI ML')).toBeNull()
    expect(parseTotal('Yankees -1.5')).toBeNull()
  })
})

describe('totalProgress — builds the runs/line bar from the live score', () => {
  it('PIT@COL Over 11.5 with a 8-6 game → current 14, label "14 / 11.5"', () => {
    const bar = totalProgress('PIT@COL Over 11.5', 8, 6, { key: 'won' })
    expect(bar).not.toBeNull()
    expect(bar.current).toBe(14)
    expect(bar.line).toBe(11.5)
    expect(bar.label).toBe('14 / 11.5')
  })
  it('null scores → null (pending, no bar)', () => {
    expect(totalProgress('PIT@COL Over 11.5', null, null)).toBeNull()
  })
})
