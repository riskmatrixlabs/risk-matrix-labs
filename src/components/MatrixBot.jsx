// MATRIX EV BOT — retro broadcast-TV tab. Everything renders inside a CRT screen.
//   CH1 FIND  — scan the board → +EV edge rows + a slate ticker (credit-guarded)
//   CH2 LOOK  — a game's books (best highlighted) + props + line movement, bet links
//   CH3 TRACK — your logged bets graded for EV / CLV
// Heavy lifting reuses the already-built engine, endpoints and discipline libs.
import { useState, useEffect, useMemo, useRef } from 'react'
import './MatrixBot.css'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER, BOOK_NAMES, SPREAD_LABEL, fmtAm, Sparkline } from './botShared.jsx'
import { fetchEvents, isLiveEvent } from '../lib/events.js'
import { fetchLineMovement, fetchBookMovement } from '../lib/oddsHistory.js'
import { matchBetToEvent, evaluateBet, teamSide } from '../lib/betMatch.js'
import { decorate } from '../lib/betLinks.js'
import { groupEdgesByGame, applyFeedFilters, gameKey } from '../lib/botFeed.js'
import { getScan, putScan } from '../lib/scanCache.js'
import { kellyStake } from '../lib/kelly.js'
import { labelFor, PROP_MARKETS } from '../lib/propMarkets.js'
import { LineShop } from './LiveCenter.jsx'
import { BookMoveChart } from './BookMoveChart.jsx'
import EventsPicker from './EventsPicker.jsx'
import { normalizeBet, computeRecord, groupByDate } from '../lib/betCard.js'
import { BetCard, BetTicket } from './BetCard.jsx'

// League logos (ESPN transparent PNGs) — clean fallback when a bet's team side can't be resolved.
const LEAGUE_LOGO = {
  MLB:  'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
  NHL:  'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
  NBA:  'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  WNBA: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
}

// Give each leg a real logo: the correct team logo from the matched event when the
// pick's side is resolvable, else the league logo. Mutates and returns the normalized bet.
function withLogos(n, ev) {
  for (const leg of n.legs) {
    let logo = null
    if (ev) {
      const side = teamSide(leg.title, ev) || teamSide(leg.subtitle, ev)
      if (side === 'away') logo = ev.away_logo
      else if (side === 'home') logo = ev.home_logo
    }
    if (!logo) logo = LEAGUE_LOGO[String(leg.sport || n.sport || '').toUpperCase()] || null
    leg.logo = logo
  }
  return n
}

const SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL']
const todayStr = () => new Date().toISOString().slice(0, 10)
const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const up = (s) => lw(s).toUpperCase()
const isPreGame = (ev) => ev.status === 'NS' || ev.status === 'STATUS_SCHEDULED'
// Game time in the USER'S local timezone (the device tz) — not raw UTC off the timestamp.
const localClock = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }

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

