// "By Sportsbook" line chart — one line per BOOK for the selected moneyline side, color-matched
// chips below (Sharp app look). Fed by per-book odds_history snapshots (fetchBookMovement).
// Shared by the Matrix Bot (CH2 LOOK) and the Game Center game card so it's one component.
import { useState, useEffect } from 'react'
import { NEON, NEON_T, R, MUTED, BORDER, TEXT, CARD, BOOK_NAMES, fmtAm } from './botShared.jsx'
import { fetchBookMovement } from '../lib/oddsHistory.js'
import { REPUTABLE_BOOKS } from '../lib/edgeFilter.js'

const up = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop().toUpperCase()
const BOOK_LINE_COLORS = ['#378ADD', '#1D9E75', '#BDFF00', '#FF3B3B', '#EF9F27', '#A78BFA', '#5DCAA5', '#F472B6', '#38BDF8', '#FB923C']

// US RETAIL books people actually bet — shown first, in this order. Sharp/exchange books
// (Pinnacle, Betfair) are EXCLUDED from the chart — they're not books a user bets at.
const BOOK_PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'williamhill_us', 'espnbet', 'fanatics', 'betrivers', 'hardrockbet', 'ballybet', 'betparx', 'fliff']
// Clean, DISTINCT chip labels (slice(0,3) collided: FanDuel/Fanatics both → "Fan", BetMGM/
// BetRivers/Betfair all → "Bet"). Map each book to a unique short tag.
const BOOK_ABBR = {
  draftkings: 'DK', fanduel: 'FD', betmgm: 'MGM', caesars: 'CZR', williamhill_us: 'CZR',
  espnbet: 'ESPN', fanatics: 'FAN', betrivers: 'BR', hardrockbet: 'HR',
  ballybet: 'BALLY', betparx: 'PARX', fliff: 'FLIFF',
}
const bookTag = (book) => BOOK_ABBR[book] || (BOOK_NAMES[book] || book).slice(0, 4).toUpperCase()
const MAX_BOOK_LINES = 7
// Keep only US-retail books (no Pinnacle/Betfair), ordered by what bettors care about, capped.
export function curateBooks(byBook) {
  const entries = Object.entries(byBook || {}).filter(([book]) => BOOK_PRIORITY.includes(book))
  entries.sort((a, b) => BOOK_PRIORITY.indexOf(a[0]) - BOOK_PRIORITY.indexOf(b[0]))
  return Object.fromEntries(entries.slice(0, MAX_BOOK_LINES))
}

const toDec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)

// "Best Available" — the single best price across reputable books at each point in time.
// Aligns books on the union of capture timestamps and carries the last known price forward
// (a book that didn't update still has its standing price). Returns one series + which book
// holds the best price right now. This is the Pikkit "Best Available" line.
export function computeBestAvailable(byBook) {
  const books = curateBooks(byBook)
  const names = Object.keys(books)
  if (!names.length) return null
  const times = [...new Set(names.flatMap(b => books[b].times || []))].sort()
  if (!times.length) return null
  // per-book timestamp → value lookup
  const lookup = {}
  for (const b of names) {
    lookup[b] = {}
    const { times: ts = [], series = [] } = books[b]
    ts.forEach((t, i) => { lookup[b][t] = series[i] })
  }
  const last = {}                       // carried-forward last value per book
  const series = [], bestBookSeries = []
  for (const t of times) {
    for (const b of names) { if (lookup[b][t] != null) last[b] = lookup[b][t] }
    let bestV = null, bestB = null
    for (const b of names) {
      const v = last[b]
      if (v == null) continue
      if (bestV == null || (toDec(v) ?? 0) > (toDec(bestV) ?? 0)) { bestV = v; bestB = b }
    }
    series.push(bestV); bestBookSeries.push(bestB)
  }
  return { series, times, current: series[series.length - 1], bestBook: bestBookSeries[bestBookSeries.length - 1] }
}

