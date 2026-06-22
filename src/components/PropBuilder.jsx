// Free guided prop builder (controlled). Emits onChange(prop|null) as the user
// edits. Parents own the submit button. Zero Odds-API credits — uses the free
// player-search / player-stats / box-score chain.
import { useState, useEffect, useMemo } from 'react'
import { trackableStatOptions, assembleProp, pickStatValue } from '../lib/propBuilderLib.js'

const NEON = '#BDFF00', AMBER = '#FFAE2B', MUTED = '#8f8f8f', BORDER = '#2a2a2a'

export default function PropBuilder({ sport, game = null, token, onChange }) {
  const [query, setQuery]   = useState('')
  const [matches, setMatches] = useState([])
  const [player, setPlayer] = useState(null)
  const [stat, setStat]     = useState(null)
  const [side, setSide]     = useState('over')
  const [line, setLine]     = useState('')
  const [odds, setOdds]     = useState('')

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
          let rows = j.matches || []
          if (game) rows = rows.filter(m => m.game?.external_event_id === game.external_event_id)
          setMatches(rows.slice(0, 12))
        })
        .catch(() => { if (on) setMatches([]) })
    }, 250)
    return () => { on = false; clearTimeout(t) }
  }, [query, sport, token, game, player])

  const choosePlayer = (m) => {
    const event = eventFromGame || `${m.game?.away} vs ${m.game?.home}`
    setPlayer({ player: m.player, id: m.id, event })
    setMatches([]); setQuery('')
  }

  useEffect(() => {
    const lineN = parseFloat(line)
    const oddsN = parseInt(String(odds).replace(/[−–—]/g, '-').replace(/[^0-9-]/g, ''))
    if (!player || !stat || !Number.isFinite(lineN) || !Number.isFinite(oddsN)) { onChange?.(null); return }
    onChange?.(assembleProp({ player: player.player, side, line: lineN, statLabel: stat.label, sport, event: player.event, odds: oddsN }))
  }, [player, stat, side, line, odds, sport])

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

  // Cached scan line: if this player+stat+game was already scanned (paid), the line/price live
  // in prop_history. Pre-fill the (still-editable) inputs from that FREE cache read; show open.
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
      })
      .catch(() => {})
    return () => { on = false }
  }, [player, stat, side, sport, token, game])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!player ? (
        <div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player…"
            style={{ width: '100%', padding: '10px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
          {matches.map(m => (
            <div key={`${m.player}|${m.game?.external_event_id}`} onClick={() => choosePlayer(m)}
              style={{ padding: '8px 11px', cursor: 'pointer', color: '#fff' }}>
              {m.player} <span style={{ color: MUTED, fontSize: 11 }}>{m.team}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#121212', border: `1px solid ${NEON}33`, borderRadius: 10, padding: '8px 11px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 500 }}>{player.player}</div>
            <div style={{ color: MUTED, fontSize: 11 }}>{player.event} <span style={{ color: NEON }}>auto-matched</span></div>
          </div>
          <button type="button" onClick={() => { setPlayer(null); onChange?.(null) }}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: '4px 8px', cursor: 'pointer' }}>change</button>
        </div>
      )}
      {player && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1.3, fontSize: 11, color: MUTED }}>Stat
              <select aria-label="Stat" value={stat?.label || ''} onChange={e => setStat(statOptions.find(o => o.label === e.target.value) || null)}
                style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }}>
                <option value="" disabled>Choose…</option>
                {statOptions.map(o => <option key={o.key} value={o.label}>{o.label}</option>)}
              </select>
            </label>
            <div style={{ flex: 1, fontSize: 11, color: MUTED }}>Side
              <div style={{ display: 'flex', marginTop: 4, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                {['over', 'under'].map(s => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    style={{ flex: 1, padding: '9px 0', fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: side === s ? NEON : 'transparent', color: side === s ? '#0A0A0A' : MUTED }}>{s === 'over' ? 'OVER' : 'UNDER'}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={line} onChange={e => setLine(e.target.value)} placeholder="Line  ·  1.5" inputMode="decimal"
              style={{ flex: 1, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
            <input value={odds} onChange={e => setOdds(e.target.value)} placeholder="Odds  ·  -120" inputMode="text"
              style={{ flex: 1, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
          </div>
          {cachedOpen?.found && cachedOpen.line != null && (
            <div style={{ fontSize: 11, color: NEON }}>
              book line {cachedOpen.line}
              {cachedOpen.openLine != null && cachedOpen.openLine !== cachedOpen.line ? ` (open ${cachedOpen.openLine})` : ''}
              <span style={{ color: MUTED }}> · pre-filled, editable</span>
            </div>
          )}
          {ctx && (
            <div style={{ background: '#101510', border: `1px solid ${NEON}22`, borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 16 }}>
              <div><div style={{ fontSize: 10, color: MUTED }}>SEASON / GM</div><div style={{ fontWeight: 700, color: '#fff' }}>{ctx.seasonPerGame.toFixed(1)}</div></div>
              {ctx.last5PerGame != null && <div><div style={{ fontSize: 10, color: MUTED }}>LAST 5 / GM</div><div style={{ fontWeight: 700, color: '#fff' }}>{ctx.last5PerGame.toFixed(1)}</div></div>}
            </div>
          )}
          {stat && line !== '' && odds !== '' && (
            <div style={{ background: '#121212', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ color: '#fff', marginBottom: 5 }}>{`${player.player} ${side === 'over' ? 'Over' : 'Under'} ${line} ${stat.label} · ${odds}`}</div>
              <span style={{ fontSize: 10, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 5, padding: '2px 7px' }}>your number — not a book line</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
