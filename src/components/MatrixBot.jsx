// MATRIX EV BOT — retro broadcast-TV tab. Everything renders inside a CRT screen.
//   CH1 FIND  — scan the board → +EV edge rows + a slate ticker (credit-guarded)
//   CH2 LOOK  — a game's books (best highlighted) + props + line movement, bet links
//   CH3 TRACK — your logged bets graded for EV / CLV
// Heavy lifting reuses the already-built engine, endpoints and discipline libs.
import { useState, useEffect, useMemo, useRef } from 'react'
import './MatrixBot.css'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER, BOOK_NAMES, SPREAD_LABEL, fmtAm, Sparkline } from './botShared.jsx'
import { fetchEvents } from '../lib/events.js'
import { fetchLineMovement } from '../lib/oddsHistory.js'
import { matchBetToEvent, evaluateBet } from '../lib/betMatch.js'
import { decorate } from '../lib/betLinks.js'
import { groupEdgesByGame, applyFeedFilters, gameKey } from '../lib/botFeed.js'
import { getScan, putScan } from '../lib/scanCache.js'
import { kellyStake } from '../lib/kelly.js'
import { labelFor } from '../lib/propMarkets.js'
import { LineShop } from './LiveCenter.jsx'

const SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL']
const todayStr = () => new Date().toISOString().slice(0, 10)
const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const up = (s) => lw(s).toUpperCase()
const isPreGame = (ev) => ev.status === 'NS' || ev.status === 'STATUS_SCHEDULED'

// Format a point with sign (+1.5 / -1.5). Plain string for nulls.
const fmtPt = (p) => p == null ? '' : (p > 0 ? `+${p}` : `${p}`)
// Human pick label for an edge across markets: ML / spread / total.
const pickLabel = (e) => {
  if (e.market === 'totals') return `${/^o/i.test(e.outcome) ? 'OVER' : 'UNDER'} ${e.point}`
  if (e.market === 'spreads') return `${up(e.outcome)} ${fmtPt(e.point)}`
  return `${up(e.outcome)} ML`
}

