// MATRIX EV BOT — retro broadcast-TV tab. Everything renders inside a CRT screen.
//   CH1 FIND  — scan the board → +EV edge rows + a slate ticker (credit-guarded)
//   CH2 LOOK  — a game's books (best highlighted) + props + line movement, bet links
//   CH3 TRACK — your logged bets graded for EV / CLV
// Heavy lifting reuses the already-built engine, endpoints and discipline libs.
import { useState, useEffect, useMemo } from 'react'
import './MatrixBot.css'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER, BOOK_NAMES, SPREAD_LABEL, fmtAm, Sparkline } from './botShared.jsx'
import { fetchEvents } from '../lib/events.js'
import { fetchLineMovement } from '../lib/oddsHistory.js'
import { matchBetToEvent, evaluateBet } from '../lib/betMatch.js'
import { decorate } from '../lib/betLinks.js'
import { groupEdgesByGame, applyFeedFilters, gameKey } from '../lib/botFeed.js'
import { getScan, putScan } from '../lib/scanCache.js'

const SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL']
const todayStr = () => new Date().toISOString().slice(0, 10)
const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const up = (s) => lw(s).toUpperCase()
const isPreGame = (ev) => ev.status === 'NS' || ev.status === 'STATUS_SCHEDULED'

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

export default function MatrixBot({ onLogPosition, bets = [], token = null, unitSize = 0 }) {
  const [channel, setChannel] = useState('find')   // find | look | track
  const [sport, setSport]     = useState('MLB')
  const [game, setGame]       = useState(null)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 12px 90px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['find', 'CH 1 · FIND'], ['look', 'CH 2 · LOOK'], ['track', 'CH 3 · TRACK']].map(([k, label]) => (
          <button key={k} onClick={() => setChannel(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${channel === k ? NEON : BORDER}`, background: channel === k ? 'rgba(189,255,0,0.1)' : 'transparent', color: channel === k ? NEON_T : MUTED }}>{label}</button>
        ))}
      </div>
      <div key={channel} className="tvbot-tune">
        {channel === 'find' && <FindChannel sport={sport} setSport={setSport} token={token} unitSize={unitSize}
          onPick={(g) => { setGame(g); setChannel('look') }} />}
        {channel === 'look' && <LookChannel game={game} sport={sport} token={token} onLogPosition={onLogPosition} onBack={() => setChannel('find')} />}
        {channel === 'track' && <TrackChannel bets={bets} sport={sport} />}
      </div>
    </div>
  )
}

// ───────────────────────────── CH 1 · FIND ─────────────────────────────
function FindChannel({ sport, setSport, token, unitSize, onPick }) {
  const [events, setEvents]   = useState([])
  const [minEv, setMinEv]     = useState(0)
  const [status, setStatus]   = useState('idle')   // idle | scanning | done | error
  const [scan, setScan]       = useState(null)     // { edges, creditsRemaining }
  const [err, setErr]         = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    let live = true
    const cached = getScan(sport, todayStr())
    setScan(cached); setStatus(cached ? 'done' : 'idle')
    fetchEvents(sport, 'today').then(res => { if (live) setEvents(res?.data || []) }).catch(() => {})
    return () => { live = false }
  }, [sport])

  const preGames = events.filter(isPreGame)
  const evByKey = useMemo(() => {
    const m = {}
    for (const ev of preGames) m[gameKey(ev.away_team, ev.home_team)] = ev
    return m
  }, [events])

  const buildGame = (ev) => ({ away: ev.away_team, home: ev.home_team, away_abbr: ev.away_abbr, home_abbr: ev.home_abbr, external_event_id: ev.external_event_id, commenceTime: ev.start_time })
  const pickFromGroup = (g) => {
    const ev = evByKey[g.key]
    onPick(ev ? buildGame(ev) : { away: g.away, home: g.home, external_event_id: '', commenceTime: g.commenceTime })
  }

  async function runScan() {
    if (!token || status === 'scanning') return
    const cached = getScan(sport, todayStr())
    if (cached) { setScan(cached); setStatus('done'); return }
    setStatus('scanning'); setErr('')
    try {
      const res = await fetch(`/api/scan-edges?sport=${encodeURIComponent(sport)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `scan ${res.status}`)
      const data = await res.json()
      const payload = { edges: data.edges || [], creditsRemaining: data.creditsRemaining }
      putScan(sport, todayStr(), payload)
      setScan(payload); setStatus('done')
    } catch (e) { setErr(e.message); setStatus('error') }
  }

  const edges  = useMemo(() => applyFeedFilters(scan?.edges || [], { minEvPct: minEv }), [scan, minEv])
  const groups = useMemo(() => groupEdgesByGame(edges), [edges])

  const sub = status === 'scanning' ? '▶ NOW SCANNING THE BOARD ◀'
    : status === 'done' ? '▶ BOARD SCANNED ◀' : '▶ READY ◀'
  const headline = status === 'scanning' ? 'SCANNING…'
    : status === 'done' ? (edges.length ? '⬡ VALID MATRIX' : 'NO VALID MATRIX')
    : '⬡ TAP SCAN'
  const headlineColor = (status === 'done' && !edges.length) ? MUTED : NEON_T

  return (
    <>
      {/* sport quick row */}
      <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {SPORTS.map(s => <button key={s} onClick={() => setSport(s)} style={pill(sport === s)}>{s}</button>)}
      </div>

      <TvFrame ch="21">
        <div style={{ textAlign: 'center', fontFamily: R, fontSize: '10px', letterSpacing: '0.28em', color: 'rgba(189,255,0,0.6)', marginBottom: '6px' }}>{sub}</div>
        <div className={headlineColor === NEON_T ? 'tv-glow' : ''} style={{ textAlign: 'center', fontFamily: R, fontSize: '30px', fontWeight: 700, letterSpacing: '0.06em', color: headlineColor, marginBottom: '14px' }}>{headline}</div>

        {/* edge board */}
        {status === 'done' && groups.map((g, gi) => g.edges.map((e, i) => {
          const top = gi === 0 && i === 0
          return (
            <div key={g.key + i} onClick={() => pickFromGroup(g)} style={{ cursor: 'pointer', borderLeft: `3px solid ${top ? NEON : 'transparent'}`, background: 'rgba(189,255,0,0.04)', borderRadius: '0 8px 8px 0', padding: '11px 13px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: TEXT }}>{up(e.outcome)} ML</span>
                <span className="tv-glow" style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: NEON_T }}>{fmtAm(e.best.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>{BOOK_NAMES[e.best.book] || e.best.book} · best line{unitSize > 0 ? ` · 1u $${Math.round(unitSize)}` : ''}</span>
                <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: top ? NEON_T : '#5DCAA5' }}>+{e.evPct.toFixed(1)}% EDGE</span>
              </div>
            </div>
          )
        }))}
        {status === 'done' && !edges.length && <Empty text="Market's efficient right now — we won't fake an edge." />}
        {status === 'scanning' && <div style={{ textAlign: 'center', padding: '8px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)' }}>de-vigging the sharp line…</div>}
        {status === 'idle' && <Empty text={token ? 'Hit ▶ SCAN to read the board.' : 'Log in to summon the bot.'} />}
        {status === 'error' && <Empty text={`Scan failed — ${err}`} />}

        {/* slate ticker — every pre-game game, tap to tune in */}
        {preGames.length > 0 && (
          <div className="tv-ticker" style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: `1px solid rgba(189,255,0,0.12)` }}>
            {preGames.map(ev => (
              <button key={ev.external_event_id} onClick={() => onPick(buildGame(ev))} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.75)', letterSpacing: '0.04em', whiteSpace: 'nowrap', padding: 0 }}>
                {ev.away_abbr}@{ev.home_abbr} <span style={{ color: MUTED }}>{(ev.start_time || '').slice(11, 16)}</span>
              </button>
            ))}
          </div>
        )}
      </TvFrame>

      {/* small SCAN + FILTERS controls BELOW the TV — filters pop up under */}
      {token && (
        <>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' }}>
            <button onClick={runScan} disabled={!preGames.length || status === 'scanning'} style={{ ...pill(false), padding: '9px 22px', fontSize: '12px', borderColor: preGames.length ? NEON : BORDER, color: preGames.length ? NEON_T : MUTED, cursor: preGames.length ? 'pointer' : 'not-allowed' }}>▶ {status === 'scanning' ? 'SCANNING' : 'SCAN'}</button>
            <button onClick={() => setShowFilters(f => !f)} style={{ ...pill(showFilters), padding: '9px 22px', fontSize: '12px' }}>FILTERS</button>
          </div>
          {showFilters && (
            <div style={{ maxWidth: '300px', margin: '10px auto 0', padding: '12px 14px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD }}>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>MINIMUM EV</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>{[0, 2, 5].map(v => <button key={v} onClick={() => setMinEv(v)} style={pill(minEv === v)}>{v === 0 ? 'ANY' : `${v}%+`}</button>)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '8px' }}>SPORT</div>
              <div className="tv-ticker" style={{ display: 'flex', gap: '6px' }}>{SPORTS.map(s => <button key={s} onClick={() => setSport(s)} style={pill(sport === s)}>{s}</button>)}</div>
            </div>
          )}
          {status === 'done' && scan?.creditsRemaining != null && (
            <div style={{ textAlign: 'center', marginTop: '8px', fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.06em' }}>{scan.creditsRemaining} scans left · tap ▶ SCAN to refresh</div>
          )}
        </>
      )}
    </>
  )
}

// ───────────────────────────── CH 2 · LOOK ─────────────────────────────
function LookChannel({ game, sport, token, onLogPosition, onBack }) {
  const [status, setStatus] = useState('idle')   // idle | loading | done | error
  const [data, setData]     = useState(null)
  const [mkt, setMkt]       = useState('h2h')
  const [move, setMove]     = useState({})
  const [err, setErr]       = useState('')
  const dec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)

  useEffect(() => {
    if (!game || !token) return
    let live = true
    setStatus('loading'); setErr(''); setMove({}); setMkt('h2h')
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
  const tabDefs = [['h2h', 'ML'], ['spreads', SPREAD_LABEL[sport] || 'Spread'], ['totals', 'Total']].filter(([k]) => M[k])
  tabDefs.push(['props', 'PROPS'])
  const activeKey = mkt === 'props' ? 'props' : (M[mkt] ? mkt : tabDefs[0]?.[0])
  const isProps = activeKey === 'props'
  const cmp = M[activeKey]
  const isTotals = activeKey === 'totals'
  const fmtPt = (pt) => pt == null ? '' : (pt > 0 ? `+${pt}` : `${pt}`)
  const moveRows = Object.entries(move || {}).filter(([, m]) => m && m.series && m.series.length >= 2)

  // Stacked-by-book list per side (screen-2 look): one stack per outcome, books sorted best-first.
  const sides = !cmp ? [] : (isTotals
    ? cmp.outcomes.map(n => ({ name: n, label: /^o/i.test(n) ? 'OVER' : 'UNDER' }))
    : [{ name: cmp.outcomes.find(n => lw(n) === lw(game.away)) || cmp.outcomes[0], label: up(game.away) },
       { name: cmp.outcomes.find(n => lw(n) === lw(game.home)) || cmp.outcomes[1], label: up(game.home) }])

  return (
    <Frame>
      <div className="tv-ticker" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {tabDefs.map(([k, label]) => <button key={k} onClick={() => setMkt(k)} style={pill(activeKey === k)}>{label}</button>)}
      </div>

      {isProps && <PropsPanel game={game} sport={sport} token={token} onLogPosition={onLogPosition} />}

      {!isProps && cmp && sides.map(side => {
        const rows = [...cmp.rows].filter(r => r.prices[side.name] != null).sort((a, b) => (dec(b.prices[side.name]) ?? 0) - (dec(a.prices[side.name]) ?? 0))
        if (!rows.length) return null
        const bestBook = cmp.best[side.name]?.book
        return (
          <div key={side.name} style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: '8px' }}>{side.label}{isTotals && cmp.modalPoint?.[side.name] != null ? ` ${cmp.modalPoint[side.name]}` : ''}</div>
            {rows.map(r => {
              const p = r.prices[side.name], pt = r.points[side.name]
              const best = r.book === bestBook
              const pick = isTotals ? `${/^o/i.test(side.name) ? 'Over' : 'Under'} ${pt}` : activeKey === 'spreads' ? `${side.label} ${fmtPt(pt)}` : `${side.label} ML`
              return (
                <div key={r.book} onClick={() => onLogPosition && onLogPosition({ sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime }, { pick, odds: p })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 2px', cursor: 'pointer' }}>
                  <span style={{ fontFamily: R, fontSize: '13px', fontWeight: best ? 700 : 500, color: best ? NEON_T : MUTED }}>{BOOK_NAMES[r.book] || r.book}{r.sharp && <span style={{ fontSize: '8px', color: '#5DCAA5', marginLeft: '6px' }}>SHARP</span>}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: best ? NEON_T : TEXT }}>{fmtAm(p)}{pt != null ? <span style={{ fontSize: '10px', color: MUTED }}> {isTotals ? (/^o/i.test(side.name) ? 'o' : 'u') + pt : fmtPt(pt)}</span> : ''}</span>
                    {best && <span style={{ color: NEON_T, fontSize: '13px' }}>✓</span>}
                    {best && r.links?.[side.name] && <BetLink book={r.book} link={r.links[side.name]} />}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}

      {!isProps && moveRows.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.12em', marginBottom: '6px' }}>LINE MOVEMENT</div>
          {moveRows.map(([key, m]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', color: TEXT, width: '96px', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</span>
              <div style={{ flex: 1 }}><Sparkline series={m.series} color={m.delta >= 0 ? NEON : DANGER} /></div>
              <span style={{ fontFamily: R, fontSize: '10px', color: m.delta >= 0 ? NEON_T : DANGER, width: '54px', textAlign: 'right' }}>{m.open} → {m.current}</span>
            </div>
          ))}
        </div>
      )}
      {!isProps && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, textAlign: 'center', marginTop: '8px' }}>✓ = best price · tap any book to log it</div>}
    </Frame>
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
function TrackChannel({ bets, sport }) {
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

  return (
    <TvFrame ch="33">
      <div style={{ textAlign: 'center', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, marginBottom: '12px' }}>⬡ BEAT THE CLOSE</div>
      {!graded.length && <Empty text={`No graded ${sport} positions yet. Log a play on CH 1/2 and it grades here.`} />}
      {graded.map(({ bet, ev, grade }, i) => (
        <div key={i} style={{ padding: '11px 12px', marginBottom: '8px', borderRadius: '12px', background: '#0d0d0d', border: `1px solid ${BORDER}` }}>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{bet.pick || bet.event}</div>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: '10px', color: MUTED, textTransform: 'uppercase' }}>{up(ev.away_team)} @ {up(ev.home_team)}</div>
          <div style={{ display: 'flex', gap: '18px', marginTop: '6px' }}>
            {grade.evPct != null && <Stat label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
            {grade.clvPct != null && <Stat label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
            {grade.evPct == null && grade.clvPct == null && <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>Awaiting closing line…</span>}
          </div>
        </div>
      ))}
    </TvFrame>
  )
}

function Stat({ label, value, good }) {
  return (
    <div>
      <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: good ? NEON_T : DANGER }}>{value}</div>
    </div>
  )
}
