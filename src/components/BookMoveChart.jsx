// "By Sportsbook" line chart — one line per BOOK for the selected moneyline side, color-matched
// chips below (Sharp app look). Fed by per-book odds_history snapshots (fetchBookMovement).
// Shared by the Matrix Bot (CH2 LOOK) and the Game Center game card so it's one component.
import { useState, useEffect } from 'react'
import { NEON, NEON_T, R, MUTED, BORDER, TEXT, CARD, BOOK_NAMES, fmtAm } from './botShared.jsx'
import { fetchBookMovement } from '../lib/oddsHistory.js'
import { REPUTABLE_BOOKS } from '../lib/edgeFilter.js'

const up = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop().toUpperCase()
const BOOK_LINE_COLORS = ['#378ADD', '#1D9E75', '#BDFF00', '#FF3B3B', '#EF9F27', '#A78BFA', '#5DCAA5', '#F472B6', '#38BDF8', '#FB923C', '#E879F9', '#FACC15']

// Books people actually bet, shown first; the no-vig exchanges (Novig/ProphetX) + Fliff/Rebet
// ranked high so they make the line-chart cut; PINNACLE last as the SHARP reference line.
// williamhill_us dropped (duplicate of Caesars). Betfair stays OUT — not a book you bet at.
const BOOK_PRIORITY = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet', 'fanatics', 'hardrockbet', 'fliff', 'novig', 'prophetx', 'rebet', 'betrivers', 'ballybet', 'betparx', 'pinnacle']
// Clean, DISTINCT chip labels (slice(0,3) collided: FanDuel/Fanatics both → "Fan", BetMGM/
// BetRivers/Betfair all → "Bet"). Map each book to a unique short tag.
const BOOK_ABBR = {
  draftkings: 'DK', fanduel: 'FD', betmgm: 'MGM', caesars: 'CZR', williamhill_us: 'CZR',
  espnbet: 'ESPN', fanatics: 'FAN', betrivers: 'BR', hardrockbet: 'HR',
  ballybet: 'BALLY', betparx: 'PARX', fliff: 'FLIFF', pinnacle: 'PIN',
  novig: 'NOVIG', prophetx: 'PROPH', rebet: 'REBET', onyxodds: 'ONYX',
}
const bookTag = (book) => BOOK_ABBR[book] || (BOOK_NAMES[book] || book).slice(0, 4).toUpperCase()
const MAX_BOOK_LINES = 12
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
  const [open, setOpen] = useState(true)   // open by default (data fills lazily; free to render)
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

