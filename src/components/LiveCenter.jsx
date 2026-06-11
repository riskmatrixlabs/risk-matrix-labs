import { useState, useEffect } from 'react'
import { fetchEvents } from '../lib/events'

const NEON   = '#BDFF00'
const NEON_T = 'var(--neon-title)'
const R      = 'Rajdhani, sans-serif'
const MUTED  = 'var(--muted)'
const CARD   = 'var(--card)'
const BORDER = 'var(--border2)'
const TEXT   = 'var(--text)'

const SPORTS = ['MLB', 'NBA', 'NHL', 'NFL']
const DATES  = ['Yesterday', 'Today', 'Upcoming']

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtOdds(val) {
  if (val == null) return '—'
  return val > 0 ? `+${val}` : `${val}`
}

// Team logo circle — shows logo image if available, falls back to abbr
function TeamLogo({ logo, abbr, size = 44 }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={abbr}
        onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: R, fontSize: size * 0.3, fontWeight: 700, color: NEON_T, letterSpacing: '0.04em',
    }}>
      {abbr || '?'}
    </div>
  )
}

// ── Game card — Apple Sports horizontal layout ──────────────────────────────
function GameCard({ event, onClick }) {
  const live  = event.status === 'LIVE' || event.status === 'IP'
  const final = event.status === 'FT'   || event.status === 'AOT'
  const hasScore = event.home_score != null

  const centerLabel = live ? 'LIVE' : final ? 'Final' : fmtTime(event.start_time)
  const centerColor = live ? '#FF3B3B' : final ? MUTED : TEXT

  return (
    <div
      onClick={onClick}
      style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px',
        padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(189,255,0,0.35)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
    >
      {/* Main row: away | center | home */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>

        {/* Away team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TeamLogo logo={event.away_logo} abbr={event.away_abbr} size={40} />
          <div>
            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, letterSpacing: '0.02em' }}>
              {event.away_team}
            </div>
            {event.away_record && (
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{event.away_record}</div>
            )}
          </div>
        </div>

        {/* Center: score or time */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '70px' }}>
          {hasScore ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: TEXT }}>{event.away_score}</span>
              <span style={{ fontFamily: R, fontSize: '11px', color: MUTED }}>–</span>
              <span style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: TEXT }}>{event.home_score}</span>
            </div>
          ) : (
            <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: centerColor, letterSpacing: live ? '0.1em' : '0' }}>
              {live && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 5px #FF3B3B', marginRight: '5px', verticalAlign: 'middle' }} />}
              {centerLabel}
            </span>
          )}
          {/* Spread below time */}
          {event.odds_spread_home != null && !hasScore && (
            <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>
              {event.home_abbr} {event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : event.odds_spread_home}
            </span>
          )}
          {hasScore && (
            <span style={{ fontFamily: R, fontSize: '9px', color: centerColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {centerLabel}
            </span>
          )}
        </div>

        {/* Home team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, letterSpacing: '0.02em' }}>
              {event.home_team}
            </div>
            {event.home_record && (
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{event.home_record}</div>
            )}
          </div>
          <TeamLogo logo={event.home_logo} abbr={event.home_abbr} size={40} />
        </div>
      </div>

      {/* Odds row — compact, only if pre-game */}
      {!hasScore && event.odds_ml_away != null && (
        <div style={{
          marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px',
        }}>
          {[
            { label: event.away_abbr || 'Away', val: `ML ${fmtOdds(event.odds_ml_away)}` },
            { label: 'O/U',                     val: event.odds_total != null ? `${event.odds_total}` : '—' },
            { label: event.home_abbr || 'Home', val: `ML ${fmtOdds(event.odds_ml_home)}` },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
              <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Game detail — full odds table + LOG POSITION ────────────────────────────
function GameDetail({ event, onLogPosition, onBack }) {
  const live  = event.status === 'LIVE' || event.status === 'IP'
  const final = event.status === 'FT'   || event.status === 'AOT'
  const hasScore = event.home_score != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Back */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
        width: 'fit-content',
      }}>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>← BACK</span>
      </button>

      {/* Hero header */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* League + context label */}
        <div style={{
          padding: '12px 16px 0',
          fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em',
          color: MUTED, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {event.league} · {fmtTime(event.start_time)}
        </div>

        {/* Teams */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', gap: '12px', padding: '20px 20px',
        }}>
          {/* Away */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <TeamLogo logo={event.away_logo} abbr={event.away_abbr} size={56} />
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, textAlign: 'center' }}>{event.away_team}</div>
            {event.away_record && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{event.away_record}</div>}
            {hasScore && <div style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, color: TEXT, lineHeight: 1 }}>{event.away_score}</div>}
          </div>

          {/* Center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {live && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: '#FF3B3B' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 5px #FF3B3B', display: 'inline-block' }} />
                LIVE
              </span>
            )}
            {!live && !hasScore && (
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, color: MUTED }}>vs</span>
            )}
            {final && <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Final</span>}
          </div>

          {/* Home */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <TeamLogo logo={event.home_logo} abbr={event.home_abbr} size={56} />
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, textAlign: 'center' }}>{event.home_team}</div>
            {event.home_record && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{event.home_record}</div>}
            {hasScore && <div style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, color: TEXT, lineHeight: 1 }}>{event.home_score}</div>}
          </div>
        </div>
      </div>

      {/* Betting Odds table — Apple Sports style */}
      {event.odds_ml_away != null && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 10px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase' }}>
            Betting Odds
          </div>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
            padding: '6px 16px', borderBottom: `1px solid ${BORDER}`,
          }}>
            {['Team', 'Spread', 'Total', 'Moneyline'].map((h, i) => (
              <span key={h} style={{
                fontFamily: R, fontSize: '9px', fontWeight: 600, color: MUTED,
                textAlign: i === 0 ? 'left' : 'center',
              }}>{h}</span>
            ))}
          </div>
          {/* Away row */}
          {[
            {
              abbr: event.away_abbr,
              spread: event.odds_spread_home != null ? fmtOdds(-event.odds_spread_home) : '—',
              total: event.odds_total != null ? `O${event.odds_total}` : '—',
              ml: fmtOdds(event.odds_ml_away),
            },
            {
              abbr: event.home_abbr,
              spread: event.odds_spread_home != null ? fmtOdds(event.odds_spread_home) : '—',
              total: event.odds_total != null ? `U${event.odds_total}` : '—',
              ml: fmtOdds(event.odds_ml_home),
            },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
              padding: '10px 16px',
              borderBottom: i === 0 ? `1px solid ${BORDER}` : 'none',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
            }}>
              <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: TEXT }}>{row.abbr}</span>
              <span style={{ fontFamily: R, fontSize: '11px', color: NEON_T, textAlign: 'center' }}>{row.spread}</span>
              <span style={{ fontFamily: R, fontSize: '11px', color: NEON_T, textAlign: 'center' }}>{row.total}</span>
              <span style={{ fontFamily: R, fontSize: '11px', color: NEON_T, textAlign: 'center' }}>{row.ml}</span>
            </div>
          ))}
        </div>
      )}

      {/* LOG POSITION */}
      <button
        onClick={() => onLogPosition(event)}
        style={{
          width: '100%', padding: '16px', borderRadius: '8px',
          background: NEON, border: 'none', cursor: 'pointer',
          fontFamily: R, fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.18em', color: '#0A0A0A', textTransform: 'uppercase',
          boxShadow: '0 0 24px rgba(189,255,0,0.35)',
        }}
      >
        LOG POSITION
      </button>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function LiveCenter({ onLogPosition }) {
  const [sport,      setSport]      = useState('MLB')
  const [dateFilter, setDateFilter] = useState('Today')
  const [events,     setEvents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    setLoading(true)
    setSelectedId(null)
    fetchEvents(sport.toLowerCase(), dateFilter.toLowerCase())
      .then(({ data }) => setEvents(data ?? []))
      .finally(() => setLoading(false))
  }, [sport, dateFilter])

  const selected = events.find(e => e.id === selectedId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '80px' }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', color: TEXT }}>LIVE CENTER™</div>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>Game → Position → Settlement</div>
      </div>

      {/* Sport pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
        {SPORTS.map(s => (
          <button key={s} onClick={() => setSport(s)} style={{
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
            padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: sport === s ? NEON : CARD,
            color:      sport === s ? '#0A0A0A' : MUTED,
            boxShadow:  sport === s ? '0 0 12px rgba(189,255,0,0.3)' : 'none',
            transition: 'background 0.15s',
          }}>{s}</button>
        ))}
      </div>

      {/* Date tabs */}
      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {DATES.map((d, i) => (
          <button key={d} onClick={() => setDateFilter(d)} style={{
            flex: 1, padding: '8px', fontFamily: R, fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            background: dateFilter === d ? 'rgba(189,255,0,0.12)' : CARD,
            color:      dateFilter === d ? NEON_T : MUTED,
            borderRight: i < DATES.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}>{d}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
          LOADING SLATE...
        </div>
      ) : selected ? (
        <GameDetail event={selected} onBack={() => setSelectedId(null)} onLogPosition={onLogPosition} />
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
          NO GAMES FOUND
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(e => (
            <GameCard key={e.id} event={e} onClick={() => setSelectedId(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
