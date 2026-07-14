import { useState, useEffect, useMemo } from 'react'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER } from './botShared.jsx'
import { Avatar } from './BetCard.jsx'
import { fmtRec, winPct, applyFilters, unitsRoi, avgClv } from '../lib/performance.js'

// ── All-Time Performance — the model's graded-in-public record. Every call listed with
//    team crests + ✓HIT/✗MISS, filterable. Pure reads of lean_results + prop_results
//    (api/all-time-calls.js) — FREE, 0 Odds-API credits. See the plan doc for the spec.

const MODELS = [
  ['all', 'All'], ['total', 'O/U'], ['ml', 'ML'], ['rl', 'Run Line'], ['phlt', 'PHLT'],
]
const RANGES = [['today', 'Today'], ['all', 'All-time'], ['7d', '7d'], ['30d', '30d']]
// PHLT rating tiers — brand-safe names (A=Prime, B=Strong, C=Caution). Shown as a sub-filter
// only when the PHLT model is selected, so the long prop list can be cut to one tier.
const TIERS = [['all', 'All tiers'], ['A', 'A'], ['B', 'B'], ['C', 'C']]
const TIER_META = {
  A: { name: 'Prime',   c: '#0A0A0A', bg: '#BDFF00',                bd: '#BDFF00' },
  B: { name: 'Strong',  c: NEON_T,    bg: 'rgba(189,255,0,0.12)',  bd: 'rgba(189,255,0,0.45)' },
  C: { name: 'Caution', c: '#FFAE2B', bg: 'rgba(255,174,43,0.12)', bd: 'rgba(255,174,43,0.4)' },
}
const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Won / Lost / Live / Settled status segments for the results panel. Colors mirror the
// per-row ResultChip so the panel reads at a glance.
const STATUSES = [
  { key: 'all',     label: 'All',     icon: '',  c: NEON_T,    bd: 'rgba(189,255,0,0.55)',  glow: 'rgba(189,255,0,0.35)' },
  { key: 'W',       label: 'Won',     icon: '✓', c: NEON_T,    bd: 'rgba(189,255,0,0.55)',  glow: 'rgba(189,255,0,0.4)' },
  { key: 'L',       label: 'Lost',    icon: '✗', c: DANGER,    bd: 'rgba(255,59,59,0.55)',  glow: 'rgba(255,59,59,0.4)' },
  { key: 'live',    label: 'Live',    icon: '●', c: '#FFAE2B', bd: 'rgba(255,174,43,0.55)', glow: 'rgba(255,174,43,0.4)' },
  { key: 'settled', label: 'Settled', icon: '⬡', c: '#5BC8FF', bd: 'rgba(91,200,255,0.55)', glow: 'rgba(91,200,255,0.35)' },
]

// Rating-tier pill (A · Prime, etc.) — one glance tells you how strong the PHLT call is.
function TierBadge({ tier }) {
  const m = TIER_META[tier]
  if (!m) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, fontFamily: R, fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: m.c, background: m.bg, border: `1px solid ${m.bd}`, borderRadius: '5px', padding: '2px 6px' }}>
      {tier} · {m.name}
    </span>
  )
}

// Market pill for lean rows (ML / Run Line / O/U) — gives the non-prop rows the same colored
// badge rhythm as the PHLT tier pills. Color-coded by market so the list scans by type.
function MarketBadge({ call }) {
  let text, c, bg, bd
  if (call.market === 'total') {
    const over = call.lean === 'OVER'
    text = over ? '📈 O/U' : '📉 O/U'
    c  = over ? NEON_T : '#5BC8FF'
    bg = over ? 'rgba(189,255,0,0.12)' : 'rgba(91,200,255,0.12)'
    bd = over ? 'rgba(189,255,0,0.45)' : 'rgba(91,200,255,0.45)'
  } else if (call.market === 'rl') {
    text = 'Run Line'; c = '#FFAE2B'; bg = 'rgba(255,174,43,0.12)'; bd = 'rgba(255,174,43,0.4)'
  } else {
    text = 'ML'; c = NEON_T; bg = 'rgba(189,255,0,0.12)'; bd = 'rgba(189,255,0,0.4)'
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontFamily: R, fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c, background: bg, border: `1px solid ${bd}`, borderRadius: '5px', padding: '2px 6px' }}>{text}</span>
  )
}

