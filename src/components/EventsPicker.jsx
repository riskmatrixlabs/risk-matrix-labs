// EVENTS PICKER — credit-free entry surface for CH2 (the browsable game page).
// A row of sport circles + today's pre-game slate, pulled from Supabase via
// fetchEvents(sport,'today') (zero Odds-API credits). Tapping a game emits
// onPickGame(<game>) in the EXACT shape the bot's tuneTo()/LookChannel consume
// (mirrors FindChannel's buildGame mapping in MatrixBot.jsx). NOT mounted yet.
import { useState, useEffect } from 'react'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT } from './botShared.jsx'
import { fetchEvents, isLiveEvent } from '../lib/events.js'

// Sports the provider supports today — must match FindChannel's FEED_SPORTS.
const FEED_SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA']

// ── DEMO SAMPLE SLATE ────────────────────────────────────────────────────────
// Shown ONLY when isDemo===true AND the real board is empty (off-day / early AM).
// These games are NEVER real: __sample:true tags every entry so they can never
// be snapshotted, logged as bets, or fed into any model.  Real users (isDemo===false)
// will NEVER see these — the gate is the isDemo prop, which AppRoot only sets to
// true when ?demo=true is in the URL.
const _SAMPLE_DATE = (() => {
  // Use tomorrow's date so the fake games always appear as "upcoming"
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString()
})()
const SAMPLE_SLATE = [
  {
    external_event_id: '__sample_1',
    away_team: 'New York Yankees',  away_abbr: 'NYY',
    home_team: 'Los Angeles Dodgers', home_abbr: 'LAD',
    away_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
    home_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
    start_time: _SAMPLE_DATE,
    _sport: 'MLB', _live: false, __sample: true,
  },
  {
    external_event_id: '__sample_2',
    away_team: 'Houston Astros',   away_abbr: 'HOU',
    home_team: 'Atlanta Braves',   home_abbr: 'ATL',
    away_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
    home_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
    start_time: _SAMPLE_DATE,
    _sport: 'MLB', _live: false, __sample: true,
  },
  {
    external_event_id: '__sample_3',
    away_team: 'Chicago Cubs',     away_abbr: 'CHC',
    home_team: 'Boston Red Sox',   home_abbr: 'BOS',
    away_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
    home_logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
    start_time: _SAMPLE_DATE,
    _sport: 'MLB', _live: false, __sample: true,
  },
]
// ─────────────────────────────────────────────────────────────────────────────

// League logos (ESPN, transparent PNGs) for the sport selector circles.
const LEAGUE_LOGO = {
  MLB:  'https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png',
  NHL:  'https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png',
  NBA:  'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
  WNBA: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png',
}

// Game time in the user's local timezone (device tz), not raw UTC.
const localClock = (iso) => {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
  catch { return '' }
}

// Map a raw Supabase event row into the tuneTo/LookChannel game shape.
// Mirrors buildGame() in MatrixBot.jsx (~line 193) — DO NOT diverge.
const buildGame = (ev) => ({
  away: ev.away_team,
  home: ev.home_team,
  away_abbr: ev.away_abbr,
  home_abbr: ev.home_abbr,
  sport: ev._sport,
  external_event_id: ev.external_event_id,
  commenceTime: ev.start_time,
  odds_ml_away: ev.odds_ml_away,
  odds_ml_home: ev.odds_ml_home,
  odds_spread_away: ev.odds_spread_away,
  odds_spread_home: ev.odds_spread_home,
  odds_total: ev.odds_total,
  metadata: ev.metadata,
})

// ET (UTC-4) YYYY-MM-DD for an offset in days — matches fetchEvents' day windows.
const etDateStr = (off = 0) => new Date(Date.now() + (-4 * 60) * 60 * 1000 + off * 86400000).toISOString().slice(0, 10)

