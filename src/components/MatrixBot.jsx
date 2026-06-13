// MATRIX EV BOT — standalone retro broadcast-TV tab. One remote, three channels:
//   CH1 FIND  — scan the slate → filtered +EV edge feed (credit-guarded)
//   CH2 LOOK  — tap a play → every book's price + line movement, tap a book to log it
//   CH3 TRACK — your logged bets graded for EV / CLV ("beat the close")
// Heavy lifting reuses the already-built engine, endpoints, and discipline libs.
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
const isPreGame = (ev) => ev.status === 'NS' || ev.status === 'STATUS_SCHEDULED'

// ── shared little style helpers ──
const pill = (active) => ({ flexShrink: 0, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', border: `1px solid ${active ? NEON : BORDER}`, background: active ? NEON : 'transparent', color: active ? '#0A0A0A' : MUTED })
const chip = (active) => ({ flexShrink: 0, padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '11px', textAlign: 'center', border: `1px solid ${active ? NEON : BORDER}`, background: active ? 'rgba(189,255,0,0.1)' : CARD, color: active ? NEON_T : TEXT })

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '22px 12px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.04em', position: 'relative', zIndex: 1 }}>{text}</div>
}

// "Bet at <book> →" deep-link. Opens the sportsbook to the game; stops card-click bubbling.
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

export default function MatrixBot({ onLogPosition, bets = [], token = null, unitSize = 0 }) {
  const [channel, setChannel] = useState('find')   // find | look | track
  const [sport, setSport]     = useState('MLB')
  const [focused, setFocused] = useState(null)      // { game, edge } selected on CH1

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 12px 90px' }}>
      <ChannelChrome channel={channel} setChannel={setChannel} />
      <div key={channel} className="tvbot-bezel tvbot-tune" style={{ marginTop: '12px' }}>
        <div className="tvbot-screen" style={{ position: 'relative', padding: '14px' }}>
          {channel === 'find' && (
            <FindChannel sport={sport} setSport={setSport} token={token} unitSize={unitSize}
              onPick={(game, edge) => { setFocused({ game, edge }); setChannel('look') }} />
          )}
          {channel === 'look' && (
            <LookChannel focused={focused} sport={sport} token={token} onLogPosition={onLogPosition} onBack={() => setChannel('find')} />
          )}
          {channel === 'track' && <TrackChannel bets={bets} sport={sport} />}
        </div>
      </div>
    </div>
  )
}

function ChannelChrome({ channel, setChannel }) {
  const tabs = [['find', 'CH 1 · FIND'], ['look', 'CH 2 · LOOK'], ['track', 'CH 3 · TRACK']]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.2em', color: NEON_T }}>MATRIX EV BOT</span>
        <span className="tvbot-onair">
          <span className="dot" />
          <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', letterSpacing: '0.14em', color: DANGER }}>ON AIR</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setChannel(k)} style={{
            flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: 'pointer',
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            border: `1px solid ${channel === k ? NEON : BORDER}`,
            background: channel === k ? 'rgba(189,255,0,0.1)' : 'transparent',
            color: channel === k ? NEON_T : MUTED,
          }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────── CH 1 · FIND ─────────────────────────────
