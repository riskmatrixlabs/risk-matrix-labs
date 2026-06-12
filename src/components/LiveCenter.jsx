import { useState, useEffect } from 'react'
import { fetchEvents, fetchLiveEvents } from '../lib/events'
import { devigTwoWay, americanToDecimal } from '../lib/devig'
import { computeClv } from '../lib/clv'
import { matchBetToEvent, evaluateBet } from '../lib/betMatch'
import { fetchLineMovement } from '../lib/oddsHistory'

const NEON   = '#BDFF00'
const NEON_T = 'var(--neon-title)'
const R      = 'Rajdhani, sans-serif'
const MUTED  = 'var(--muted)'
const CARD   = 'var(--card)'
const BORDER = 'var(--border2)'
const TEXT   = 'var(--text)'

// Sport pills in display order. "All" (default) + "Live" (only when games are in progress)
// are prepended dynamically in the component.
const SPORTS = ['MLB', 'WNBA', 'NHL', 'NBA', 'NFL']

const SPREAD_LABEL = { MLB: 'Run Line', NHL: 'Puck Line', NBA: 'Spread', WNBA: 'Spread', NFL: 'Spread' }
const DATES  = ['Yesterday', 'Today', 'Upcoming']

// Sport-specific detail tabs. Context-layer tabs (Value/Trends/Injuries) only appear
// when there's data for them — no dead empty tabs.
function getDetailTabs(event, meta, live, final) {
  const sport = event.sport
  const hasOdds = event.odds_ml_home != null || event.odds_spread_home != null || event.odds_total != null
  const statTabs = sport === 'MLB' ? ['Box Score']
    : sport === 'NHL' ? ['Goalies', 'Skaters']
    : (sport === 'NBA' || sport === 'WNBA') ? ['Box Score']
    : []
  const hasInsights = hasOdds || meta.trends || meta.injuries || meta.weather || meta.away_team_stats || meta.home_team_stats
  return [
    hasInsights && 'Insights',
    ...statTabs,
    'Play by Play',
    'Standings',
  ].filter(Boolean)
}

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

// ── Form tab — last 5 games per team ────────────────────────────────────────
function FormTab({ awayAbbr, homeAbbr, awayL5, homeL5 }) {
  const [side, setSide] = useState('away')
  const rows = side === 'away' ? awayL5 : homeL5
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {[{ k: 'away', label: awayAbbr }, { k: 'home', label: homeAbbr }].map((t, i) => (
          <button key={t.k} onClick={() => setSide(t.k)} style={{
            flex: 1, padding: '9px', fontFamily: R, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            background: side === t.k ? 'rgba(189,255,0,0.1)' : 'transparent',
            color: side === t.k ? NEON_T : MUTED,
            borderRight: i === 0 ? `1px solid ${BORDER}` : 'none',
            borderBottom: side === t.k ? `2px solid ${NEON}` : '2px solid transparent',
          }}>{t.label} Last 5</button>
        ))}
      </div>
      {!rows.length ? (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.12em' }}>NO DATA</div>
      ) : rows.map((g, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 60px', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: g.result === 'W' ? 'rgba(189,255,0,0.15)' : 'rgba(255,59,59,0.12)',
            border: `1px solid ${g.result === 'W' ? 'rgba(189,255,0,0.35)' : 'rgba(255,59,59,0.3)'}`,
          }}>
            <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: g.result === 'W' ? NEON : '#FF3B3B' }}>{g.result}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{g.score}</span>
              {g.opponent && <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED }}>{g.atVs === '@' ? '@' : 'vs'} {g.opponent}</span>}
            </div>
            <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{g.date ? new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Game card — Apple Sports horizontal layout ──────────────────────────────
function GameCard({ event, onClick, showSport = false }) {
  const live  = event.status === 'LIVE' || event.status === 'IP'
  const final = event.status === 'FT'   || event.status === 'AOT'
  const isOT  = event.status === 'AOT'
  const hasScore = event.home_score != null

  const centerLabel = live ? 'LIVE' : final ? (isOT ? 'Final/OT' : 'Final') : fmtTime(event.start_time)
  const centerColor = live ? '#FF3B3B' : final ? MUTED : TEXT

  const awayWin = hasScore && final && event.away_score > event.home_score
  const homeWin = hasScore && final && event.home_score > event.away_score
  const awayLead = hasScore && live && event.away_score > event.home_score
  const homeLead = hasScore && live && event.home_score > event.away_score

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
      {/* League tag — shown on the mixed-sport "All" slate so each card is identifiable */}
      {showSport && event.sport && (
        <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase', marginBottom: '8px' }}>{event.sport}</div>
      )}
      {/* Event subtitle — series/round name (e.g. "Stanley Cup Final · Game 5", "Commissioner's Cup") */}
      {(event.metadata?.event_note || event.metadata?.series_summary) && (() => {
        const raw = event.metadata.event_note || event.metadata.series_summary
        const clean = raw.replace(new RegExp(`^${event.league}\\s*`, 'i'), '').replace(/\s*-\s*/g, ' · ').trim()
        return (
          <div style={{ textAlign: 'center', marginBottom: '10px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {clean}
          </div>
        )
      })()}
      {/* Main row */}
      {live && hasScore && event.sport === 'MLB' ? (() => {
        // Live MLB: [Logo · Name · Score] [Bases · Inning] [Score · Name · Logo]
        const sit = event.metadata?.situation
        const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
        const half = sit?.inningHalf?.toLowerCase() === 'bottom' ? '▼' : '▲'
        const inningLabel = sit?.inning ? `${half} ${ordinal(sit.inning)}` : '● LIVE'
        const bases = [sit?.onFirst, sit?.onSecond, sit?.onThird]
        const B = 11
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
            {/* Away: logo · abbr/record · score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <TeamLogo logo={event.away_logo} abbr={event.away_abbr} size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{event.away_abbr}</div>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED }}>{event.away_record}</div>
              </div>
              <span style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: awayLead ? TEXT : MUTED, opacity: homeLead ? 0.7 : 1, flexShrink: 0 }}>{event.away_score}</span>
            </div>
            {/* Center: bases diamond + inning */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '0 8px' }}>
              <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '0px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', background: bases[1] ? NEON : 'transparent', border: `1.5px solid ${bases[1] ? NEON : 'rgba(189,255,0,0.35)'}` }} />
                <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '50%', left: '1px', transform: 'translateY(-50%) rotate(45deg)', background: bases[2] ? NEON : 'transparent', border: `1.5px solid ${bases[2] ? NEON : 'rgba(189,255,0,0.35)'}` }} />
                <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '50%', right: '1px', transform: 'translateY(-50%) rotate(45deg)', background: bases[0] ? NEON : 'transparent', border: `1.5px solid ${bases[0] ? NEON : 'rgba(189,255,0,0.35)'}` }} />
                <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: '1px', bottom: '1px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', background: 'transparent', border: '1.5px solid rgba(189,255,0,0.18)' }} />
              </div>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: '#FF3B3B', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{inningLabel}</span>
            </div>
            {/* Home: score · abbr/record · logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end', minWidth: 0 }}>
              <span style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: homeLead ? TEXT : MUTED, opacity: awayLead ? 0.7 : 1, flexShrink: 0 }}>{event.home_score}</span>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{event.home_abbr}</div>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED }}>{event.home_record}</div>
              </div>
              <TeamLogo logo={event.home_logo} abbr={event.home_abbr} size={40} />
            </div>
          </div>
        )
      })() : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
          {/* Away team */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <TeamLogo logo={event.away_logo} abbr={event.away_abbr} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{event.away_abbr || event.away_team}</div>
              <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{event.away_record || event.away_team}</div>
            </div>
          </div>
          {/* Center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '76px' }}>
            {hasScore ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '24px', fontWeight: 700, color: (awayWin || awayLead) ? TEXT : MUTED, opacity: (homeWin || homeLead) ? 0.7 : 1 }}>{event.away_score}</span>
                <span style={{ fontFamily: R, fontSize: '12px', color: MUTED }}>–</span>
                <span style={{ fontFamily: R, fontSize: '24px', fontWeight: 700, color: (homeWin || homeLead) ? TEXT : MUTED, opacity: (awayWin || awayLead) ? 0.7 : 1 }}>{event.home_score}</span>
              </div>
            ) : (
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: centerColor, letterSpacing: live ? '0.08em' : '0', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {live && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 5px #FF3B3B', flexShrink: 0 }} />}
                {centerLabel}
              </span>
            )}
            {event.odds_spread_home != null && !hasScore && (
              <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, whiteSpace: 'nowrap' }}>
                <span style={{ color: MUTED }}>{event.home_abbr} </span>
                <span style={{ fontWeight: 700, color: NEON_T }}>{event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : event.odds_spread_home}</span>
              </span>
            )}
            {hasScore && (
              <span style={{ fontFamily: R, fontSize: '10px', color: centerColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{centerLabel}</span>
            )}
            {live && hasScore && event.sport !== 'MLB' && event.metadata?.situation?.period && event.metadata?.situation?.clock && (() => {
              const sit = event.metadata.situation
              const regP = event.sport === 'NHL' ? 3 : 4
              const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
              const lbl = sit.period <= regP ? ord(sit.period) : (sit.period === regP + 1 ? 'OT' : `${sit.period - regP}OT`)
              return <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{lbl} · {sit.clock}</span>
            })()}
          </div>
          {/* Home team */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end', minWidth: 0 }}>
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{event.home_abbr || event.home_team}</div>
              <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px', direction: 'rtl', textAlign: 'right' }}>{event.home_record || event.home_team}</div>
            </div>
            <TeamLogo logo={event.home_logo} abbr={event.home_abbr} size={40} />
          </div>
        </div>
      )}

      {/* Live situation row — MLB uses center column, this is only for other sports + MLB outs/count sub-row */}
      {live && event.metadata?.situation && (() => {
        const sit = event.metadata.situation
        // MLB — show outs + count below the card (inning + bases already in center column)
        if (event.sport === 'MLB' && hasScore) {
          const outsLabel = sit.outs != null ? `${sit.outs} Out${sit.outs !== 1 ? 's' : ''}` : null
          const countLabel = sit.balls != null && sit.strikes != null ? `${sit.balls}-${sit.strikes}` : null
          if (!outsLabel && !countLabel) return null
          return (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {outsLabel && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em' }}>{outsLabel}</span>}
              {countLabel && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em' }}>{countLabel}</span>}
            </div>
          )
        }
        // NHL / NBA / WNBA period+clock now render under LIVE in the center column
        return null
      })()}

      {/* Odds row */}
      {!hasScore && event.odds_ml_away != null && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
          {[
            { label: event.away_abbr || 'Away', val: `ML ${fmtOdds(event.odds_ml_away)}` },
            { label: 'O/U',                     val: event.odds_total != null ? `${event.odds_total}` : '—' },
            { label: event.home_abbr || 'Home', val: `ML ${fmtOdds(event.odds_ml_home)}` },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Probable pitcher matchup */}
      {event.metadata?.away_pitcher && event.metadata?.home_pitcher && !hasScore && (
        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: TEXT }}>{event.metadata.away_pitcher.name}</span>
          <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>vs</span>
          <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: TEXT }}>{event.metadata.home_pitcher.name}</span>
        </div>
      )}
    </div>
  )
}

