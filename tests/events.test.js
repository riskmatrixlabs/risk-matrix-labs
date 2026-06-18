import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    from:   vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lte:    vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
  }
  return { supabase: chain }
})

import { fetchEvents, fetchEvent, isLiveEvent } from '../src/lib/events'

describe('isLiveEvent', () => {
  const now = Date.parse('2026-06-13T20:00:00Z')
  it('is live when IP and started recently', () => {
    expect(isLiveEvent({ status: 'IP', start_time: '2026-06-13T19:00:00Z' }, now)).toBe(true)
  })
  it('is NOT live when IP but started over 30h ago (stale status row)', () => {
    // 30h window keeps resumed/suspended games "live"; beyond that a stuck IP row is treated as stale.
    expect(isLiveEvent({ status: 'IP', start_time: '2026-06-11T20:00:00Z' }, now)).toBe(false)
  })
  it('is still live when IP and started within the 30h window (resumed/suspended games)', () => {
    expect(isLiveEvent({ status: 'IP', start_time: '2026-06-12T20:00:00Z' }, now)).toBe(true)
  })
  it('is not live for finished/scheduled status', () => {
    expect(isLiveEvent({ status: 'FT', start_time: '2026-06-13T19:00:00Z' }, now)).toBe(false)
    expect(isLiveEvent({ status: 'NS', start_time: '2026-06-13T19:00:00Z' }, now)).toBe(false)
  })
})

describe('fetchEvents', () => {
  it('returns empty array for unknown sport', async () => {
    const result = await fetchEvents('cricket', 'today')
    expect(result).toEqual({ data: [], error: null })
  })

  it('returns empty array when sport is undefined', async () => {
    const result = await fetchEvents(undefined, 'today')
    expect(result).toEqual({ data: [], error: null })
  })
})

describe('fetchEvent', () => {
  it('calls single() for a given id', async () => {
    const result = await fetchEvent('abc-123')
    expect(result.data).toEqual({ id: '1' })
  })
})
