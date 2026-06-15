// src/components/BetCard.jsx — the universal bet card. Pure presentational:
// give it a normalized bet (from src/lib/betCard.js) + optional grade { evPct, clvPct, verdict }.
import { NEON, MUTED, BORDER, TEXT } from './botShared.jsx'
import { ticketStatus, slipClv } from '../lib/betCard.js'

const R = "'Rajdhani',sans-serif"
const I = "'Inter',sans-serif"
const AMBER = '#FFB800'

// This app uses unicode/emoji glyphs (no Tabler webfont). Map status → glyph.
const GLYPH = { won: '✓', lost: '✕', live: '◷', push: '–' }

const fmtOdds = (o) => o == null ? '' : (o > 0 ? `+${o}` : `${o}`)
const initials = (s) => String(s || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
const toWin = (odds, stake) => (odds == null || !stake) ? null : (odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds))

// Pikkit-style win-probability ring. pct = 0..1 (de-vig fair win prob). Green donut + % center.
function Ring({ pct, size = 38, stroke = 4, color = NEON }) {
  if (pct == null || Number.isNaN(pct)) return null
  const p = Math.max(0, Math.min(1, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * p
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-label={`${Math.round(p * 100)}% win probability`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily={R} fontSize={size * 0.32} fontWeight="700" fill={color}>{Math.round(p * 100)}</text>
    </svg>
  )
}

// Thin per-leg progress bar — fills to the leg's win probability, colored by status.
function ProbBar({ pct, color = NEON }) {
  if (pct == null || Number.isNaN(pct)) return null
  const p = Math.max(0, Math.min(1, pct))
  return (
    <div style={{ height: 4, borderRadius: 2, background: '#222', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.round(p * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  )
}

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
  const winProb = grade?.winProb ?? leg.winProb ?? null
  const win = toWin(bet.odds, bet.stake)
  return (
    <div style={{ position: 'relative', background: '#0d0d0d', border: `1px solid ${st.color}59`, borderRadius: 14, padding: compact ? '9px 11px' : 13, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar headshot={leg.headshot} logo={leg.logo} label={bet.subtitle || bet.title} status={st} size={compact ? 30 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: R, fontSize: compact ? 14 : 17, fontWeight: 700, color: TEXT, letterSpacing: '0.02em', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{bet.title}</div>
          {bet.subtitle && <div style={{ fontFamily: I, fontSize: 11, color: MUTED }}>{bet.subtitle}</div>}
        </div>
        {bet.book && <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#1c1c1c', color: '#9a9a9a', alignSelf: 'flex-start' }}>{bet.book}</span>}
        <Ring pct={winProb} size={compact ? 32 : 40} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontFamily: R, fontSize: 9, color: MUTED, letterSpacing: '0.1em' }}>ODDS</span>
          <span style={{ fontFamily: R, fontSize: 17, fontWeight: 700, color: TEXT }}>{fmtOdds(bet.odds)}</span>
          {win != null && <span style={{ fontFamily: R, fontSize: 11, color: MUTED, marginLeft: 'auto' }}>${Number(bet.stake).toFixed(0)} → ${win.toFixed(0)}</span>}
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
        <ProbBar pct={leg.winProb} color={st.color} />
      </div>
      <span style={{ color: st.color, fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{GLYPH[st.key] || ''}</span>
    </div>
  )
}

export function BetTicket({ bet, grade }) {
  const t = ticketStatus(bet.legs)
  const clv = grade?.slipClv ?? slipClv(bet.legs.map(l => ({ entry: l.odds, close: l.close })))
  const win = toWin(bet.odds, bet.stake)
  // Combined parlay win probability = product of each leg's win prob (independent legs).
  const legProbs = bet.legs.map(l => l.winProb).filter(p => p != null && !Number.isNaN(p))
  const comboProb = legProbs.length === bet.legs.length && legProbs.length ? legProbs.reduce((a, b) => a * b, 1) : null
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: '#0c0c0c', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 13px', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{bet.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${t.overall.color}1f`, color: t.overall.color }}>{t.label}{t.overall.key === 'live' ? ' · LIVE' : ''}</span>
          <Ring pct={comboProb} size={36} />
        </span>
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
          <span style={{ color: clv.beat ? NEON : '#FF3B3B', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{clv.beat ? '▲' : '▼'}</span>
          <span style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B', letterSpacing: '0.06em' }}>{clv.beat ? 'YOU BEAT THE CLOSE' : 'WORSE THAN CLOSE'}</span>
          <span style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B' }}>{`${clv.clvPct >= 0 ? '+' : ''}${clv.clvPct.toFixed(1)}% CLV`}</span>
        </div>
      )}
    </div>
  )
}
