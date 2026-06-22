// Free guided prop builder (controlled). Emits onChange(prop|null) as the user
// edits. Parents own the submit button. Zero Odds-API credits for the free path —
// uses the free player-search / player-stats / phlt / prop-open chain. The "Pull
// line" button is the only paid call and is tap-only (never automatic).
import { useState, useEffect, useMemo } from 'react'
import { trackableStatOptions, assembleProp, pickStatValue, scopeToGame } from '../lib/propBuilderLib.js'

const NEON = '#BDFF00', AMBER = '#FFAE2B', MUTED = '#8f8f8f', BORDER = '#2a2a2a', DANGER = '#FF3B3B'
const R = "'Rajdhani', sans-serif"
// PHLT tier colors — mirror MatrixBot.PHLT_C (Prime=green/Strong=blue/Caution=amber/Fade=red).
const PHLT_C = { A: NEON, B: '#56b3ff', C: AMBER, AVOID: DANGER }
const initials = (n) => String(n || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

// 34px headshot circle (neon border) with initials fallback — the bot's pattern.
function Headshot({ src, name, size = 34 }) {
  return src
    ? <img src={src} alt="" width={size} height={size}
        style={{ borderRadius: '50%', background: '#1a1d22', border: `1px solid ${NEON}`, objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: '50%', background: '#1a1d22', border: `1px solid ${NEON}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontWeight: 700, fontSize: 11, color: NEON, flexShrink: 0 }}>{initials(name)}</span>
}

function PhltBadge({ v }) {
  if (!v || v.score == null) return null
  const c = PHLT_C[v.tier] || MUTED
  const text = v.label || (v.tier === 'AVOID' ? 'Fade' : v.tier)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, border: `1px solid ${c}`, background: `${c}1a`, fontFamily: R, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: c, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{text}</span>
      <span style={{ fontSize: 9, color: c, opacity: 0.85 }}>{v.score}</span>
    </span>
  )
}

export default function PropBuilder({ sport, game = null, token, onChange }) {
  const [query, setQuery]   = useState('')
  const [matches, setMatches] = useState([])
  const [player, setPlayer] = useState(null)
  const [stat, setStat]     = useState(null)
  const [side, setSide]     = useState('over')
  const [line, setLine]     = useState('')
  const [odds, setOdds]     = useState('')
  // Track whether the current line came from a book (cached or pulled) vs typed by hand,
  // so the "your number — not a book line" honesty note shows only for manual entry.
  const [lineSource, setLineSource] = useState('manual') // 'manual' | 'cache' | 'pull'

  const statOptions = useMemo(() => trackableStatOptions(sport), [sport])
  const eventFromGame = game ? `${game.away_team || game.away} vs ${game.home_team || game.home}` : null

  useEffect(() => {
    if (player) return
    const q = query.trim()
    if (q.length < 2) { setMatches([]); return }
    let on = true
    const t = setTimeout(() => {
      fetch(`/api/player-search?sport=${encodeURIComponent(sport)}&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { matches: [] })
        .then(j => {
          if (!on) return
          const rows = scopeToGame(j.matches || [], game)
          setMatches(rows.slice(0, 12))
        })
        .catch(() => { if (on) setMatches([]) })
    }, 250)
    return () => { on = false; clearTimeout(t) }
  }, [query, sport, token, game, player])

  const choosePlayer = (m) => {
    const event = eventFromGame || `${m.game?.away} vs ${m.game?.home}`
    setPlayer({ player: m.player, id: m.id, event, headshot: m.headshot || null, team: m.team || null, pos: m.pos || null })
    setMatches([]); setQuery('')
  }

  const resetPlayer = () => {
    setPlayer(null); setStat(null); setLine(''); setOdds(''); setLineSource('manual'); onChange?.(null)
  }

  // CONTRACT: do NOT add onChange to deps (inline-callback identity changes every parent
  // render → infinite loop). Keep exactly [player, stat, side, line, odds, sport].
  useEffect(() => {
    const lineN = parseFloat(line)
    const oddsN = parseInt(String(odds).replace(/[−–—]/g, '-').replace(/[^0-9-]/g, ''))
    if (!player || !stat || !Number.isFinite(lineN) || !Number.isFinite(oddsN)) { onChange?.(null); return }
    onChange?.(assembleProp({ player: player.player, side, line: lineN, statLabel: stat.label, sport, event: player.event, odds: oddsN }))
  }, [player, stat, side, line, odds, sport])

  // Free season / L5 context
  const [statResp, setStatResp] = useState(null)
  useEffect(() => {
    if (!player?.id) { setStatResp(null); return }
    let on = true
    fetch(`/api/player-stats?sport=${encodeURIComponent(sport)}&id=${encodeURIComponent(player.id)}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { found: false })
      .then(j => { if (on) setStatResp(j) })
      .catch(() => { if (on) setStatResp({ found: false }) })
    return () => { on = false }
  }, [player, sport, token])

  const ctx = useMemo(() => (statResp && stat ? pickStatValue(statResp, stat.key) : null), [statResp, stat])

  // PHLT grade (MLB, best-effort, game required). Fail-soft — no badge otherwise.
  const [phlt, setPhlt] = useState(null)
  useEffect(() => {
    setPhlt(null)
    if (!game || String(sport).toUpperCase() !== 'MLB' || !player?.player) return
    let on = true
    const params = new URLSearchParams({ sport: 'MLB', away: game.away_team || '', home: game.home_team || '', iso: game.start_time || '', names: player.player })
    fetch(`/api/phlt?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (on) setPhlt(j?.verdicts?.[player.player] || null) })
      .catch(() => {})
    return () => { on = false }
  }, [player, sport, token, game])

  // Cached scan line (FREE): if this player+stat+game was already scanned, the line/price live
  // in prop_history. Pre-fill the (still-editable) inputs from that cache read; show open.
  const [cachedOpen, setCachedOpen] = useState(null)
  useEffect(() => {
    setCachedOpen(null)
    const eventId = game?.external_event_id
    if (!player?.player || !stat?.key || !eventId) return
    let on = true
    const params = new URLSearchParams({ sport, game: String(eventId), player: player.player, market: stat.key, side })
    fetch(`/api/prop-open?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { found: false })
      .then(j => {
        if (!on || !j?.found) return
        setCachedOpen(j)
        if (j.line != null) setLine(String(j.line))
        if (j.price != null) setOdds(String(j.price))
        setLineSource('cache')
      })
      .catch(() => {})
    return () => { on = false }
  }, [player, stat, side, sport, token, game])

  // PAID pull-line: explicit, tap-only. Scans the live board and finds this player+market+side.
  const [pulling, setPulling] = useState(false)
  const [pullPrices, setPullPrices] = useState(null) // { over, under } available prices
  const [pullErr, setPullErr] = useState(null)
  const pullLine = async () => {
    if (!game || !player?.player || !stat?.key) return
    setPulling(true); setPullErr(null); setPullPrices(null)
    try {
      const params = new URLSearchParams({ sport, away: game.away_team || '', home: game.home_team || '' })
      const r = await fetch(`/api/scan-props?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json()
      const all = [...(j.edges || []), ...(j.lineShopOnly || [])]
      const want = String(player.player).toLowerCase()
      const rows = all.filter(p => String(p.player || '').toLowerCase() === want && p.market === stat.key)
      if (!rows.length) { setPullErr('No line on the board for this number yet.'); return }
      // Prefer the row matching the selected side; fall back to any.
      const chosen = rows.find(p => String(p.side || '').toLowerCase() === side) || rows[0]
      const point = chosen.point ?? chosen.best?.point
      const price = chosen.best?.price ?? chosen.price
      if (point != null) { setLine(String(point)); }
      if (price != null) { setOdds(String(price)); }
      setLineSource('pull')
      // Surface available over/under prices for context.
      const over = rows.find(p => String(p.side || '').toLowerCase() === 'over')
      const under = rows.find(p => String(p.side || '').toLowerCase() === 'under')
      setPullPrices({
        over: over?.best?.price ?? over?.price ?? null,
        under: under?.best?.price ?? under?.price ?? null,
      })
    } catch {
      setPullErr('Could not pull a line right now.')
    } finally {
      setPulling(false)
    }
  }

  const fld = { padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!player ? (
        <div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player…"
            style={{ ...fld, width: '100%', padding: '10px 11px' }} />
          {matches.length > 0 && (
            <div style={{ marginTop: 6, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              {matches.map(m => (
                <div key={`${m.player}|${m.game?.external_event_id}`} onClick={() => choosePlayer(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', cursor: 'pointer', background: '#101114', borderBottom: `1px solid ${BORDER}` }}>
                  <Headshot src={m.headshot} name={m.player} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontFamily: R, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.player}</div>
                    <div style={{ color: MUTED, fontSize: 11, fontFamily: R, fontWeight: 700, letterSpacing: '0.04em' }}>{[m.team, m.pos].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#101114', border: `1px solid ${NEON}33`, borderRadius: 12, padding: '9px 11px' }}>
          <Headshot src={player.headshot} name={player.player} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontFamily: R, fontSize: 16 }}>{player.player}</div>
              <PhltBadge v={phlt} />
            </div>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: R, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[player.team, player.event].filter(Boolean).join(' · ')} <span style={{ color: NEON }}>auto-matched</span>
            </div>
          </div>
          <button type="button" onClick={resetPlayer}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>change</button>
        </div>
      )}

      {player && (
        <>
          {/* Stat chips */}
          <div>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: R, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>STAT</div>
            <div role="group" aria-label="Stat" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {statOptions.map(o => {
                const on = stat?.key === o.key
                return (
                  <button key={o.key} type="button" onClick={() => setStat(o)}
                    style={{ padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: R, fontWeight: 700, fontSize: 12, letterSpacing: '0.02em',
                      background: on ? NEON : 'transparent', color: on ? '#0A0A0A' : '#cfcfcf', border: `1px solid ${on ? NEON : BORDER}` }}>{o.label}</button>
                )
              })}
            </div>
          </div>

          {/* Side toggle */}
          <div>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: R, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>SIDE</div>
            <div style={{ display: 'flex', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              {['over', 'under'].map(s => (
                <button key={s} type="button" onClick={() => setSide(s)}
                  style={{ flex: 1, padding: '9px 0', fontWeight: 700, fontFamily: R, border: 'none', cursor: 'pointer',
                    background: side === s ? NEON : 'transparent', color: side === s ? '#0A0A0A' : MUTED }}>{s === 'over' ? 'OVER' : 'UNDER'}</button>
              ))}
            </div>
          </div>

          {/* Free season / L5 context */}
          {ctx && (
            <div style={{ background: '#101510', border: `1px solid ${NEON}22`, borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 18 }}>
              <div><div style={{ fontSize: 10, color: MUTED, fontFamily: R, fontWeight: 700, letterSpacing: '0.06em' }}>SEASON / GM</div><div style={{ fontWeight: 700, color: '#fff', fontFamily: R, fontSize: 18 }}>{ctx.seasonPerGame.toFixed(1)}</div></div>
              {ctx.last5PerGame != null && <div><div style={{ fontSize: 10, color: MUTED, fontFamily: R, fontWeight: 700, letterSpacing: '0.06em' }}>LAST 5 / GM</div><div style={{ fontWeight: 700, color: '#fff', fontFamily: R, fontSize: 18 }}>{ctx.last5PerGame.toFixed(1)}</div></div>}
            </div>
          )}

          {/* Line + odds (always-available manual fallback) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: R, fontWeight: 700, letterSpacing: '0.08em' }}>LINE · ODDS</div>
              {game && stat && (
                <button type="button" onClick={pullLine} disabled={pulling}
                  style={{ background: 'transparent', border: `1px solid ${NEON}`, borderRadius: 8, color: NEON, padding: '4px 9px', cursor: pulling ? 'default' : 'pointer', fontFamily: R, fontWeight: 700, fontSize: 11, opacity: pulling ? 0.6 : 1 }}>
                  {pulling ? '↻ pulling…' : '↻ Pull line · uses credits'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={line} onChange={e => { setLine(e.target.value); setLineSource('manual') }} placeholder="Line  ·  1.5" inputMode="decimal" style={{ ...fld, flex: 1 }} />
              <input value={odds} onChange={e => { setOdds(e.target.value); setLineSource('manual') }} placeholder="Odds  ·  -120" inputMode="text" style={{ ...fld, flex: 1 }} />
            </div>
          </div>

          {/* Cached book line chip */}
          {cachedOpen?.found && cachedOpen.line != null && lineSource === 'cache' && (
            <div style={{ fontSize: 11, color: NEON, fontFamily: R, fontWeight: 700 }}>
              book line {cachedOpen.line}
              {cachedOpen.openLine != null && cachedOpen.openLine !== cachedOpen.line
                ? ` (open ${cachedOpen.openLine}${cachedOpen.openLine < cachedOpen.line ? ' ▲' : ' ▼'})` : ''}
              <span style={{ color: MUTED }}> · pre-filled, editable</span>
            </div>
          )}

          {/* Pulled book prices */}
          {pullPrices && (pullPrices.over != null || pullPrices.under != null) && (
            <div style={{ fontSize: 11, color: NEON, fontFamily: R, fontWeight: 700 }}>
              board · {pullPrices.over != null ? `Over ${pullPrices.over}` : ''}{pullPrices.over != null && pullPrices.under != null ? '  ·  ' : ''}{pullPrices.under != null ? `Under ${pullPrices.under}` : ''}
              <span style={{ color: MUTED }}> · pulled, editable</span>
            </div>
          )}
          {pullErr && <div style={{ fontSize: 11, color: AMBER, fontFamily: R, fontWeight: 700 }}>{pullErr}</div>}

          {/* Live preview */}
          {stat && line !== '' && odds !== '' && (
            <div style={{ background: '#121212', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ color: '#fff', marginBottom: 5, fontFamily: R, fontWeight: 700 }}>{`${player.player} ${side === 'over' ? 'Over' : 'Under'} ${line} ${stat.label} · ${odds}`}</div>
              {lineSource === 'manual' && (
                <span style={{ fontSize: 10, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 5, padding: '2px 7px', fontFamily: R, fontWeight: 700 }}>your number — not a book line</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
