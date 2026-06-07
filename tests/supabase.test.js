/**
 * RML Supabase Helper Tests — betToRow / rowToBet
 * These functions are the bridge between app state and the database.
 * If they break, bets stop saving or loading correctly.
 */

import { describe, it, expect } from 'vitest'
import { betToRow, rowToBet } from '../src/lib/supabase.js'

const TEST_USER = 'test-user-123'

const sampleBet = {
  id: 42,
  date: '2026-06-07',
  sport: 'NFL',
  book: 'DraftKings',
  betType: 'Straight',
  event: 'Chiefs vs Ravens',
  pick: 'Chiefs ML',
  odds: -150,
  units: 2,
  stake: 30,
  result: 'W',
  pnl: 1.8,
  ladder: false,
  ladderId: null,
  pull: false,
  pullNote: null,
  notes: 'sharp money on Chiefs',
}

describe('betToRow', () => {
  it('maps bet fields to DB column names', () => {
    const row = betToRow(sampleBet, TEST_USER)
    expect(row.client_id).toBe('42')
    expect(row.user_id).toBe(TEST_USER)
    expect(row.bet_type).toBe('Straight')
    expect(row.ladder_id).toBeNull()
    expect(row.pull_note).toBeNull()
  })

  it('converts id to string for client_id', () => {
    const row = betToRow({ ...sampleBet, id: 99 }, TEST_USER)
    expect(row.client_id).toBe('99')
    expect(typeof row.client_id).toBe('string')
  })

  it('defaults result to Open when missing', () => {
    const row = betToRow({ ...sampleBet, result: undefined }, TEST_USER)
    expect(row.result).toBe('Open')
  })

  it('defaults betType to Straight when missing', () => {
    const row = betToRow({ ...sampleBet, betType: undefined }, TEST_USER)
    expect(row.bet_type).toBe('Straight')
  })

  it('defaults odds/units/stake/pnl to 0 when missing', () => {
    const row = betToRow({ id: 1, result: 'Open' }, TEST_USER)
    expect(row.odds).toBe(0)
    expect(row.units).toBe(0)
    expect(row.stake).toBe(0)
    expect(row.pnl).toBe(0)
  })

  it('defaults ladder to false when missing', () => {
    const row = betToRow({ id: 1 }, TEST_USER)
    expect(row.ladder).toBe(false)
  })

  it('preserves ladder=true for ladder bets', () => {
    const row = betToRow({ ...sampleBet, ladder: true, ladderId: 3 }, TEST_USER)
    expect(row.ladder).toBe(true)
    expect(row.ladder_id).toBe(3)
  })

  it('includes updated_at as ISO string', () => {
    const row = betToRow(sampleBet, TEST_USER)
    expect(row.updated_at).toBeTruthy()
    expect(() => new Date(row.updated_at)).not.toThrow()
  })

  it('preserves negative odds correctly', () => {
    const row = betToRow({ ...sampleBet, odds: -450 }, TEST_USER)
    expect(row.odds).toBe(-450)
  })
})

describe('rowToBet — round trip', () => {
  it('betToRow → rowToBet preserves core fields', () => {
    const row = betToRow(sampleBet, TEST_USER)
    // Simulate what Supabase returns (adds confidence field, etc.)
    const roundTripped = rowToBet({ ...row, confidence: 3 })
    expect(roundTripped.date).toBe(sampleBet.date)
    expect(roundTripped.sport).toBe(sampleBet.sport)
    expect(roundTripped.odds).toBe(sampleBet.odds)
    expect(roundTripped.units).toBe(sampleBet.units)
    expect(roundTripped.stake).toBe(sampleBet.stake)
    expect(roundTripped.result).toBe(sampleBet.result)
    expect(roundTripped.pnl).toBe(sampleBet.pnl)
    expect(roundTripped.ladder).toBe(sampleBet.ladder)
  })
})
