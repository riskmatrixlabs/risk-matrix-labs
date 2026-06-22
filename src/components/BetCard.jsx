// src/components/BetCard.jsx — the universal bet card. Pure presentational:
// give it a normalized bet (from src/lib/betCard.js) + optional grade { evPct, clvPct, verdict }.
import { useState } from 'react'
import { Pencil, ChevronDown } from 'lucide-react'
import { NEON, MUTED, BORDER, TEXT } from './botShared.jsx'
import { ticketStatus, slipClv } from '../lib/betCard.js'
import { verdictFromBetGrade } from '../lib/evBrain.js'

// EV-Brain verdict → pill color. Green=neon, Small=green, Lean=amber, Pass=muted.
const VERDICT_COLOR = { neon: '#BDFF00', green: '#5BD16B', amber: '#FFAE2B', muted: '#888780' }
// One honest sentence — this is an experimental signal, not advice.
const VERDICT_TIP = 'EV Brain grade — value (EV) + line value (CLV). Green = best, Pass = skip. Experimental signal, not advice.'

// Build the compact sub-score breakdown string from the grade + verdict result.
// Only includes pieces that actually exist (EV but no CLV, etc.). Returns '' if nothing.
function breakdownText(result, grade) {
  if (!result) return ''
  const parts = []
  if (result.evScore != null) {
    parts.push(grade?.evPct != null
      ? `EV ${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`
      : `EV ${Math.round(result.evScore)}`)
  }
  if (result.clvScore != null) {
    parts.push(grade?.clvPct != null
      ? `beat close ${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}`
      : `CLV ${Math.round(result.clvScore)}`)
  }
  return parts.join(' · ')
}

