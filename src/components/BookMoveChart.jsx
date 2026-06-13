// "By Sportsbook" line chart — one line per BOOK for the selected moneyline side, color-matched
// chips below (Sharp app look). Fed by per-book odds_history snapshots (fetchBookMovement).
// Shared by the Matrix Bot (CH2 LOOK) and the Game Center game card so it's one component.
import { useState, useEffect } from 'react'
import { NEON, NEON_T, R, MUTED, BORDER, TEXT, BOOK_NAMES, fmtAm } from './botShared.jsx'
import { fetchBookMovement } from '../lib/oddsHistory.js'

const up = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop().toUpperCase()
const BOOK_LINE_COLORS = ['#378ADD', '#1D9E75', '#BDFF00', '#FF3B3B', '#EF9F27', '#A78BFA', '#5DCAA5', '#F472B6', '#38BDF8', '#FB923C']

// Self-contained: fetches per-book ML history for an event and renders the chart with an
// away/home toggle. Renders nothing until per-book history exists (cron accrues it over time).
// Drop-in for the Game Center card AND the bot.
export function BookLineMovement({ event, title = true }) {
  const [byBook, setByBook] = useState({})
  const [side, setSide] = useState('away')
  useEffect(() => {
    if (!event?.external_event_id) { setByBook({}); return }
    let live = true
    fetchBookMovement(event.external_event_id, 'ml', side).then(m => { if (live) setByBook(m || {}) }).catch(() => {})
    return () => { live = false }
  }, [event?.external_event_id, side])
  if (!event?.external_event_id || !Object.keys(byBook).length) return null
  return (
    <div>
      {title && <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>Line Movement · By Sportsbook</div>}
      <BookMoveChart byBook={byBook} game={{ away: event.away_team, home: event.home_team }} side={side} onSide={setSide} />
    </div>
  )
}

export function BookMoveChart({ byBook, game, side, onSide }) {
  const decT = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)
  const colored = Object.entries(byBook).map(([book, m], i) => ({ book, m, color: BOOK_LINE_COLORS[i % BOOK_LINE_COLORS.length] }))
  const all = colored.flatMap(c => c.m.series)
  if (!all.length) return null
  const W = 320, H = 160, padL = 36, padR = 10, padT = 12, padB = 16
  const min = Math.min(...all), max = Math.max(...all), range = (max - min) || 1
  const x = (i, n) => padL + (n <= 1 ? (W - padL - padR) : (i / (n - 1)) * (W - padL - padR))
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB)
  const bestBook = colored.reduce((b, c) => (!b || (decT(c.m.current) ?? 0) > (decT(byBook[b].current) ?? 0)) ? c.book : b, null)
  const chips = [...colored].sort((a, b) => (decT(b.m.current) ?? 0) - (decT(a.m.current) ?? 0))
  return (
    <div>
      {game && onSide && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {['away', 'home'].map(s => (
            <button key={s} onClick={() => onSide(s)} style={{ flex: 1, padding: '7px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, border: `1px solid ${side === s ? NEON : BORDER}`, background: side === s ? 'rgba(189,255,0,0.1)' : 'transparent', color: side === s ? NEON_T : MUTED }}>{up(s === 'away' ? game.away : game.home)} ML</button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <text x="3" y={y(max) + 3} fill={MUTED} fontSize="8" fontFamily="Rajdhani">{fmtAm(Math.round(max))}</text>
        <text x="3" y={y(min) + 3} fill={MUTED} fontSize="8" fontFamily="Rajdhani">{fmtAm(Math.round(min))}</text>
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(189,255,0,0.12)" strokeWidth="1" />
        {colored.map(({ book, m, color }) => {
          const n = m.series.length
          const pts = m.series.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          return (
            <g key={book}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={book === bestBook ? 2.5 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1, n)} cy={y(m.series[n - 1])} r="3" fill={color} />
            </g>
          )
        })}
      </svg>
      <div className="tv-ticker" style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        {chips.map(({ book, m, color }) => (
          <span key={book} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '7px', border: `1px solid ${book === bestBook ? NEON : BORDER}`, background: book === bestBook ? 'rgba(189,255,0,0.08)' : '#0d0d0d' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>{(BOOK_NAMES[book] || book).slice(0, 3)}</span>
            <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: book === bestBook ? NEON_T : TEXT }}>{fmtAm(m.current)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
