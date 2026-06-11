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

import { fetchEvents, fetchEvent } from '../src/lib/events'

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
