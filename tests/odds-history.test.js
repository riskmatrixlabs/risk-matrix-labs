import { describe, it, expect, vi } from 'vitest'

const rows = vi.hoisted(() => [
  { market: 'ml', side: 'home', value: -135, captured_at: '2026-06-12T14:00:00Z' },
  { market: 'ml', side: 'home', value: -155, captured_at: '2026-06-12T15:00:00Z' },
  { market: 'ml', side: 'away', value: 115,  captured_at: '2026-06-12T14:00:00Z' },
  { market: 'total', side: null, value: 8.5, captured_at: '2026-06-12T14:00:00Z' },
  { market: 'total', side: null, value: 9.0, captured_at: '2026-06-12T15:00:00Z' },
])

vi.mock('../src/lib/supabase', () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
  return { supabase: chain }
})

import { computeMovement, fetchLineMovement } from '../src/lib/oddsHistory.js'

describe('computeMovement', () => {
  it('open/current/delta from chronological snapshots', () => {
    expect(computeMovement([
      { value: -135, captured_at: '2026-06-12T14:00:00Z' },
      { value: -155, captured_at: '2026-06-12T15:00:00Z' },
    ])).toEqual({ open: -135, current: -155, delta: -20, points: 2 })
  })
  it('sorts unordered input by captured_at', () => {
    expect(computeMovement([
      { value: -155, captured_at: '2026-06-12T15:00:00Z' },
      { value: -135, captured_at: '2026-06-12T14:00:00Z' },
    ])).toEqual({ open: -135, current: -155, delta: -20, points: 2 })
  })
  it('single snapshot → delta 0', () => {
    expect(computeMovement([{ value: 8.5, captured_at: '2026-06-12T14:00:00Z' }])).toEqual({ open: 8.5, current: 8.5, delta: 0, points: 1 })
  })
  it('empty → null', () => { expect(computeMovement([])).toBeNull() })
})

describe('fetchLineMovement', () => {
  it('groups by market+side and returns movement per key', async () => {
    const m = await fetchLineMovement('401')
    expect(m.ml_home).toEqual({ open: -135, current: -155, delta: -20, points: 2 })
    expect(m.ml_away).toEqual({ open: 115, current: 115, delta: 0, points: 1 })
    expect(m.total).toEqual({ open: 8.5, current: 9.0, delta: 0.5, points: 2 })
  })
})