function VerdictPill({ verdict, result = null, grade = null, size = 'md' }) {
  if (!verdict) return null
  const c = VERDICT_COLOR[verdict.tone] || MUTED
  const fs = size === 'sm' ? 8 : 9
  const detail = breakdownText(result, grade)
  const head = result?.score != null ? `${verdict.label} ${Math.round(result.score)}` : verdict.label
  return (
    <span title={VERDICT_TIP} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
      <span style={{ fontFamily: R, fontSize: fs, fontWeight: 700, letterSpacing: '0.12em', color: c, background: `${c}1f`, border: `1px solid ${c}59`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{head}</span>
      {detail && <span style={{ fontFamily: I, fontSize: 8, color: c, opacity: 0.78, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{detail}</span>}
    </span>
  )
}

const R = "'Rajdhani',sans-serif"
const I = "'Inter',sans-serif"

// This app uses unicode/emoji glyphs (no Tabler webfont). Map status → glyph.
// live = no glyph (the fake-looking clock is gone; the orange ring already signals pending/live).
const GLYPH = { won: '✓', lost: '✕', live: '', push: '–' }

const fmtOdds = (o) => o == null ? '' : (o > 0 ? `+${o}` : `${o}`)
const initials = (s) => String(s || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()
const toWin = (odds, stake) => (odds == null || !stake) ? null : (odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds))
const AMBER = '#FFAE2B'   // brighter, punchier orange for pending/live
// Ring color by status: pending/live = orange, won = green, lost = red, push = gray.
const ringColor = (status) => status?.key === 'won' ? NEON : status?.key === 'lost' ? '#FF3B3B' : status?.key === 'push' ? '#888780' : AMBER
// Pikkit-style live ring color: a SETTLED bet locks to its result (green win / red
// loss / gray push); an in-progress bet shifts with the win probability so the circle
// reads as a live "are we winning" — green ahead (≥60%), amber toss-up, red behind (<40%).
const probColor = (p) => (p == null || Number.isNaN(p)) ? AMBER : p >= 0.60 ? NEON : p >= 0.40 ? AMBER : '#FF3B3B'
export const liveRingColor = (status, pct) =>
  (status?.key === 'won' || status?.key === 'lost' || status?.key === 'push') ? ringColor(status) : probColor(pct)

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

export function Avatar({ headshot, logo, logo2, label, status, size = 42 }) {
  const ring = status?.color || BORDER
  const common = { width: size, height: size, borderRadius: size > 34 ? 10 : 8, flexShrink: 0, objectFit: 'cover', border: `1px solid ${ring}55` }
  if (headshot) return <img src={headshot} alt="" style={common} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  // Totals show BOTH teams — two crests on a diagonal, spaced so neither blocks the other.
  if (logo && logo2) {
    const box = Math.round(size * 1.18)               // a touch wider so the two crests breathe
    const s = Math.round(size * 0.56)
    const crest = { width: s, height: s, objectFit: 'contain', background: '#15181c', borderRadius: 5, position: 'absolute' }
    return (
      <div style={{ width: box, height: size, position: 'relative', flexShrink: 0 }}>
        <img src={logo}  alt="" style={{ ...crest, top: 0, left: 0 }}                              onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <img src={logo2} alt="" style={{ ...crest, bottom: 0, right: 0, outline: '2px solid #0c0c0c' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </div>
    )
  }
  if (logo) return <img src={logo} alt="" style={{ ...common, objectFit: 'contain', background: '#141414' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  return (
    <div style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${ring}1a`, color: ring, fontFamily: R, fontWeight: 700, fontSize: size > 34 ? 15 : 11 }}>
      {initials(label)}
    </div>
  )
}

function GradeBadge({ label, value, good }) {
  const isDash = value === '—' || value == null
  const c = isDash ? MUTED : good ? NEON : '#FF3B3B'
  const bg = isDash ? '#14141420' : `${c}14`
  const border = isDash ? `1px solid ${BORDER}` : `1px solid ${c}59`
  return (
    <div style={{ textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: bg, border, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: c }}>{value ?? '—'}</div>
    </div>
  )
}

// Neutral boxed stat (label stacked on top of value), matching the EV/CLV badge shape.
function StatBox({ label, value, valueSize = 15, flex = false, color = TEXT }) {
  return (
    <div style={{ flex: flex ? 1 : '0 0 auto', minWidth: 0, textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: '#141414', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: valueSize, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

// P&L box — green when win, red when loss, uses GradeBadge style (colored border + bg).
function PnlBox({ pnl }) {
  if (pnl == null) return null
  const good = pnl >= 0
  const c = good ? NEON : '#FF3B3B'
  const v = `${good ? '+' : '-'}$${Math.abs(Math.round(pnl))}`
  return (
    <div style={{ textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: `${c}14`, border: `1px solid ${c}59`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>P&L</div>
      <div style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{v}</div>
    </div>
  )
}

// Small pill (e.g. ladder badge). amber=ladder accent.
function Badge({ text }) {
  if (!text) return null
  return <span style={{ fontFamily: R, fontSize: 7, fontWeight: 700, letterSpacing: '0.14em', color: AMBER, background: `${AMBER}1f`, border: `1px solid ${AMBER}59`, borderRadius: 4, padding: '1px 5px', flexShrink: 0, whiteSpace: 'nowrap' }}>{text}</span>
}

export function BetCard({ bet, grade, compact = false, pnl = null, onEdit = null, badge = null, bankIn = null }) {
  const [open, setOpen] = useState(false)
  const st = bet.status
  const leg = bet.legs[0] || {}
  // Win-prob ring: a SETTLED bet resolves to 100% (won) / 0% (lost) so the ring fills like everyone's
  // tracker; while pending/live it shows the current/implied probability.
  // leg.liveWP (live ESPN game-winner prob for an ML pick) wins over the static
  // de-vig/implied prob so the ring moves with the score on in-progress games.
  const baseWP = leg.liveWP ?? grade?.winProb ?? leg.winProb ?? null
  const winProb = st?.key === 'won' ? 1 : st?.key === 'lost' ? 0 : baseWP
  const win = toWin(bet.odds, bet.stake)
  const gradeResult = verdictFromBetGrade(grade, bet.odds)
  const verdict = grade?.verdict ?? gradeResult?.verdict
  return (
    <div style={{ position: 'relative', background: '#0d0d0d', border: `1px solid ${st.color}59`, borderRadius: 14, padding: compact ? '9px 11px' : 13, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar headshot={leg.headshot} logo={leg.logo} logo2={leg.logo2} label={bet.subtitle || bet.title} status={st} size={compact ? 30 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {badge && <div style={{ marginBottom: 3 }}><Badge text={badge} /></div>}
          <div style={{ fontFamily: R, fontSize: compact ? 14 : 17, fontWeight: 700, color: TEXT, letterSpacing: '0.02em', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{bet.title}</div>
          {bet.subtitle && <div style={{ fontFamily: I, fontSize: 11, color: MUTED }}>{bet.subtitle}</div>}
        </div>
        {bet.book && <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#1c1c1c', color: '#9a9a9a', alignSelf: 'flex-start' }}>{bet.book}</span>}
        {verdict && <VerdictPill verdict={verdict} result={gradeResult} grade={grade} size={compact ? 'sm' : 'md'} />}
        <Ring pct={winProb} size={compact ? 32 : 40} color={liveRingColor(st, winProb)} />
      </div>
      <StatBar stat={leg.statNow} style={{ marginTop: 11 }} />
      <ScoreChip text={leg.scoreLine} status={st} />
      {/* Collapse toggle row */}
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10, cursor: 'pointer', gap: 5 }}>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <ChevronDown size={13} color={open ? NEON : MUTED} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>
      {/* Collapsible footer */}
      <div style={{ maxHeight: open ? '80px' : '0', overflow: 'hidden', transition: 'max-height 0.22s ease' }}>
        <div style={{ paddingTop: 8, display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 7, flexWrap: 'nowrap' }}>
          <StatBox label="ODDS" value={fmtOdds(bet.odds)} />
          {win != null && <StatBox label="STAKE → WIN" value={`$${Number(bet.stake).toFixed(0)} → $${win.toFixed(0)}`} valueSize={12} />}
          <PnlBox pnl={pnl} />
          {bankIn != null && <StatBox label="BANK" value={`$${Number(bankIn).toFixed(0)}`} valueSize={13} />}
          <GradeBadge label="EV" value={grade?.evPct != null ? `${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%` : '—'} good={grade?.evPct != null && grade.evPct >= 0} />
          <GradeBadge label="CLV" value={grade?.clvPct != null ? `${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%` : '—'} good={grade?.clvPct != null && grade.clvPct >= 0} />
          {onEdit && <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', padding: '0 10px', color: MUTED, display: 'flex', alignItems: 'center', flexShrink: 0 }}><Pencil size={12} /></button>}
        </div>
      </div>
    </div>
  )
}

function LegRow({ leg, last = false }) {
  const st = leg.status
  // One sportsbook-slip line: status dot + logo on the left, pick + odds aligned in a row,
  // live score / stat below. Name + odds stay light/readable; the bar (StatBar) carries green/red.
  const dim = st.key === 'lost'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 13px', position: 'relative', borderBottom: last ? 'none' : '1px solid #161616' }}>
      <Avatar headshot={leg.headshot} logo={leg.logo} logo2={leg.logo2} label={leg.subtitle || leg.title} status={st} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: dim ? '#9a9a9a' : TEXT, textDecoration: dim ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leg.title}</span>
          <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: dim ? '#9a9a9a' : TEXT, flexShrink: 0 }}>{fmtOdds(leg.odds)}</span>
        </div>
        {leg.subtitle && <div style={{ fontFamily: I, fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leg.subtitle}</div>}
        {leg.close != null && <div style={{ fontFamily: I, fontSize: 9, color: MUTED }}>closed {fmtOdds(leg.close)}</div>}
        <StatBar stat={leg.statNow} />
        <ScoreChip text={leg.scoreLine} status={st} />
      </div>
      <span style={{ color: st.color, fontSize: 17, fontWeight: 700, lineHeight: 1, marginTop: 1 }}>{GLYPH[st.key] || ''}</span>
    </div>
  )
}

export function BetTicket({ bet, grade, pnl = null, onEdit = null, badge = null }) {
  const [open, setOpen] = useState(false)
  // A SETTLED parlay (result W/L/P → bet.status) shows its real outcome in the header;
  // only an Open parlay falls back to live leg-progress. Without this a won/lost parlay
  // kept rendering "0 OF 2 HIT · LIVE" with an amber ring even after auto-settle.
  const liveStatus = ticketStatus(bet.legs)
  const settledKey = bet.status?.key
  const isSettled = settledKey === 'won' || settledKey === 'lost' || settledKey === 'push'
  const t = isSettled
    ? { ...liveStatus, overall: bet.status, label: settledKey === 'won' ? 'WON' : settledKey === 'lost' ? 'LOST' : 'PUSH' }
    : liveStatus
  const clvVal = grade?.clvPct ?? slipClv(bet.legs.map(l => ({ entry: l.odds, close: l.close }))).clvPct
  const win = toWin(bet.odds, bet.stake)
  // Combined parlay win probability = product of each leg's win prob (independent legs).
  const legProbs = bet.legs.map(l => l.liveWP ?? l.winProb).filter(p => p != null && !Number.isNaN(p))
  const comboProb = legProbs.length === bet.legs.length && legProbs.length ? legProbs.reduce((a, b) => a * b, 1) : null
  const ticketGrade = { evPct: grade?.evPct, clvPct: clvVal, winProb: comboProb ?? grade?.winProb }
  const gradeResult = verdictFromBetGrade(ticketGrade, bet.odds)
  const verdict = grade?.verdict ?? gradeResult?.verdict
  return (
    <div style={{ position: 'relative', border: `1px solid ${t.overall.color}59`, borderRadius: 14, background: '#0c0c0c', overflow: 'hidden' }}>
      {/* Left status-color accent stripe, matching the single card. */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: t.overall.color, zIndex: 2 }} />
      {/* Slip header — title + leg count on the left; verdict, progress pill + win-prob ring on the right. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 13px 9px', background: `${t.overall.color}0d` }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Badge text={badge} />
            <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.title}</span>
          </span>
          <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.12em' }}>{bet.legs.length}-LEG PARLAY</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          {verdict && <VerdictPill verdict={verdict} result={gradeResult} grade={ticketGrade} size="sm" />}
          <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${t.overall.color}1f`, color: t.overall.color, whiteSpace: 'nowrap' }}>{t.label}{t.overall.key === 'live' ? ' · LIVE' : ''}</span>
          <Ring pct={t.overall.key === 'won' ? 1 : t.overall.key === 'lost' ? 0 : (comboProb ?? grade?.winProb)} size={36} color={liveRingColor(t.overall, comboProb ?? grade?.winProb)} />
        </span>
      </div>

      {/* Combined odds + stake → to win, sportsbook-slip style. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 13px', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e', background: '#0a0a0a' }}>
        <span style={{ fontFamily: R, fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: '0.02em' }}>{fmtOdds(bet.odds)}</span>
        {win != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: R, fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: MUTED }}>${Number(bet.stake).toFixed(0)}</span>
            <span style={{ color: MUTED, fontSize: 12 }}>→</span>
            <span style={{ color: t.overall.key === 'lost' ? '#9a9a9a' : NEON }}>${win.toFixed(0)}</span>
          </span>
        )}
      </div>

      <div style={{ position: 'relative', padding: '2px 0' }}>
        <div style={{ position: 'absolute', left: 32, top: 30, bottom: 30, width: 2, background: '#262626' }} />
        {bet.legs.map((leg, i) => <div key={i} style={{ position: 'relative', zIndex: 1 }}><LegRow leg={leg} last={i === bet.legs.length - 1} /></div>)}
      </div>

      {/* Collapse toggle row */}
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 13px 0', cursor: 'pointer', gap: 5 }}>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <ChevronDown size={13} color={open ? NEON : MUTED} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>
      {/* Collapsible footer */}
      <div style={{ maxHeight: open ? '80px' : '0', overflow: 'hidden', transition: 'max-height 0.22s ease' }}>
        <div style={{ padding: '8px 13px 12px', display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 7 }}>
          <StatBox label="ODDS" value={fmtOdds(bet.odds)} />
          {win != null && <StatBox label="STAKE → WIN" value={`$${Number(bet.stake).toFixed(0)} → $${win.toFixed(0)}`} valueSize={12} />}
          <PnlBox pnl={pnl} />
          <GradeBadge label="EV" value={grade?.evPct != null ? `${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%` : '—'} good={grade?.evPct != null && grade.evPct >= 0} />
          <GradeBadge label="CLV" value={clvVal != null ? `${clvVal >= 0 ? '+' : ''}${clvVal.toFixed(1)}%` : '—'} good={clvVal != null && clvVal >= 0} />
          {onEdit && <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', padding: '0 10px', color: MUTED, display: 'flex', alignItems: 'center', flexShrink: 0 }}><Pencil size={12} /></button>}
        </div>
      </div>
    </div>
  )
}
