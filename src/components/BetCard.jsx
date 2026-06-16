// src/components/BetCard.jsx — the universal bet card. Pure presentational:
// give it a normalized bet (from src/lib/betCard.js) + optional grade { evPct, clvPct, verdict }.
import { NEON, MUTED, BORDER, TEXT } from './botShared.jsx'
import { ticketStatus, slipClv } from '../lib/betCard.js'

const R = "'Rajdhani',sans-serif"
const I = "'Inter',sans-serif"

// This app uses unicode/emoji glyphs (no Tabler webfont). Map status → glyph.
const GLYPH = { won: '✓', lost: '✕', live: '◷', push: '–' }

const fmtOdds = (o) => o == null ? '' : (o > 0 ? `+${o}` : `${o}`)
const initials = (s) => String(s || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
const toWin = (odds, stake) => (odds == null || !stake) ? null : (odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds))
const AMBER = '#FFB800'
// Ring color by status: pending/live = orange, won = green, lost = red, push = gray.
const ringColor = (status) => status?.key === 'won' ? NEON : status?.key === 'lost' ? '#FF3B3B' : status?.key === 'push' ? '#888780' : AMBER

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

// Live stat-progress bar (Pikkit-style): fills to current ÷ line, green on track / red
// once busted or lost, with a "current / line" readout. stat from src/lib/statProgress.js.
function StatBar({ stat, style }) {
  if (!stat) return null
  const pending = stat.current == null
  const p = pending ? 0 : Math.max(0, Math.min(1, stat.pct))
  return (
    <div style={{ marginTop: 6, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontFamily: I, fontSize: 9, color: MUTED, letterSpacing: '0.04em' }}>{stat.dir === 'over' ? 'OVER' : 'UNDER'} {stat.line}</span>
        <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, color: pending ? MUTED : stat.color }}>{stat.label}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#222', overflow: 'hidden' }}>
        {!pending && <div style={{ width: `${Math.round(p * 100)}%`, height: '100%', background: stat.color, borderRadius: 3 }} />}
      </div>
    </div>
  )
}

// Score readout for ML/spread legs (no bar) — e.g. "NYK 110 – SAS 105".
function ScoreChip({ text, status }) {
  if (!text) return null
  return (
    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: R, fontSize: 12, fontWeight: 700,
      color: status?.color || TEXT, background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 9px' }}>{text}</div>
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
    <div style={{ textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: `${c}14`, border: `1px solid ${c}59`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: c }}>{value}</div>
    </div>
  )
}

// Neutral boxed stat (label stacked on top of value), matching the EV/CLV badge shape.
function StatBox({ label, value, valueSize = 15, flex = false }) {
  return (
    <div style={{ flex: flex ? 1 : '0 0 auto', minWidth: 0, textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: '#141414', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: valueSize, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>{value}</div>
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
        <Ring pct={winProb} size={compact ? 32 : 40} color={ringColor(st)} />
      </div>
      {/* Progress bar sits ABOVE the odds (always shown for over/under bets, empty pre-game). */}
      <StatBar stat={leg.statNow} style={{ marginTop: 11 }} />
      <ScoreChip text={leg.scoreLine} status={st} />
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 7, marginTop: 11 }}>
        <StatBox label="ODDS" value={fmtOdds(bet.odds)} />
        {win != null && <StatBox label="STAKE → WIN" value={`$${Number(bet.stake).toFixed(0)} → $${win.toFixed(0)}`} valueSize={13} flex />}
        {grade?.evPct != null && <GradeBadge label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
        {grade?.clvPct != null && <GradeBadge label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
      </div>
    </div>
  )
}

function LegRow({ leg }) {
  const st = leg.status
  // Name + detail stay light/readable; the bar (StatBar) carries the green/red status.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', position: 'relative' }}>
      <Avatar headshot={leg.headshot} logo={leg.logo} label={leg.subtitle || leg.title} status={st} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: st.key === 'lost' ? '#9a9a9a' : TEXT, textDecoration: st.key === 'lost' ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leg.title}</span>
          <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: st.key === 'lost' ? '#9a9a9a' : TEXT, flexShrink: 0 }}>{fmtOdds(leg.odds)}</span>
        </div>
        {leg.close != null && <div style={{ fontFamily: I, fontSize: 9, color: MUTED }}>closed {fmtOdds(leg.close)}</div>}
        <StatBar stat={leg.statNow} />
        <ScoreChip text={leg.scoreLine} status={st} />
      </div>
      <span style={{ color: st.color, fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{GLYPH[st.key] || ''}</span>
    </div>
  )
}

export function BetTicket({ bet, grade }) {
  const t = ticketStatus(bet.legs)
  const clvVal = grade?.clvPct ?? slipClv(bet.legs.map(l => ({ entry: l.odds, close: l.close }))).clvPct
  const win = toWin(bet.odds, bet.stake)
  // Combined parlay win probability = product of each leg's win prob (independent legs).
  const legProbs = bet.legs.map(l => l.winProb).filter(p => p != null && !Number.isNaN(p))
  const comboProb = legProbs.length === bet.legs.length && legProbs.length ? legProbs.reduce((a, b) => a * b, 1) : null
  return (
    <div style={{ position: 'relative', border: `1px solid ${t.overall.color}59`, borderRadius: 14, background: '#0c0c0c', overflow: 'hidden' }}>
      {/* Left status-color accent stripe, matching the single card. */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: t.overall.color, zIndex: 2 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 13px', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{bet.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${t.overall.color}1f`, color: t.overall.color }}>{t.label}{t.overall.key === 'live' ? ' · LIVE' : ''}</span>
          <Ring pct={comboProb ?? grade?.winProb} size={36} color={ringColor(t.overall)} />
        </span>
      </div>

      <div style={{ position: 'relative', padding: '4px 0' }}>
        <div style={{ position: 'absolute', left: 27, top: 24, bottom: 24, width: 2, background: '#262626' }} />
        {bet.legs.map((leg, i) => <div key={i} style={{ position: 'relative', zIndex: 1 }}><LegRow leg={leg} /></div>)}
      </div>

      {/* Bottom matches the single (Wheeler) card: separate ODDS box (label stacked) + STAKE→WIN box + EV + CLV. */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 7, padding: '0 13px 12px' }}>
        <StatBox label="ODDS" value={fmtOdds(bet.odds)} />
        {win != null && <StatBox label="STAKE → WIN" value={`$${Number(bet.stake).toFixed(0)} → $${win.toFixed(0)}`} valueSize={13} flex />}
        {grade?.evPct != null && <GradeBadge label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
        {clvVal != null && <GradeBadge label="CLV" value={`${clvVal >= 0 ? '+' : ''}${clvVal.toFixed(1)}%`} good={clvVal >= 0} />}
      </div>
    </div>
  )
}
