import { useState, useEffect } from 'react'
import { fetchEvents } from '../lib/events'

const NEON   = '#BDFF00'
const NEON_T = 'var(--neon-title)'
const R      = 'Rajdhani, sans-serif'
const MUTED  = 'var(--muted)'
const CARD   = 'var(--card)'
const BORDER = 'var(--border2)'

const SPORTS = ['MLB', 'NBA', 'NHL', 'NFL']
const DATES  = ['Yesterday', 'Today', 'Upcoming']

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function OddsChip({ label, odds }) {
  if (odds == null) return null
  const val = typeof odds === 'number' ? (odds > 0 ? `+${odds}` : `${odds}`) : odds
  return (
    <div style={{
      background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.18)',
      borderRadius: '4px', padding: '3px 8px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '1px',
    }}>
      <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>{val}</span>
    </div>
  )
}

function GameCard({ event, onClick }) {
  const live  = event.status === 'LIVE' || event.status === 'IP'
  const final = event.status === 'FT'   || event.status === 'AOT'
  const noScore = event.home_score == null

  return (
    <div
      onClick={onClick}
      style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px',
        padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(189,255,0,0.35)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
    >
      {/* Status row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,59,59,0.15)', border: '1px solid rgba(255,59,59,0.4)',
              borderRadius: '3px', padding: '2px 6px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 4px #FF3B3B' }} />
              <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: '#FF3B3B' }}>LIVE</span>
            </span>
          )}
          {final && (
            <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>Final</span>
          )}
          {!live && !final && (
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>{fmtTime(event.start_time)}</span>
          )}
        </div>
        <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{event.league}</span>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { name: event.away_team, abbr: event.away_abbr, record: event.away_record, score: event.away_score },
          { name: event.home_team, abbr: event.home_abbr, record: event.home_record, score: event.home_score },
        ].map((team, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>{team.name}</span>
              {team.record && (
                <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{team.record}</span>
              )}
            </div>
            {!noScore && (
              <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{team.score ?? 0}</span>
            )}
          </div>
        ))}
      </div>

      {/* Odds row */}
      {event.odds_ml_away != null && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <OddsChip label={event.away_abbr || 'Away'} odds={event.odds_ml_away} />
          <OddsChip label={event.home_abbr || 'Home'} odds={event.odds_ml_home} />
          {event.odds_total != null && <OddsChip label="O/U" odds={event.odds_total} />}
        </div>
      )}
    </div>
  )
}

function GameDetail({ event, onLogPosition, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
        display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content',
      }}>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>← BACK</span>
      </button>

      {/* Matchup header */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '20px' }}>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase', marginBottom: '14px' }}>
          {event.league} · {fmtTime(event.start_time)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
          {[
            { name: event.away_team, record: event.away_record, score: event.away_score, align: 'flex-start' },
            { name: event.home_team, record: event.home_record, score: event.home_score, align: 'flex-end' },
          ].map((team, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: team.align, gap: '4px' }}>
              <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>{team.name}</span>
              {team.record && <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{team.record}</span>}
              {team.score != null && <span style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: NEON_T }}>{team.score}</span>}
            </div>
          ))}
          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: MUTED, textAlign: 'center' }}>vs</div>
        </div>
      </div>

      {/* Odds */}
      {event.odds_ml_away != null && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase', marginBottom: '12px' }}>Main Lines</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <OddsChip label={`${event.away_abbr || 'Away'} ML`} odds={event.odds_ml_away} />
            <OddsChip label={`${event.home_abbr || 'Home'} ML`} odds={event.odds_ml_home} />
            {event.odds_spread_home != null && (
              <OddsChip
                label={`${event.home_abbr || 'Home'} Spread`}
                odds={event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : event.odds_spread_home}
              />
            )}
            {event.odds_total != null && <OddsChip label="O/U" odds={event.odds_total} />}
          </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text)' }}>LIVE CENTER™</div>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>Game → Position → Settlement</div>
      </div>

      {/* Sport pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
        {SPORTS.map(s => (
          <button key={s} onClick={() => setSport(s)} style={{
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
            padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: sport === s ? NEON : CARD,
            color:      sport === s ? '#0A0A0A' : MUTED,
            boxShadow:  sport === s ? '0 0 12px rgba(189,255,0,0.3)' : 'none',
            transition: 'background 0.15s',
          }}>{s}</button>
        ))}
      </div>

      {/* Date filter */}
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
        <div style={{ textAlign: 'center', padding: '40px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
          LOADING SLATE...
        </div>
      ) : selected ? (
        <GameDetail event={selected} onBack={() => setSelectedId(null)} onLogPosition={onLogPosition} />
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
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
