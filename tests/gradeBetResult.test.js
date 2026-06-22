import { describe, it, expect } from 'vitest'
import { gradeBetResult } from '../src/lib/gradeBetResult'

// A real-ish event: PIT @ MIA, final 5-4 (away 5, home 4).
const finalEvent = (over = {}) => ({
  sport: 'MLB',
  away_abbr: 'PIT',
  home_abbr: 'MIA',
  away_team: 'Pittsburgh Pirates',
  home_team: 'Miami Marlins',
  away_score: 5,
  home_score: 4,
  status: 'FT',
  ...over,
})

describe('gradeBetResult — totals', () => {
  it('over wins when total clears the line', () => {
    expect(gradeBetResult({ pick: 'Over 8.5' }, finalEvent())).toBe('W')
  })
  it('under loses when total clears the line', () => {
    expect(gradeBetResult({ pick: 'Under 8.5' }, finalEvent())).toBe('L')
  })
  it('over loses when total is below the line', () => {
    expect(gradeBetResult({ pick: 'O 9.5' }, finalEvent())).toBe('L')
  })
  it('under wins when total is below the line', () => {
    expect(gradeBetResult({ pick: 'U 9.5' }, finalEvent())).toBe('W')
  })
  it('push on exact total (line 9 vs 5+4=9)', () => {
    expect(gradeBetResult({ pick: 'Over 9' }, finalEvent())).toBe('P')
    expect(gradeBetResult({ pick: 'Under 9' }, finalEvent())).toBe('P')
  })
})

describe('gradeBetResult — moneyline', () => {
  it('picked winner (away, higher score) wins', () => {
    expect(gradeBetResult({ pick: 'PIT ML' }, finalEvent())).toBe('W')
  })
  it('picked loser (home, lower score) loses', () => {
    expect(gradeBetResult({ pick: 'MIA ML' }, finalEvent())).toBe('L')
  })
  it('bare team name maps to moneyline', () => {
    expect(gradeBetResult({ pick: 'Pirates' }, finalEvent())).toBe('W')
  })
  it('tie → push (defensive)', () => {
    expect(gradeBetResult({ pick: 'PIT ML' }, finalEvent({ home_score: 5 }))).toBe('P')
  })
})

describe('gradeBetResult — spread / run-line', () => {
  it('favorite -1.5 covers (5-4 margin 1 → not covered)', () => {
    // PIT -1.5: 5 - 1.5 = 3.5 < 4 → loss
    expect(gradeBetResult({ pick: 'PIT -1.5' }, finalEvent())).toBe('L')
  })
  it('favorite -1.5 covers on a 2-run win', () => {
    // away 6 home 4: 6 - 1.5 = 4.5 > 4 → win
    expect(gradeBetResult({ pick: 'PIT -1.5' }, finalEvent({ away_score: 6 }))).toBe('W')
  })
  it('dog +1.5 covers on a 1-run loss', () => {
    // MIA +1.5: 4 + 1.5 = 5.5 > 5 → win
    expect(gradeBetResult({ pick: 'MIA +1.5' }, finalEvent())).toBe('W')
  })
  it('push on exact integer spread', () => {
    // PIT -1: 5 - 1 = 4 === 4 → push
    expect(gradeBetResult({ pick: 'PIT -1' }, finalEvent())).toBe('P')
  })
})

describe('gradeBetResult — conservative null cases', () => {
  it('not final → null', () => {
    expect(gradeBetResult({ pick: 'Over 8.5' }, finalEvent({ status: 'LIVE' }))).toBeNull()
  })
  it('AOT (final after OT) is gradeable', () => {
    expect(gradeBetResult({ pick: 'PIT ML' }, finalEvent({ status: 'AOT' }))).toBe('W')
  })
  it('missing score → null', () => {
    expect(gradeBetResult({ pick: 'Over 8.5' }, finalEvent({ home_score: null }))).toBeNull()
  })
  it('non-finite score → null', () => {
    expect(gradeBetResult({ pick: 'Over 8.5' }, finalEvent({ away_score: NaN }))).toBeNull()
  })
  it('unparseable pick → null', () => {
    expect(gradeBetResult({ pick: 'banana split' }, finalEvent())).toBeNull()
  })
  it('empty pick → null', () => {
    expect(gradeBetResult({ pick: '' }, finalEvent())).toBeNull()
  })
  it('missing bet/event → null', () => {
    expect(gradeBetResult(null, finalEvent())).toBeNull()
    expect(gradeBetResult({ pick: 'PIT ML' }, null)).toBeNull()
  })
})