export function BookMoveChart({ byBook: rawByBook, game, market = 'ml', side, onSide, mode: modeProp, onMode }) {
  const [modeInner, setModeInner] = useState('books')  // 'books' = By Sportsbook | 'best' = Best Available
  const [picked, setPicked] = useState(null)           // null = default (top 2); Set = the books the user tapped to compare
  const [showHelp, setShowHelp] = useState(false)      // "how to read this" explainer
  const mode = modeProp ?? modeInner                    // parent may lift this into the settings gear
  const setMode = onMode ?? setModeInner
  const decT = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)
  const byBook = curateBooks(rawByBook)              // reputable US books only, capped & ordered
  const colored = Object.entries(byBook).map(([book, m], i) => ({ book, m, color: BOOK_LINE_COLORS[i % BOOK_LINE_COLORS.length] }))
  const best = computeBestAvailable(rawByBook)
  const chips = [...colored].sort((a, b) => (decT(b.m.current) ?? 0) - (decT(a.m.current) ?? 0))
  // All books shown by default; tap a chip to hide/show its line (picked = the user's custom set).
  const defaultPicks = chips.map(c => c.book)
  const activeBooks = (picked && picked.size) ? picked : new Set(defaultPicks)
  const drawn = colored.filter(c => activeBooks.has(c.book))
  const toggleBook = (book) => {
    const cur = (picked && picked.size) ? new Set(picked) : new Set(defaultPicks)
    cur.has(book) ? cur.delete(book) : cur.add(book)
    setPicked(cur.size ? cur : new Set([book]))   // never leave the chart empty
  }
  // Scale by DECIMAL odds (continuous & monotonic) so the line never jumps at the +100/-100
  // boundary the way raw American odds do; axis ticks are labelled back in American.
  const decSeries = (arr) => arr.map(decT).filter(v => v != null)
  const all = mode === 'best' ? decSeries((best?.series || []).filter(v => v != null)) : (drawn.length ? drawn : colored).flatMap(c => decSeries(c.m.series))
  if (!all.length) return null
  const W = 340, H = 208, padL = 30, padR = 12, padT = 14, padB = 18
  const min = Math.min(...all), max = Math.max(...all), range = (max - min) || 1
  const x = (i, n) => padL + (n <= 1 ? (W - padL - padR) : (i / (n - 1)) * (W - padL - padR))
  const yD = (dec) => padT + ((dec - min) / range) * (H - padT - padB)   // decimal → y (favorite/shorter price on TOP)
  const y = (am) => { const d = decT(am); return d == null ? null : yD(d) }   // American → y
  const amFromDec = (d) => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1))
  const ticks = Array.from({ length: 5 }, (_, i) => min + range * i / 4)
  const bestBook = colored.reduce((b, c) => (!b || (decT(c.m.current) ?? 0) > (decT(byBook[b].current) ?? 0)) ? c.book : b, null)
  const Toggle = ({ val, label }) => (
    <button onClick={() => setMode(val)} style={{ flex: 1, padding: '6px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', border: `1px solid ${mode === val ? NEON : BORDER}`, background: mode === val ? 'rgba(189,255,0,0.1)' : 'transparent', color: mode === val ? NEON_T : MUTED }}>{label}</button>
  )
  return (
    <div>
      {!onMode && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <Toggle val="books" label="By Sportsbook" />
          <Toggle val="best" label="Best Available" />
        </div>
      )}
      {game && onSide && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {(market === 'total' ? ['over', 'under'] : ['away', 'home']).map(s => {
            const label = market === 'total'
              ? (s === 'over' ? 'OVER' : 'UNDER')
              : `${up(s === 'away' ? game.away : game.home)}${market === 'ml' ? ' ML' : ''}`
            return (
              <button key={s} onClick={() => onSide(s)} style={{ flex: 1, padding: '7px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, border: `1px solid ${side === s ? NEON : BORDER}`, background: side === s ? 'rgba(189,255,0,0.1)' : 'transparent', color: side === s ? NEON_T : MUTED }}>{label}</button>
            )
          })}
        </div>
      )}
      {game && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase' }}>
            {up(game.away)} @ {up(game.home)} · line movement
          </span>
          <button onClick={() => setShowHelp(h => !h)} aria-label="How to read this chart"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: `1px solid ${showHelp ? NEON : BORDER}`, background: showHelp ? 'rgba(189,255,0,0.12)' : 'transparent', color: showHelp ? NEON_T : MUTED, cursor: 'pointer', fontFamily: R, fontSize: '9px', fontWeight: 700, lineHeight: 1, padding: 0 }}>i</button>
        </div>
      )}
      {showHelp && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 12px', marginBottom: '10px', fontFamily: R, fontSize: '11px', lineHeight: 1.55, color: 'var(--text-sub)' }}>
          <div style={{ marginBottom: '4px' }}><span style={{ color: NEON_T, fontWeight: 700 }}>← → time.</span> Far left = the opening line; the dot on the right = the price now.</div>
          <div style={{ marginBottom: '4px' }}><span style={{ color: NEON_T, fontWeight: 700 }}>↑ ↓ price.</span> Top = shorter / more favored (−); bottom = longer (+). Numbers on the left are the odds at that height.</div>
          <div style={{ marginBottom: '4px' }}><span style={{ color: NEON_T, fontWeight: 700 }}>Each line = a book.</span> Tap the chips to show/hide. The <b>dashed line is the sharp book (Pinnacle)</b> — watch it move first.</div>
          <div><span style={{ color: NEON_T, fontWeight: 700 }}>The read:</span> books bunching the same way = real market steam; the sharp line leading = the tell. The spread on the right edge = where the best number is.</div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* gridlines at even decimal steps, labelled back in American odds */}
        {ticks.map((d, i) => (
          <g key={i}>
            <line x1={padL} y1={yD(d)} x2={W - padR} y2={yD(d)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 3" />
            <text x="2" y={yD(d) + 3} fill={MUTED} fontSize="8" fontFamily="Rajdhani">{fmtAm(amFromDec(d))}</text>
          </g>
        ))}
        {mode === 'best' ? (() => {
          const s = (best?.series || []).filter(v => v != null)
          const n = s.length
          const pts = s.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          return (
            <g>
              <polyline points={pts} fill="none" stroke={NEON} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
              {s.map((v, i) => <circle key={i} cx={x(i, n)} cy={y(v)} r={i === n - 1 ? 3.5 : 1.8} fill={NEON} />)}
            </g>
          )
        })() : drawn.map(({ book, m, color }) => {
          const n = m.series.length
          const isSharp = book === 'pinnacle'                                   // sharp book → dashed
          const pts = m.series.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          return (
            <g key={book}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={isSharp || book === bestBook ? 2.4 : 1.7} strokeDasharray={isSharp ? '5 4' : 'none'} strokeLinejoin="round" strokeLinecap="round" />
              {m.series.map((v, i) => <circle key={i} cx={x(i, n)} cy={y(v)} r={i === n - 1 ? 3 : 1.6} fill={color} />)}
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
        <div>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', textAlign: 'center', marginTop: '8px', marginBottom: '6px' }}>
            Tap a book to show/hide · {activeBooks.size}/{chips.length} shown{chips.some(c => c.book === 'pinnacle') ? ' · dashed = sharp (Pinnacle)' : ''}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {chips.map(({ book, m, color }) => {
              const on = activeBooks.has(book)
              return (
                <button key={book} onClick={() => toggleBook(book)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '7px', cursor: 'pointer', border: `1px solid ${on ? color : BORDER}`, background: on ? 'rgba(255,255,255,0.07)' : '#0d0d0d', opacity: on ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>{bookTag(book)}</span>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: on ? TEXT : MUTED }}>{fmtAm(m.current)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
