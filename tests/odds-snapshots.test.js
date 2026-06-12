import { describe, it, expect } from 'vitest'
import { buildOddsSnapshots } from '../api/cron-sync-live.js'

const TS = '2026-06-12T20:00:00.000Z'

describe('buildOddsSnapshots', () => {
  it('emits one row per non-null odds field', () => {
    const rows = [{
      external_event_id: '401', sport: 'MLB',
      odds_ml_home: -135, odds_ml_away: 115,
      odds_spread_home: -1.5, odds_spread_away: 1.5, odds_total: 8.5,
    }]
    const out = buildOddsSnapshots(rows, TS)
    expect(out).toEqual([
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'ml',     side: 'home', value: -135, captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'ml',     side: 'away', value: 115,  captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'spread', side: 'home', value: -1.5, captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'spread', side: 'away', value: 1.5,  captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'total',  side: null,   value: 8.5,  captured_at: TS },
    ])
  })

  it('skips null/undefined odds and rows with no odds', () => {
    const rows = [
      { external_event_id: '402', sport: 'NBA', odds_ml_home: null, odds_ml_away: null, odds_spread_home: null, odds_total: null },
      { external_event_id: '403', sport: 'NBA', odds_ml_home: -110 },
    ]
    const out = buildOddsSnapshots(rows, TS)
    expect(out).toEqual([
      { external_event_id: '403', provider: 'espn', sport: 'NBA', market: 'ml', side: 'home', value: -110, captured_at: TS },
    ])
  })
})