// Self-contained: fetches per-book ML history for an event and renders the chart with an
// away/home toggle. Renders nothing until per-book history exists (cron accrues it over time).
// Drop-in for the Game Center card AND the bot.
export function BookLineMovement({ event, title = true, collapsible = false }) {
  const [byBook, setByBook] = useState({})
  const [side, setSide] = useState('away')
  const [open, setOpen] = useState(!collapsible)   // collapsible → starts closed
  useEffect(() => {
    if (!event?.external_event_id) { setByBook({}); return }
    let live = true
    fetchBookMovement(event.external_event_id, 'ml', side).then(m => { if (live) setByBook(m || {}) }).catch(() => {})
    return () => { live = false }
  }, [event?.external_event_id, side])
  if (!event?.external_event_id) return null
  const hasData = Object.keys(curateBooks(byBook)).length > 0
  if (collapsible) {
    // Matches the Fair Value / Line Movement section-header card style in Insights.
    // ALWAYS render the header (even with no data yet) so the section never "disappears".
    return (
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
        <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '10px 14px', borderBottom: open ? `1px solid ${BORDER}` : 'none', background: 'rgba(189,255,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>Line Movement <span style={{ color: 'rgba(255,255,255,0.3)' }}>· by sportsbook</span></span>
          <span style={{ position: 'absolute', right: '14px', color: open ? NEON_T : MUTED, fontSize: '10px' }}>{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div style={{ padding: '12px 14px' }}>
            {hasData
              ? <BookMoveChart byBook={byBook} game={{ away: event.away_team, home: event.home_team }} side={side} onSide={setSide} />
              : <div style={{ fontFamily: R, fontSize: '11px', color: MUTED, textAlign: 'center', padding: '6px 0' }}>By-sportsbook history is building — fills in as prices are captured.</div>}
          </div>
        )}
      </div>
    )
  }
  if (!hasData) return null
  return (
    <div>
      {title && <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>Line Movement · By Sportsbook</div>}
      <BookMoveChart byBook={byBook} game={{ away: event.away_team, home: event.home_team }} side={side} onSide={setSide} />
    </div>
  )
}

export function BookMoveChart({ byBook: rawByBook, game, side, onSide }) {
  const [mode, setMode] = useState('books')           // 'books' = By Sportsbook | 'best' = Best Available
  const decT = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)
  const byBook = curateBooks(rawByBook)              // reputable US books only, capped & ordered
  const colored = Object.entries(byBook).map(([book, m], i) => ({ book, m, color: BOOK_LINE_COLORS[i % BOOK_LINE_COLORS.length] }))
  const best = computeBestAvailable(rawByBook)
  // Series feeding the y-axis scale depends on the active view.
  const all = mode === 'best' ? (best?.series || []).filter(v => v != null) : colored.flatMap(c => c.m.series)
  if (!all.length) return null
  const W = 320, H = 160, padL = 36, padR = 10, padT = 12, padB = 16
  const min = Math.min(...all), max = Math.max(...all), range = (max - min) || 1
  const x = (i, n) => padL + (n <= 1 ? (W - padL - padR) : (i / (n - 1)) * (W - padL - padR))
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB)
  const bestBook = colored.reduce((b, c) => (!b || (decT(c.m.current) ?? 0) > (decT(byBook[b].current) ?? 0)) ? c.book : b, null)
  const chips = [...colored].sort((a, b) => (decT(b.m.current) ?? 0) - (decT(a.m.current) ?? 0))
  const Toggle = ({ val, label }) => (
    <button onClick={() => setMode(val)} style={{ flex: 1, padding: '6px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', border: `1px solid ${mode === val ? NEON : BORDER}`, background: mode === val ? 'rgba(189,255,0,0.1)' : 'transparent', color: mode === val ? NEON_T : MUTED }}>{label}</button>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <Toggle val="books" label="By Sportsbook" />
        <Toggle val="best" label="Best Available" />
      </div>
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
        {mode === 'best' ? (() => {
          const s = (best?.series || []).filter(v => v != null)
          const n = s.length
          const pts = s.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          return (
            <g>
              <polyline points={pts} fill="none" stroke={NEON} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
              {n > 0 && <circle cx={x(n - 1, n)} cy={y(s[n - 1])} r="3.5" fill={NEON} />}
            </g>
          )
        })() : colored.map(({ book, m, color }) => {
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
      {mode === 'best' ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '7px', border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)' }}>
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>Best · {best?.bestBook ? (BOOK_NAMES[best.bestBook] || best.bestBook) : '—'}</span>
            <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: NEON_T }}>{best?.current != null ? fmtAm(best.current) : '—'}</span>
          </span>
        </div>
      ) : (
        <div className="tv-ticker" style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          {chips.map(({ book, m, color }) => (
            <span key={book} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '7px', border: `1px solid ${book === bestBook ? NEON : BORDER}`, background: book === bestBook ? 'rgba(189,255,0,0.08)' : '#0d0d0d' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>{bookTag(book)}</span>
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: book === bestBook ? NEON_T : TEXT }}>{fmtAm(m.current)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