const pill = (active) => ({ flexShrink: 0, padding: '6px 12px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${active ? NEON : BORDER}`, background: active ? NEON : 'transparent', color: active ? '#0A0A0A' : MUTED })

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 12px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>{text}</div>
}

function BetLink({ book, link }) {
  const url = decorate(book, link)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      style={{ flexShrink: 0, padding: '6px 10px', borderRadius: '6px', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'none', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      Bet at {BOOK_NAMES[book] || book} →
    </a>
  )
}

// ── The CRT television: bezel + screen + in-screen broadcast header. ──
function TvFrame({ ch, children }) {
  return (
    <div className="tvbot-bezel">
      <div className="tvbot-screen" style={{ padding: '14px 14px 12px' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T }}>◤ RISK MATRIX TV</span>
            <span className="tvbot-onair"><span className="dot" /><span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', letterSpacing: '0.12em', color: DANGER }}>ON AIR · CH{ch}</span></span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MatrixBot({ onLogPosition, bets = [], token = null, unitSize = 0, bankroll = 0 }) {
  const [channel, setChannel] = useState('find')   // find | look | track
  const [sport, setSport]     = useState('MLB')
  const [game, setGame]       = useState(null)
  const [showFilters, setShowFilters] = useState(false)   // gear (FIND filters) lives in the tab row

  return (
    <div className="mbot-root" style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 12px 90px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {channel === 'find' && (
          <button onClick={() => setShowFilters(f => !f)} aria-label="Filters" style={{ flexShrink: 0, width: '40px', borderRadius: '7px', cursor: 'pointer', fontSize: '15px', lineHeight: 1, border: `1px solid ${showFilters ? NEON : BORDER}`, background: showFilters ? NEON : 'transparent', color: showFilters ? '#0A0A0A' : NEON_T }}>⚙</button>
        )}
        {[['find', 'CH 1 · FIND'], ['look', 'CH 2 · LOOK'], ['track', 'CH 3 · TRACK']].map(([k, label]) => (
          <button key={k} onClick={() => setChannel(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${channel === k ? NEON : BORDER}`, background: channel === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: channel === k ? NEON_T : MUTED }}>{label}</button>
        ))}
      </div>
      {/* FIND stays mounted (just hidden) so a scan survives channel switches — no re-scan */}
      <div style={{ display: channel === 'find' ? 'block' : 'none' }}>
        <FindChannel token={token} bankroll={bankroll} showFilters={showFilters}
          onPick={(g) => { setGame(g); if (g.sport) setSport(g.sport); setChannel('look') }} />
      </div>
      {channel !== 'find' && (
        <div key={channel} className="tvbot-tune">
          {channel === 'look' && <LookChannel game={game} sport={sport} token={token} onLogPosition={onLogPosition} onBack={() => setChannel('find')} />}
          {channel === 'track' && <TrackChannel bets={bets} sport={sport} token={token} />}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────── CH 1 · FIND ─────────────────────────────
// One LIVE feed across all sports (the SharpMoney/OddsJam model): scan every sport,
// merge into a single ranked list, slice it with FILTER chips (no per-sport tabs),
// auto-refresh on a timer. The TV and the dense board both just display this feed.
const FEED_SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA']   // sports the provider supports today
const MARKET_CHIPS = [['ALL', 'ALL'], ['h2h', 'ML'], ['spreads', 'SPREAD'], ['totals', 'TOTAL'], ['props', 'PROPS']]

function FindChannel({ token, bankroll = 0, onPick, showFilters = false }) {
  const [events, setEvents]   = useState([])
  const [feed, setFeed]       = useState({ status: 'idle', edges: [], scanned: 0, credits: null })
  const [props, setProps]     = useState(null)
  const [err, setErr]         = useState('')
  const [view, setView]       = useState('tv')        // tv | board
  const [sportF, setSportF]   = useState('ALL')       // filters replace tabs (toggled by the gear)
  const [marketF, setMarketF] = useState('ALL')
  const [propCat, setPropCat] = useState('ALL')   // prop category filter (strikeouts, points…)
  const [minEv, setMinEv]     = useState(0)
  const scanning = useRef(false)

  // pull pre-games for every sport once (Supabase, no API credits) — for props + ticker
  useEffect(() => {
    let live = true
    Promise.all(FEED_SPORTS.map(s =>
      fetchEvents(s, 'today').then(r => (r?.data || []).map(e => ({ ...e, _sport: s }))).catch(() => [])
    )).then(arr => { if (live) setEvents(arr.flat()) })
    return () => { live = false }
  }, [])

  const preGames = useMemo(() => events.filter(isPreGame), [events])
  const evByKey = useMemo(() => {
    const m = {}
    for (const ev of preGames) m[gameKey(ev.away_team, ev.home_team)] = ev
    return m
  }, [preGames])

  const buildGame = (ev) => ({ away: ev.away_team, home: ev.home_team, away_abbr: ev.away_abbr, home_abbr: ev.home_abbr, sport: ev._sport, external_event_id: ev.external_event_id, commenceTime: ev.start_time })
  const resolveGame = (e) => {
    const ev = evByKey[gameKey(e.away, e.home)]
    return ev ? buildGame(ev) : { away: e.away, home: e.home, sport: e._sport, external_event_id: '', commenceTime: e.commenceTime }
  }

  // Scan EVERY sport and merge into one feed. force=true re-fetches (server cache makes
  // repeats ~free) for the live auto-refresh; otherwise we reuse the per-day client cache.
  async function runScan(force = false) {
    if (!token || scanning.current) return
    scanning.current = true
    if (!force) setFeed(f => ({ ...f, status: 'scanning', scanned: 0 }))
    setErr('')
    const all = []
    let scanned = 0, credits = null, anyError = ''
    for (const s of FEED_SPORTS) {
      try {
        let payload = force ? null : getScan(s, todayStr())
        if (!payload) {
          const res = await fetch(`/api/scan-edges?sport=${encodeURIComponent(s)}`, { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) { const d = await res.json(); payload = { edges: d.edges || [], creditsRemaining: d.creditsRemaining }; putScan(s, todayStr(), payload) }
          else anyError = (await res.json().catch(() => ({}))).error || `scan ${res.status}`
        }
        if (payload) { for (const e of payload.edges) all.push({ ...e, _sport: s }); if (payload.creditsRemaining != null) credits = payload.creditsRemaining }
      } catch (e) { anyError = e.message }
      scanned++
      if (!force) setFeed({ status: 'scanning', edges: [...all], scanned, credits })
    }
    scanning.current = false
    setFeed({ status: all.length || !anyError ? 'done' : 'error', edges: all, scanned, credits })
    if (anyError && !all.length) setErr(anyError)
  }

  // LIVE: auto-refresh the feed every 2 min once we've scanned (server cache = cheap).
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => { if (feed.status === 'done') runScan(true) }, 120000)
    return () => clearInterval(id)
  }, [token, feed.status])

  // Selecting PROPS in the gear IS the trigger — scan props once when it's first chosen.
  useEffect(() => {
    if (marketF === 'props' && token && preGames.length && props == null) scanProps()
  }, [marketF, token, preGames.length])

  // Props are per-game (one call each) — pulled on tap, merged into the same feed.
  async function scanProps() {
    if (!token || props?.status === 'scanning' || !preGames.length) return
    setProps({ status: 'scanning', edges: [], scanned: 0 })
    const all = []
    let scanned = 0
    for (const ev of preGames) {
      try {
        const res = await fetch(`/api/scan-props?sport=${encodeURIComponent(ev._sport)}&away=${encodeURIComponent(ev.away_team)}&home=${encodeURIComponent(ev.home_team)}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const j = await res.json()
          if (j?.found) {
            for (const e of (j.edges || [])) all.push({ ...e, _sport: ev._sport, _game: buildGame(ev) })
            // line-shop props (no sharp anchor) still show — best price, no EV claim
            for (const e of (j.lineShopOnly || [])) all.push({ ...e, _sport: ev._sport, _game: buildGame(ev), evPct: null, fairProb: null })
          }
        }
      } catch { /* skip a game that fails, keep scanning */ }
      scanned++
      setProps({ status: 'scanning', edges: [...all], scanned })
    }
    setProps({ status: 'done', edges: all, scanned })
  }

  // The single ranked feed, after filter chips: game lines + props, highest EV first.
  const rows = useMemo(() => {
    const inSport = (sp) => sportF === 'ALL' || sp === sportF
    const showGL = marketF !== 'props'
    const showProps = marketF === 'ALL' || marketF === 'props'
    const gl = !showGL ? [] : (feed.edges || [])
      .filter(e => inSport(e._sport) && (marketF === 'ALL' || e.market === marketF) && (e.evPct ?? 0) >= minEv)
      .map(e => ({ key: `gl:${e._sport}:${gameKey(e)}:${e.market}:${e.outcome}:${e.point}`, label: pickLabel(e), book: e.best.book, sub: `${up(e.away)}@${up(e.home)}`, price: e.best.price, evPct: e.evPct, fairProb: e.fairProb, isProp: false, game: resolveGame(e) }))
    const pr = !showProps ? [] : (props?.edges || [])
      .filter(p => inSport(p._sport) && (propCat === 'ALL' || p.market === propCat) && (p.evPct == null ? minEv === 0 : p.evPct >= minEv))
      .map((p, i) => ({ key: `pr:${i}:${p.player}:${p.point}:${p.side}`, label: `${p.player} ${/^o/i.test(p.side) ? 'O' : 'U'}${p.point}`, book: p.best.book, sub: p.marketLabel, price: p.best.price, evPct: p.evPct, fairProb: p.fairProb, isProp: true, game: p._game }))
    return [...gl, ...pr].sort((a, b) => (b.evPct ?? -1) - (a.evPct ?? -1))
  }, [feed, props, sportF, marketF, propCat, minEv, evByKey])

  // prop categories that actually came out of the scan (Strikeouts, Points, …) for the filter
  const propCats = useMemo(() => [...new Set((props?.edges || []).map(p => p.market))], [props])

  const status = feed.status
  const sub = status === 'scanning' ? `▶ SCANNING ${feed.scanned}/${FEED_SPORTS.length} SPORTS ◀`
    : status === 'done' ? '▶ LIVE · ALL SPORTS ◀' : '▶ READY ◀'
  const headline = status === 'scanning' ? 'SCANNING…'
    : status === 'done' ? (rows.length ? '⬡ VALID MATRIX' : 'NO VALID MATRIX')
    : '⬡ TAP SCAN'
  const headlineColor = (status === 'done' && !rows.length) ? MUTED : NEON_T

  const sportChips = ['ALL', ...FEED_SPORTS]

  return (
    <>
      {showFilters && (
        <div style={{ marginBottom: '12px', padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD }}>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>SPORT</div>
          <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {sportChips.map(s => <button key={s} onClick={() => setSportF(s)} style={pill(sportF === s)}>{s}</button>)}
          </div>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>MARKET</div>
          <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {MARKET_CHIPS.map(([k, label]) => <button key={k} onClick={() => setMarketF(k)} style={pill(marketF === k)}>{label}</button>)}
          </div>
          {marketF === 'props' && propCats.length > 0 && (
            <>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>PROP CATEGORY</div>
              <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <button onClick={() => setPropCat('ALL')} style={pill(propCat === 'ALL')}>ALL</button>
                {propCats.map(c => <button key={c} onClick={() => setPropCat(c)} style={pill(propCat === c)}>{labelFor(c)}</button>)}
              </div>
            </>
          )}
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>MIN EV</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 2, 5].map(v => <button key={v} onClick={() => setMinEv(v)} style={pill(minEv === v)}>{v === 0 ? 'ANY' : `${v}%+`}</button>)}
          </div>
        </div>
      )}

      {marketF === 'props' && props?.status === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '6px', marginBottom: '8px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)' }}>SCANNING PROPS… {props.scanned}/{preGames.length}</div>
      )}
      {marketF === 'props' && props?.status === 'done' && (props.edges || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '6px', marginBottom: '8px', fontFamily: R, fontSize: '10px', color: MUTED }}>No props for today's slate · try after lineups post</div>
      )}

      {view === 'board' && (
        <BoardView status={status} rows={rows} edgeCount={rows.length} bankroll={bankroll}
          token={token} err={err} onPickGame={onPick}
          props={props} onScanProps={scanProps} gameCount={preGames.length} />
      )}

      {view === 'tv' && (
      <TvFrame ch="21">
        <div style={{ textAlign: 'center', fontFamily: R, fontSize: '10px', letterSpacing: '0.28em', color: 'rgba(189,255,0,0.6)', marginBottom: '6px' }}>{sub}</div>
        <div className={headlineColor === NEON_T ? 'tv-glow' : ''} style={{ textAlign: 'center', fontFamily: R, fontSize: '30px', fontWeight: 700, letterSpacing: '0.06em', color: headlineColor, marginBottom: '14px' }}>{headline}</div>

        {status === 'done' && rows.map((r, i) => {
          const top = i === 0
          return (
            <div key={r.key} onClick={() => r.game && onPick(r.game)} style={{ cursor: 'pointer', borderLeft: `3px solid ${top ? NEON : 'transparent'}`, background: 'rgba(189,255,0,0.04)', borderRadius: '0 8px 8px 0', padding: '11px 13px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT }}>{r.isProp && <span style={{ fontSize: '8px', color: '#5DCAA5', border: '1px solid #5DCAA5', borderRadius: '3px', padding: '1px 4px', marginRight: '6px', verticalAlign: '2px' }}>PROP</span>}{r.label}</span>
                <span className="tv-glow" style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: NEON_T }}>{fmtAm(r.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>{BOOK_NAMES[r.book] || r.book} · {r.sub}{bankroll > 0 && r.fairProb != null ? ` · bet $${Math.round(kellyStake(r.price, r.fairProb, bankroll))}` : ''}</span>
                <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: r.evPct == null ? MUTED : (top ? NEON_T : '#5DCAA5') }}>{r.evPct != null ? `+${r.evPct.toFixed(1)}% EDGE` : 'LINE SHOP'}</span>
              </div>
            </div>
          )
        })}
        {status === 'done' && !rows.length && <Empty text="Market's efficient right now — we won't fake an edge." />}
        {status === 'scanning' && <div style={{ textAlign: 'center', padding: '8px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)' }}>de-vigging the sharp line…</div>}
        {status === 'idle' && <Empty text={token ? 'Hit ▶ GO LIVE to read the board.' : 'Log in to summon the bot.'} />}
        {status === 'error' && <Empty text={`Scan failed — ${err}`} />}

        {/* slate ticker — teams BIG, sliding across the screen like a broadcast crawl */}
        {preGames.length > 0 && (
          <div className="tv-marquee-wrap" style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid rgba(189,255,0,0.12)` }}>
            <div className="tv-marquee">
              {[...preGames, ...preGames].map((ev, i) => (
                <button key={ev._sport + ev.external_event_id + i} onClick={() => onPick(buildGame(ev))} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: R, fontWeight: 700, fontSize: '17px', color: NEON_T, letterSpacing: '0.04em', whiteSpace: 'nowrap', padding: 0 }}>
                  {ev.away_abbr}@{ev.home_abbr} <span style={{ color: MUTED, fontSize: '11px', fontFamily: 'Courier New, monospace' }}>{(ev.start_time || '').slice(11, 16)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </TvFrame>
      )}

      {/* bottom controls — TV · GO LIVE (middle) · BOARD */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={() => setView('tv')} style={{ flex: 1, padding: '11px 4px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${view === 'tv' ? NEON : BORDER}`, background: view === 'tv' ? 'rgba(189,255,0,0.1)' : 'transparent', color: view === 'tv' ? NEON_T : MUTED }}>📺 TV</button>
        <button onClick={() => token && runScan(false)} disabled={!token || status === 'scanning'} style={{ flex: 1.5, padding: '11px 4px', borderRadius: '8px', cursor: !token ? 'not-allowed' : status === 'scanning' ? 'wait' : 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${NEON}`, background: token ? NEON : 'transparent', color: token ? '#0A0A0A' : MUTED, opacity: status === 'scanning' ? 0.7 : 1 }}>▶ {status === 'scanning' ? 'SCANNING' : status === 'done' ? 'REFRESH' : 'GO LIVE'}</button>
        <button onClick={() => setView('board')} style={{ flex: 1, padding: '11px 4px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${view === 'board' ? NEON : BORDER}`, background: view === 'board' ? 'rgba(189,255,0,0.1)' : 'transparent', color: view === 'board' ? NEON_T : MUTED }}>☰ BOARD</button>
      </div>

      {token && status === 'done' && feed.credits != null && (
        <div style={{ textAlign: 'center', marginTop: '8px', fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.06em' }}>{feed.credits} credits left · auto-refreshing every 2 min</div>
      )}
    </>
  )
}

// Dense OddsJam/Prop-Professor-style board — every +EV play (game lines AND props) on one
// ranked table. Props scan on tap (per-game). Tap a row to drill into all books on CH 2.
const GRID = '1fr 58px 54px'
function BoardView({ status, rows = [], edgeCount, bankroll = 0, token, err, onPickGame }) {
  if (status === 'idle')     return <Empty text={token ? 'Hit ▶ GO LIVE to read the board.' : 'Log in to summon the bot.'} />
  if (status === 'scanning') return <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: 'rgba(189,255,0,0.6)', letterSpacing: '0.1em' }}>SCANNING THE BOARD…</div>
  if (status === 'error')    return <Empty text={`Scan failed — ${err}`} />
  if (!rows.length) return <Empty text="Market's efficient on game lines — pull props (below) to widen the net." />

  return (
    <div style={{ background: '#0A0A0A', border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '9px 14px', borderBottom: '1px solid #161616', color: '#5a5a5a', fontFamily: R, fontSize: '10px', letterSpacing: '0.1em' }}>
        <span>PICK / BOOK</span><span style={{ textAlign: 'right' }}>ODDS</span><span style={{ textAlign: 'right' }}>EV</span>
      </div>
      {rows.map((r, i) => {
        const top = i === 0
        return (
          <div key={r.key} onClick={() => r.game && onPickGame(r.game)} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #111', borderLeft: `3px solid ${top ? NEON : 'transparent'}`, background: top ? 'rgba(189,255,0,0.04)' : 'transparent' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.isProp && <span style={{ fontSize: '8px', color: '#5DCAA5', border: '1px solid #5DCAA5', borderRadius: '3px', padding: '1px 4px', marginRight: '6px', verticalAlign: '1px' }}>PROP</span>}
                {r.label}
              </div>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{BOOK_NAMES[r.book] || r.book} · {r.sub}{bankroll > 0 && r.fairProb != null ? ` · BET $${Math.round(kellyStake(r.price, r.fairProb, bankroll))}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: R, fontSize: '15px', fontWeight: 700, color: top ? NEON_T : TEXT }}>{fmtAm(r.price)}</div>
            <div style={{ textAlign: 'right', fontFamily: R, fontSize: '13px', fontWeight: 700, color: r.evPct == null ? MUTED : (top ? NEON_T : '#5DCAA5') }}>{r.evPct != null ? `+${r.evPct.toFixed(1)}%` : 'SHOP'}</div>
          </div>
        )
      })}
      <div style={{ padding: '10px 14px', color: '#5a5a5a', fontFamily: R, fontSize: '10px', letterSpacing: '0.06em' }}>{edgeCount} EDGE{edgeCount === 1 ? '' : 'S'} · TAP A ROW FOR ALL BOOKS</div>
    </div>
  )
}

// ───────────────────────────── CH 2 · LOOK ─────────────────────────────
function LookChannel({ game, sport, token, onLogPosition, onBack }) {
  const [status, setStatus] = useState('idle')   // idle | loading | done | error
  const [data, setData]     = useState(null)
  const [mkt, setMkt]       = useState('h2h')
  const [move, setMove]     = useState({})
  const [view, setView]     = useState('books')  // books | move
  const [err, setErr]       = useState('')
  const dec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)

  useEffect(() => {
    if (!game || !token) return
    let live = true
    setStatus('loading'); setErr(''); setMove({}); setMkt('h2h'); setView('books')
    fetch(`/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `lines ${res.status}`); return res.json() })
      .then(j => { if (live) { setData(j.found && j.markets ? j : null); setStatus('done') } })
      .catch(e => { if (live) { setErr(e.message); setStatus('error') } })
    if (game.external_event_id) fetchLineMovement(game.external_event_id).then(m => { if (live) setMove(m || {}) }).catch(() => {})
    return () => { live = false }
  }, [game, sport, token])

  const Frame = ({ children }) => (
    <TvFrame ch="07">
      <button onClick={onBack} style={{ ...pill(false), marginBottom: '12px', fontSize: '10px', padding: '5px 12px' }}>← CH 1</button>
      {game && <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color: TEXT, marginBottom: '2px' }}>{up(game.away)} @ {up(game.home)}</div>}
      <div style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, letterSpacing: '0.1em', marginBottom: '12px' }}>BY BOOK · BEST AVAILABLE</div>
      {children}
    </TvFrame>
  )

  if (!game) return <Frame><Empty text="Pick a game on CH 1 to tune in." /></Frame>
  if (status === 'loading') return <Frame><div style={{ textAlign: 'center', padding: '20px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)' }}>TUNING IN…</div></Frame>
  if (status === 'error')   return <Frame><Empty text={`Failed — ${err}`} /></Frame>
  if (!data)                return <Frame><Empty text="No book lines for this game (pre-game only)." /></Frame>

  const M = data.markets
  const fmtPt = (pt) => pt == null ? '' : (pt > 0 ? `+${pt}` : `${pt}`)
  const moveRows = Object.entries(move || {}).filter(([, m]) => m && m.series && m.series.length >= 2)
  const gameMarkets = ['h2h', 'spreads', 'totals'].filter(k => M[k])
  const mktName = (k) => k === 'h2h' ? 'MONEYLINE' : k === 'spreads' ? (SPREAD_LABEL[sport] || 'SPREAD').toUpperCase() : 'TOTAL'

  const sidesFor = (cmp, key) => !cmp ? [] : (key === 'totals'
    ? cmp.outcomes.map(n => ({ name: n, label: /^o/i.test(n) ? 'OVER' : 'UNDER' }))
    : [{ name: cmp.outcomes.find(n => lw(n) === lw(game.away)) || cmp.outcomes[0], label: up(game.away) },
       { name: cmp.outcomes.find(n => lw(n) === lw(game.home)) || cmp.outcomes[1], label: up(game.home) }])

  // By-book stack for ONE market (no tabs — every market is stacked vertically).
  const renderBooks = (key) => {
    const cmp = M[key]; if (!cmp) return null
    const isTot = key === 'totals'
    return (
      <div key={key} style={{ marginBottom: '14px' }}>
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: NEON_T, marginBottom: '8px' }}>{mktName(key)}</div>
        {sidesFor(cmp, key).map(side => {
          const rows = [...cmp.rows].filter(r => r.prices[side.name] != null).sort((a, b) => (dec(b.prices[side.name]) ?? 0) - (dec(a.prices[side.name]) ?? 0))
          if (!rows.length) return null
          const bestBook = cmp.best[side.name]?.book
          return (
            <div key={side.name} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '10px' }}>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>{side.label}{isTot && cmp.modalPoint?.[side.name] != null ? ` ${cmp.modalPoint[side.name]}` : ''}</div>
              {rows.map(r => {
                const p = r.prices[side.name], pt = r.points[side.name]
                const best = r.book === bestBook
                const pick = isTot ? `${/^o/i.test(side.name) ? 'Over' : 'Under'} ${pt}` : key === 'spreads' ? `${side.label} ${fmtPt(pt)}` : `${side.label} ML`
                return (
                  <div key={r.book} onClick={() => onLogPosition && onLogPosition({ sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime }, { pick, odds: p })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 2px', cursor: 'pointer' }}>
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: best ? 700 : 500, color: best ? NEON_T : MUTED }}>{BOOK_NAMES[r.book] || r.book}{r.sharp && <span style={{ fontSize: '8px', color: '#5DCAA5', marginLeft: '6px' }}>SHARP</span>}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: best ? NEON_T : TEXT }}>{fmtAm(p)}{pt != null ? <span style={{ fontSize: '10px', color: MUTED }}> {isTot ? (/^o/i.test(side.name) ? 'o' : 'u') + pt : fmtPt(pt)}</span> : ''}</span>
                      {best && <span style={{ color: NEON_T, fontSize: '13px' }}>✓</span>}
                      {best && r.links?.[side.name] && <BetLink book={r.book} link={r.links[side.name]} />}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const mlCmp = M.h2h
  const mlSide = sidesFor(mlCmp, 'h2h')[0]?.name

  return (
    <Frame>
      {/* 3-market movement summary — sparkline + % move per market (Pikkit) */}
      <MarketSummary move={move} sport={sport} />

      {/* BOOKS / LINE MOVE toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => setView('books')} style={pill(view === 'books')}>By Book</button>
        <button onClick={() => setView('move')} style={pill(view === 'move')}>Line Move</button>
      </div>

      {view === 'move' && (
        <>
          {moveRows.length ? <MoveChart moveRows={moveRows} /> : <Empty text="Line-movement history builds as the price moves — check back as the game nears." />}
          <BookChips cmp={mlCmp} sideName={mlSide} />
        </>
      )}

      {view === 'books' && gameMarkets.map(renderBooks)}
      {view === 'books' && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, textAlign: 'center', marginTop: '8px' }}>✓ = best price · tap any book to log it</div>}

      {/* same Line Shop · Compare Books component used in the Live Center game card */}
      <div style={{ marginTop: '16px' }}>
        <LineShop event={{ sport: game.sport || sport, league: game.sport || sport, away_team: game.away, home_team: game.home, away_abbr: game.away_abbr, home_abbr: game.home_abbr, external_event_id: game.external_event_id || '', start_time: game.commenceTime }} token={token} onLogPosition={onLogPosition} />
      </div>
    </Frame>
  )
}

// Multi-series line-move chart (screen 5) — plots each market/side's price over the
// snapshots we've stored, on a shared axis, with a legend of current values.
const MOVE_COLORS = ['#BDFF00', '#378ADD', '#1D9E75', '#FF3B3B', '#EF9F27']
function MoveChart({ moveRows }) {
  const W = 320, H = 150, padL = 30, padR = 8, padT = 12, padB = 20
  const all = moveRows.flatMap(([, m]) => m.series)
  const min = Math.min(...all), max = Math.max(...all), range = (max - min) || 1
  const maxLen = Math.max(...moveRows.map(([, m]) => m.series.length))
  const x = (i, n) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB)
  const lab = (k) => k.replace(/_/g, ' ').toUpperCase()
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <text x="2" y={y(max) + 3} fill={MUTED} fontSize="8" fontFamily="Rajdhani">{Math.round(max)}</text>
        <text x="2" y={y(min) + 3} fill={MUTED} fontSize="8" fontFamily="Rajdhani">{Math.round(min)}</text>
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(189,255,0,0.12)" strokeWidth="1" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(189,255,0,0.12)" strokeWidth="1" />
        <text x={padL} y={H - 6} fill={MUTED} fontSize="8" fontFamily="Courier New">open</text>
        <text x={W - padR} y={H - 6} fill={MUTED} fontSize="8" fontFamily="Courier New" textAnchor="end">now</text>
        {moveRows.map(([key, m], idx) => {
          const c = MOVE_COLORS[idx % MOVE_COLORS.length], n = m.series.length
          const pts = m.series.map((v, i) => `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          const last = m.series[n - 1]
          return (
            <g key={key}>
              <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1, n)} cy={y(last)} r="3" fill={c} />
            </g>
          )
        })}
      </svg>
      <div className="tv-ticker" style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        {moveRows.map(([key, m], idx) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '6px', border: `1px solid ${BORDER}`, fontFamily: R, fontSize: '10px', fontWeight: 700, color: TEXT }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: MOVE_COLORS[idx % MOVE_COLORS.length] }} />
            {lab(key)} <span style={{ color: MUTED }}>{m.open}→{m.current}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Mini sparkline for the market-movement summary (Pikkit-style row).
function MiniSpark({ series, color }) {
  if (!series || series.length < 2) return <div style={{ width: '110px', height: '34px' }} />
  const W = 110, H = 34
  const min = Math.min(...series), max = Math.max(...series), range = (max - min) || 1
  const pts = series.map((v, i) => `${(i / (series.length - 1) * W).toFixed(1)},${(H - 4 - ((v - min) / range) * (H - 8)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '110px', height: '34px', flexShrink: 0 }}>
      <line x1="0" y1={H - 4} x2={W} y2={H - 4} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// 3-market movement summary (Pikkit screenshot): ML / Spread / Total — sparkline + % move.
function MarketSummary({ move, sport }) {
  const pick = (market) => (Object.entries(move || {}).find(([k, m]) => (k === market || k.startsWith(market + '_')) && m?.series?.length >= 2) || [])[1] || null
  const rows = [
    { key: 'h2h', label: 'Moneyline', sub: 'Best price', odds: true },
    { key: 'spreads', label: SPREAD_LABEL[sport] || 'Spread', sub: 'Main line', odds: false },
    { key: 'totals', label: 'Total', sub: 'Over / Under', odds: true },
  ].map(r => ({ ...r, m: pick(r.key) })).filter(r => r.m)
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: '14px' }}>
      {rows.map(r => {
        const pct = r.m.open ? ((r.m.current - r.m.open) / Math.abs(r.m.open)) * 100 : 0
        const up_ = pct >= 0, col = up_ ? '#1D9E75' : '#FF3B3B'
        return (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ width: '70px', flexShrink: 0 }}>
              <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{r.label}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{r.sub}</div>
            </div>
            <MiniSpark series={r.m.series} color={col} />
            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{r.odds ? fmtAm(r.m.current) : r.m.current}</div>
              <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: col }}>{up_ ? '↗' : '↘'} {Math.abs(pct).toFixed(1)}%</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Book price chips (Sharp screenshot) — each book's current price for one outcome, best lit.
function BookChips({ cmp, sideName }) {
  if (!cmp || !sideName) return null
  const dec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)
  const rows = [...cmp.rows].filter(r => r.prices[sideName] != null).sort((a, b) => (dec(b.prices[sideName]) ?? 0) - (dec(a.prices[sideName]) ?? 0))
  if (!rows.length) return null
  const bestBook = cmp.best[sideName]?.book
  return (
    <div className="tv-ticker" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
      {rows.map(r => {
        const best = r.book === bestBook
        return (
          <div key={r.book} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', borderRadius: '8px', border: `1px solid ${best ? NEON : BORDER}`, background: best ? 'rgba(189,255,0,0.08)' : '#0d0d0d' }}>
            <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', color: MUTED, textTransform: 'uppercase' }}>{(BOOK_NAMES[r.book] || r.book).slice(0, 3)}</span>
            <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: best ? NEON_T : TEXT }}>{fmtAm(r.prices[sideName])}</span>
            {best && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON }} />}
          </div>
        )
      })}
    </div>
  )
}