function FindChannel({ sport, setSport, token, unitSize, onPick }) {
  const [events, setEvents]  = useState([])
  const [focusKey, setFocus] = useState(null)      // null = ALL GAMES
  const [minEv, setMinEv]    = useState(0)
  const [status, setStatus]  = useState('idle')    // idle | scanning | done | error
  const [scan, setScan]      = useState(null)      // { edges, creditsRemaining }
  const [err, setErr]        = useState('')

  // Game slider from Supabase (free). Reset focus + reuse cached scan when sport changes.
  useEffect(() => {
    let live = true
    const cached = getScan(sport, todayStr())
    setFocus(null); setScan(cached); setStatus(cached ? 'done' : 'idle')
    fetchEvents(sport, 'today').then(res => { if (live) setEvents(res?.data || []) }).catch(() => {})
    return () => { live = false }
  }, [sport])

  const preGames = events.filter(isPreGame)

  async function runScan() {
    if (!token || status === 'scanning') return
    const cached = getScan(sport, todayStr())
    if (cached) { setScan(cached); setStatus('done'); return }   // credit guard: never re-charge
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

  const edges  = useMemo(() => applyFeedFilters(scan?.edges || [], { minEvPct: minEv, focusKey }), [scan, minEv, focusKey])
  const groups = useMemo(() => groupEdgesByGame(edges), [edges])

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* sport pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {SPORTS.map(s => <button key={s} onClick={() => setSport(s)} style={pill(sport === s)}>{s}</button>)}
      </div>

      {/* game slider */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 0' }}>
        <button onClick={() => setFocus(null)} style={chip(focusKey === null)}>ALL GAMES</button>
        {preGames.map(ev => {
          const k = gameKey(ev.away_team, ev.home_team)
          return (
            <button key={ev.external_event_id} onClick={() => setFocus(focusKey === k ? null : k)} style={chip(focusKey === k)}>
              <span style={{ fontWeight: 700 }}>{ev.away_abbr} @ {ev.home_abbr}</span>
              <span style={{ display: 'block', fontSize: '8px', color: MUTED }}>{(ev.start_time || '').slice(11, 16)}</span>
            </button>
          )
        })}
      </div>

      {/* filter pills */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>MIN EV</span>
        {[0, 2, 5].map(v => <button key={v} onClick={() => setMinEv(v)} style={pill(minEv === v)}>{v === 0 ? 'ANY' : `${v}%+`}</button>)}
        <span style={{ ...pill(false), opacity: 0.5, cursor: 'not-allowed' }} title="Player props — coming in Pro">PROPS <b style={{ color: NEON_T }}>PRO</b></span>
      </div>

      {/* scan control + feed */}
      {!token && <Empty text="Log in to summon the bot — scans use credits." />}
      {token && status === 'idle' && (
        <button onClick={runScan} disabled={preGames.length === 0} style={{ width: '100%', padding: '12px', borderRadius: '8px', cursor: preGames.length ? 'pointer' : 'not-allowed', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${preGames.length ? NEON : BORDER}`, background: 'transparent', color: preGames.length ? NEON_T : MUTED }}>
          {preGames.length ? 'RUN SCAN' : 'NO PRE-GAME GAMES RIGHT NOW'}
        </button>
      )}
      {token && status === 'scanning' && <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: NEON_T, letterSpacing: '0.1em' }}>SCANNING EVERY BOOK…</div>}
      {token && status === 'error' && (
        <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>
          Scan failed — {err} <button onClick={runScan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button>
        </div>
      )}

      {token && status === 'done' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontFamily: R, fontSize: '10px', color: edges.length ? NEON_T : MUTED, letterSpacing: '0.12em' }}>
              {edges.length ? `${edges.length} VALID MATRIX${edges.length > 1 ? 'ES' : ''}` : 'NO VALID MATRIX'}
            </span>
            <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>
              {scan?.creditsRemaining != null ? `${scan.creditsRemaining} scans left · ` : ''}
              <button onClick={runScan} style={{ background: 'none', border: 'none', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px', padding: 0 }}>RE-SCAN</button>
            </span>
          </div>
          {groups.length === 0 && <Empty text="Market's efficient right now — we won't fake an edge." />}
          {groups.map(g => g.edges.map((e, i) => (
            <FeedRow key={g.key + i} game={g} edge={e} unitSize={unitSize} onClick={() => onPick(g, e)} />
          )))}
        </>
      )}
    </div>
  )
}

function FeedRow({ game, edge, unitSize, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${NEON}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{edge.outcome}</div>
        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{game.away} @ {game.home} · {BOOK_NAMES[edge.best.book] || edge.best.book}</div>
        {unitSize > 0 && <div style={{ fontFamily: R, fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>Size 1u · ${Math.round(unitSize)}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(edge.best.price)}</div>
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>+{edge.evPct.toFixed(1)}% EV</div>
        {edge.best.link && <BetLink book={edge.best.book} link={edge.best.link} />}
      </div>
    </div>
  )
}

// ───────────────────────────── CH 2 · LOOK ─────────────────────────────
function LookChannel({ focused, sport, token, onLogPosition, onBack }) {
  const [status, setStatus] = useState('idle')   // idle | loading | done | error
  const [data, setData]     = useState(null)
  const [mkt, setMkt]       = useState('h2h')
  const [move, setMove]     = useState({})        // { `${market}_${side}`: {series,...} }
  const [err, setErr]       = useState('')
  const dec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)
  const game = focused?.game

  useEffect(() => {
    if (!game || !token) return
    let live = true
    setStatus('loading'); setErr(''); setMove({})
    fetch(`/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `lines ${res.status}`); return res.json() })
      .then(j => { if (live) { setData(j.found && j.markets ? j : null); setStatus('done') } })
      .catch(e => { if (live) { setErr(e.message); setStatus('error') } })
    const evId = game.external_event_id
    if (evId) fetchLineMovement(evId).then(m => { if (live) setMove(m || {}) }).catch(() => {})
    return () => { live = false }
  }, [game, sport, token])

  if (!game) return <Empty text="Pick a play on CH 1 to tune in." />
  const back = <button onClick={onBack} style={{ ...pill(false), marginBottom: '10px' }}>← CH 1</button>

  if (status === 'loading') return <div style={{ position: 'relative', zIndex: 1 }}>{back}<div style={{ textAlign: 'center', padding: '20px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: MUTED }}>TUNING IN…</div></div>
  if (status === 'error')   return <div style={{ position: 'relative', zIndex: 1 }}>{back}<div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err}</div></div>
  if (!data)                return <div style={{ position: 'relative', zIndex: 1 }}>{back}<Empty text="No book lines for this game (pre-game only)." /></div>

  const M = data.markets
  const tabDefs = [['h2h', 'ML'], ['spreads', SPREAD_LABEL[sport] || 'Spread'], ['totals', 'Total']].filter(([k]) => M[k])
  tabDefs.push(['props', 'PROPS'])
  const activeKey = mkt === 'props' ? 'props' : (M[mkt] ? mkt : tabDefs[0]?.[0])
  const isProps = activeKey === 'props'
  const cmp = M[activeKey]
  const isTotals = activeKey === 'totals'
  const cols = !cmp ? [] : isTotals
    ? cmp.outcomes.map(n => ({ name: n, label: /^o/i.test(n) ? 'OVER' : 'UNDER' }))
    : [{ name: cmp.outcomes.find(n => lw(n) === lw(game.away)) || cmp.outcomes[0], label: lw(game.away) }, // resolved below
       { name: cmp.outcomes.find(n => lw(n) === lw(game.home)) || cmp.outcomes[1], label: lw(game.home) }]
  const colHead = (c) => isTotals ? c.label : (lw(c.name) === lw(game.away) ? game.away : game.home).split(' ').pop()
  const sortName = cols[0]?.name
  const rows = !cmp ? [] : [...cmp.rows].sort((x, y) => (dec(y.prices[sortName]) ?? 0) - (dec(x.prices[sortName]) ?? 0))
  const fmtPt = (pt) => pt == null ? '' : (pt > 0 ? `+${pt}` : `${pt}`)
  const moveRows = Object.entries(move || {}).filter(([, m]) => m && m.series && m.series.length >= 2)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {back}
      <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, marginBottom: '2px' }}>{game.away} @ {game.home}</div>
      <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginBottom: '10px', letterSpacing: '0.12em' }}>BY BOOK · BEST AVAILABLE</div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {tabDefs.map(([k, label]) => <button key={k} onClick={() => setMkt(k)} style={pill(activeKey === k)}>{label}</button>)}
      </div>

      {isProps && <PropsPanel game={game} sport={sport} token={token} onLogPosition={onLogPosition} />}

      {!isProps && cmp && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '6px', fontFamily: R, fontSize: '9px', color: MUTED }}>BOOK</th>
            {cols.map(c => <th key={c.name} style={{ textAlign: 'center', padding: '6px', fontFamily: R, fontSize: '11px', color: MUTED }}>{colHead(c)}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.book} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '7px 6px', fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>
                  {BOOK_NAMES[r.book] || r.book}{r.sharp && <span style={{ fontSize: '8px', color: NEON_T, marginLeft: '5px' }}>SHARP</span>}
                </td>
                {cols.map(c => {
                  const p = r.prices[c.name], pt = r.points[c.name]
                  const isBest = cmp.best[c.name] && cmp.best[c.name].book === r.book
                  const canLog = onLogPosition && p != null
                  const sideLabel = colHead(c)
                  const pick = isTotals ? `${/^o/i.test(c.name) ? 'Over' : 'Under'} ${pt}`
                    : activeKey === 'spreads' ? `${sideLabel} ${fmtPt(pt)}`
                    : `${sideLabel} ML`
                  const onTap = () => canLog && onLogPosition(
                    { sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime },
                    { pick, odds: p })
                  return (
                    <td key={c.name} onClick={onTap} style={{ textAlign: 'center', padding: '7px 6px', cursor: canLog ? 'pointer' : 'default' }}>
                      <span style={{ display: 'inline-block', padding: isBest ? '2px 7px' : '2px 0', borderRadius: '5px', background: isBest ? NEON : 'transparent' }}>
                        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: isBest ? '#0A0A0A' : TEXT }}>{p == null ? '—' : fmtAm(p)}</span>
                        {pt != null && <span style={{ display: 'block', fontFamily: R, fontSize: '9px', color: isBest ? 'rgba(10,10,10,0.6)' : MUTED }}>{isTotals ? (/^o/i.test(c.name) ? 'o' : 'u') + pt : fmtPt(pt)}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isProps && moveRows.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.12em', marginBottom: '6px' }}>LINE MOVEMENT</div>
          {moveRows.map(([key, m]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', color: TEXT, width: '96px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key.replace(/_/g, ' ')}</span>
              <div style={{ flex: 1 }}><Sparkline series={m.series} color={m.delta >= 0 ? NEON : DANGER} /></div>
              <span style={{ fontFamily: R, fontSize: '10px', color: m.delta >= 0 ? NEON_T : DANGER, width: '54px', textAlign: 'right' }}>{m.open} → {m.current}</span>
            </div>
          ))}
        </div>
      )}

      {!isProps && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, textAlign: 'center', marginTop: '10px' }}>Green = best price on the main line · tap a book to log the bet</div>}
    </div>
  )
}

