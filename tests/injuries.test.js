import { describe, it, expect } from 'vitest'
import { parseInjuries } from '../api/cron-sync-live.js'

const away = { team: { id: '1' } }
const home = { team: { id: '2' } }

const s = {
  injuries: [
    { team: { id: '2' }, injuries: [
      { athlete: { displayName: 'Kemp Alderman', position: { abbreviation: 'RF' } }, status: 'Day-To-Day', details: { type: 'Elbow', detail: 'Sprain' } },
      { athlete: { displayName: 'Griffin Conine', position: { abbreviation: 'LF' } }, status: '60-Day-IL', details: { type: 'Hamstring', detail: 'Surgery' } },
    ] },
    { team: { id: '1' }, injuries: [
      { athlete: { displayName: 'John Doe', position: { abbreviation: 'P' } }, status: 'Out', shortComment: 'Knee soreness' },
    ] },
  ],
}

describe('parseInjuries', () => {
  it('maps injuries per team with name/pos/status/detail', () => {
    const out = parseInjuries(s, away, home)
    expect(out.away).toEqual([
      { name: 'John Doe', pos: 'P', status: 'Out', detail: 'Knee soreness' },
    ])
    expect(out.home).toEqual([
      { name: 'Kemp Alderman', pos: 'RF', status: 'Day-To-Day', detail: 'Elbow Sprain' },
      { name: 'Griffin Conine', pos: 'LF', status: '60-Day-IL', detail: 'Hamstring Surgery' },
    ])
  })

  it('returns null when no injuries', () => {
    expect(parseInjuries({}, away, home)).toBeNull()
    expect(parseInjuries({ injuries: [] }, away, home)).toBeNull()
  })
})