// Closing-lines grid (Pikkit screenshot): away/home rows × ML / Spread / Total best cells.
function ClosingLines({ M, game, sport }) {
  const markets = ['h2h', 'spreads', 'totals'].filter(k => M[k])
  if (!markets.length) return null
  const fmtPt = (pt) => pt == null ? '' : (pt > 0 ? `+${pt}` : `${pt}`)
  const sideName = (cmp, which) => {
    if (!cmp) return null
    if (cmp.outcomes.some(n => /^o/i.test(n)) && cmp.outcomes.some(n => /^u/i.test(n)))
      return which === 'away' ? cmp.outcomes.find(n => /^o/i.test(n)) : cmp.outcomes.find(n => /^u/i.test(n))
    const away = cmp.outcomes.find(n => lw(n) === lw(game.away)) || cmp.outcomes[0]
    const home = cmp.outcomes.find(n => lw(n) === lw(game.home)) || cmp.outcomes[1]
    return which === 'away' ? away : home
  }
  const Row = ({ which, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
      <span style={{ width: '46px', flexShrink: 0, fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{label}</span>
      {markets.map(k => {
        const cmp = M[k], name = sideName(cmp, which), b = cmp?.best?.[name]
        const pt = cmp?.modalPoint?.[name], isTot = k === 'totals', over = /^o/i.test(name || '')
        return (
          <div key={k} style={{ flex: 1, position: 'relative', background: '#15161a', borderRadius: '6px', padding: '5px 4px', textAlign: 'center', minWidth: 0 }}>
            {k !== 'h2h' && pt != null && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{isTot ? (over ? 'o' : 'u') + pt : fmtPt(pt)}</div>}
            <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: b ? TEXT : MUTED }}>{b ? fmtAm(b.price) : '—'}{b && <span style={{ marginLeft: '4px', display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#1D9E75', verticalAlign: 'middle' }} />}</div>
          </div>
        )
      })}
    </div>
  )
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, marginBottom: '6px' }}>CLOSING LINES</div>
      <Row which="away" label={up(game.away)} />
      <Row which="home" label={up(game.home)} />
    </div>
  )
}

// Props sub-panel — per-game on-demand prop scan (credit-disciplined).
function PropsPanel({ game, sport, token, onLogPosition }) {
  const [status, setStatus] = useState('idle')
  const [data, setData]     = useState(null)
  const [err, setErr]       = useState('')

  async function scan() {
    if (!token || status === 'scanning') return
    setStatus('scanning'); setErr('')
    try {
      const res = await fetch(`/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `props ${res.status}`)
      const j = await res.json()
      setData(j.found ? j : { edges: [], lineShopOnly: [], creditsRemaining: j.creditsRemaining })
      setStatus('done')
    } catch (e) { setErr(e.message); setStatus('error') }
  }

  const logProp = (p) => onLogPosition && onLogPosition(
    { sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime },
    { pick: `${p.player} ${p.side} ${p.point} ${p.marketLabel}`, odds: p.best.price })

  if (status === 'idle') return <button onClick={scan} style={{ width: '100%', padding: '11px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T }}>▶ SCAN PROPS</button>
  if (status === 'scanning') return <div style={{ textAlign: 'center', padding: '22px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: 'rgba(189,255,0,0.6)', letterSpacing: '0.1em' }}>SCANNING PROPS…</div>
  if (status === 'error') return <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err} <button onClick={scan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button></div>

  const edges = data?.edges || [], ls = data?.lineShopOnly || []
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: edges.length ? NEON_T : MUTED, letterSpacing: '0.1em' }}>{edges.length ? `${edges.length} VALID PROP MATRIX${edges.length > 1 ? 'ES' : ''}` : 'NO VALID PROP MATRIX'}</span>
        <button onClick={scan} style={{ background: 'none', border: 'none', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px' }}>{data?.creditsRemaining != null ? `${data.creditsRemaining} left · ` : ''}RE-SCAN</button>
      </div>
      {edges.length === 0 && <Empty text="No +EV props right now — we won't fake an edge." />}
      {edges.map((p, i) => (
        <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', marginBottom: '8px', borderRadius: '12px', cursor: 'pointer', background: 'rgba(189,255,0,0.04)', border: `1px solid ${NEON}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{p.player} {p.side} {p.point}</div>
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>{p.marketLabel} · {BOOK_NAMES[p.best.book] || p.best.book} · +{p.evPct.toFixed(1)}% EV</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span className="tv-glow" style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(p.best.price)}</span>
            {p.best.link && <BetLink book={p.best.book} link={p.best.link} />}
          </div>
        </div>
      ))}
      {ls.length > 0 && (
        <>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.12em', margin: '12px 0 6px' }}>LINE SHOP · NO SHARP ANCHOR</div>
          {ls.map((p, i) => (
            <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', marginBottom: '6px', borderRadius: '10px', cursor: 'pointer', background: '#0d0d0d', border: `1px solid ${BORDER}` }}>
              <div style={{ fontFamily: R, fontSize: '12px', color: TEXT }}>{p.player} {p.side} {p.point} <span style={{ color: MUTED, fontSize: '10px' }}>· {p.marketLabel}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{fmtAm(p.best.price)}</span>
                {p.best.link && <BetLink book={p.best.book} link={p.best.link} />}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ───────────────────────────── CH 3 · TRACK ─────────────────────────────
function TrackChannel({ bets, sport, token }) {
  const [events, setEvents] = useState([])
  useEffect(() => {
    let live = true
    fetchEvents(sport, 'today').then(res => { if (live) setEvents(res?.data || []) }).catch(() => {})
    return () => { live = false }
  }, [sport])

  const graded = useMemo(() => {
    const out = []
    for (const b of bets || []) {
      const ev = events.find(e => matchBetToEvent(b, e))
      if (ev) { const grade = evaluateBet(b, ev, null); if (grade) out.push({ bet: b, ev, grade }) }
    }
    return out
  }, [bets, events])

  // group tracked bets by game → one card per game (closing lines live inside each card)
  const games = useMemo(() => {
    const m = new Map()
    for (const g of graded) {
      const key = `${lw(g.ev.away_team)}@${lw(g.ev.home_team)}`
      if (!m.has(key)) m.set(key, { ev: g.ev, items: [] })
      m.get(key).items.push(g)
    }
    return [...m.values()]
  }, [graded])

  // Pikkit-style scoreboard: averages across every graded bet. CLV% is the headline metric —
  // beating the closing line over time is the truest proof you're a +EV operator.
  const board = useMemo(() => {
    const clv = graded.map(g => g.grade.clvPct).filter(v => v != null)
    const ev  = graded.map(g => g.grade.evPct).filter(v => v != null)
    const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
    return {
      tracked: graded.length,
      avgClv: avg(clv),
      avgEv:  avg(ev),
      beatRate: clv.length ? (clv.filter(v => v > 0).length / clv.length) * 100 : null,
    }
  }, [graded])

  return (
    <TvFrame ch="33">
      <div style={{ textAlign: 'center', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, marginBottom: '12px' }}>⬡ BEAT THE CLOSE</div>

      {/* scoreboard — the Pikkit Pro headline numbers */}
      {graded.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            ['AVG CLV', board.avgClv, true],
            ['BEAT CLOSE', board.beatRate, false],
            ['AVG EV', board.avgEv, true],
          ].map(([label, val, signed]) => (
            <div key={label} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color: val == null ? MUTED : (val >= (label === 'BEAT CLOSE' ? 50 : 0) ? NEON_T : DANGER) }}>
                {val == null ? '—' : `${signed && val >= 0 ? '+' : ''}${val.toFixed(label === 'BEAT CLOSE' ? 0 : 1)}%`}
              </div>
            </div>
          ))}
        </div>
      )}
      {graded.length > 0 && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.06em', textAlign: 'center', marginBottom: '10px' }}>{board.tracked} TRACKED · CLV IS THE TRUTH — BEAT THE CLOSE &gt; 50% = SHARP</div>}

      {!graded.length && <Empty text={`No graded ${sport} positions yet. Log a play on CH 1/2 and it grades here.`} />}
      {games.map((g, i) => <TrackGameCard key={i} ev={g.ev} items={g.items} sport={sport} token={token} />)}
    </TvFrame>
  )
}

// One game card on TRACK: the graded bets for this game + its closing-lines grid.
function TrackGameCard({ ev, items, sport, token }) {
  const [M, setM] = useState(null)
  useEffect(() => {
    if (!token || !ev) return
    let live = true
    fetch(`/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(ev.away_team)}&home=${encodeURIComponent(ev.home_team)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(j => { if (live) setM(j?.markets || null) }).catch(() => {})
    return () => { live = false }
  }, [ev, sport, token])

  return (
    <div style={{ padding: '8px 10px', marginBottom: '6px', borderRadius: '10px', background: '#0d0d0d', border: `1px solid ${BORDER}` }}>
      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginBottom: '1px' }}>{up(ev.away_team)} @ {up(ev.home_team)}</div>
      {items.map(({ bet, grade }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '3px' }}>
          <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.pick || bet.event}</span>
          <span style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            {grade.evPct != null && <Stat label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
            {grade.clvPct != null && <Stat label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
            {grade.evPct == null && grade.clvPct == null && <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>Awaiting close…</span>}
          </span>
        </div>
      ))}
      {M && <ClosingLines M={M} game={{ away: ev.away_team, home: ev.home_team }} sport={sport} />}
    </div>
  )
}

function Stat({ label, value, good }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: R, fontSize: '7px', color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: good ? NEON_T : DANGER }}>{value}</div>
    </div>
  )
}