// Props sub-panel inside CH2 LOOK — per-game on-demand prop scan (credit-disciplined).
function PropsPanel({ game, sport, token, onLogPosition }) {
  const [status, setStatus] = useState('idle')   // idle | scanning | done | error
  const [data, setData]     = useState(null)     // { edges, lineShopOnly, creditsRemaining }
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

  if (!token) return <Empty text="Log in to scan props — scans use credits." />
  if (status === 'idle') return (
    <button onClick={scan} style={{ width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T }}>SCAN PROPS</button>
  )
  if (status === 'scanning') return <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: NEON_T, letterSpacing: '0.1em' }}>SCANNING PROPS…</div>
  if (status === 'error') return <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err} <button onClick={scan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button></div>

  const edges = data?.edges || [], ls = data?.lineShopOnly || []
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 10px' }}>
        <span style={{ fontFamily: R, fontSize: '10px', color: edges.length ? NEON_T : MUTED, letterSpacing: '0.12em' }}>{edges.length ? `${edges.length} VALID PROP MATRIX${edges.length > 1 ? 'ES' : ''}` : 'NO VALID PROP MATRIX'}</span>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{data?.creditsRemaining != null ? `${data.creditsRemaining} left · ` : ''}<button onClick={scan} style={{ background: 'none', border: 'none', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px', padding: 0 }}>RE-SCAN</button></span>
      </div>
      {edges.length === 0 && <Empty text="No +EV props right now — we won't fake an edge." />}
      {edges.map((p, i) => (
        <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${NEON}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{p.player} {p.side} {p.point}</div>
            <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{p.marketLabel} · {BOOK_NAMES[p.best.book] || p.best.book} · +{p.evPct.toFixed(1)}% EV</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(p.best.price)}</div>
            {p.best.link && <BetLink book={p.best.book} link={p.best.link} />}
          </div>
        </div>
      ))}
      {ls.length > 0 && (
        <>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.12em', margin: '12px 0 6px' }}>LINE SHOP · NO SHARP ANCHOR</div>
          {ls.map((p, i) => (
            <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', marginBottom: '6px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${BORDER}` }}>
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
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ fontFamily: R, fontSize: '11px', letterSpacing: '0.16em', color: NEON_T, marginBottom: '10px' }}>BEAT THE CLOSE</div>
      {!graded.length && <Empty text={`No graded ${sport} positions for today's slate yet. Log a play on CH 1 and it shows here with CLV.`} />}
      {graded.map(({ bet, ev, grade }, i) => (
        <div key={i} style={{ padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', background: CARD, border: `1px solid ${BORDER}` }}>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{bet.pick || bet.event}</div>
          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{ev.away_team} @ {ev.home_team}</div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
            {grade.evPct != null && <Stat label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
            {grade.clvPct != null && <Stat label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
            {grade.evPct == null && grade.clvPct == null && <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>Awaiting closing line…</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, good }) {
  return (
    <div>
      <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: good ? NEON_T : DANGER }}>{value}</div>
    </div>
  )
}