// Date strip: yesterday → Today → +3 days. `key` is what fetchEvents() consumes.
const buildDateStrip = () => {
  const out = []
  const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  for (let off = -1; off <= 3; off++) {
    const d = new Date()
    d.setDate(d.getDate() + off)
    out.push({
      off,
      label: off === 0 ? 'Today' : fmt(d),
      key: off === 0 ? 'today' : off === -1 ? 'yesterday' : etDateStr(off),
    })
  }
  return out
}

export default function EventsPicker({ sport, onPickSport, onPickGame, onPickPlayer, token, selectedId, isDemo = false }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [players, setPlayers] = useState([])      // player-name search matches (across today's games)
  const [pStatus, setPStatus] = useState('idle')  // idle | loading | done
  const [dayOff, setDayOff] = useState(0)          // selected date-strip offset (0 = today)
  const dateStrip = buildDateStrip()
  const activeDay = dateStrip.find(d => d.off === dayOff) || dateStrip[1]

  // Search ALSO finds players (mirrors CH1's player search) — type a name → their game + props.
  useEffect(() => {
    if (!token || query.trim().length < 2) { setPlayers([]); setPStatus('idle'); return }
    let live = true; setPStatus('loading')
    const id = setTimeout(() => {
      fetch(`/api/player-search?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { matches: [] })
        .then(j => { if (live) { setPlayers(j.matches || []); setPStatus('done') } })
        .catch(() => { if (live) setPStatus('done') })
    }, 300)
    return () => { live = false; clearTimeout(id) }
  }, [query, token])

  // Demo safety-net: substitute sample games ONLY when demo mode is on AND the
  // real slate is empty (off-day / early AM) AND the user is viewing Today.
  // Real users (isDemo===false) always get the untouched `events` array.
  const displayEvents = (!loading && isDemo && events.length === 0 && dayOff === 0)
    ? SAMPLE_SLATE
    : events

  // Case-insensitive substring filter on away/home name + abbr.
  const q = query.trim().toLowerCase()
  const filtered = !q ? displayEvents : displayEvents.filter(ev =>
    [ev.away_team, ev.home_team, ev.away_abbr, ev.home_abbr]
      .some(v => v && String(v).toLowerCase().includes(q))
  )

  useEffect(() => {
    let live = true
    setLoading(true)
    fetchEvents(sport, activeDay.key)
      .then(res => {
        if (!live) return
        // Show the WHOLE slate (pre-game AND live) so a game card never disappears mid-game.
        // Pre-game first, live after; live games are tagged (props stay pre-game-gated).
        const rows = (res?.data || [])
          .map(e => ({ ...e, _sport: sport, _live: isLiveEvent(e) }))
          .sort((a, b) => (a._live === b._live) ? 0 : (a._live ? 1 : -1))
        setEvents(rows)
      })
      .catch(() => { if (live) setEvents([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sport, dayOff])

  return (
    <div style={{ width: '100%', fontFamily: R }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: NEON_T, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Events
      </div>

      {/* Date strip — tap a day to load that slate (centered, squarish pills). */}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', paddingBottom: '4px', marginBottom: '16px' }}>
        {dateStrip.map(d => {
          const active = d.off === dayOff
          return (
            <button
              key={d.off}
              onClick={() => setDayOff(d.off)}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', cursor: 'pointer',
                padding: '6px 13px', borderRadius: '10px',
                fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                background: active ? 'rgba(189,255,0,0.1)' : CARD,
                border: `1px solid ${active ? NEON : BORDER}`,
                color: active ? NEON : MUTED,
              }}
            >{d.label}</button>
          )
        })}
      </div>

      {/* Sport tiles — squarish (brand vibe), centered on the page. */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', paddingBottom: '4px', marginBottom: '16px' }}>
        {FEED_SPORTS.map(s => {
          const active = s === sport
          return (
            <button
              key={s}
              onClick={() => onPickSport && onPickSport(s)}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                cursor: 'pointer', background: 'transparent', border: 'none', padding: 0,
              }}
            >
              <span style={{
                width: '46px', height: '46px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: CARD,
                border: `1px solid ${active ? NEON : BORDER}`,
                boxShadow: active ? `0 0 0 2px ${NEON}` : 'none',
                opacity: active ? 1 : 0.55,
              }}>
                <img src={LEAGUE_LOGO[s]} alt={s} width="22" height="22" style={{ objectFit: 'contain' }} />
              </span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: active ? NEON_T : MUTED }}>{s}</span>
            </button>
          )
        })}
      </div>

      {/* Search — filters the slate by team AND finds players by name. */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search team or player…"
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: '14px',
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px',
          padding: '9px 14px', fontFamily: R, fontSize: '13px', fontWeight: 600,
          color: TEXT, letterSpacing: '0.03em', caretColor: NEON, outline: 'none',
        }}
      />

      {/* Player matches — type a name → tap to open their game + props (mirrors CH1 search). */}
      {query.trim().length >= 2 && (pStatus === 'loading' || players.length > 0) && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Players</div>
          {pStatus === 'loading' && <div style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', color: 'rgba(189,255,0,0.6)', padding: '4px 2px' }}>SEARCHING…</div>}
          {players.map((m, i) => (
            <button key={`${m.player}-${i}`} onClick={() => onPickPlayer && onPickPlayer(m)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: '6px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#0d0d0d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {m.headshot
                ? <img src={m.headshot} alt="" width="36" height="36" style={{ borderRadius: '50%', background: '#1a1a1a', objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a1a1a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontSize: '13px', fontWeight: 700, color: MUTED, flexShrink: 0 }}>{m.player[0] || '?'}</span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.player}</span>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>{[m.pos, m.team].filter(Boolean).join(' · ')}</span>
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: NEON_T, letterSpacing: '0.04em', textAlign: 'right', flexShrink: 0 }}>{(m.game?.away_abbr || m.game?.away)} @ {(m.game?.home_abbr || m.game?.home)}<br />{localClock(m.game?.commenceTime)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected-day slate. */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {dayOff === 0 ? 'Today' : activeDay.label}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 12px', fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>
          Loading games…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 12px', fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>
          {displayEvents.length === 0 ? `No games ${dayOff === 0 ? 'today' : activeDay.label}` : 'No matching games'}
        </div>
      ) : (
        // Square cards in a horizontal slider — saves vertical space, swipe through the slate.
        <div className="tv-ticker" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
          {filtered.map((ev, i) => {
            const sel = selectedId && ev.external_event_id === selectedId
            return (
            <button
              key={(ev.external_event_id || '') + i}
              onClick={() => onPickGame && onPickGame(buildGame(ev))}
              style={{
                flexShrink: 0, width: '124px', height: '124px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', background: sel ? 'rgba(189,255,0,0.12)' : 'rgba(189,255,0,0.04)',
                border: `1px solid ${sel ? NEON : BORDER}`, borderRadius: '14px',
                boxShadow: sel ? `0 0 0 1px ${NEON}` : 'none',
                padding: '13px 10px', fontFamily: R,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {ev.away_logo ? <img src={ev.away_logo} alt="" width="30" height="30" style={{ objectFit: 'contain' }} /> : null}
                <span style={{ fontSize: '10px', color: MUTED }}>@</span>
                {ev.home_logo ? <img src={ev.home_logo} alt="" width="30" height="30" style={{ objectFit: 'contain' }} /> : null}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: TEXT, letterSpacing: '0.03em', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {(ev.away_abbr || ev.away_team)} <span style={{ color: MUTED }}>@</span> {(ev.home_abbr || ev.home_team)}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: ev._live ? '#FF3B3B' : NEON_T, letterSpacing: '0.04em' }}>
                {ev._live ? '● LIVE' : localClock(ev.start_time)}
              </span>
            </button>
          )})}
        </div>
      )}
    </div>
  )
}