// Player search (the CH1 "knob") — type a player → their game; tap → tune to Channel 2.
// Uses FREE ESPN rosters server-side (zero Odds-API credits).
function PlayerSearch({ token, onSelect, onClose }) {
  const [q, setQ] = useState('')
  const [matches, setMatches] = useState([])
  const [status, setStatus] = useState('idle')   // idle | loading | done
  const [anyGames, setAnyGames] = useState(true)
  useEffect(() => {
    if (q.trim().length < 2) { setMatches([]); setStatus('idle'); return }
    let live = true
    setStatus('loading')
    const id = setTimeout(() => {
      fetch(`/api/player-search?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { matches: [] })
        .then(j => { if (live) { setMatches(j.matches || []); setAnyGames(j.anyGames !== false); setStatus('done') } })
        .catch(() => { if (live) setStatus('done') })
    }, 300)
    return () => { live = false; clearTimeout(id) }
  }, [q, token])

  const fmtT = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }
  return (
    <div style={{ background: CARD, border: `1px solid ${NEON}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search a player…"
          style={{ flex: 1, padding: '9px 11px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0d0d0d', color: TEXT, fontFamily: R, fontSize: '13px', outline: 'none' }} />
        <button onClick={onClose} style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700 }}>✕</button>
      </div>
      {status === 'loading' && <div style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)', padding: '8px 2px' }}>SEARCHING…</div>}
      {status === 'done' && !matches.length && (
        <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, padding: '8px 2px' }}>{anyGames ? 'No player found in today’s games.' : 'No events today.'}</div>
      )}
      {matches.map((m, i) => (
        <button key={`${m.player}-${i}`} onClick={() => onSelect(m)}
          style={{ width: '100%', textAlign: 'left', padding: '8px 10px', marginTop: '6px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#0d0d0d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {m.headshot
            ? <img src={m.headshot} alt="" width="38" height="38" style={{ borderRadius: '50%', background: '#1a1a1a', objectFit: 'cover', flexShrink: 0 }} />
            : <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#1a1a1a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontSize: '13px', fontWeight: 700, color: MUTED, flexShrink: 0 }}>{(m.player[0] || '?')}</span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.player}</span>
            <span style={{ display: 'block', fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>{[m.pos, m.team].filter(Boolean).join(' · ')}</span>
          </span>
          <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, letterSpacing: '0.04em', textAlign: 'right', flexShrink: 0 }}>{up(m.game.away_abbr || m.game.away)} @ {up(m.game.home_abbr || m.game.home)}<br />{fmtT(m.game.commenceTime)}</span>
        </button>
      ))}
    </div>
  )
}

export default function MatrixBot({ onLogPosition, onAddToSlip, bets = [], token = null, unitSize = 0, bankroll = 0, initialView = 'tv' }) {
  const [channel, setChannel] = useState('find')   // find | look | track
  const [sport, setSport]     = useState('MLB')
  const [game, setGame]       = useState(null)
  const [showFilters, setShowFilters] = useState(false)   // gear (FIND filters) lives in the tab row
  const [showSearch, setShowSearch]   = useState(false)   // the CH1 "knob" → player search
  const [player, setPlayer]           = useState(null)    // when arriving via player search → CH2 player mode
  const tuneTo = (g, p = null) => { setGame(g); setPlayer(p); if (g.sport) setSport(g.sport); setChannel('look') }

  return (
    <div className="mbot-root" style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 12px 90px' }}>
      {/* channel dial */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['find', 'CH 1 · FIND'], ['look', 'CH 2 · LOOK'], ['track', 'CH 3 · TRACK']].map(([k, label]) => (
          <button key={k} onClick={() => setChannel(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${channel === k ? NEON : BORDER}`, background: channel === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: channel === k ? NEON_T : MUTED }}>{label}</button>
        ))}
      </div>
      {/* FIND stays mounted (just hidden) so a scan survives channel switches — no re-scan */}
      <div style={{ display: channel === 'find' ? 'block' : 'none' }}>
        <FindChannel token={token} bankroll={bankroll} initialView={initialView}
          showFilters={showFilters} setShowFilters={setShowFilters}
          showSearch={showSearch} setShowSearch={setShowSearch}
          onPick={(g) => tuneTo(g)}
          onPickPlayer={(m) => tuneTo(m.game, { name: m.player, pos: m.pos, team: m.team, headshot: m.headshot, id: m.id })} />
      </div>
      {channel !== 'find' && (
        <div key={channel} className="tvbot-tune">
          {channel === 'look' && <LookChannel game={game} player={player} sport={sport} setSport={setSport} token={token} onLogPosition={onLogPosition} onAddToSlip={onAddToSlip} onBack={() => setChannel('find')} onBackToList={() => { setGame(null); setPlayer(null) }} onTune={(g) => tuneTo(g)} onPickPlayer={(m) => tuneTo(m.game, { name: m.player, pos: m.pos, team: m.team, headshot: m.headshot, id: m.id })} />}
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

function FindChannel({ token, bankroll = 0, onPick, onPickPlayer, showFilters = false, setShowFilters, showSearch = false, setShowSearch, initialView = 'tv' }) {
  const [events, setEvents]   = useState([])
  const [feed, setFeed]       = useState({ status: 'idle', edges: [], scanned: 0, credits: null })
  const [props, setProps]     = useState(null)
  const [err, setErr]         = useState('')
  const [view, setView]       = useState(initialView) // tv | board (board = via Analyze Bet door)
  const [sportF, setSportF]   = useState('ALL')       // filters replace tabs (toggled by the gear)
  const [marketF, setMarketF] = useState('ALL')
  const [propCat, setPropCat] = useState('ALL')   // prop category filter (strikeouts, points…)
  const [bookF, setBookF]     = useState('ALL')   // filter board to a specific sportsbook's best price
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
  // Ticker = LIVE games first (tagged), then the upcoming pre-game slate. Finals drop off.
  const tickerGames = useMemo(() => [...events.filter(e => isLiveEvent(e)), ...preGames], [events, preGames])
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
    return [...gl, ...pr]
      .filter(r => bookF === 'ALL' || r.book === bookF)
      .sort((a, b) => (b.evPct ?? -1) - (a.evPct ?? -1))
  }, [feed, props, sportF, marketF, propCat, bookF, minEv, evByKey])

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
      {showSearch && setShowSearch && (
        <PlayerSearch token={token} onClose={() => setShowSearch(false)}
          onSelect={(m) => { setShowSearch(false); onPickPlayer && onPickPlayer(m) }} />
      )}
      {showFilters && (
        <div style={{ marginBottom: '12px', padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD }}>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>SPORT</div>
          <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {sportChips.map(s => <button key={s} onClick={() => setSportF(s)} style={pill(sportF === s)}>{s}</button>)}
          </div>
          {/* TEAM — tap menu of today's teams (scoped to the selected sport) → jump to its game */}
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>TEAM</div>
          {(() => {
            const teams = preGames
              .filter(ev => sportF === 'ALL' || ev._sport === sportF)
              .flatMap(ev => [{ name: ev.away_team, abbr: ev.away_abbr, ev }, { name: ev.home_team, abbr: ev.home_abbr, ev }])
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            return (
              <select value="" onChange={e => { const t = teams[Number(e.target.value)]; if (t) onPick(buildGame(t.ev)) }}
                style={{ width: '100%', padding: '9px 10px', marginBottom: '12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0d0d0d', color: TEXT, fontFamily: R, fontSize: '12px', fontWeight: 700, outline: 'none' }}>
                <option value="">{teams.length ? 'Jump to a team…' : 'No games today'}</option>
                {teams.map((t, i) => <option key={t.abbr + i} value={i}>{t.abbr} — {t.name}</option>)}
              </select>
            )
          })()}

          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>MARKET</div>
          <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {MARKET_CHIPS.map(([k, label]) => <button key={k} onClick={() => setMarketF(k)} style={pill(marketF === k)}>{label}</button>)}
          </div>

          {/* PROP — tap menu, sport-correlated (the right props per sport); picks the exact prop */}
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>PROP</div>
          <select value={marketF === 'props' ? propCat : 'NONE'} disabled={sportF === 'ALL'}
            onChange={e => { setMarketF('props'); setPropCat(e.target.value === 'NONE' ? 'ALL' : e.target.value) }}
            style={{ width: '100%', padding: '9px 10px', marginBottom: '12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0d0d0d', color: sportF === 'ALL' ? MUTED : TEXT, fontFamily: R, fontSize: '12px', fontWeight: 700, outline: 'none', opacity: sportF === 'ALL' ? 0.6 : 1 }}>
            {sportF === 'ALL'
              ? <option value="NONE">Pick a sport first</option>
              : <>
                  <option value="NONE">Choose a prop…</option>
                  <option value="ALL">All props</option>
                  {(PROP_MARKETS[sportF] || []).map(k => <option key={k} value={k}>{labelFor(k)}</option>)}
                </>}
          </select>
          {/* BOOK — filter the board to one sportsbook's best price */}
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>BOOK</div>
          <select value={bookF} onChange={e => setBookF(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', marginBottom: '12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0d0d0d', color: TEXT, fontFamily: R, fontSize: '12px', fontWeight: 700, outline: 'none' }}>
            <option value="ALL">All books</option>
            {['draftkings', 'fanduel', 'betmgm', 'williamhill_us', 'espnbet', 'fanatics', 'betrivers', 'hardrockbet', 'pinnacle'].map(b => (
              <option key={b} value={b}>{BOOK_NAMES[b] || b}</option>
            ))}
          </select>

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
        {tickerGames.length > 0 && (
          <div className="tv-marquee-wrap" style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid rgba(189,255,0,0.12)` }}>
            <div className="tv-marquee">
              {[...tickerGames, ...tickerGames].map((ev, i) => {
                const live = isLiveEvent(ev)
                return (
                  <button key={ev._sport + ev.external_event_id + i} onClick={() => onPick(buildGame(ev))} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: R, fontWeight: 700, fontSize: '17px', color: NEON_T, letterSpacing: '0.04em', whiteSpace: 'nowrap', padding: 0 }}>
                    {ev.away_abbr}@{ev.home_abbr}{' '}
                    {live
                      ? <span style={{ color: DANGER, fontSize: '11px', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>● LIVE{(ev.away_score != null && ev.home_score != null) ? ` ${ev.away_score}-${ev.home_score}` : ''}</span>
                      : <span style={{ color: MUTED, fontSize: '11px', fontFamily: 'Courier New, monospace' }}>{localClock(ev.start_time)}</span>}
                  </button>
                )
              })}
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

      {/* TV buttons — search (left) · settings/gear (right); open their panel inside the screen */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button onClick={() => { setShowSearch && setShowSearch(s => !s); setShowFilters && setShowFilters(false) }}
          style={{ flex: 1, padding: '11px 4px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${showSearch ? NEON : BORDER}`, background: showSearch ? 'rgba(189,255,0,0.1)' : 'transparent', color: showSearch ? NEON_T : MUTED }}>🔍 SEARCH</button>
        <button onClick={() => { setShowFilters && setShowFilters(s => !s); setShowSearch && setShowSearch(false) }}
          style={{ flex: 1, padding: '11px 4px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${showFilters ? NEON : BORDER}`, background: showFilters ? 'rgba(189,255,0,0.1)' : 'transparent', color: showFilters ? NEON_T : MUTED }}>⚙ SETTINGS</button>
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

// Player-prop card shown atop CH2 when you arrive via player search (PrizePicks-style):
// that player's prop markets, each side with best book price + tap → confirm → log + open.
function PlayerProps({ player, game, sport, token, onLogPosition, onAddToSlip }) {
  const [status, setStatus] = useState('loading')
  const [rows, setRows] = useState([])
  const [confirm, setConfirm] = useState(null)
  useEffect(() => {
    if (!player?.name || !game?.away || !token) return
    let live = true; setStatus('loading')
    fetch(`/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}&cacheOnly=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!live) return
        const nm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        const all = [...(j?.edges || []), ...(j?.lineShopOnly || [])]
        const target = nm(player.name)
        setRows(all.filter(e => { const p = nm(e.player); return p.includes(target) || target.includes(p) }))
        setStatus('done')
      }).catch(() => { if (live) setStatus('done') })
    return () => { live = false }
  }, [player?.name, game?.external_event_id, token])

  // Recent stats — FREE (ESPN), so the card shows the player's last game line, not just a name.
  const [pstats, setPstats] = useState(null)
  useEffect(() => {
    if (!player?.id || !token) { setPstats(null); return }
    let live = true
    fetch(`/api/player-stats?sport=${encodeURIComponent(sport)}&id=${encodeURIComponent(player.id)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (live) setPstats(j?.found ? j : null) })
      .catch(() => {})
    return () => { live = false }
  }, [player?.id, sport, token])

  // group by market+line → { Over, Under }
  const groups = []
  const idx = {}
  for (const r of rows) {
    const k = `${r.market}__${r.point}`
    if (!(k in idx)) { idx[k] = groups.length; groups.push({ marketLabel: r.marketLabel, point: r.point, sides: {} }) }
    groups[idx[k]].sides[r.side] = r
  }

  const fmtPt = (p) => p == null ? '' : (p > 0 ? `+${p}` : `${p}`)
  const sideBtn = (g, side) => {
    const r = g.sides[side]; if (!r) return <span style={{ flex: 1 }} />
    const url = decorate(r.best.book, r.best.link)
    return (
      <button onClick={() => setConfirm({ pick: `${player.name} ${side} ${g.point} ${g.marketLabel}`, odds: r.best.price, book: r.best.book, url, byBook: r.byBook })}
        style={{ flex: 1, padding: '8px 6px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#0d0d0d', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase' }}>{side} {g.point}</div>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{fmtAm(r.best.price)}<span style={{ fontSize: '9px', color: NEON_T, marginLeft: '2px' }}>+</span></div>
        <div style={{ fontFamily: 'Courier New, monospace', fontSize: '8px', color: MUTED }}>{(BOOK_NAMES[r.best.book] || r.best.book).slice(0, 8)}</div>
      </button>
    )
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${NEON}`, borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        {player.headshot
          ? <img src={player.headshot} alt="" width="40" height="40" style={{ borderRadius: '50%', background: '#1a1a1a', objectFit: 'cover' }} />
          : <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1a1a1a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontWeight: 700, color: MUTED }}>{player.name[0]}</span>}
        <div>
          <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{player.name}</div>
          <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>{[player.pos, player.team].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      {pstats && (pstats.season?.length > 0) && (() => {
        const SHOW = ({ MLB: ['H', 'HR', 'RBI', 'R', 'SB'], NBA: ['PTS', 'REB', 'AST'], WNBA: ['PTS', 'REB', 'AST'], NHL: ['G', 'A', 'SOG'] }[sport]) || []
        const pick = (arr) => SHOW.map(lbl => (arr || []).find(s => s.label === lbl)).filter(Boolean)
        const seasonC = pick(pstats.season), l5 = pick(pstats.last5)
        const keyRates = (pstats.rates || []).filter(r => /^(AVG|OPS|ERA|FG%|PTS|SV%)$/i.test(r.label)).slice(0, 2)
        const lbl = { fontFamily: R, fontSize: '8px', fontWeight: 700, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '5px' }
        const chip = (s, i) => <span key={i} style={{ display: 'inline-flex', gap: '4px', alignItems: 'baseline', fontFamily: R, fontSize: '12px', fontWeight: 700, background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '3px 8px' }}><span style={{ fontSize: '8px', color: MUTED }}>{s.label}</span><span style={{ color: TEXT }}>{s.value}</span></span>
        if (!seasonC.length) return null
        return (
          <div style={{ marginBottom: '12px' }}>
            <div style={lbl}>Season{pstats.games ? ` · ${pstats.games} GP` : ''}{keyRates.length ? ` · ${keyRates.map(r => `${r.value} ${r.label}`).join(' · ')}` : ''}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '9px' }}>{seasonC.map(chip)}</div>
            {l5.length > 0 && <>
              <div style={lbl}>Last {pstats.last5games} games</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{l5.map((s, i) => <span key={i} style={{ display: 'inline-flex', gap: '4px', alignItems: 'baseline', fontFamily: R, fontSize: '12px', fontWeight: 700, background: 'rgba(189,255,0,0.06)', border: `1px solid ${NEON}`, borderRadius: '6px', padding: '3px 8px' }}><span style={{ fontSize: '8px', color: MUTED }}>{s.label}</span><span style={{ color: NEON_T }}>{s.value}</span></span>)}</div>
            </>}
          </div>
        )
      })()}
      {status === 'loading' && <div style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)', padding: '6px 2px' }}>PULLING PROPS…</div>}
      {status === 'done' && !groups.length && <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, padding: '6px 2px' }}>No props posted for {player.name} yet (try after lineups).</div>}
      {groups.map((g, i) => (
        <div key={i} style={{ marginBottom: '8px' }}>
          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T, letterSpacing: '0.06em', marginBottom: '4px' }}>{g.marketLabel}</div>
          <div style={{ display: 'flex', gap: '8px' }}>{sideBtn(g, 'Over')}{sideBtn(g, 'Under')}</div>
        </div>
      ))}
      {confirm && (
        <div style={{ background: 'rgba(189,255,0,0.06)', border: `1px solid ${NEON}`, borderRadius: '9px', padding: '11px 12px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>Bet <span style={{ color: NEON_T }}>{confirm.pick} {fmtAm(confirm.odds)}</span> at {BOOK_NAMES[confirm.book] || confirm.book}?</span>
          <span style={{ display: 'flex', gap: '8px' }}>
            {onAddToSlip && (
              <button onClick={() => { onAddToSlip({ pick: confirm.pick, odds: confirm.odds, book: confirm.book, link: confirm.url, byBook: confirm.byBook, sport, event: `${game.away} vs ${game.home}` }); setConfirm(null) }}
                style={{ padding: '7px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>+ Slip</button>
            )}
            <button onClick={() => { onLogPosition({ sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime }, { pick: confirm.pick, odds: confirm.odds, book: confirm.book }); if (confirm.url) window.open(confirm.url, '_blank', 'noopener,noreferrer'); setConfirm(null) }}
              style={{ padding: '7px 11px', borderRadius: '7px', border: `1px solid ${NEON}`, cursor: 'pointer', background: 'transparent', color: NEON_T, fontFamily: R, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Log &amp; Open</button>
            <button onClick={() => setConfirm(null)} style={{ padding: '7px 11px', borderRadius: '7px', border: `1px solid ${BORDER}`, cursor: 'pointer', background: 'transparent', color: MUTED, fontFamily: R, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Cancel</button>
          </span>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────── CH 2 · LOOK ─────────────────────────────
// Module-level so its component identity is CONSTANT across LookChannel re-renders.
// (Defined inline it remounted the whole CH2 subtree on every render — collapsing the
//  Compare Books table — because the parent passes a fresh onBack each render.)
function LookFrame({ onBack, children }) {
  // The game selector lives inside CH2 now (always on screen), so back simply leaves to CH 1.
  return (
    <TvFrame ch="07">
      <button onClick={onBack} style={{ ...pill(false), marginBottom: '12px', fontSize: '10px', padding: '5px 12px' }}>← CH 1</button>
      {children}
    </TvFrame>
  )
}

// Matchup header for CH2 — logos, records, status/score, MLB pitchers (FREE via ESPN game-info).
function GameCard({ game, sport, token }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    if (!game?.away || !game?.home || !token) { setInfo(null); return }
    let live = true
    fetch(`/api/game-info?sport=${encodeURIComponent(game.sport || sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}${game.commenceTime ? `&iso=${encodeURIComponent(game.commenceTime)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (live) setInfo(j?.found ? j : null) })
      .catch(() => {})
    return () => { live = false }
  }, [game?.away, game?.home, sport, token])

  const col = (t, fbAbbr) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0 }}>
      {t?.logo ? <img src={t.logo} alt="" width="46" height="46" style={{ objectFit: 'contain' }} /> : <div style={{ width: '46px', height: '46px' }} />}
      <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT }}>{t?.abbr || fbAbbr}</span>
      {t?.record && <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{t.record}</span>}
      {t?.pitcher && <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>⚾ {t.pitcher}{t.era ? <span style={{ color: NEON_T }}> · {t.era}</span> : ''}</span>}
    </div>
  )
  const isLive = info?.status?.state === 'in'
  const center = info ? (info.status.detail || (info.status.state === 'pre' ? '' : '')) : `${up(game.away)} @ ${up(game.home)}`
  const ou = info?.ou
  const t = ou?.total
  // "LEANS OVER vs 8.5" — anchored to the live total instead of a naked lean.
  const ouLabel = ou ? (ou.lean === 'OVER' ? '📈 LEANS OVER' : ou.lean === 'UNDER' ? '📉 LEANS UNDER' : '➖ COIN FLIP')
    + (t?.current != null ? ` vs ${t.current}` : '') : null
  const moveArrow = t && t.dir > 0 ? '▲' : t && t.dir < 0 ? '▼' : null
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {col(info?.away, game.away_abbr || up(game.away))}
        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '70px' }}>
          {info && info.status.state !== 'pre'
            ? <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: TEXT }}>{info.away.score}<span style={{ color: MUTED, margin: '0 4px' }}>-</span>{info.home.score}</div>
            : <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: MUTED }}>@</div>}
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: isLive ? DANGER : NEON_T, letterSpacing: '0.04em', marginTop: '3px', whiteSpace: 'nowrap' }}>{center}</div>
        </div>
        {col(info?.home, game.home_abbr || up(game.home))}
      </div>
      {ou && (
        <div style={{ marginTop: '11px', padding: '9px 11px', borderRadius: '10px', border: `1px solid ${ou.strong ? NEON : BORDER}`, background: ou.strong ? 'rgba(189,255,0,0.07)' : 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: ou.strong ? NEON_T : MUTED, letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>{ouLabel}</span>
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ou.reason}</span>
          </div>
          {/* anchored extras: since-open move on the number + value/late verdict */}
          {(moveArrow || ou.edge) && (
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {moveArrow && t?.open != null && (
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED }}>
                  total <span style={{ color: TEXT }}>{t.open}→{t.current}</span> <span style={{ color: t.dir > 0 ? NEON_T : DANGER }}>{moveArrow} since open</span>
                </span>
              )}
              {ou.edge && (
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: ou.edge.startsWith('value') ? NEON_T : DANGER, letterSpacing: '0.03em' }}>{ou.edge}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LookChannel({ game, player = null, sport, setSport, token, onLogPosition, onAddToSlip, onBack, onTune, onPickPlayer }) {
  const [bookMove, setBookMove] = useState({})   // per-book movement (the line-movement chart)
  const [chartMkt, setChartMkt] = useState('ml') // ml | spread | total
  const [bookSide, setBookSide] = useState('away')
  const setMarket = (m) => { setChartMkt(m); setBookSide(m === 'total' ? 'over' : 'away') }
  const [frame, setFrame] = useState('all')   // line-movement window: all (since open) | 24h | 6h
  const [chartMode, setChartMode] = useState('books') // by-sportsbook | best — lifted into the ⚙ tray
  const [lineSettings, setLineSettings] = useState(false) // ⚙ tray open?

  useEffect(() => {
    if (!game?.external_event_id) { setBookMove({}); return }
    let live = true
    fetchBookMovement(game.external_event_id, chartMkt, bookSide).then(m => { if (live) setBookMove(m || {}) }).catch(() => {})
    return () => { live = false }
  }, [game, chartMkt, bookSide])

  // Window the per-book movement to the selected time frame (client-side, free — no extra fetch).
  const framed = (() => {
    if (frame === 'all') return bookMove
    const cutoff = Date.now() - (frame === '6h' ? 6 : 24) * 3600 * 1000
    const out = {}
    for (const [book, m] of Object.entries(bookMove)) {
      const keep = (m.times || []).map((t, i) => ({ ms: new Date(t).getTime(), i })).filter(x => x.ms >= cutoff).map(x => x.i)
      if (!keep.length) continue
      const series = keep.map(i => m.series[i]); const times = keep.map(i => m.times[i])
      out[book] = { open: series[0], current: series[series.length - 1], series, times }
    }
    return out
  })()

  // "Is it still a good bet?" — best price NOW vs where this side OPENED within the chosen frame.
  const sinceOpen = (() => {
    const toDec = (a) => a == null ? null : (a > 0 ? 1 + a / 100 : 1 + 100 / -a)
    let best = null
    for (const [book, m] of Object.entries(framed)) {
      const d = toDec(m.current); if (d == null) continue
      if (!best || d > best.dec) best = { book, dec: d, open: m.open, current: m.current }
    }
    if (!best) return null
    const od = toDec(best.open)
    return { book: best.book, open: best.open, current: best.current, dir: od == null ? 0 : best.dec - od }
  })()

  // ONE screen: the game selector (slider + search + leagues) is ALWAYS on top. Picking a game loads
  // its detail right below — no page switch, no back-to-list. Each panel self-fetches + shows its own
  // empty state, so props still appear even when a game has no book lines.
  return (
    <LookFrame onBack={onBack}>
      <EventsPicker sport={sport} onPickSport={setSport} onPickGame={onTune} onPickPlayer={onPickPlayer} token={token} selectedId={game?.external_event_id} />

      {!game && <div style={{ marginTop: '14px' }}><Empty text="Tap a game above — line movement, compare books & props load right here." /></div>}

      {game && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${BORDER}` }}>
          <GameCard game={game} sport={sport} token={token} />

          <LookSection label="LINE MOVEMENT">
            {/* primary: market tabs + ⚙ (secondary controls tuck into the gear so the panel isn't a wall of buttons) */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: lineSettings ? '8px' : '10px', alignItems: 'stretch' }}>
              {[['ml', 'ML'], ['spread', (SPREAD_LABEL[game.sport || sport] || 'Spread')], ['total', 'Total']].map(([k, label]) => (
                <button key={k} onClick={() => setMarket(k)} style={{ flex: 1, padding: '6px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${chartMkt === k ? NEON : BORDER}`, background: chartMkt === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: chartMkt === k ? NEON_T : MUTED }}>{label}</button>
              ))}
              <button onClick={() => setLineSettings(s => !s)} title="Line movement settings" aria-label="Line movement settings"
                style={{ flexShrink: 0, padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', border: `1px solid ${lineSettings ? NEON : BORDER}`, background: lineSettings ? 'rgba(189,255,0,0.1)' : 'transparent', color: lineSettings ? NEON_T : MUTED }}>⚙</button>
            </div>
            {lineSettings && (
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '9px 10px', marginBottom: '10px', background: '#0d0d0d' }}>
                <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>Time frame</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {[['all', 'Since Open'], ['24h', '24H'], ['6h', '6H']].map(([k, label]) => (
                    <button key={k} onClick={() => setFrame(k)} style={{ flex: 1, padding: '5px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${frame === k ? NEON : BORDER}`, background: frame === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: frame === k ? NEON_T : MUTED }}>{label}</button>
                  ))}
                </div>
                <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>Chart</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[['books', 'By Sportsbook'], ['best', 'Best Available']].map(([k, label]) => (
                    <button key={k} onClick={() => setChartMode(k)} style={{ flex: 1, padding: '6px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, border: `1px solid ${chartMode === k ? NEON : BORDER}`, background: chartMode === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: chartMode === k ? NEON_T : MUTED }}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {sinceOpen && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0d0d0d', border: `1px solid ${sinceOpen.dir > 0 ? NEON : BORDER}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.12em' }}>SINCE OPEN · {(BOOK_NAMES[sinceOpen.book] || sinceOpen.book)}</div>
                  <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{fmtAm(sinceOpen.open)} <span style={{ color: MUTED }}>→</span> <span style={{ color: NEON_T }}>{fmtAm(sinceOpen.current)}</span></div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: sinceOpen.dir > 0 ? NEON_T : sinceOpen.dir < 0 ? DANGER : MUTED }}>{sinceOpen.dir > 0 ? '▲ MOVED YOUR WAY' : sinceOpen.dir < 0 ? '▼ MOVED AGAINST' : '— FLAT'}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: MUTED }}>{sinceOpen.dir > 0 ? 'value better than open — still good' : sinceOpen.dir < 0 ? "you're late — value worse than open" : 'no move since open'}</div>
                </div>
              </div>
            )}
            {Object.keys(framed).length > 0
              ? <BookMoveChart byBook={framed} game={game} market={chartMkt} side={bookSide} onSide={setBookSide} mode={chartMode} onMode={setChartMode} />
              : <Empty text={Object.keys(bookMove).length > 0 ? `No movement in the last ${frame === '6h' ? '6 hours' : '24 hours'} — try Since Open.` : `${chartMkt === 'ml' ? 'ML' : chartMkt === 'total' ? 'Total' : (SPREAD_LABEL[game.sport || sport] || 'Spread')} by-sportsbook history is building — fills in as the game's viewed.`} />}
          </LookSection>

          {/* GAME-level lines (Line Movement + Compare Books) sit together up top; PLAYER PROPS below. */}
          <LookSection label="COMPARE BOOKS · GAME LINES">
            <LineShop event={{ sport: game.sport || sport, league: game.sport || sport, away_team: game.away, home_team: game.home, away_abbr: game.away_abbr, home_abbr: game.home_abbr, external_event_id: game.external_event_id || '', start_time: game.commenceTime }} token={token} onLogPosition={onLogPosition} onAddToSlip={onAddToSlip} />
          </LookSection>

          <LookSection label="PLAYER PROPS" defaultOpen={true}>
            {player && <PlayerProps player={player} game={game} sport={game.sport || sport} token={token} onLogPosition={onLogPosition} onAddToSlip={onAddToSlip} />}
            <PropsPanel game={game} sport={game.sport || sport} token={token} onLogPosition={onLogPosition} onAddToSlip={onAddToSlip} />
          </LookSection>
        </div>
      )}
    </LookFrame>
  )
}

// Every CH2 block is a COLLAPSIBLE panel — all on one page, in sequence, nothing hidden behind tabs
// or separate screens. Default open (everything visible); tap the header to collapse in place.
// Smooth open/close via the grid 0fr→1fr trick (animates dynamic-height content cleanly).
function LookSection({ label, defaultOpen = true, headerRight = null, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginTop: '12px', border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', background: '#0c0d0f' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 13px', cursor: 'pointer', background: open ? 'rgba(189,255,0,0.06)' : 'transparent', border: 'none', borderBottom: open ? `1px solid ${BORDER}` : 'none', transition: 'background 0.2s ease' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, flexShrink: 0, boxShadow: open ? `0 0 6px ${NEON}` : 'none' }} />
          <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </span>
        {headerRight && <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto' }}>{headerRight}</span>}
        <span style={{ fontFamily: R, fontSize: '11px', color: open ? NEON_T : MUTED, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}>▾</span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px' }}>{children}</div>
        </div>
      </div>
    </div>
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

// Props sub-panel — per-game on-demand prop scan (credit-disciplined).
// PrizePicks-style: one card per player+line, big line number, More (Over) / Less (Under) buttons.
function PropsPanel({ game, sport, token, onLogPosition, onAddToSlip }) {
  const [status, setStatus] = useState('idle')
  const [data, setData]     = useState(null)
  const [err, setErr]       = useState('')
  const firstStat = (sp) => (PROP_MARKETS[sp] || []).map(labelFor)[0] || 'ALL'
  const [statF, setStatF]   = useState(() => firstStat(sport))   // default to the FIRST prop tab, not ALL
  const [confirm, setConfirm] = useState(null)
  // All player cards open by default (full board, like a sportsbook). Tap a header to collapse one;
  // we track only the manually-collapsed players so new scans default everyone open again.
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggleCard = (name) => setCollapsed(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  const [teamF, setTeamF] = useState('ALL')            // filter players by team (shortens the scroll)
  const [phlt, setPhlt] = useState({})                 // PHLT v2.2 hitter-HIT verdicts, by player name (MLB)
  const [phltOpen, setPhltOpen] = useState(() => new Set()) // which players' PHLT breakdown is expanded

  // withEx=true (manual refresh) pulls the pricier us_ex region (Novig/exchanges); the auto-scan
  // that fires on game open stays cheap (us, us2) so browsing doesn't bleed credits.
  async function scan(opts = {}) {
    if (!token || status === 'scanning') return
    setStatus('scanning'); setErr('')
    const qs = opts.ex ? '&ex=1' : opts.cacheOnly ? '&cacheOnly=1' : ''
    try {
      const res = await fetch(`/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `props ${res.status}`)
      const j = await res.json()
      setData(j.found ? j : { edges: [], lineShopOnly: [], creditsRemaining: j.creditsRemaining, notCached: j.notCached })
      setStatus('done')
    } catch (e) { setErr(e.message); setStatus('error') }
  }

  // On open: read cache ONLY (free — never spends credits). Cached props show instantly; if nothing's
  // cached you tap ↻ REFRESH to do a paid scan. So just browsing games costs nothing.
  useEffect(() => { if (token && game?.away) scan({ cacheOnly: true }) }, [game?.away, game?.home, token])
  // Reset the stat filter to the first prop tab on each new game/sport (so it opens focused, not on ALL).
  useEffect(() => { setStatF(firstStat(sport)) }, [game?.away, game?.home, sport])

  // PHLT v2.2 — once props load, score every hitter's chance to record a HIT (FREE Statcast + ESPN
  // form, all server-side & cached). MLB only. Auto-runs on game open (Savant ≠ Odds-API credits).
  useEffect(() => {
    if (!token || sport !== 'MLB' || !game?.away) { setPhlt({}); return }
    const names = [...new Set([...(data?.edges || []), ...(data?.lineShopOnly || [])].map(p => p.player).filter(Boolean))].slice(0, 30)
    if (!names.length) return
    let cancel = false
    const iso = game.commenceTime ? `&iso=${encodeURIComponent(game.commenceTime)}` : ''
    fetch(`/api/phlt?sport=${sport}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}${iso}&names=${encodeURIComponent(names.join('|'))}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(j => { if (!cancel && j?.verdicts) setPhlt(j.verdicts) }).catch(() => {})
    return () => { cancel = true }
  }, [game?.away, game?.home, sport, token, data])

  // Group props BY PLAYER → one card per player holding ALL their lines (scan player by player).
  const pmap = new Map()
  for (const p of [...(data?.edges || []), ...(data?.lineShopOnly || [])]) {
    if (!pmap.has(p.player)) pmap.set(p.player, { player: p.player, lines: new Map(), ev: null, headshot: p.headshot || null, team: p.team || null })
    const P = pmap.get(p.player)
    if (!P.headshot && p.headshot) P.headshot = p.headshot
    if (!P.team && p.team) P.team = p.team
    const lk = `${p.market}|${p.point}`
    if (!P.lines.has(lk)) P.lines.set(lk, { marketLabel: p.marketLabel, point: p.point, sides: {}, ev: null })
    const L = P.lines.get(lk)
    L.sides[p.side] = p
    if (p.evPct != null && p.evPct > 0) {   // only a POSITIVE edge counts as +EV (green)
      if (L.ev == null || p.evPct > L.ev) L.ev = p.evPct
      if (P.ev == null || p.evPct > P.ev) P.ev = p.evPct
    }
  }
  // PHLT rank: locks (A) float up, fades (AVOID) sink, no-data falls back to EV order.
  const phltRank = (P) => { const v = P.phlt; if (!v || v.score == null) return -1; return v.faded ? -2 : v.score }
  const players = [...pmap.values()]
    .map(P => ({ ...P, lines: [...P.lines.values()], phlt: phlt[P.player] || null }))
    .sort((a, b) => phltRank(b) - phltRank(a) || (b.ev ?? -99) - (a.ev ?? -99))
  // Tabs = the sport's STANDARD prop categories — always pinned on top, even before any props load.
  const tabLabels = (PROP_MARKETS[sport] || []).map(labelFor)
  const teams = [...new Set(players.map(P => P.team).filter(Boolean))]
  // Team filter shortens the scroll; stat tab filters which LINES show (player drops if none match).
  const shownPlayers = players
    .filter(P => teamF === 'ALL' || P.team === teamF)
    .map(P => ({ ...P, lines: statF === 'ALL' ? P.lines : P.lines.filter(l => l.marketLabel === statF) }))
    .filter(P => P.lines.length)
  // counts reflect the ACTIVE filters (team + stat) so the header never lies
  const propCount = shownPlayers.reduce((n, P) => n + P.lines.length, 0)
  const edgeCount = shownPlayers.reduce((n, P) => n + P.lines.filter(l => l.ev != null).length, 0)
  const initials = (n) => String(n || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // PHLT verdict badge (A·Lock / B·Strong / C·Caution / FADE) — same flag language as the game card.
  const PHLT_C = { A: '#BDFF00', B: '#56b3ff', C: '#ffcf3a', AVOID: '#FF3B3B' }
  const phltBadge = (v, big = false) => {
    if (!v || v.score == null) return null
    const c = PHLT_C[v.tier] || MUTED
    const text = v.tier === 'AVOID' ? 'FADE' : v.tier
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: big ? '3px 8px' : '2px 6px', borderRadius: '6px', border: `1px solid ${c}`, background: `${c}1a`, fontFamily: R, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
        <span style={{ fontSize: big ? '12px' : '10px', color: c, letterSpacing: '0.04em' }}>{text}</span>
        <span style={{ fontSize: big ? '11px' : '9px', color: c, opacity: 0.85 }}>{v.score}</span>
      </span>
    )
  }
  // 5-part breakdown bar (Pitcher/Form/Matchup/Park/Streak) shown when a player's PHLT is expanded.
  const phltBar = (label, val) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
      <span style={{ width: '58px', flexShrink: 0, fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ flex: 1, height: '5px', background: '#1a1d22', borderRadius: '3px', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, val))}%`, background: NEON, opacity: 0.8 }} />
      </span>
      <span style={{ width: '22px', textAlign: 'right', fontFamily: R, fontSize: '9px', fontWeight: 700, color: TEXT }}>{val}</span>
    </div>
  )

  // Compact single-line price chip (▲ more / ▼ less). Tight so a player's whole board scans fast.
  const sideChip = (player, L, side) => {
    const r = L.sides[side], more = side === 'Over'
    const isEdge = r && r.evPct != null && r.evPct > 0          // GREEN highlight = a real +EV edge only
    const isBad = r && r.evPct != null && r.evPct < 0           // -EV bet → flag red, never green
    if (!r) return <div style={{ flex: 1, padding: '7px 4px', borderRadius: '7px', border: `1px solid ${BORDER}`, textAlign: 'center', opacity: 0.35, fontFamily: R, fontSize: '12px', color: MUTED }}>{more ? '▲' : '▼'} —</div>
    return (
      <button onClick={() => setConfirm({ pick: `${player} ${side} ${L.point} ${L.marketLabel}`, odds: r.best.price, book: r.best.book, url: decorate(r.best.book, r.best.link), byBook: r.byBook, byBookLink: r.byBookLink, evPct: r.evPct, consensus: r.consensus })}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px 4px', borderRadius: '7px', border: `1px solid ${isEdge ? NEON : BORDER}`, background: isEdge ? 'rgba(189,255,0,0.1)' : '#0d0d0d', cursor: 'pointer' }}>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: isEdge ? NEON_T : MUTED }}>{more ? '▲' : '▼'}</span>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: isEdge ? NEON_T : TEXT }}>{fmtAm(r.best.price)}</span>
        {isEdge && <span style={{ fontFamily: R, fontSize: '8px', color: NEON_T }}>{r.consensus ? '~' : '+'}{r.evPct.toFixed(1)}%</span>}
        {isBad && <span style={{ fontFamily: R, fontSize: '8px', color: DANGER }}>{r.evPct.toFixed(1)}%</span>}
        {r.openPrice != null && r.openPrice !== r.best.price && (() => {
          const toDec = (a) => a > 0 ? 1 + a / 100 : 1 + 100 / -a
          const up = toDec(r.best.price) > toDec(r.openPrice)
          return <span title={`opened ${r.openPrice > 0 ? '+' : ''}${r.openPrice}`} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: up ? NEON_T : DANGER }}>{up ? '▲' : '▼'}</span>
        })()}
      </button>
    )
  }

  return (
    <div>
      {/* Stat-type tabs — ALWAYS pinned on top, even with no props loaded (the sport's standard categories). */}
      <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto' }}>
        <button onClick={() => setStatF('ALL')} style={pill(statF === 'ALL')}>ALL</button>
        {tabLabels.map(s => <button key={s} onClick={() => setStatF(s)} style={pill(statF === s)}>{s}</button>)}
      </div>

      {/* team filter — shortens the player scroll to one side */}
      {teams.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <button onClick={() => setTeamF('ALL')} style={{ ...pill(teamF === 'ALL'), flex: 1 }}>BOTH</button>
          {teams.map(t => <button key={t} onClick={() => setTeamF(t)} style={{ ...pill(teamF === t), flex: 1 }}>{t}</button>)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: edgeCount ? NEON_T : MUTED, letterSpacing: '0.1em' }}>{edgeCount ? `${edgeCount} +EV · ${shownPlayers.length} PLAYERS` : propCount ? `${shownPlayers.length} PLAYERS · ${propCount} PROPS` : 'NO PROPS YET'}</span>
        <button onClick={() => scan({ ex: true })} title="Refresh prop odds (incl. Novig/exchanges)" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(189,255,0,0.08)', border: `1px solid ${NEON}`, borderRadius: '7px', padding: '4px 9px', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>{data?.creditsRemaining != null ? `${data.creditsRemaining} · ` : ''}<span style={{ fontSize: '11px', display: 'inline-block', animation: status === 'scanning' ? 'spin 0.8s linear infinite' : 'none' }}>↻</span> {status === 'scanning' ? 'REFRESHING' : 'REFRESH'}</button>
      </div>

      {status === 'error'
        ? <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err} <button onClick={scan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button></div>
        : (status === 'idle' || status === 'scanning')
          ? <div style={{ textAlign: 'center', padding: '22px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: 'rgba(189,255,0,0.6)', letterSpacing: '0.1em' }}>SCANNING PROPS…</div>
          : !players.length
            ? <Empty text={data?.notCached ? 'Tap ↻ REFRESH to load props (spends credits)' : 'No props posted for this game yet — try after lineups.'} />
            : !shownPlayers.length
              ? <Empty text={`No ${statF} props on the board right now.`} />
              : shownPlayers.map((P, i) => {
        const open = !collapsed.has(P.player)
        return (
        <div key={i} style={{ background: '#101114', border: `1px solid ${P.phlt?.faded ? 'rgba(255,59,59,0.4)' : P.phlt?.tier === 'A' ? NEON : P.ev != null ? 'rgba(189,255,0,0.35)' : BORDER}`, borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>
          {/* collapsed row — tap to open this player's board */}
          <button onClick={() => toggleCard(P.player)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', background: open ? 'rgba(189,255,0,0.05)' : 'transparent', border: 'none' }}>
            {P.headshot
              ? <img src={P.headshot} alt="" width="34" height="34" style={{ borderRadius: '50%', background: '#1a1d22', border: `1px solid ${NEON}`, objectFit: 'cover', flexShrink: 0 }} />
              : <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1a1d22', border: `1px solid ${NEON}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontWeight: 700, fontSize: '11px', color: NEON_T, flexShrink: 0 }}>{initials(P.player)}</span>}
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{P.player}</span>
              <span style={{ display: 'block', fontFamily: R, fontSize: '9px', fontWeight: 700, color: P.ev != null ? NEON_T : MUTED, letterSpacing: '0.06em' }}>{P.lines.length} {P.lines.length === 1 ? 'PROP' : 'PROPS'}{P.ev != null ? ` · +${P.ev.toFixed(1)}% EV` : ''}</span>
            </span>
            {phltBadge(P.phlt)}
            <span style={{ fontFamily: R, fontSize: '11px', color: open ? NEON_T : MUTED, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}>▾</span>
          </button>
          {open && (
            <div style={{ padding: '2px 12px 12px' }}>
              {P.phlt && P.phlt.score != null && (() => {
                const v = P.phlt, c = PHLT_C[v.tier] || MUTED, exp = phltOpen.has(P.player)
                return (
                  <div style={{ marginBottom: '10px', padding: '8px 10px', borderRadius: '10px', border: `1px solid ${c}55`, background: `${c}0d` }}>
                    <button onClick={() => setPhltOpen(s => { const n = new Set(s); n.has(P.player) ? n.delete(P.player) : n.add(P.player); return n })}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {phltBadge(v, true)}
                      <span style={{ minWidth: 0, flex: 1, textAlign: 'left', fontFamily: R, fontSize: '10px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        PHLT · TO HIT{v.vs ? ` · vs ${v.vs}` : ''}
                      </span>
                      <span style={{ fontFamily: R, fontSize: '10px', color: MUTED, transform: exp ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▾</span>
                    </button>
                    {v.fades?.length > 0 && (
                      <div style={{ marginTop: '5px', fontFamily: R, fontSize: '9px', fontWeight: 700, color: DANGER, letterSpacing: '0.03em' }}>⚑ {v.fades.join(' · ')}</div>
                    )}
                    {exp && v.breakdown && (
                      <div style={{ marginTop: '8px' }}>
                        {phltBar('PITCHER', v.breakdown.pitcher)}
                        {phltBar('FORM', v.breakdown.form)}
                        {phltBar('MATCHUP', v.breakdown.matchup)}
                        {phltBar('PARK/WX', v.breakdown.parkWeather)}
                        {phltBar('STREAK', v.breakdown.streak)}
                      </div>
                    )}
                  </div>
                )
              })()}
              {(() => {
                const byStat = {}
                for (const L of P.lines) (byStat[L.marketLabel] ??= []).push(L)
                return Object.entries(byStat).map(([stat, lines], si) => (
                  <div key={si} style={{ marginTop: si === 0 ? 0 : '12px', paddingTop: si === 0 ? 0 : '10px', borderTop: si === 0 ? 'none' : `1px solid ${BORDER}` }}>
                    <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', opacity: 0.85 }}>{stat}</div>
                    {lines.map((L, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                        <span style={{ width: '44px', flexShrink: 0, fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>{L.point}</span>
                        {sideChip(P.player, L, 'Over')}
                        {sideChip(P.player, L, 'Under')}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      )})}

      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.55)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '360px', background: '#15171c', border: `1px solid ${NEON}`, borderRadius: '14px', padding: '18px 16px 16px', boxShadow: '0 14px 44px rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT, textAlign: 'center' }}>Add <span style={{ color: NEON_T }}>{confirm.pick} {fmtAm(confirm.odds)}</span>?</span>
            <span style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {onAddToSlip && (
                <button onClick={() => { onAddToSlip({ pick: confirm.pick, odds: confirm.odds, book: confirm.book, link: confirm.url, byBook: confirm.byBook, byBookLink: confirm.byBookLink, evPct: confirm.evPct, consensus: confirm.consensus, sport, event: `${game.away} vs ${game.home}` }); setConfirm(null) }}
                  style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>+ Slip</button>
              )}
              <button onClick={() => { onLogPosition && onLogPosition({ sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime }, { pick: confirm.pick, odds: confirm.odds, book: confirm.book }); if (confirm.url) window.open(confirm.url, '_blank', 'noopener,noreferrer'); setConfirm(null) }}
                style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${NEON}`, cursor: 'pointer', background: 'transparent', color: NEON_T, fontFamily: R, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Log &amp; Open</button>
              <button onClick={() => setConfirm(null)} style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: 'pointer', background: 'transparent', color: MUTED, fontFamily: R, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Cancel</button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────── CH 3 · TRACK ─────────────────────────────
function TrackChannel({ bets, sport, token }) {
  const [events, setEvents] = useState([])
  useEffect(() => {
    let live = true
    const load = () => fetchEvents(sport, 'today').then(res => { if (live) setEvents(res?.data || []) }).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => { live = false; clearInterval(id) }
  }, [sport])

  const graded = useMemo(() => {
    const out = []
    for (const b of bets || []) {
      const ev = events.find(e => matchBetToEvent(b, e))
      if (ev) { const grade = evaluateBet(b, ev, null); if (grade) out.push({ bet: b, ev, grade }) }
    }
    return out
  }, [bets, events])

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

  const [gearOpen, setGearOpen] = useState(false)
  const [scope, setScope] = useState('all')   // all | 30d | 7d | today
  const scopedBets = useMemo(() => {
    if (scope === 'all') return bets || []
    const days = scope === '30d' ? 30 : scope === '7d' ? 7 : 1
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (days - 1))
    const cutStr = cutoff.toISOString().slice(0, 10)
    return (bets || []).filter(b => (b.date || '') >= cutStr)
  }, [bets, scope])

  const [statusFilter, setStatusFilter] = useState('all')   // all | live | pending | settled
  const record = useMemo(() => computeRecord(scopedBets), [scopedBets])
  const statusOk = (b) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'settled') return ['W', 'L', 'P'].includes(b.result)
    return b.result === 'Open'
  }

  const todayKey = todayStr()
  const visibleBets = useMemo(() => scopedBets.filter(statusOk), [scopedBets, statusFilter])
  const dateGroups = useMemo(() => groupByDate(visibleBets, todayKey), [visibleBets])
  const gradeFor = (b) => {
    const g = graded.find(x => x.bet === b)
    if (!g) return null
    return { evPct: g.grade.evPct, clvPct: g.grade.clvPct }
  }

  return (
    <TvFrame ch="33">
      <div style={{ textAlign: 'center', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, marginBottom: '12px' }}>⬡ BEAT THE CLOSE</div>

      {gearOpen && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '6px' }}>TIME SCOPE</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {[['all', 'ALL-TIME'], ['30d', '30D'], ['7d', '7D'], ['today', 'TODAY']].map(([k, lbl]) => (
              <button key={k} onClick={() => setScope(k)} style={pill(scope === k)}>{lbl}</button>
            ))}
          </div>
          <button onClick={() => { if (confirm('Reset your tracked record? This cannot be undone.')) { /* TODO(ev-track): wire reset handler when bet-log mutation is available */ } }}
            style={{ width: '100%', padding: '9px', background: 'transparent', border: `1px solid ${DANGER}59`, borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: DANGER }}>
            RESET SCOREBOARD
          </button>
        </div>
      )}

      {/* scoreboard — the Pikkit Pro headline numbers (collapsible panel) */}
      <LookSection label="SCOREBOARD" headerRight={
        <button aria-label="Track settings" onClick={() => setGearOpen(o => !o)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, fontSize: '16px', lineHeight: 1 }}>
          ⚙
        </button>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px', marginTop: '8px' }}>
          <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 10px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>RECORD</div>
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>
              {record.w}-{record.l}{record.p ? `-${record.p}` : ''} · {record.units >= 0 ? '+' : ''}{record.units.toFixed(1)}u{record.roi != null ? ` · ROI ${record.roi >= 0 ? '+' : ''}${record.roi.toFixed(1)}%` : ''}
            </div>
          </div>
          <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>OPERATOR</div>
            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: MUTED }}>SOON</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[['all', 'ALL'], ['live', 'LIVE'], ['pending', 'PENDING'], ['settled', 'SETTLED']].map(([k, lbl]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={pill(statusFilter === k)}>{lbl}</button>
          ))}
        </div>
        <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.06em', textAlign: 'center', marginTop: '10px' }}>
          {graded.length > 0 ? `${board.tracked} TRACKED · CLV IS THE TRUTH — BEAT THE CLOSE > 50% = SHARP` : 'CLV IS THE TRUTH — log a play on CH 1/2 and it grades here.'}
        </div>
      </LookSection>

      {/* tracked positions — collapsible panel */}
      <LookSection label="TRACKED POSITIONS">
        {!visibleBets.length && <Empty text={`No ${statusFilter === 'all' ? '' : statusFilter + ' '}positions yet. Log a play on CH 1/2 and it grades here.`} />}
        {dateGroups.map((grp) => (
          <div key={grp.date || 'undated'} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 7px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em' }}>{grp.label}</span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{grp.tally.w}-{grp.tally.l}{grp.tally.p ? `-${grp.tally.p}` : ''} · {grp.tally.units >= 0 ? '+' : ''}{grp.tally.units}u</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {grp.bets.map((b) => {
                const ev = graded.find(x => x.bet === b)?.ev
                const n = withLogos(normalizeBet(b), ev)
                return n.kind === 'parlay'
                  ? <BetTicket key={b.id} bet={n} grade={gradeFor(b)} />
                  : <BetCard key={b.id} bet={n} grade={gradeFor(b)} />
              })}
            </div>
          </div>
        ))}
      </LookSection>
    </TvFrame>
  )
}

