// EVENTS PICKER — credit-free entry surface for CH2 (the browsable game page).
// A row of sport circles + today's pre-game slate, pulled from Supabase via
// fetchEvents(sport,'today') (zero Odds-API credits). Tapping a game emits
// onPickGame(<game>) in the EXACT shape the bot's tuneTo()/LookChannel consume
// (mirrors FindChannel's buildGame mapping in MatrixBot.jsx). NOT mounted yet.
import { useState, useEffect } from 'react'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT } from './botShared.jsx'
import { fetchEvents, isLiveEvent } from '../lib/events.js'

// Sports the provider supports today — must match FindChannel's FEED_SPORTS.
const FEED_SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA']

// Game time in the user's local timezone (device tz), not raw UTC.
const localClock = (iso) => {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}

// Map a raw Supabase event row into the tuneTo/LookChannel game shape.
// Mirrors buildGame() in MatrixBot.jsx (~line 193) — DO NOT diverge.
const buildGame = (ev) => ({
  away: ev.away_team,
  home: ev.home_team,
  away_abbr: ev.away_abbr,
  home_abbr: ev.home_abbr,
  sport: ev._sport,
  external_event_id: ev.external_event_id,
  commenceTime: ev.start_time,
})

// Build the visual-only date strip labels: yesterday, Today, +3 days.
// date strip is visual-only for now — real multi-day fetch is a later step
const buildDateStrip = () => {
  const out = []
  const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  for (let off = -1; off <= 3; off++) {
    const d = new Date()
    d.setDate(d.getDate() + off)
    out.push({ off, label: off === 0 ? 'Today' : fmt(d) })
  }
  return out
}

export default function EventsPicker({ sport, onPickSport, onPickGame, token }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const dateStrip = buildDateStrip()

  // Case-insensitive substring filter on away/home name + abbr.
  const q = query.trim().toLowerCase()
  const filtered = !q ? events : events.filter(ev =>
    [ev.away_team, ev.home_team, ev.away_abbr, ev.home_abbr]
      .some(v => v && String(v).toLowerCase().includes(q))
  )

  useEffect(() => {
    let live = true
    setLoading(true)
    fetchEvents(sport, 'today')
      .then(res => {
        if (!live) return
        const rows = (res?.data || [])
          .filter(e => !isLiveEvent(e))           // pre-game only
          .map(e => ({ ...e, _sport: sport }))
        setEvents(rows)
      })
      .catch(() => { if (live) setEvents([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sport])

  return (
    <div style={{ width: '100%', fontFamily: R }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: NEON_T, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Events
      </div>

      {/* Search — filters today's slate by team name/abbr. */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search teams…"
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: '14px',
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: '999px',
          padding: '9px 14px', fontFamily: R, fontSize: '13px', fontWeight: 600,
          color: TEXT, letterSpacing: '0.03em', caretColor: NEON, outline: 'none',
        }}
      />

      {/* Sport circles — horizontal scrollable row. */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {FEED_SPORTS.map(s => {
          const active = s === sport
          return (
            <button
              key={s}
              onClick={() => onPickSport && onPickSport(s)}
              style={{
                flexShrink: 0,
                width: '54px', height: '54px', borderRadius: '50%',
                cursor: 'pointer',
                background: CARD,
                border: `1px solid ${active ? NEON : BORDER}`,
                boxShadow: active ? `0 0 0 2px ${NEON}, 0 0 12px rgba(189,255,0,0.4)` : 'none',
                color: active ? NEON : MUTED,
                fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
              }}
            >
              {s}
            </button>
          )
        })}
      </div>

      {/* Date strip — visual-only for now (real multi-day fetch is a later step). */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {dateStrip.map(d => {
          const active = d.off === 0
          return (
            <span
              key={d.off}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap',
                padding: '6px 13px', borderRadius: '999px',
                fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                background: active ? 'rgba(189,255,0,0.1)' : CARD,
                border: `1px solid ${active ? NEON : BORDER}`,
                color: active ? NEON : MUTED,
              }}
            >{d.label}</span>
          )
        })}
      </div>

      {/* Today slate. */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
        Today
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 12px', fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>
          Loading games…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 12px', fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>
          {events.length === 0 ? 'No games today' : 'No matching games'}
        </div>
      ) : (
        filtered.map((ev, i) => (
          <button
            key={(ev.external_event_id || '') + i}
            onClick={() => onPickGame && onPickGame(buildGame(ev))}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: 'rgba(189,255,0,0.04)',
              border: `1px solid ${BORDER}`, borderRadius: '8px',
              padding: '11px 13px', marginBottom: '8px',
              fontFamily: R,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {ev.away_logo ? <img src={ev.away_logo} alt="" width="22" height="22" style={{ objectFit: 'contain', flexShrink: 0 }} /> : null}
              <span style={{ fontSize: '15px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {(ev.away_abbr || ev.away_team)} <span style={{ color: MUTED }}>@</span> {(ev.home_abbr || ev.home_team)}
              </span>
              {ev.home_logo ? <img src={ev.home_logo} alt="" width="22" height="22" style={{ objectFit: 'contain', flexShrink: 0 }} /> : null}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: NEON_T, letterSpacing: '0.04em', flexShrink: 0 }}>
              {localClock(ev.start_time)}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