// ET YYYY-MM-DD for an offset in days (matches lib/events.js etDate)
function etDate(offsetDays = 0) {
  const now = new Date()
  const etMs = now.getTime() + (-4 * 60) * 60 * 1000 + offsetDays * 86400000
  return new Date(etMs).toISOString().slice(0, 10)
}

const isSettledCall = (c) => c.result === 'W' || c.result === 'L' || c.result === 'P'
const isFinalStatus = (s) => s === 'FT' || s === 'AOT'
// A call is genuinely LIVE only if its game is TODAY (ET), has a score, and isn't final.
// An ungraded call from a past day is grade-pending, NOT live (fixes the day-rollover bug
// where yesterday's finished games kept flashing "LIVE").
function gameIsLive(c) {
  if (isSettledCall(c)) return false
  const ev = c.event || {}
  if (isFinalStatus(ev.status)) return false
  if (c.game_date !== etDate(0)) return false
  return ev.away_score != null && ev.home_score != null
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '6px 12px', borderRadius: '100px', cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${active ? NEON : BORDER}`,
      background: active ? 'rgba(189,255,0,0.12)' : 'transparent',
      color: active ? NEON_T : MUTED, transition: 'all 0.12s',
    }}>{children}</button>
  )
}

function Tile({ label, value, sub, danger }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: 'clamp(7px, 2vw, 11px) clamp(6px, 1.6vw, 13px)', minWidth: 0, overflow: 'hidden', textAlign: 'center' }}>
      <div style={{ fontFamily: R, fontSize: 'clamp(7.5px, 2.1vw, 9px)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: 'clamp(14px, 4.6vw, 21px)', fontWeight: 700, color: danger ? DANGER : NEON_T, lineHeight: 1, whiteSpace: 'nowrap' }}>{value}</div>
      {sub != null && <div style={{ fontFamily: R, fontSize: 'clamp(7.5px, 2vw, 9px)', color: MUTED, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  )
}

// One call → result chip. Ungraded rows show ● LIVE only when the game is actually in
// progress; otherwise "Pending" (awaiting grade) — so past days don't flash LIVE.
function ResultChip({ result, live }) {
  const map = {
    W: { t: '✓ HIT', c: NEON_T, bg: 'rgba(189,255,0,0.10)', bd: 'rgba(189,255,0,0.35)' },
    L: { t: '✗ MISS', c: DANGER, bg: 'rgba(255,59,59,0.10)', bd: 'rgba(255,59,59,0.35)' },
    P: { t: 'PUSH', c: MUTED, bg: 'rgba(255,255,255,0.05)', bd: BORDER },
  }
  const s = map[result] || (live
    ? { t: '● LIVE', c: '#FFAE2B', bg: 'rgba(255,174,43,0.10)', bd: 'rgba(255,174,43,0.35)' }
    : { t: 'Pending', c: MUTED, bg: 'rgba(255,255,255,0.04)', bd: BORDER })
  return (
    <span style={{ flexShrink: 0, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: s.c, background: s.bg, border: `1px solid ${s.bd}`, borderRadius: '5px', padding: '3px 7px', whiteSpace: 'nowrap' }}>{s.t}</span>
  )
}

const LEAGUE_LOGO = {
  MLB: 'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
  WNBA: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
  NBA: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  NHL: 'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
}

// Live scoreboard + lean-tracking for the empty middle of an in-progress lean row.
// Uses the score/status already on the call's event (as of load) — no extra fetch.
function LiveDetail({ call }) {
  const ev = call.event || {}
  const away = Number(ev.away_score), home = Number(ev.home_score)
  if (!Number.isFinite(away) || !Number.isFinite(home)) return null

  let track = null, trackColor = MUTED
  if (call.market === 'total' && call.total_line != null) {
    const line = Number(call.total_line), total = away + home
    const cashing = call.lean === 'OVER' ? total > line : total < line
    trackColor = cashing ? NEON_T : '#FFAE2B'
    track = `Tot ${total} · ${line}`
  } else if (call.market === 'ml' || call.market === 'rl') {
    const pickHome = call.pick_side === 'HOME'
    const margin = pickHome ? home - away : away - home
    const need = call.market === 'rl' ? 1.5 : 0
    const winWord = call.market === 'rl' ? 'Covering' : 'Ahead'
    trackColor = margin > need ? NEON_T : (margin === need && call.market !== 'rl') ? '#FFAE2B' : DANGER
    track = margin > need ? winWord : margin === need ? 'Tied' : 'Trailing'
  }
  const leadAway = away > home, leadHome = home > away
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 800 }}>
        <span style={{ color: leadAway ? TEXT : MUTED }}>{ev.away_abbr} {away}</span>
        <span style={{ color: MUTED, margin: '0 3px' }}>–</span>
        <span style={{ color: leadHome ? TEXT : MUTED }}>{home} {ev.home_abbr}</span>
      </span>
      {track && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: R, fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: trackColor }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF3B3B', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
          {track}
        </span>
      )}
    </div>
  )
}

// Game time / status label for the Today's-Games modal rows.
// Live → red LIVE pulse; finished → "Final"; otherwise the ET start time (e.g. "7:05 PM").
function GameTime({ g }) {
  const finalGame = g.status === 'FT' || g.status === 'AOT'
  const live = !finalGame && g.away_score != null && g.home_score != null
  if (live) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: R, fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FF3B3B', whiteSpace: 'nowrap' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF3B3B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />Live
      </span>
    )
  }
  if (finalGame) return <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, whiteSpace: 'nowrap' }}>Final</span>
  let t = '—'
  try { if (g.start_time) t = new Date(g.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) } catch { /* keep dash */ }
  return <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, whiteSpace: 'nowrap' }}>{t}</span>
}

// Build the per-row display from a unified call (lean or prop)
function CallRow({ call, headshot }) {
  const ev = call.event || {}
  const leagueFallback = LEAGUE_LOGO[String(call.sport || ev.sport || 'MLB').toUpperCase()] || null
  const matchup = ev.away_abbr && ev.home_abbr ? `${ev.away_abbr}@${ev.home_abbr}` : (call.player ? '' : '—')

  const isProp = call.kind === 'prop'
  // Truly live = today's game, in progress (not final, not a past day). Lean rows also get
  // the live scoreboard; props just get the LIVE chip.
  const live = gameIsLive(call)
  const liveRow = live && !isProp
  let crest, label, line
  if (isProp) {
    crest = { logo: ev.away_logo || leagueFallback, logo2: ev.home_logo || null }
    label = <><span style={{ color: TEXT }}>{call.player}</span> <span style={{ color: NEON_T }}>{(call.lean === 'UNDER' ? 'u' : 'o')}{call.prop_line} {call.prop_market}</span></>
    line = null   // tier now shown as a colored badge, not plain text
  } else if (call.market === 'total') {
    crest = { logo: ev.away_logo || leagueFallback, logo2: ev.home_logo || null }
    const c = call.lean === 'OVER' ? NEON_T : '#5BC8FF'
    label = <span style={{ color: c, fontWeight: 800 }}>{call.lean} {call.total_line}</span>
    line = call.final_total != null ? `${call.total_line} → ${call.final_total}` : null
  } else {
    // ml / rl — single crest of the picked side; market shown as the colored badge
    const side = call.pick_side === 'HOME' ? ev.home_logo : ev.away_logo
    crest = { logo: side || leagueFallback, logo2: null }
    const abbr = call.pick_side === 'HOME' ? ev.home_abbr : ev.away_abbr
    label = <span style={{ color: NEON_T, fontWeight: 800 }}>{abbr || call.pick_side}{call.market === 'rl' ? ' −1.5' : ''}</span>
    line = ev.away_score != null && ev.home_score != null ? `${ev.away_score}-${ev.home_score}` : null
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '8px',
      background: call.strong ? 'rgba(189,255,0,0.06)' : 'rgba(255,255,255,0.015)',
      border: `1px solid ${call.strong ? 'rgba(189,255,0,0.25)' : BORDER}` }}>
      <Avatar headshot={isProp ? headshot : undefined} logo={crest.logo} logo2={crest.logo2} size={28} />
      {/* left cluster — matchup + pick + badge, ellipsis if cramped */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 1 }}>
        <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {matchup && <span style={{ color: TEXT, marginRight: '6px' }}>{matchup}</span>}
          {label}
          {call.strong && <span style={{ fontSize: '8px', color: NEON_T, marginLeft: '6px', letterSpacing: '0.1em' }}>★</span>}
        </span>
        {isProp ? (call.phlt_tier && <TierBadge tier={call.phlt_tier} />) : <MarketBadge call={call} />}
      </div>
      {/* flexible gap so the right-side detail hugs the result chip */}
      <div style={{ flex: 1, minWidth: '6px' }} />
      {/* right — live scoreboard (in-progress) or settled line→final / CLV, all one line */}
      {liveRow ? <LiveDetail call={call} /> : (
        (line || call.clv != null) && (
          <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {line}
            {call.clv != null && <span style={{ marginLeft: line ? '8px' : 0, color: call.clv > 0 ? NEON_T : MUTED }}>CLV {call.clv > 0 ? '+' : ''}{call.clv}</span>}
          </span>
        )
      )}
      <ResultChip result={call.result} live={live} />
    </div>
  )
}

export default function PerformancePage({ token, onBack }) {
  const [data, setData] = useState(null)   // { leans, props }
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState('all')
  const [strong, setStrong] = useState(false)
  const [range, setRange] = useState('all')
  const [tier, setTier] = useState('all')            // PHLT rating-tier sub-filter (A/B/C)
  const [showFilters, setShowFilters] = useState(true) // filters open by default
  const [roster, setRoster] = useState({})            // normalized player name → headshot url
  const [gameFilter, setGameFilter] = useState(null)  // external_event_id → narrow list to one game
  const [drawerOpen, setDrawerOpen] = useState(false) // today's-games slide-out
  const [result, setResult] = useState('all')         // status panel: all | W | L | live | settled

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/all-time-calls', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j?.ok) setData({ leans: j.leans || [], props: j.props || [] }) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [token])

  // Player headshots for PHLT rows — name→headshot across active sports (free ESPN rosters,
  // same source the bet log uses). Fail-soft: rows just fall back to team crests if this misses.
  useEffect(() => {
    if (!token) return
    let on = true
    const SP = ['MLB', 'NBA', 'NHL', 'WNBA']
    Promise.all(SP.map(s =>
      fetch(`/api/player-search?all=1&sport=${encodeURIComponent(s)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(j => j?.players || (Array.isArray(j) ? j : []))   // endpoint returns { players: [...] }
        .catch(() => [])
    )).then(arrs => {
      if (!on) return
      const map = {}
      for (const p of arrs.flat()) { const n = normName(p.player || ''); if (n && p.headshot) map[n] ??= p.headshot }
      setRoster(map)
    })
    return () => { on = false }
  }, [token])

  // Unify leans + props into one stream, tag kind, then filter — everything EXCEPT the
  // Won/Lost/Live/Settled status (so the status panel can show accurate per-status counts).
  const baseCalls = useMemo(() => {
    if (!data) return []
    const leans = (data.leans || []).map(r => ({ ...r, kind: 'lean' }))
    const props = (data.props || []).map(r => ({ ...r, kind: 'prop' }))
    const from = range === 'today' ? etDate(0) : range === '7d' ? etDate(-7) : range === '30d' ? etDate(-30) : null
    const to = range === 'today' ? etDate(0) : null
    let rows = applyFilters([...leans, ...props], { model, strong, from, to })
    // PHLT rating-tier sub-filter (only meaningful on the PHLT model)
    if (model === 'phlt' && tier !== 'all') rows = rows.filter(r => r.phlt_tier === tier)
    // Today's-game drawer selection — narrow to one game
    if (gameFilter) rows = rows.filter(r => String(r.external_event_id) === String(gameFilter))
    return rows.sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)))
  }, [data, model, strong, range, tier, gameFilter])

  const isSettled = isSettledCall
  // Live counts for the status panel (from the base set, before the status filter is applied).
  // "Live" = genuinely in progress today; past-day ungraded rows are pending, not live.
  const statusCounts = useMemo(() => ({
    all: baseCalls.length,
    W: baseCalls.filter(r => r.result === 'W').length,
    L: baseCalls.filter(r => r.result === 'L').length,
    live: baseCalls.filter(gameIsLive).length,
    settled: baseCalls.filter(isSettled).length,
  }), [baseCalls])

  // Apply the Won/Lost/Live/Settled status filter on top of everything else.
  const calls = useMemo(() => {
    if (result === 'all') return baseCalls
    if (result === 'live') return baseCalls.filter(gameIsLive)
    if (result === 'settled') return baseCalls.filter(isSettled)
    return baseCalls.filter(r => r.result === result)   // 'W' | 'L'
  }, [baseCalls, result])

  // Today's slate, derived from the loaded calls (free — no extra fetch). One entry per game
  // with its matchup + crests + how many calls we made on it, for the slide-out game filter.
  const todayGames = useMemo(() => {
    if (!data) return []
    const today = etDate(0)
    const m = new Map()
    for (const r of [...(data.leans || []), ...(data.props || [])]) {
      if (r.game_date !== today || r.external_event_id == null) continue
      const ev = r.event || {}
      const key = String(r.external_event_id)
      if (!m.has(key)) m.set(key, { id: key, away_abbr: ev.away_abbr, home_abbr: ev.home_abbr, away_logo: ev.away_logo, home_logo: ev.home_logo, sport: r.sport || ev.sport, start_time: ev.start_time, status: ev.status, away_score: ev.away_score, home_score: ev.home_score, n: 0 })
      m.get(key).n++
    }
    // Live games first, then upcoming (soonest first), then finished.
    const rank = g => (g.status === 'FT' || g.status === 'AOT') ? 2 : (g.away_score != null && g.home_score != null) ? 0 : 1
    return [...m.values()].sort((a, b) => rank(a) - rank(b) || String(a.start_time || '').localeCompare(String(b.start_time || '')))
  }, [data])

  const graded = calls.filter(c => c.result === 'W' || c.result === 'L' || c.result === 'P')
  const rec = { w: graded.filter(c => c.result === 'W').length, l: graded.filter(c => c.result === 'L').length, p: graded.filter(c => c.result === 'P').length }
  const wp = winPct(rec.w, rec.l)
  const clv = avgClv(graded)
  const { units, roi } = unitsRoi(graded)

  // Group rows by date, and within each date float LIVE (in-progress) games to the top,
  // then upcoming, then settled — so live action never gets buried in the settled pile.
  const byDate = useMemo(() => {
    const liveRank = (c) => {
      if (gameIsLive(c)) return 0          // live, in progress today
      if (!isSettledCall(c)) return 1      // upcoming or pending grade
      return 2                             // settled
    }
    const m = new Map()
    for (const c of calls) { const d = c.game_date || '—'; if (!m.has(d)) m.set(d, []); m.get(d).push(c) }
    for (const rows of m.values()) rows.sort((a, b) => liveRank(a) - liveRank(b))  // stable within rank
    return [...m.entries()]
  }, [calls])

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto', padding: '14px 12px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        {onBack && (
          <button onClick={onBack} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>← Back</button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: NEON_T }}>⬡ Full Matrix</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {todayGames.length > 0 && (
              <button onClick={() => setDrawerOpen(true)} aria-label="Filter by today's game" title="Filter by today's game"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: gameFilter ? NEON_T : MUTED, background: gameFilter ? 'rgba(189,255,0,0.1)' : 'transparent', border: `1px solid ${gameFilter ? NEON : BORDER}`, borderRadius: '7px', padding: '5px 9px', cursor: 'pointer' }}>
                📅 {gameFilter ? (todayGames.find(g => g.id === gameFilter) ? `${todayGames.find(g => g.id === gameFilter).away_abbr}@${todayGames.find(g => g.id === gameFilter).home_abbr}` : 'Game') : 'Today'}
              </button>
            )}
            <button onClick={() => setShowFilters(f => !f)} aria-label="Filter settings" title="Filter settings"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: showFilters ? NEON_T : MUTED, background: showFilters ? 'rgba(189,255,0,0.1)' : 'transparent', border: `1px solid ${showFilters ? NEON : BORDER}`, borderRadius: '7px', padding: '5px 9px', cursor: 'pointer' }}>
              ⚙ Filters
            </button>
          </div>
        </div>
        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginTop: '2px' }}>Every model call, graded in public — self-graded from final results.</div>
      </div>

      {/* BETA disclaimer (mirrors Spotlight) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '12px', padding: '7px 9px', borderRadius: '7px', background: 'rgba(255,174,43,0.08)', border: '1px solid rgba(255,174,43,0.3)' }}>
        <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', flexShrink: 0, marginTop: '1px' }}>BETA</span>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, lineHeight: 1.5 }}>Experimental models in testing — calls are informational signals we're still calibrating, not guarantees or advice. The record is shown for transparency.</span>
      </div>

      {/* Filters — tucked behind the ⚙ Filters gear so the page opens clean */}
      {showFilters ? (
        <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {MODELS.map(([v, l]) => <Chip key={v} active={model === v} onClick={() => setModel(v)}>{l}</Chip>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
            {RANGES.map(([v, l]) => <Chip key={v} active={range === v} onClick={() => setRange(v)}>{l}</Chip>)}
            <span style={{ width: '1px', height: '18px', background: BORDER, margin: '0 3px' }} />
            <Chip active={strong} onClick={() => setStrong(s => !s)}>★ Strong only</Chip>
          </div>
          {/* Rating tiers — only when PHLT is selected, so a long prop list can be cut to A/B/C */}
          {model === 'phlt' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginRight: '2px' }}>Rating</span>
              {TIERS.map(([v, l]) => <Chip key={v} active={tier === v} onClick={() => setTier(v)}>{l}</Chip>)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginBottom: '14px' }}>
          Showing <span style={{ color: NEON_T }}>{MODELS.find(([v]) => v === model)?.[1]}</span>
          {' · '}<span style={{ color: NEON_T }}>{RANGES.find(([v]) => v === range)?.[1]}</span>
          {model === 'phlt' && tier !== 'all' && <span style={{ color: NEON_T }}> · Tier {tier}</span>}
          {strong && <span style={{ color: NEON_T }}> · ★ Strong only</span>}
        </div>
      )}

      {/* ── Status panel — Won / Lost / Live / Settled, with live counts. The primary lens. ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '14px' }}>
        {STATUSES.map(s => {
          const active = result === s.key
          const n = statusCounts[s.key] ?? 0
          return (
            <button key={s.key} onClick={() => setResult(s.key)} title={`${s.label} (${n})`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '9px 3px 8px', borderRadius: '9px', cursor: 'pointer',
                border: `1px solid ${active ? s.bd : BORDER}`,
                background: active ? `linear-gradient(180deg, ${s.glow.replace(/0\.\d+\)/, '0.14)')}, transparent)` : 'rgba(255,255,255,0.015)',
                boxShadow: active ? `0 0 12px ${s.glow}, inset 0 0 0 1px ${s.bd}` : 'none',
                transition: 'all 0.14s' }}>
              <span style={{ fontFamily: R, fontSize: '20px', fontWeight: 800, lineHeight: 1, color: n > 0 || active ? s.c : MUTED }}>{n}</span>
              <span style={{ fontFamily: R, fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: active ? s.c : MUTED, whiteSpace: 'nowrap' }}>
                {s.icon && <span style={{ marginRight: '2px' }}>{s.icon}</span>}{s.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(5px, 1.5vw, 8px)', marginBottom: '16px' }}>
        <Tile label="Record" value={fmtRec(rec)} sub={`${graded.length} graded`} />
        <Tile label="Win %" value={wp == null ? '—' : `${wp}%`} sub={wp == null ? 'n < 1' : null} />
        <Tile label="Units (1u)" value={units > 0 ? `+${units}` : units} sub={roi ? `${roi}% ROI` : null} danger={units < 0} />
        <Tile label="CLV" value={clv == null ? '—' : `${clv > 0 ? '+' : ''}${clv}`} sub="vs close" />
      </div>

      {/* Detailed call list */}
      {loading ? (
        <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, textAlign: 'center', padding: '30px 0' }}>Loading the record…</div>
      ) : byDate.length === 0 ? (
        <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, textAlign: 'center', padding: '30px 0' }}>No graded calls for this filter yet — the record builds as games settle.</div>
      ) : (
        byDate.map(([date, rows]) => (
          <div key={date} style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: '6px', paddingLeft: '2px' }}>{date}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rows.map((c, i) => <CallRow key={(c.external_event_id || '') + (c.market || c.player || '') + i} call={c} headshot={c.kind === 'prop' ? roster[normName(c.player)] : undefined} />)}
            </div>
          </div>
        ))
      )}

      {/* Today's-games modal — centered pop-out; tap a game to narrow the whole record to it */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(340px, 92vw)', maxHeight: '80vh', background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 14px', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(189,255,0,0.1)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', minHeight: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEON_T, textAlign: 'center' }}>📅 Today's Games</div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <button onClick={() => { setGameFilter(null); setDrawerOpen(false) }}
              style={{ width: '100%', textAlign: 'left', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: !gameFilter ? NEON_T : MUTED, background: !gameFilter ? 'rgba(189,255,0,0.1)' : 'transparent', border: `1px solid ${!gameFilter ? NEON : BORDER}`, borderRadius: '8px', padding: '9px 11px', cursor: 'pointer', marginBottom: '8px' }}>
              All games
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {todayGames.map(g => {
                const active = g.id === gameFilter
                return (
                  <button key={g.id} onClick={() => { setGameFilter(g.id); setDrawerOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', background: active ? 'rgba(189,255,0,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? NEON : BORDER}`, borderRadius: '8px', padding: '8px 11px', cursor: 'pointer' }}>
                    <Avatar logo={g.away_logo || LEAGUE_LOGO[String(g.sport || 'MLB').toUpperCase()]} logo2={g.home_logo || null} size={26} />
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: active ? NEON_T : TEXT, whiteSpace: 'nowrap' }}>{g.away_abbr}@{g.home_abbr}</span>
                    {g.sport && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1px 4px', flexShrink: 0 }}>{g.sport}</span>}
                    <span style={{ flex: 1 }} />
                    <GameTime g={g} />
                    <span style={{ fontFamily: R, fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>{g.n}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
