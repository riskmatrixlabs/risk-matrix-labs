// src/components/BetCard.jsx — the universal bet card. Pure presentational:
// give it a normalized bet (from src/lib/betCard.js) + optional grade { evPct, clvPct, verdict }.
import { NEON, MUTED, BORDER, TEXT } from './botShared.jsx'
import { ticketStatus, slipClv } from '../lib/betCard.js'

const R = "'Rajdhani',sans-serif"
const I = "'Inter',sans-serif"
const AMBER = '#FFB800'

const fmtOdds = (o) => o == null ? '' : (o > 0 ? `+${o}` : `${o}`)
const initials = (s) => String(s || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()

export function Avatar({ headshot, logo, label, status, size = 42 }) {
  const ring = status?.color || BORDER
  const common = { width: size, height: size, borderRadius: size > 34 ? 10 : 8, flexShrink: 0, objectFit: 'cover', border: `1px solid ${ring}55` }
  if (headshot) return <img src={headshot} alt="" style={common} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  if (logo) return <img src={logo} alt="" style={{ ...common, objectFit: 'contain', background: '#141414' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  return (
    <div style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${ring}1a`, color: ring, fontFamily: R, fontWeight: 700, fontSize: size > 34 ? 15 : 11 }}>
      {initials(label)}
    </div>
  )
}

function GradeBadge({ label, value, good }) {
  const c = good ? NEON : '#FF3B3B'
  return (
    <div style={{ textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: `${c}14`, border: `1px solid ${c}59` }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: c }}>{value}</div>
    </div>
  )
}

export function BetCard({ bet, grade, compact = false }) {
  const st = bet.status
  const leg = bet.legs[0] || {}
  return (
    <div style={{ position: 'relative', background: '#0d0d0d', border: `1px solid ${st.color}59`, borderRadius: 14, padding: compact ? '9px 11px' : 13, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar headshot={leg.headshot} logo={leg.logo} label={bet.subtitle || bet.title} status={st} size={compact ? 30 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: R, fontSize: compact ? 14 : 17, fontWeight: 700, color: TEXT, letterSpacing: '0.02em', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{bet.title}</div>
          {bet.subtitle && <div style={{ fontFamily: I, fontSize: 11, color: MUTED }}>{bet.subtitle}</div>}
        </div>
        {bet.book && <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#1c1c1c', color: '#9a9a9a' }}>{bet.book}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontFamily: R, fontSize: 9, color: MUTED, letterSpacing: '0.1em' }}>ODDS</span>
          <span style={{ fontFamily: R, fontSize: 17, fontWeight: 700, color: TEXT }}>{fmtOdds(bet.odds)}</span>
        </div>
        {grade?.evPct != null && <GradeBadge label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
        {grade?.clvPct != null && <GradeBadge label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
      </div>
    </div>
  )
}

function LegRow({ leg }) {
  const st = leg.status
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', position: 'relative',
      background: st.key === 'live' ? 'rgba(255,184,0,0.05)' : 'transparent' }}>
      <Avatar headshot={leg.headshot} logo={leg.logo} label={leg.subtitle || leg.title} status={st} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: st.key === 'won' ? TEXT : st.key === 'live' ? AMBER : '#8a8a8a', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{leg.title}</div>
        <div style={{ fontFamily: I, fontSize: 10, color: st.key === 'live' ? AMBER : MUTED }}>
          {fmtOdds(leg.odds)}{leg.close != null ? ` · closed ${fmtOdds(leg.close)}` : ''}{st.key === 'live' ? ' · needs this' : ''}
        </div>
      </div>
      <i className={`ti ${st.icon}`} style={{ color: st.color, fontSize: 17 }} />
    </div>
  )
}

export function BetTicket({ bet, grade }) {
  const t = ticketStatus(bet.legs)
  const clv = grade?.slipClv ?? slipClv(bet.legs.map(l => ({ entry: l.odds, close: l.close })))
  const win = bet.odds != null && bet.stake ? (bet.odds > 0 ? bet.stake * bet.odds / 100 : bet.stake * 100 / Math.abs(bet.odds)) : null
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: '#0c0c0c', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{bet.title}</span>
        <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${t.overall.color}1f`, color: t.overall.color }}>{t.label}{t.overall.key === 'live' ? ' · LIVE' : ''}</span>
      </div>

      <div style={{ position: 'relative', padding: '4px 0' }}>
        <div style={{ position: 'absolute', left: 27, top: 24, bottom: 24, width: 2, background: '#262626' }} />
        {bet.legs.map((leg, i) => <div key={i} style={{ position: 'relative', zIndex: 1 }}><LegRow leg={leg} /></div>)}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 13px 11px' }}>
        <div style={{ flex: 1.2, textAlign: 'center', background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 7 }}>
          <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.08em' }}>ODDS · STAKE → WIN</div>
          <div style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: TEXT }}>{fmtOdds(bet.odds)}{win != null ? ` · $${bet.stake.toFixed(0)} → $${win.toFixed(0)}` : ''}</div>
        </div>
        {grade?.evPct != null && (
          <div style={{ flex: 1, textAlign: 'center', background: `${NEON}14`, border: `1px solid ${NEON}59`, borderRadius: 8, padding: 7 }}>
            <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.08em' }}>TICKET EV</div>
            <div style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: grade.evPct >= 0 ? NEON : '#FF3B3B' }}>{`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`}</div>
          </div>
        )}
      </div>

      {clv.clvPct != null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10,
          background: clv.beat ? `${NEON}12` : 'rgba(255,59,59,0.10)', borderTop: `1px solid ${(clv.beat ? NEON : '#FF3B3B')}40` }}>
          <i className={`ti ${clv.beat ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ color: clv.beat ? NEON : '#FF3B3B', fontSize: 18 }} />
          <span style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B', letterSpacing: '0.06em' }}>{clv.beat ? 'YOU BEAT THE CLOSE' : 'WORSE THAN CLOSE'}</span>
          <span style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B' }}>{`${clv.clvPct >= 0 ? '+' : ''}${clv.clvPct.toFixed(1)}% CLV`}</span>
        </div>
      )}
    </div>
  )
}
