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
  }, [player, stat, side, line, odds, sport, onChange])

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
          {/* free context box + live preview added in Task 4 */}
        </>
      )}
    </div>
  )
}