// ── Collapsible at-bat card ───────────────────────────────────────────────────
function AtBatCard({ ab, awayAbbr, homeAbbr, resultColor, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ background: ab.scoring ? 'rgba(189,255,0,0.04)' : CARD, border: `1px solid ${ab.scoring ? 'rgba(189,255,0,0.3)' : BORDER}`, borderLeft: `3px solid ${ab.scoring ? NEON : 'transparent'}`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Header — always visible, click to toggle */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {ab.teamAbbr && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em' }}>{ab.teamAbbr}:</span>}
          <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ab.batter ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {ab.result && (
            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: resultColor(ab.result), background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 6px' }}>
              {ab.result}
            </span>
          )}
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </div>
      </div>

      {open && (
        <>
          {ab.resultText && (
            <div style={{ padding: '0 14px 10px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: ab.scoring ? TEXT : MUTED, lineHeight: 1.45 }}>
              {ab.resultText}
            </div>
          )}
          {ab.scoring && ab.awayScore != null && (
            <div style={{ padding: '0 14px 10px', fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON }}>
              {awayAbbr} {ab.awayScore} – {homeAbbr} {ab.homeScore}
            </div>
          )}
          {ab.pitches.length > 0 && (
            <div style={{ borderTop: `1px solid ${BORDER}` }}>
              {ab.pitches.map((pitch, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderBottom: j < ab.pitches.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{pitch.n}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{pitch.type ?? pitch.pitchType ?? '—'}</span>
                  </div>
                  {pitch.balls != null && pitch.strikes != null && (
                    <span style={{ fontFamily: R, fontSize: '11px', color: MUTED }}>{pitch.balls}-{pitch.strikes}</span>
                  )}
                  {pitch.vel != null && pitch.pitchType && (
                    <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, whiteSpace: 'nowrap' }}>{pitch.vel} mph {pitch.pitchType}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── MLB Play-by-play — at-bat cards with pitch sequences ─────────────────────
function MLBPlays({ plays, awayAbbr, homeAbbr, sit }) {
  const [filter, setFilter] = useState('all') // 'all' | 'scoring'

  // Group consecutive pitches into at-bats by atBatId, preserving order
  const atBats = []
  const seen = {}
  for (const p of plays) {
    const key = p.atBatId ?? `solo-${atBats.length}`
    if (!seen[key]) {
      seen[key] = { pitches: [], result: null, batter: p.batter, teamAbbr: p.teamAbbr, scoring: false, awayScore: null, homeScore: null }
      atBats.push(seen[key])
    }
    const ab = seen[key]
    if (p.batter && !ab.batter) ab.batter = p.batter
    if (p.teamAbbr && !ab.teamAbbr) ab.teamAbbr = p.teamAbbr
    if (p.scoring) { ab.scoring = true; ab.awayScore = p.awayScore; ab.homeScore = p.homeScore; ab.resultText = p.text }
    // Last non-null text with a play type is the result
    if (p.playType && p.playType !== 'At Bat' && !p.playType.startsWith('End')) {
      ab.result = p.playType
      if (!ab.scoring) ab.resultText = p.text
    }
    if (p.pitchType || p.pitchVelocity) {
      ab.pitches.push({ n: ab.pitches.length + 1, type: p.playType, pitchType: p.pitchType, vel: p.pitchVelocity, balls: p.balls, strikes: p.strikes })
    }
  }

  const visible = filter === 'scoring' ? atBats.filter(a => a.scoring) : atBats

  // Current pitcher from situation
  const currentPitcher = sit?.pitcher
  const currentBatter  = sit?.batter

  const resultColor = (result) => {
    if (!result) return MUTED
    const r = result.toLowerCase()
    if (r.includes('home run') || r.includes('hit') || r.includes('single') || r.includes('double') || r.includes('triple')) return NEON_T
    if (r.includes('out') || r.includes('strikeout') || r.includes('struck')) return '#FF3B3B'
    return TEXT
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* All Plays / Scoring Plays toggle */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
        {[{ k: 'all', label: 'All Plays' }, { k: 'scoring', label: 'Scoring Plays' }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{
            flex: 1, padding: '8px', fontFamily: R, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            borderRadius: '6px',
            background: filter === t.k ? CARD : 'transparent',
            color: filter === t.k ? TEXT : MUTED,
            boxShadow: filter === t.k ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Current pitcher / batter */}
      {(currentPitcher || currentBatter) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}>
          {currentPitcher && <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>P: {currentPitcher}</span>}
          {currentBatter  && <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>AB: {currentBatter}</span>}
        </div>
      )}

      {/* At-bat cards — collapsible dropdowns */}
      {!visible.length ? (
        <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.12em' }}>NO PLAYS</div>
      ) : visible.map((ab, i) => <AtBatCard key={i} ab={ab} awayAbbr={awayAbbr} homeAbbr={homeAbbr} resultColor={resultColor} defaultOpen={i === 0} />)}
    </div>
  )
}

// ── Collapsible hitter row ────────────────────────────────────────────────────
function HitterRow({ p }) {
  const [open, setOpen] = useState(false)
  const summary = [p.h != null && p.ab != null ? `${p.h}-${p.ab}` : null, p.hr > 0 ? `${p.hr} HR` : null, p.rbi > 0 ? `${p.rbi} RBI` : null].filter(Boolean).join(', ')
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', cursor: 'pointer', userSelect: 'none' }}>
        <div>
          <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{p.name}</span>
          {p.pos && <span style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginLeft: '6px', letterSpacing: '0.08em' }}>{p.pos}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {summary && <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: p.h > 0 ? NEON_T : MUTED }}>{summary}</span>}
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', borderTop: `1px solid ${BORDER}`, background: BORDER }}>
          {[{ l: 'AB', v: p.ab }, { l: 'H', v: p.h }, { l: 'R', v: p.r }, { l: 'RBI', v: p.rbi }, { l: 'HR', v: p.hr }, { l: 'BB', v: p.bb }, { l: 'K', v: p.k }, { l: 'AVG', v: p.avg }].map(({ l, v }) => (
            <div key={l} style={{ background: '#0A0A0A', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: '4px' }}>{l}</div>
              <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: l === 'H' && v > 0 ? NEON_T : TEXT }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Collapsible pitcher row ───────────────────────────────────────────────────
function PitcherRow({ p }) {
  const [open, setOpen] = useState(false)
  const summary = [p.ip != null ? `${p.ip} IP` : null, p.k != null ? `${p.k} K` : null, p.er != null ? `${p.er} ER` : null].filter(Boolean).join(' · ')
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{p.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {summary && <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: MUTED }}>{summary}</span>}
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', borderTop: `1px solid ${BORDER}`, background: BORDER }}>
          {[{ l: 'IP', v: p.ip }, { l: 'H', v: p.h }, { l: 'R', v: p.r }, { l: 'ER', v: p.er }, { l: 'BB', v: p.bb }, { l: 'K', v: p.k }, { l: 'PC', v: p.pc_st }, { l: 'ERA', v: p.era }].map(({ l, v }) => (
            <div key={l} style={{ background: '#0A0A0A', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: '4px' }}>{l}</div>
              <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: l === 'K' && v > 0 ? NEON_T : TEXT }}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Team stats — always-visible comparison section (not a tab), Apple Sports style ──
const TEAM_STAT_ROWS = {
  MLB: [
    ['Hits', 'hits'], ['Home Runs', 'homeRuns'], ['Strikeouts', 'strikeouts'], ['Walks', 'walks'],
    ['Extra Base Hits', 'extraBaseHits'], ['Total Bases', 'totalBases'], ['Left on Base', 'lob'],
    ['Stolen Bases', 'stolenBases'], ['Double Plays', 'doublePlays'], ['Errors', 'errors'],
  ],
  NHL: [
    ['Shots on Goal', 'sog'], ['Hits', 'hits'], ['Face-Off %', 'faceoffPct'],
    ['Power Play Opportunities', 'ppOpp'], ['Power Play Goals', 'ppGoals'],
    ['Short Handed Goals', 'shGoals'], ['Penalties', 'penalties'], ['Penalty Minutes', 'pim'],
  ],
  NBA: [
    ['Field Goal %', 'fgPct'], ['Free Throw %', 'ftPct'], ['Three Point %', 'tpPct'],
    ['Assists', 'assists'], ['Rebounds', 'rebounds'], ['Defensive Rebounds', 'defReb'], ['Offensive Rebounds', 'offReb'],
    ['Steals', 'steals'], ['Blocks', 'blocks'], ['Fouls', 'fouls'], ['Turnovers', 'turnovers'],
    ['Points Off Turnovers', 'pointsOffTO'], ['Points in the Paint', 'pointsInPaint'], ['Largest Lead', 'largestLead'],
  ],
}
TEAM_STAT_ROWS.WNBA = TEAM_STAT_ROWS.NBA

function TeamStats({ sport, awayAbbr, homeAbbr, aStats, hStats }) {
  const [open, setOpen] = useState(true)
  const statRows = (TEAM_STAT_ROWS[sport] ?? [])
    .map(([label, key]) => ({ label, a: aStats?.[key], h: hStats?.[key] }))
    .filter(r => r.a != null || r.h != null)
  if (!statRows.length) return null
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: open ? `1px solid ${BORDER}` : 'none', background: 'rgba(189,255,0,0.03)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{awayAbbr}</span>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right' }}>Team Stats</span>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><path d="M4 6L8 10L12 6" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT, textAlign: 'right' }}>{homeAbbr}</span>
      </button>
      {open && statRows.map(({ label, a, h }, i) => {
        const av = a ?? 0; const hv = h ?? 0; const total = av + hv || 1
        return (
          <div key={label} style={{ padding: '12px 16px', borderBottom: i < statRows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '7px' }}>
              <span style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: TEXT }}>{av}</span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', minWidth: '100px' }}>{label}</span>
              <span style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: TEXT, textAlign: 'right' }}>{hv}</span>
            </div>
            <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${(av / total) * 100}%`, background: '#FF3B3B', transition: 'width 0.4s ease' }} />
              <div style={{ width: `${(hv / total) * 100}%`, background: NEON, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Trends — record splits (overall/home/road), streak, recent form. Collapsible (default open). ──
function Trends({ awayAbbr, homeAbbr, trends }) {
  const [open, setOpen] = useState(true)
  if (!trends?.away && !trends?.home) return null
  const a = trends.away ?? {}, h = trends.home ?? {}
  const rows = [
    ['Record', a.overall, h.overall],
    ['Home',   a.home,    h.home],
    ['Away',   a.road,    h.road],
    ['Streak', a.streak,  h.streak],
  ].filter(([, av, hv]) => av != null || hv != null)
  const formPips = (form) => (form ?? []).slice(-5).map((r, i) => (
    <span key={i} style={{ display: 'inline-block', width: 14, height: 14, lineHeight: '14px', textAlign: 'center', borderRadius: '50%', fontFamily: R, fontSize: '8px', fontWeight: 700, marginLeft: i ? 3 : 0, color: r === 'W' ? '#0A0A0A' : '#fff', background: r === 'W' ? NEON : '#FF3B3B' }}>{r}</span>
  ))
  const hasForm = a.form?.length || h.form?.length
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: open ? `1px solid ${BORDER}` : 'none', background: 'rgba(189,255,0,0.03)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{awayAbbr}</span>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'right' }}>Trends</span>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M4 6L8 10L12 6" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT, textAlign: 'right' }}>{homeAbbr}</span>
      </button>
      {open && (
        <>
          {rows.map(([label, av, hv], i) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '10px 16px', borderBottom: (i < rows.length - 1 || hasForm) ? `1px solid ${BORDER}` : 'none' }}>
              <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{av ?? '—'}</span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', minWidth: '70px' }}>{label}</span>
              <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, textAlign: 'right' }}>{hv ?? '—'}</span>
            </div>
          ))}
          {hasForm && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '10px 16px' }}>
              <span style={{ textAlign: 'left' }}>{formPips(a.form)}</span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', minWidth: '70px' }}>Last 5</span>
              <span style={{ textAlign: 'right' }}>{formPips(h.form)}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Injuries — per-team list (collapsible, default open). ──
function Injuries({ awayAbbr, homeAbbr, injuries }) {
  const [open, setOpen] = useState(true)
  const a = injuries?.away ?? [], h = injuries?.home ?? []
  if (!a.length && !h.length) return null
  const statusColor = (s) => {
    const t = (s || '').toLowerCase()
    if (t.includes('out') || t.includes('il')) return '#FF3B3B'
    if (t.includes('day')) return NEON_T
    return MUTED
  }
  const teamBlock = (abbr, list) => (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', padding: '8px 16px 4px' }}>{abbr}</div>
      {list.length === 0
        ? <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: MUTED, padding: '4px 16px 8px' }}>No reported injuries</div>
        : list.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', padding: '6px 16px' }}>
            <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{p.name}{p.pos ? <span style={{ color: MUTED, fontWeight: 500 }}> {p.pos}</span> : ''}</span>
            <span style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: statusColor(p.status) }}>{p.status}</span>
              {p.detail && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: MUTED }}> · {p.detail}</span>}
            </span>
          </div>
        ))}
    </div>
  )
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: open ? `1px solid ${BORDER}` : 'none', background: 'rgba(189,255,0,0.03)', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Injury Report</span>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M4 6L8 10L12 6" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div>
          {teamBlock(awayAbbr, a)}
          <div style={{ borderTop: `1px solid ${BORDER}` }}>{teamBlock(homeAbbr, h)}</div>
        </div>
      )}
    </div>
  )
}

// ── Sparkline — normalizes a numeric series into a flat polyline (line-movement trend). ──
function Sparkline({ series, color }) {
  if (!series || series.length < 2) return null
  const min = Math.min(...series), max = Math.max(...series)
  const range = max - min || 1
  const w = 120, h = 28, pad = 3
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '26px', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Plain-English explanations for every Insights term — surfaced via the tap-ⓘ.
const GLOSSARY = {
  winProb:  "Each side's real chance to win — the sportsbook's odds with their built-in profit margin stripped out. The honest read on who's better.",
  fairValue:"The fair price — what the odds would be if the book took no cut (“no-vig”). Compare it to what you're actually being asked to pay. HOLD is the book's margin on that market.",
  lineMove: "How the price has moved since it opened. When a line drifts steadily one way, money is piling in on that side — the market is getting more confident.",
  clvOpen:  "If you'd taken the OPENING price, how much better it was than now. Beating the closing line (green) is the #1 predictor of a winning bettor.",
  yourBet:  "Your logged bet on this game, graded. Win Prob = its true chance. +EV = is the price worth it. CLV = did you beat the closing line.",
  ev:       "Is this bet worth it? Compares your price to the fair price. Green = you're getting paid fairly or better; red = you overpaid (a −EV bet bleeds money long-term even when it wins).",
  clv:      "Did you beat the closing line? Green = you locked a better number than where the market ended up. Pros track this above win/loss.",
}

// Tap-to-explain label: renders the (already-styled) label + a ⓘ that toggles a
// plain-English caption underneath. Stops click-through so it works inside tappable cards.
function InfoLabel({ label, tip }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {label}
        {tip && (
          <button
            type="button"
            aria-label="What does this mean?"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ width: '15px', height: '15px', flexShrink: 0, borderRadius: '50%', border: `1px solid ${open ? NEON_T : MUTED}`, background: open ? 'rgba(189,255,0,0.12)' : 'transparent', color: open ? NEON_T : MUTED, fontSize: '10px', fontWeight: 700, lineHeight: 1, fontFamily: 'Georgia, serif', fontStyle: 'italic', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >i</button>
        )}
      </span>
      {open && tip && (
        <div style={{ marginTop: '7px', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{tip}</div>
      )}
    </div>
  )
}

// ── Win Probability split — both teams' no-vig implied %, all three markets. ──
// markets: [{ label, aLabel, bLabel, pA, pB }] — pA/pB are 0–1 fair probabilities.
function WinProbability({ markets }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ marginBottom: '12px' }}>
        <InfoLabel tip={GLOSSARY.winProb} label={
          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>Win Probability <span style={{ color: 'rgba(255,255,255,0.3)' }}>· true chance to win</span></span>
        } />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {markets.map((m, i) => {
          const a = Math.round(m.pA * 100), b = Math.round(m.pB * 100)
          return (
            <div key={i}>
              {m.label && <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', marginBottom: '5px' }}>{m.label}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: a >= b ? NEON_T : TEXT }}>{m.aLabel} {a}%</span>
                <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: b > a ? NEON_T : TEXT }}>{b}% {m.bLabel}</span>
              </div>
              <div style={{ display: 'flex', height: '7px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${a}%`, background: a >= b ? NEON : 'rgba(255,255,255,0.3)' }} />
                <div style={{ width: `${b}%`, background: b > a ? NEON : 'rgba(255,255,255,0.3)' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Your Bet — links a logged bet to this game: your price vs no-vig fair (EV) + CLV. ──
// graded: array of evaluateBet() results. The free Pikkit-PRO card, pinned atop Insights.
function PersonalBet({ graded }) {
  const fmtAm = (v) => v == null ? '—' : (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)
  const resultColor = (r) => r === 'W' ? NEON_T : r === 'L' ? '#FF3B3B' : MUTED
  return (
    <div style={{ background: CARD, border: `1px solid rgba(189,255,0,0.35)`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <InfoLabel tip={GLOSSARY.yourBet} label={
          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEON_T }}>Your Bet</span>
        } />
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>Position ↔ Edge</span>
      </div>
      {graded.map((g, i) => {
        const evPos = g.evPct != null && g.evPct >= 0
        const clvPos = g.clvPct != null && g.clvPct >= 0
        const stat = (label, val, color, tip) => (
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <InfoLabel tip={tip} label={<span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>} />
            </div>
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color }}>{val}</div>
          </div>
        )
        return (
          <div key={i} style={{ padding: '12px 14px', borderBottom: i < graded.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.01em' }}>{g.pick}</span>
              <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: NEON_T }}>{fmtAm(g.yourAmerican)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '11px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 600, color: MUTED }}>
                {g.book || 'Your book'}{g.fairAmerican != null && <> · fair <span style={{ color: TEXT, fontWeight: 700 }}>{fmtAm(g.fairAmerican)}</span></>}
              </span>
              {g.result && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: resultColor(g.result) }}>{g.result === 'Open' ? 'Open' : g.result}</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {stat('Win Prob', g.fairProb != null ? `${Math.round(g.fairProb * 100)}%` : '—', TEXT, GLOSSARY.winProb)}
              {stat('+EV', g.evPct != null ? `${evPos ? '+' : ''}${g.evPct.toFixed(1)}%` : '—', g.evPct == null ? MUTED : evPos ? NEON_T : '#FF3B3B', GLOSSARY.ev)}
              {stat('CLV', g.clvPct != null ? `${clvPos ? '+' : ''}${g.clvPct.toFixed(1)}%` : '—', g.clvPct == null ? MUTED : clvPos ? NEON_T : '#FF3B3B', GLOSSARY.clv)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Starting pitcher line — shown under each team's score in the hero ─────────
// ── Probable Pitchers matchup — outlined box in the hero (shows on all tabs). ──
function PitcherMatchup({ away, home, awayAbbr, homeAbbr }) {
  if (!away?.name && !home?.name) return null
  const hand = (t) => { const s = String(t || '').toUpperCase(); return s.startsWith('R') ? 'RHP' : s.startsWith('L') ? 'LHP' : null }
  const col = (p, abbr) => (
    <div style={{ padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}>{abbr}</div>
      <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, marginTop: '3px' }}>
        {p?.name ?? 'TBD'}{hand(p?.throws) && <span style={{ color: NEON_T, fontSize: '12px', fontWeight: 700 }}> {hand(p.throws)}</span>}
      </div>
      {p?.name && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
          {[['ERA', p.era], ['REC', p.record], ['K', p.strikeouts]].filter(([, v]) => v != null && v !== '').map(([l, v]) => (
            <div key={l}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED }}>{l}</div>
              <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div style={{ margin: '0 16px 16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.04)', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, textAlign: 'center' }}>Probable Pitchers</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {col(away, awayAbbr)}
        <div style={{ borderLeft: `1px solid ${BORDER}` }}>{col(home, homeAbbr)}</div>
      </div>
    </div>
  )
}

// ── Game info — Coverage / Venue / Location, shown under Team Stats ───────────
function GameInfo({ broadcast, venue, venueCity, series }) {
  const items = [broadcast, venue, venueCity, series].filter(Boolean)
  if (!items.length) return null
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '11px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      {items.map((value, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>·</span>}
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: TEXT, whiteSpace: 'nowrap' }}>{value}</span>
        </span>
      ))}
    </div>
  )
}

// ── Poll one live game's fresh data on-demand while its detail is open ────────
function useLiveGame(propEvent) {
  const [evt, setEvt] = useState(propEvent)
  // Reset when the user switches to a different game
  useEffect(() => { setEvt(propEvent) }, [propEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const isLive = propEvent?.status === 'IP' || propEvent?.status === 'LIVE'
    if (!isLive || !propEvent?.external_event_id || !propEvent?.sport) return
    let cancelled = false
    const tick = async () => {
      try {
        const r = await fetch(`/api/live-game?id=${encodeURIComponent(propEvent.external_event_id)}&sport=${encodeURIComponent(propEvent.sport)}`)
        if (!r.ok) return
        const d = await r.json()
        if (cancelled || !d || d.notFound || d.error) return
        setEvt(prev => ({
          ...prev,
          status:     d.status     ?? prev.status,
          home_score: d.home_score ?? prev.home_score,
          away_score: d.away_score ?? prev.away_score,
          metadata:   { ...(prev.metadata ?? {}), ...(d.metadata ?? {}) },
        }))
      } catch { /* network blip — keep last good data */ }
    }
    tick()
    const iv = setInterval(tick, 25000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [propEvent?.external_event_id, propEvent?.status, propEvent?.sport])
  return evt
}

// ── Game detail — full-screen overlay ──────────────────────────────────────
function GameDetail({ event: propEvent, onLogPosition, onBack, bets = [] }) {
  const event = useLiveGame(propEvent)
  const live     = event.status === 'LIVE' || event.status === 'IP'
  const final    = event.status === 'FT'   || event.status === 'AOT'
  const isOT     = event.status === 'AOT'
  const hasScore = event.home_score != null
  const awayWin  = hasScore && final && event.away_score > event.home_score
  const homeWin  = hasScore && final && event.home_score > event.away_score
  const awayLead = hasScore && live  && event.away_score > event.home_score
  const homeLead = hasScore && live  && event.home_score > event.away_score

  const meta       = event.metadata || {}
  const tabs = getDetailTabs(event, meta, live, final)
  const [dtab, setDtab] = useState(tabs[0] ?? 'Odds')
  const [hitTeam,     setHitTeam]     = useState('away')
  const [pitchTeam,   setPitchTeam]   = useState('away')
  const [skatersTeam, setSkatersTeam] = useState('away')
  const [movement,    setMovement]    = useState({})

  // If the active tab disappears (data loaded/changed the tab set), fall back to the first tab.
  useEffect(() => { if (!tabs.includes(dtab)) setDtab(tabs[0] ?? 'Odds') }, [tabs, dtab])

  useEffect(() => {
    if (!event.external_event_id) return
    let cancelled = false
    fetchLineMovement(event.external_event_id).then(m => { if (!cancelled) setMovement(m || {}) })
    return () => { cancelled = true }
  }, [event.external_event_id])

  const awayPitch  = meta.away_pitcher  || null
  const homePitch  = meta.home_pitcher  || null
  const awayHit    = meta.away_hitting  || []
  const homeHit    = meta.home_hitting  || []
  const awayPitch2 = meta.away_pitching || []
  const homePitch2 = meta.home_pitching || []

  function EmptyState({ label }) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontFamily: R, fontSize: '9px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em' }}>NO DATA AVAILABLE</div>
      </div>
    )
  }

  // ── MLB Linescore ──────────────────────────────────────────────────────────
  const Linescore = () => {
    if (event.sport !== 'MLB' || (!live && !final) || !meta.linescore) return null
    const { away, home, currentInning } = meta.linescore
    const innings = Math.max(away.innings?.length ?? 0, home.innings?.length ?? 0, 9)
    const cols = Array.from({ length: innings }, (_, i) => i + 1)
    const cell  = (highlight, bold) => ({ fontFamily: R, fontSize: '12px', fontWeight: bold ? 700 : 500, color: highlight ? NEON : TEXT, textAlign: 'center', minWidth: '24px', padding: '5px 2px' })
    const hdr   = (active) => ({ fontFamily: R, fontSize: '10px', fontWeight: 700, color: active ? NEON : MUTED, textAlign: 'center', minWidth: '24px', padding: '4px 2px', letterSpacing: '0.06em' })
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: 'fit-content', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '2px' }}>
            <div style={{ width: '40px' }} />
            {cols.map(n => <div key={n} style={hdr(live && n === currentInning)}>{n}</div>)}
            <div style={{ width: '10px' }} />
            {['R','H','E'].map(l => <div key={l} style={{ ...hdr(l==='R'), minWidth: '28px' }}>{l}</div>)}
          </div>
          {[{ abbr: event.away_abbr, line: away }, { abbr: event.home_abbr, line: home }].map((t, ri) => (
            <div key={t.abbr} style={{ display: 'flex', alignItems: 'center', paddingTop: '4px', paddingBottom: ri === 0 ? '4px' : '0', borderBottom: ri === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: '40px', fontFamily: R, fontSize: '11px', fontWeight: 700, color: TEXT }}>{t.abbr}</div>
              {cols.map((n, i) => <div key={n} style={cell(false, false)}>{t.line.innings?.[i] ?? (live && n > currentInning ? '' : '-')}</div>)}
              <div style={{ width: '10px' }} />
              <div style={cell(true, true)}>{t.line.r ?? (t.abbr === event.away_abbr ? event.away_score : event.home_score) ?? '-'}</div>
              <div style={cell(false, false)}>{t.line.h ?? '-'}</div>
              <div style={cell(false, false)}>{t.line.e ?? '-'}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── NHL/NBA/WNBA period-quarter linescore ──────────────────────────────────
  const PeriodLinescore = () => {
    if (event.sport === 'MLB' || (!live && !final) || !meta.linescore?.cols) return null
    const { cols, away, home } = meta.linescore
    const curIdx = (meta.situation?.period ?? 0) - 1
    const cell = (bold, hl) => ({ fontFamily: R, fontSize: '17px', fontWeight: bold ? 700 : 500, color: hl ? NEON : TEXT, textAlign: 'center', minWidth: '46px', padding: '7px 4px' })
    const hdr  = (active) => ({ fontFamily: R, fontSize: '12px', fontWeight: 700, color: active ? NEON : MUTED, textAlign: 'center', minWidth: '46px', padding: '5px 4px', letterSpacing: '0.08em' })
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: 'fit-content', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '2px' }}>
            <div style={{ width: '56px' }} />
            {cols.map((c, i) => <div key={i} style={hdr(live && i === curIdx)}>{c}</div>)}
            <div style={{ width: '14px' }} />
            <div style={{ ...hdr(true), minWidth: '52px' }}>T</div>
          </div>
          {[{ abbr: event.away_abbr, line: away }, { abbr: event.home_abbr, line: home }].map((t, ri) => (
            <div key={t.abbr} style={{ display: 'flex', alignItems: 'center', paddingTop: '5px', paddingBottom: ri === 0 ? '5px' : '0', borderBottom: ri === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: '56px', fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{t.abbr}</div>
              {cols.map((c, i) => <div key={i} style={cell(false, live && i === curIdx)}>{t.line.periods?.[i] ?? '-'}</div>)}
              <div style={{ width: '14px' }} />
              <div style={{ ...cell(true, false), minWidth: '52px', color: NEON_T }}>{t.line.total ?? '-'}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── MLB Live Situation bar ─────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0A0A0A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >

      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,10,0.95)' }}>
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)', padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '960px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase' }}>Back</span>
        </button>
        <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase' }}>{event.league} · {fmtTime(event.start_time)}</span>
        <div style={{ width: '60px' }} />
      </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto' }}>

        {/* ── HERO ── */}
        <div style={{ background: 'linear-gradient(180deg, rgba(189,255,0,0.03) 0%, transparent 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Event subtitle — league · series/event name (e.g. "NHL · Stanley Cup Final · Game 5") */}
          {(() => {
            const raw = meta.event_note
            if (!raw) return null
            const clean = raw.replace(new RegExp(`^${event.league}\\s*`, 'i'), '').replace(/\s*-\s*/g, ' · ').trim()
            return (
              <div style={{ textAlign: 'center', padding: '14px 20px 0', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase' }}>
                {event.league} · {clean}
              </div>
            )
          })()}
          {/* Scores + logos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '24px 20px 16px', gap: '12px' }}>
            {/* Away */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <TeamLogo logo={event.away_logo} abbr={event.away_abbr} size={60} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{event.away_team}</div>
                {event.away_record && <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, fontWeight: 700 }}>{event.away_record}</div>}
              </div>
              {hasScore && <div style={{ fontFamily: R, fontSize: '64px', fontWeight: 700, lineHeight: 1, color: (awayWin || awayLead) ? TEXT : 'rgba(255,255,255,0.55)', letterSpacing: '-0.02em' }}>{event.away_score}</div>}
            </div>
            {/* Center status */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '70px' }}>
              {live ? (() => {
                const sit = meta.situation
                const half = sit?.inningHalf?.toLowerCase() === 'bottom' ? '▼' : '▲'
                const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
                const inningLabel = sit?.inning ? `${half} ${ordinal(sit.inning)}` : null
                const bases = sit ? [sit.onFirst, sit.onSecond, sit.onThird] : []
                const B = 12
                return (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 8px #FF3B3B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: '#FF3B3B', letterSpacing: '0.16em' }}>LIVE</span>
                    </span>
                    {sit && event.sport === 'MLB' && (
                      <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                        <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '2px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', background: bases[1] ? NEON : 'transparent', border: `1.5px solid ${bases[1] ? NEON : 'rgba(189,255,0,0.3)'}` }} />
                        <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '50%', left: '2px', transform: 'translateY(-50%) rotate(45deg)', background: bases[2] ? NEON : 'transparent', border: `1.5px solid ${bases[2] ? NEON : 'rgba(189,255,0,0.3)'}` }} />
                        <div style={{ position: 'absolute', width: B, height: B, borderRadius: '2px', top: '50%', right: '2px', transform: 'translateY(-50%) rotate(45deg)', background: bases[0] ? NEON : 'transparent', border: `1.5px solid ${bases[0] ? NEON : 'rgba(189,255,0,0.3)'}` }} />
                        <div style={{ position: 'absolute', width: 9, height: 9, borderRadius: '1px', bottom: '2px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', border: '1.5px solid rgba(189,255,0,0.15)' }} />
                      </div>
                    )}
                    {inningLabel && <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#FF3B3B', letterSpacing: '0.08em' }}>{inningLabel}</span>}
                    {event.sport !== 'MLB' && sit?.period && (() => {
                      const regP = event.sport === 'NHL' ? 3 : 4
                      const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
                      const lbl = sit.period <= regP ? ord(sit.period) : (sit.period === regP + 1 ? 'OT' : `${sit.period - regP}OT`)
                      return <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{lbl}{sit.clock ? ` ${sit.clock}` : ''}</span>
                    })()}
                    {event.sport === 'NHL' && meta.away_team_stats?.sog != null && meta.home_team_stats?.sog != null && (
                      <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>SOG: {meta.away_team_stats.sog}-{meta.home_team_stats.sog}</span>
                    )}
                    {sit && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {sit.outs != null && <div style={{ textAlign: 'center' }}><div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, lineHeight: 1 }}>{sit.outs}</div><div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>OUTS</div></div>}
                        {sit.balls != null && <div style={{ textAlign: 'center' }}><div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, lineHeight: 1 }}>{sit.balls}-{sit.strikes}</div><div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>COUNT</div></div>}
                      </div>
                    )}
                    {meta.broadcast && <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.08em' }}>{meta.broadcast}</span>}
                  </>
                )
              })() : final ? (
                <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{isOT ? 'Final/OT' : 'Final'}</span>
              ) : (
                <span style={{ fontFamily: R, fontSize: '13px', color: MUTED }}>vs</span>
              )}
            </div>
            {/* Home */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <TeamLogo logo={event.home_logo} abbr={event.home_abbr} size={60} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{event.home_team}</div>
                {event.home_record && <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, fontWeight: 700 }}>{event.home_record}</div>}
              </div>
              {hasScore && <div style={{ fontFamily: R, fontSize: '64px', fontWeight: 700, lineHeight: 1, color: (homeWin || homeLead) ? TEXT : 'rgba(255,255,255,0.55)', letterSpacing: '-0.02em' }}>{event.home_score}</div>}
            </div>
          </div>

          {/* Probable Pitchers matchup box — MLB, in the hero (all tabs) */}
          {event.sport === 'MLB' && (meta.away_pitcher?.name || meta.home_pitcher?.name) && (
            <PitcherMatchup away={meta.away_pitcher} home={meta.home_pitcher} awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} />
          )}

          {/* NHL goal scorers — puck summary by team */}
          {event.sport === 'NHL' && (meta.goals?.away?.length || meta.goals?.home?.length) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', padding: '0 20px 16px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(meta.goals.away ?? []).map((g, i) => (
                  <div key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: TEXT, textAlign: 'left' }}>
                    {g.scorer} <span style={{ color: MUTED }}>{g.period}{g.ppg ? ' (PPG)' : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '2px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(meta.goals.home ?? []).map((g, i) => (
                  <div key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: TEXT, textAlign: 'right' }}>
                    {g.scorer} <span style={{ color: MUTED }}>{g.period}{g.ppg ? ' (PPG)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pitcher decisions — MLB final */}
          {event.sport === 'MLB' && final && meta.decisions && (() => {
            const { winner, loser, save } = meta.decisions
            if (!winner && !loser) return null
            return (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', padding: '0 20px 14px' }}>
                {[winner && { label:'W', p: winner }, loser && { label:'L', p: loser }, save && { label:'SV', p: save }].filter(Boolean).map(({ label, p }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: label==='W' ? NEON : label==='L' ? '#FF3B3B' : MUTED }}>{label}</span>
                    <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{p.name}</div>
                    <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{p.record}{p.era ? ` · ${p.era}` : ''}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Linescore */}
          {(live || final) && (
            <div style={{ padding: '10px 20px 0' }}>
              <Linescore />
              <PeriodLinescore />
            </div>
          )}

        </div>

        {/* ── Sticky tab bar — horizontal scroll (Apple/Pikkit pattern); active = filled neon pill ── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'fit-content', margin: '0 auto' }}>
              {tabs.map(t => (
                <button key={t} onClick={() => setDtab(t)} style={{
                  flexShrink: 0, padding: '7px 15px', fontFamily: R, fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  border: 'none', borderRadius: '20px', cursor: 'pointer',
                  background: dtab === t ? NEON : 'rgba(255,255,255,0.05)',
                  color: dtab === t ? '#0A0A0A' : MUTED,
                  boxShadow: dtab === t ? '0 0 10px rgba(189,255,0,0.25)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Context strip — venue / coverage + weather, always visible above every tab */}
          <GameInfo broadcast={meta.broadcast} venue={meta.venue} venueCity={meta.venue_city} series={meta.series_summary} />
          {meta.weather && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.04)', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>Weather</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '12px 14px', flexWrap: 'wrap', gap: '10px' }}>
                {meta.weather.tempF != null && <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT }}>{meta.weather.tempF}°F</span>}
                {meta.weather.windMph != null && <span style={{ textAlign: 'center' }}><div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>WIND</div><div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{meta.weather.windMph} {meta.weather.windDir}</div></span>}
                {meta.weather.precipPct != null && <span style={{ textAlign: 'center' }}><div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>RAIN</div><div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: meta.weather.precipPct >= 50 ? '#FF3B3B' : TEXT }}>{meta.weather.precipPct}%</div></span>}
              </div>
            </div>
          )}

          {/* ── Insights tab — ALL the RML edge features, premium card stack ── */}
          {dtab === 'Insights' && (() => {
            const hasML = !!event.odds_ml_away && !!event.odds_ml_home
            const dv = hasML ? devigTwoWay(event.odds_ml_away, event.odds_ml_home) : null
            const dvSpread = (meta.spread_away_juice != null && meta.spread_home_juice != null) ? devigTwoWay(meta.spread_away_juice, meta.spread_home_juice) : null
            const dvTotal  = (meta.over_juice != null && meta.under_juice != null) ? devigTwoWay(meta.over_juice, meta.under_juice) : null
            const fmtMv = (mkt, v) => v == null ? '—' : (mkt === 'ml' ? (v > 0 ? `+${v}` : `${v}`) : (mkt === 'spread' && v > 0 ? `+${v}` : `${v}`))
            const labelFor = { ml_away: `${event.away_abbr} ML`, ml_home: `${event.home_abbr} ML`, spread_away: `${event.away_abbr} ${SPREAD_LABEL[event.sport] || 'Spread'}`, spread_home: `${event.home_abbr} ${SPREAD_LABEL[event.sport] || 'Spread'}`, total: 'Total' }
            const order = ['ml_home', 'ml_away', 'spread_home', 'spread_away', 'total']
            const moved = order.filter(k => movement[k] && movement[k].points >= 2)
            const fair = (v) => v == null ? '—' : (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)

            // ── Your bets on THIS game → graded against fair value + closing line ──
            const myBets = (bets || [])
              .filter(b => matchBetToEvent(b, event))
              .map(b => evaluateBet(b, event, { dv, dvSpread, dvTotal }))
              .filter(Boolean)

            // ── Odds table (was the Odds tab) ──
            const hasSpread = event.odds_spread_home != null
            const hasTotal  = event.odds_total != null
            const spreadLabel = SPREAD_LABEL[event.sport] || 'Spread'
            const spreadAway = event.odds_spread_away > 0 ? `+${event.odds_spread_away}` : `${event.odds_spread_away}`
            const spreadHome = event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : `${event.odds_spread_home}`
            const hasAnyOdds = hasSpread || hasTotal || hasML
            const OddsCard = ({ line, juice, pick, odds, empty }) => (
              <div
                onClick={() => !empty && onLogPosition && onLogPosition(event, { pick, odds })}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '66px', cursor: (!empty && onLogPosition) ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s', gap: '3px' }}
                onMouseEnter={e => { if (!empty && onLogPosition) { e.currentTarget.style.background = 'rgba(189,255,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(189,255,0,0.35)' } }}
                onMouseLeave={e => { e.currentTarget.style.background = CARD; e.currentTarget.style.borderColor = BORDER }}
              >
                {empty ? <span style={{ fontFamily: R, fontSize: '18px', color: 'rgba(255,255,255,0.15)' }}>—</span> : (
                  <>
                    <span style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: TEXT, letterSpacing: '-0.01em', lineHeight: 1 }}>{line}</span>
                    {juice != null && <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON_T }}>{fmtOdds(juice)}</span>}
                  </>
                )}
              </div>
            )

            const anything = myBets.length || hasAnyOdds || dv || moved.length || meta.trends || meta.injuries
            if (!anything) return <EmptyState label="Insights" />
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                <a href="/how-to-read-insights.html" target="_blank" rel="noopener noreferrer"
                  style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEON_T, textDecoration: 'none', opacity: 0.85 }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: `1px solid ${NEON_T}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>i</span>
                  How to read this
                </a>

                {myBets.length > 0 && <PersonalBet graded={myBets} />}

                {hasAnyOdds && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '4px', padding: '0 2px' }}>
                      {[spreadLabel, 'Total', 'ML'].map(l => <div key={l} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center' }}>{l}</div>)}
                    </div>
                    {[
                      { label: event.away_abbr, cells: [
                        hasSpread ? { line: spreadAway, juice: meta.spread_away_juice, pick: `${event.away_abbr} ${spreadLabel} ${spreadAway}`, odds: meta.spread_away_juice ?? spreadAway } : null,
                        hasTotal  ? { line: `O ${event.odds_total}`, juice: meta.over_juice, pick: `Over ${event.odds_total}`, odds: meta.over_juice ?? `O ${event.odds_total}` } : null,
                        hasML     ? { line: fmtOdds(event.odds_ml_away), juice: null, pick: `${event.away_abbr} ML`, odds: event.odds_ml_away } : null,
                      ]},
                      { label: event.home_abbr, cells: [
                        hasSpread ? { line: spreadHome, juice: meta.spread_home_juice, pick: `${event.home_abbr} ${spreadLabel} ${spreadHome}`, odds: meta.spread_home_juice ?? spreadHome } : null,
                        hasTotal  ? { line: `U ${event.odds_total}`, juice: meta.under_juice, pick: `Under ${event.odds_total}`, odds: meta.under_juice ?? `U ${event.odds_total}` } : null,
                        hasML     ? { line: fmtOdds(event.odds_ml_home), juice: null, pick: `${event.home_abbr} ML`, odds: event.odds_ml_home } : null,
                      ]},
                    ].map(({ label, cells }) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        {cells.map((c, i) => c ? <OddsCard key={i} line={c.line} juice={c.juice} pick={c.pick} odds={c.odds} /> : <OddsCard key={i} empty />)}
                      </div>
                    ))}
                    {meta.odds_provider && (
                      <div style={{ textAlign: 'center', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginTop: '2px' }}>
                        Odds by <span style={{ color: NEON_T }}>{meta.odds_provider}</span>
                      </div>
                    )}
                  </div>
                )}

                {(dv || dvSpread || dvTotal) && (() => {
                  const sh = event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : `${event.odds_spread_home}`
                  const wpMarkets = [
                    dv       && { label: 'Moneyline',              aLabel: event.away_abbr, bLabel: event.home_abbr, pA: dv.fairA,       pB: dv.fairB },
                    dvSpread && { label: `${spreadLabel} ${sh}`,   aLabel: event.away_abbr, bLabel: event.home_abbr, pA: dvSpread.fairA, pB: dvSpread.fairB },
                    dvTotal  && { label: `Total ${event.odds_total}`, aLabel: 'Over',       bLabel: 'Under',          pA: dvTotal.fairA,  pB: dvTotal.fairB },
                  ].filter(Boolean)
                  return <WinProbability markets={wpMarkets} />
                })()}

                {(dv || dvSpread || dvTotal) && (() => {
                  const sh = event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : `${event.odds_spread_home}`
                  const pct = (p) => `${Math.round(p * 100)}%`
                  const rows = [
                    dv       && { name: 'Moneyline',          aL: event.away_abbr, bL: event.home_abbr, a: fair(dv.fairAmericanA),       b: fair(dv.fairAmericanB),       hold: dv.holdPct,       pA: dv.fairA,       pB: dv.fairB,       pLabel: 'win' },
                    dvSpread && { name: `${spreadLabel} ${sh}`, aL: event.away_abbr, bL: event.home_abbr, a: fair(dvSpread.fairAmericanA), b: fair(dvSpread.fairAmericanB), hold: dvSpread.holdPct, pA: dvSpread.fairA, pB: dvSpread.fairB, pLabel: 'cover' },
                    dvTotal  && { name: `Total ${event.odds_total}`, aL: 'O',        bL: 'U',             a: fair(dvTotal.fairAmericanA),  b: fair(dvTotal.fairAmericanB),  hold: dvTotal.holdPct,  pA: dvTotal.fairA,  pB: dvTotal.fairB,  pLabel: '' },
                  ].filter(Boolean)
                  return (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.04)' }}>
                        <InfoLabel tip={GLOSSARY.fairValue} label={
                          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>Fair Value <span style={{ color: 'rgba(255,255,255,0.3)' }}>· the honest price</span></span>
                        } />
                      </div>
                      {rows.map((m, i) => (
                        <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '11px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <span>
                            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: NEON_T }}><span style={{ color: MUTED, fontSize: '10px', fontWeight: 700 }}>{m.aL} </span>{m.a}</div>
                            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: TEXT }}>{pct(m.pA)} <span style={{ color: MUTED, fontWeight: 500 }}>{m.pLabel}</span></div>
                          </span>
                          <span style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: TEXT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.name}</div>
                            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED }}>HOLD <span style={{ color: m.hold > 5 ? '#FF3B3B' : NEON_T }}>{m.hold.toFixed(1)}%</span></div>
                          </span>
                          <span style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: NEON_T }}>{m.b}<span style={{ color: MUTED, fontSize: '10px', fontWeight: 700 }}> {m.bL}</span></div>
                            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: TEXT }}>{pct(m.pB)} <span style={{ color: MUTED, fontWeight: 500 }}>{m.pLabel}</span></div>
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {moved.length > 0 && (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.04)' }}>
                      <InfoLabel tip={GLOSSARY.lineMove} label={
                        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>Line Movement <span style={{ color: 'rgba(255,255,255,0.3)' }}>· {final ? 'open → close' : 'how the price is moving'}</span></span>
                      } />
                    </div>
                    {moved.map((k, i) => {
                      const mkt = k.split('_')[0]           // 'ml' | 'spread' | 'total'
                      const m = movement[k]                 // line/price series → the headline number
                      // The PRICE ("juice") series that actually moves — drives %, CLV, arrow, sparkline.
                      // ML already stores its price; spread/total read the parallel *_juice keys.
                      const side = k.split('_')[1]          // 'home' | 'away' | undefined (total)
                      const juiceKey = mkt === 'ml' ? k : mkt === 'total' ? 'total_juice_over' : `spread_juice_${side}`
                      const jm = (movement[juiceKey] && movement[juiceKey].points >= 2) ? movement[juiceKey] : (mkt === 'ml' ? m : null)
                      const flat = !jm || jm.delta === 0
                      const up = !!jm && jm.delta > 0
                      const lineColor = flat ? MUTED : up ? NEON : '#FF3B3B'
                      const clv = jm ? computeClv(jm.open, jm.current) : null
                      const od = jm ? americanToDecimal(jm.open) : null
                      const cd = jm ? americanToDecimal(jm.current) : null
                      const pctMove = (od && cd) ? Math.abs((cd / od - 1) * 100) : 0
                      return (
                        <div key={k} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: i < moved.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <span style={{ minWidth: '64px' }}>
                            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{labelFor[k]}</div>
                            {clv && Math.abs(clv.clvPct) >= 0.1 && (
                              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', color: clv.beat ? NEON_T : '#FF3B3B' }}>
                                {clv.beat ? '+' : ''}{clv.clvPct.toFixed(1)}% <span style={{ color: MUTED, fontWeight: 500 }}>CLV@open</span>
                              </div>
                            )}
                          </span>
                          <Sparkline series={jm ? jm.series : m.series} color={flat ? 'rgba(255,255,255,0.4)' : lineColor} />
                          <span style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{fmtMv(mkt, m.current)}</div>
                            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: lineColor }}>{flat ? '→ 0%' : `${up ? '↗' : '↘'} ${pctMove.toFixed(1)}%`}</div>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {meta.trends && <Trends awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} trends={meta.trends} />}
                {meta.injuries && <Injuries awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} injuries={meta.injuries} />}
                {/* Team Stats intentionally NOT here — it's game stats, lives with the box score */}

              </div>
            )
          })()}

          {/* Team Stats — head-to-head game stats; lives with the box score, not Insights ── */}
          {['Hitting', 'Pitching', 'Box Score', 'Skaters', 'Goalies'].includes(dtab) && (live || final) && (meta.away_team_stats || meta.home_team_stats) && (
            <TeamStats sport={event.sport} awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} aStats={meta.away_team_stats} hStats={meta.home_team_stats} />
          )}

          {/* ── Odds ── */}
          {/* ── Plays ── */}
          {dtab === 'Play by Play' && (() => {
            const allPlays = meta.plays ?? []
            if (!allPlays.length) return <EmptyState label="Play-by-play" />
            if (event.sport === 'MLB') {
              return <MLBPlays plays={allPlays} awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} sit={meta.situation} />
            }
            return (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                {allPlays.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: i < allPlays.length - 1 ? `1px solid ${BORDER}` : 'none', background: p.scoring ? 'rgba(189,255,0,0.04)' : 'transparent', borderLeft: p.scoring ? `3px solid ${NEON}` : '3px solid transparent' }}>
                    <div style={{ flexShrink: 0, minWidth: '32px' }}>
                      {p.clock && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{p.clock}</span>}
                      {p.period && <div style={{ fontFamily: R, fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>P{p.period}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: p.scoring ? 600 : 400, color: p.scoring ? TEXT : MUTED, lineHeight: 1.4 }}>{p.text}</span>
                      {p.scoring && p.awayScore != null && <div style={{ marginTop: '3px', fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON }}>{event.away_abbr} {p.awayScore} – {event.home_abbr} {p.homeScore}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── Box Score: Hitting (MLB) ── */}
          {dtab === 'Box Score' && event.sport === 'MLB' && (
            awayHit.length > 0 || homeHit.length > 0 ? (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
                  {[{ key: 'away', label: `${event.away_abbr}` }, { key: 'home', label: `${event.home_abbr}` }].map((t, i) => (
                    <button key={t.key} onClick={() => setHitTeam(t.key)} style={{ flex: 1, padding: '10px', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: hitTeam === t.key ? 'rgba(189,255,0,0.1)' : 'transparent', color: hitTeam === t.key ? NEON_T : MUTED, borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', borderBottom: hitTeam === t.key ? `2px solid ${NEON}` : '2px solid transparent' }}>{t.label} Hitting</button>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(189,255,0,0.03)' }}>
                        {['Hitter','AB','R','H','RBI','HR','BB','K','AVG'].map((h, i) => (
                          <th key={h} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', padding: '8px 8px', textAlign: i === 0 ? 'left' : 'center', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(hitTeam === 'away' ? awayHit : homeHit).map((p, i, arr) => (
                        <tr key={i} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, padding: '9px 8px', whiteSpace: 'nowrap' }}>{p.name}{p.pos ? <span style={{ color: MUTED, fontWeight: 500 }}> {p.pos}</span> : ''}</td>
                          {[p.ab, p.r, p.h, p.rbi, p.hr, p.bb, p.k, p.avg].map((v, j) => (
                            <td key={j} style={{ fontFamily: R, fontSize: '12px', fontWeight: j === 2 && p.h > 0 ? 700 : 500, color: j === 2 && p.h > 0 ? NEON_T : TEXT, textAlign: 'center', padding: '9px 8px' }}>{v ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState label="Hitting" />
          )}

          {/* ── Box Score: Pitching (MLB) — stacked under Hitting ── */}
          {dtab === 'Box Score' && event.sport === 'MLB' && (
            awayPitch2.length > 0 || homePitch2.length > 0 ? (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
                  {[{ key: 'away', label: `${event.away_abbr}` }, { key: 'home', label: `${event.home_abbr}` }].map((t, i) => (
                    <button key={t.key} onClick={() => setPitchTeam(t.key)} style={{ flex: 1, padding: '10px', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: pitchTeam === t.key ? 'rgba(189,255,0,0.1)' : 'transparent', color: pitchTeam === t.key ? NEON_T : MUTED, borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', borderBottom: pitchTeam === t.key ? `2px solid ${NEON}` : '2px solid transparent' }}>{t.label} Pitching</button>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '380px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(189,255,0,0.03)' }}>
                        {['Pitcher','IP','H','R','ER','BB','K','PC-ST'].map((h, i) => (
                          <th key={h} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', padding: '8px 8px', textAlign: i === 0 ? 'left' : 'center', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(pitchTeam === 'away' ? awayPitch2 : homePitch2).map((p, i, arr) => (
                        <tr key={i} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, padding: '9px 8px', whiteSpace: 'nowrap' }}>{p.name}</td>
                          {[p.ip, p.h, p.r, p.er, p.bb, p.k, p.pc_st].map((v, j) => (
                            <td key={j} style={{ fontFamily: R, fontSize: '12px', color: TEXT, textAlign: 'center', padding: '9px 8px' }}>{v ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState label="Pitching" />
          )}

          {/* ── Pitchers tab ── */}
          {dtab === 'Pitchers' && (
            awayPitch || homePitch ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[{ abbr: event.away_abbr, pitcher: awayPitch }, { abbr: event.home_abbr, pitcher: homePitch }].map(({ abbr, pitcher }) => pitcher && (
                  <div key={abbr} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: '10px' }}>{abbr} Starter</div>
                    <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT, marginBottom: '12px' }}>{pitcher.name}{pitcher.throws && <span style={{ fontFamily: R, fontSize: '12px', color: MUTED, fontWeight: 500 }}> ({pitcher.throws}HP)</span>}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                      {[{ label:'ERA', value: pitcher.era }, { label:'Record', value: pitcher.record }, { label:'K', value: pitcher.strikeouts }, { label:'Throws', value: pitcher.throws }].map(({ label, value }) => (
                        <div key={label} style={{ background: 'rgba(189,255,0,0.04)', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT }}>{value ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="Probable pitchers" />
          )}

          {/* ── Goalies ── */}
          {dtab === 'Goalies' && (
            meta.away_goalie || meta.home_goalie ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[{ abbr: event.away_abbr, goalie: meta.away_goalie }, { abbr: event.home_abbr, goalie: meta.home_goalie }].map(({ abbr, goalie }) => goalie && (
                  <div key={abbr} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>{abbr} Goalie</div>
                    <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT, marginBottom: '12px' }}>{goalie.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                      {[{ label:'Saves', value: goalie.shots != null ? `${goalie.saves ?? '—'}/${goalie.shots}` : goalie.saves }, { label:'SV%', value: goalie.savePct }, { label:'GA', value: goalie.ga }].map(({ label, value }) => (
                        <div key={label} style={{ background: 'rgba(189,255,0,0.04)', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT }}>{value ?? '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState label="Goalies" />
          )}

          {/* ── NBA/WNBA Box Score (Starters / Bench) ── */}
          {dtab === 'Box Score' && (event.sport === 'NBA' || event.sport === 'WNBA') && (() => {
            const awayP = meta.away_players ?? []
            const homeP = meta.home_players ?? []
            if (!awayP.length && !homeP.length) return <EmptyState label="Box Score" />
            const rows = skatersTeam === 'away' ? awayP : homeP
            const starters = rows.filter(p => p.starter)
            const bench = rows.filter(p => !p.starter)
            const COLS = [['MIN','min'],['PTS','pts'],['REB','reb'],['AST','ast'],['STL','stl'],['BLK','blk'],['TO','to'],['FG','fg'],['3PT','tp'],['FT','ft']]
            const Section = ({ label, list }) => list.length ? (
              <>
                <tr><td colSpan={COLS.length + 1} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: NEON_T, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '10px 8px 5px', background: 'rgba(189,255,0,0.05)', borderLeft: `3px solid ${NEON}` }}>{label}</td></tr>
                {list.map((p, i) => (
                  <tr key={label + i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, padding: '9px 8px', whiteSpace: 'nowrap' }}>{p.name}{p.pos ? <span style={{ color: MUTED, fontWeight: 500 }}> {p.pos}</span> : ''}</td>
                    {COLS.map(([, k], j) => <td key={j} style={{ fontFamily: R, fontSize: '12px', fontWeight: k === 'pts' ? 700 : 400, color: k === 'pts' ? NEON_T : TEXT, textAlign: 'center', padding: '9px 8px' }}>{p[k] ?? '—'}</td>)}
                  </tr>
                ))}
              </>
            ) : null
            return (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
                  {[{ k: 'away', label: event.away_abbr }, { k: 'home', label: event.home_abbr }].map((t, i) => (
                    <button key={t.k} onClick={() => setSkatersTeam(t.k)} style={{ flex: 1, padding: '10px', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: skatersTeam === t.k ? 'rgba(189,255,0,0.1)' : 'transparent', color: skatersTeam === t.k ? NEON_T : MUTED, borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', borderBottom: skatersTeam === t.k ? `2px solid ${NEON}` : '2px solid transparent' }}>{t.label}</button>
                  ))}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '460px', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'rgba(189,255,0,0.03)' }}>
                      {['Player', ...COLS.map(c => c[0])].map((h,i) => <th key={h} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', padding: '8px', textAlign: i===0 ? 'left' : 'center', borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      <Section label="Starters" list={starters} />
                      <Section label="Bench" list={bench} />
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* ── NHL Skaters ── */}
          {dtab === 'Skaters' && (() => {
            const awayP = meta.away_skaters ?? []
            const homeP = meta.home_skaters ?? []
            if (!awayP.length && !homeP.length) return <EmptyState label="Skaters" />
            const rows = skatersTeam === 'away' ? awayP : homeP
            return (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
                  {[{ k: 'away', label: event.away_abbr }, { k: 'home', label: event.home_abbr }].map((t, i) => (
                    <button key={t.k} onClick={() => setSkatersTeam(t.k)} style={{ flex: 1, padding: '10px', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: skatersTeam === t.k ? 'rgba(189,255,0,0.1)' : 'transparent', color: skatersTeam === t.k ? NEON_T : MUTED, borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', borderBottom: skatersTeam === t.k ? `2px solid ${NEON}` : '2px solid transparent' }}>{t.label}</button>
                  ))}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '360px', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'rgba(189,255,0,0.03)' }}>
                      {['Player','G','A','PTS','+/-','PIM','SOG','HITS'].map((h,i) => <th key={h} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', padding: '8px', textAlign: i===0 ? 'left' : 'center', borderBottom: `1px solid ${BORDER}` }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {rows.map((p, i, arr) => (
                        <tr key={i} style={{ borderBottom: i < arr.length-1 ? `1px solid ${BORDER}` : 'none', background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                          <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, padding: '9px 8px', whiteSpace: 'nowrap' }}>{p.name}{p.pos ? <span style={{ color: MUTED, fontWeight: 500 }}> {p.pos}</span> : ''}</td>
                          {[p.g, p.a, p.pts, p.pm, p.pim, p.sog, p.hits].map((v, j) => <td key={j} style={{ fontFamily: R, fontSize: '12px', fontWeight: j === 2 ? 700 : 400, color: j === 2 ? NEON_T : TEXT, textAlign: 'center', padding: '9px 8px' }}>{v ?? '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* ── Form ── */}
          {dtab === 'Form' && (
            meta.away_last5?.length || meta.home_last5?.length
              ? <FormTab awayAbbr={event.away_abbr} homeAbbr={event.home_abbr} awayL5={meta.away_last5 ?? []} homeL5={meta.home_last5 ?? []} />
              : <EmptyState label="Last 5 Games" />
          )}

          {/* ── Standings ── */}
          {dtab === 'Standings' && (() => {
            if (!meta.standings?.length) return <EmptyState label="Standings" />
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {meta.standings.map(group => (
                  <div key={group.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 8px 5px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', background: 'rgba(255,255,255,0.02)' }}>{group.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 36px)', padding: '8px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(189,255,0,0.03)' }}>
                      {['Team','W','L','OTL','PTS'].map((h, i) => <span key={h} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, textAlign: i===0?'left':'center', letterSpacing: '0.08em' }}>{h}</span>)}
                    </div>
                    {(group.entries ?? []).map((e, i) => {
                      const cur = e.team === event.away_team || e.team === event.home_team
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 36px)', padding: '9px 8px', borderBottom: i < group.entries.length-1 ? `1px solid ${BORDER}` : 'none', background: cur ? 'rgba(189,255,0,0.07)' : (i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent'), borderLeft: `3px solid ${cur ? NEON : 'transparent'}` }}>
                          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: cur ? NEON_T : TEXT }}>{e.team}</span>
                          {['wins','losses','otLosses','points'].map(k => <span key={k} style={{ fontFamily: R, fontSize: '12px', fontWeight: k==='points' ? 700 : 400, color: k==='points' ? NEON_T : TEXT, textAlign: 'center' }}>{e.stats?.[k] ?? '—'}</span>)}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}


        </div>
      </div>
      </div>

    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function LiveCenter({ onLogPosition, bets = [] }) {
  const [sport,       setSport]      = useState('All')
  const [dateFilter,  setDateFilter] = useState('Today')
  const [events,      setEvents]     = useState([])
  const [loading,     setLoading]    = useState(true)
  const [selectedId,  setSelectedId] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [hasLive,     setHasLive]    = useState(false)

  const isLiveTab = sport === 'Live'
  const isAllTab  = sport === 'All'
  // "Live" only shows as a tab when games are actually in progress; "All" is the default.
  const filterTabs = [...(hasLive ? ['Live'] : []), 'All', ...SPORTS]

  useEffect(() => {
    setLoading(true)
    setSelectedId(null)
    const req = isLiveTab
      ? fetchLiveEvents()
      : isAllTab
        // All-sports slate for the day — fetch every league, merge, sort by start time.
        ? Promise.all(SPORTS.map(s => fetchEvents(s.toLowerCase(), dateFilter.toLowerCase())))
            .then(results => ({ data: results.flatMap(r => r.data ?? []).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)) }))
        : fetchEvents(sport.toLowerCase(), dateFilter.toLowerCase())
    req
      .then(({ data }) => setEvents(data ?? []))
      .finally(() => setLoading(false))
  }, [sport, dateFilter])

  // Detect whether any game is live (independent of the selected tab) so the "Live"
  // tab can appear/disappear. If the user is on Live and games end, fall back to All.
  useEffect(() => {
    let cancelled = false
    const check = () => fetchLiveEvents()
      .then(({ data }) => { if (!cancelled) setHasLive((data ?? []).length > 0) })
      .catch(() => {})
    check()
    const id = setInterval(check, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => { if (isLiveTab && !hasLive) setSport('All') }, [hasLive, isLiveTab])

  // Live polling — refresh each in-progress game on-demand (direct from ESPN) every 30s
  // so the cards' score, inning and bases stay current even when the cron is behind.
  useEffect(() => {
    if (!isLiveTab && dateFilter !== 'Today') return
    const liveGames = events.filter(e => (e.status === 'IP' || e.status === 'LIVE') && e.external_event_id && e.sport)
    if (!liveGames.length) return
    const interval = setInterval(async () => {
      const results = await Promise.all(liveGames.map(async (g) => {
        try {
          const r = await fetch(`/api/live-game?id=${encodeURIComponent(g.external_event_id)}&sport=${encodeURIComponent(g.sport)}`)
          if (!r.ok) return null
          const d = await r.json()
          if (!d || d.notFound || d.error) return null
          return [g.id, d]
        } catch { return null }
      }))
      const map = Object.fromEntries(results.filter(Boolean))
      if (!Object.keys(map).length) return
      setEvents(prev => prev.map(e => {
        const d = map[e.id]
        if (!d) return e
        return {
          ...e,
          status:     d.status     ?? e.status,
          home_score: d.home_score ?? e.home_score,
          away_score: d.away_score ?? e.away_score,
          metadata:   { ...(e.metadata ?? {}), ...(d.metadata ?? {}) },
        }
      }))
      setLastUpdated(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [events, sport, dateFilter])

  const selected = events.find(e => e.id === selectedId) ?? null

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', color: TEXT }}>LIVE CENTER™</div>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>Game → Position → Settlement</div>
        </div>
        {lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 6px #FF3B3B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase' }}>
              {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )}
      </div>

      {/* Filters card — sport pills + date tabs grouped */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Sport pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
          {filterTabs.map(s => {
            const isLive = s === 'Live'
            const active = sport === s
            return (
              <button key={s} onClick={() => setSport(s)} style={{
                fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '5px',
                background: active ? (isLive ? '#FF3B3B' : NEON) : 'rgba(189,255,0,0.06)',
                color:      active ? (isLive ? '#fff' : '#0A0A0A') : (isLive ? '#FF3B3B' : MUTED),
                boxShadow:  active ? (isLive ? '0 0 10px rgba(255,59,59,0.3)' : '0 0 10px rgba(189,255,0,0.25)') : 'none',
                transition: 'background 0.15s',
              }}>
                {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#fff' : '#FF3B3B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
                {isLive ? 'LIVE' : s}
              </button>
            )
          })}
        </div>
        {/* Date tabs */}
        {!isLiveTab && (
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
            {DATES.map((d, i) => (
              <button key={d} onClick={() => setDateFilter(d)} style={{
                flex: 1, padding: '7px', fontFamily: R, fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                background: dateFilter === d ? 'rgba(189,255,0,0.12)' : 'transparent',
                color:      dateFilter === d ? NEON_T : MUTED,
                borderRight: i < DATES.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}>{d}</button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
          LOADING SLATE...
        </div>
      ) : selected ? (
        <GameDetail event={selected} onBack={() => setSelectedId(null)} onLogPosition={onLogPosition} bets={bets} />
      ) : events.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', textAlign: 'center', padding: '48px 0', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>
          {isLiveTab ? 'NO LIVE GAMES RIGHT NOW' : 'NO GAMES FOUND'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(e => (
            <GameCard key={e.id} event={e} showSport={isAllTab} onClick={() => setSelectedId(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
