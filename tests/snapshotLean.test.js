import { describe, it, expect } from 'vitest'
import { buildLeanRows } from '../api/snapshot-lean.js'

const base = {
  external_event_id: 'evt123',
  start_time: '2026-06-22T23:10:00.000Z',
  sport: 'MLB',
  away_team: 'A', home_team: 'B',
  away_abbr: 'AAA', home_abbr: 'BBB',
}

describe('buildLeanRows', () => {
  it('directional total only → 1 total row', () => {
    const rows = buildLeanRows({ ...base, lean: 'OVER', total_line: 8.5 })
    expect(rows).toHaveLength(1)
    expect(rows[0].market).toBe('total')
    expect(rows[0].lean).toBe('OVER')
    expect(rows[0].total_line).toBe(8.5)
  })

  it('total + confident ml → 2 rows', () => {
    const rows = buildLeanRows({ ...base, lean: 'OVER', total_line: 8.5, ml_pick: 'HOME', ml_win_prob: 0.6 })
    expect(rows.map(r => r.market)).toEqual(['total', 'ml'])
  })

  it('total + ml + rl → 3 rows', () => {
    const rows = buildLeanRows({ ...base, lean: 'UNDER', total_line: 7, ml_pick: 'AWAY', ml_win_prob: 0.62, rl_pick: 'HOME -1.5', rl_cover_prob: 0.55 })
    expect(rows.map(r => r.market)).toEqual(['total', 'ml', 'rl'])
  })

  it('ml at 0.54 → ml skipped', () => {
    const rows = buildLeanRows({ ...base, lean: 'OVER', total_line: 8.5, ml_pick: 'HOME', ml_win_prob: 0.54 })
    expect(rows.map(r => r.market)).toEqual(['total'])
  })

  it('rl at 0.49 → rl skipped', () => {
    const rows = buildLeanRows({ ...base, lean: 'OVER', total_line: 8.5, rl_pick: 'HOME -1.5', rl_cover_prob: 0.49 })
    expect(rows.map(r => r.market)).toEqual(['total'])
  })

  it('ml/rl rows set lean === pick_side and total_line === null', () => {
    const rows = buildLeanRows({ ...base, ml_pick: 'AWAY', ml_win_prob: 0.7, rl_pick: 'AWAY +1.5', rl_cover_prob: 0.6 })
    const ml = rows.find(r => r.market === 'ml')
    const rl = rows.find(r => r.market === 'rl')
    expect(ml.lean).toBe('AWAY')
    expect(ml.pick_side).toBe('AWAY')
    expect(ml.win_prob).toBe(0.7)
    expect(ml.total_line).toBeNull()
    expect(rl.lean).toBe('AWAY +1.5')
    expect(rl.pick_side).toBe('AWAY +1.5')
    expect(rl.cover_prob).toBe(0.6)
    expect(rl.total_line).toBeNull()
  })

  it('neutral total (LEAN) + confident ml → 1 ml row, no total row', () => {
    const rows = buildLeanRows({ ...base, lean: 'LEAN', total_line: 8.5, ml_pick: 'HOME', ml_win_prob: 0.6 })
    expect(rows.map(r => r.market)).toEqual(['ml'])
  })

  it('missing external_event_id → []', () => {
    const rows = buildLeanRows({ lean: 'OVER', total_line: 8.5, external_event_id: '' })
    expect(rows).toEqual([])
  })

  it('game_date is the ET date', () => {
    // 2026-06-22T23:10Z → ET (UTC-4) = 19:10 on 2026-06-22
    const rows = buildLeanRows({ ...base, lean: 'OVER', total_line: 8.5 })
    expect(rows[0].game_date).toBe('2026-06-22')
  })

  it('nothing qualifies → []', () => {
    expect(buildLeanRows({ ...base, lean: 'LEAN' })).toEqual([])
  })
})
