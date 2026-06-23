// ⬡ SPOTLIGHT — shared signals ticker, unified across Game Center · Dashboard · Matrix Bot.
// Self-fetches today's slate (free Supabase events) + the free, server-cached O/U model per MLB
// game; keeps only `strong` leans, ranks them #1.. by factor count. Auto-refreshes every 3 min
// (model is FREE — safe to poll, unlike paid scans). Tap a signal → onOpen(event) if provided.
import { useState, useEffect, Fragment } from 'react'
import { fetchEvents } from '../lib/events'
import { teamLeanLines } from '../lib/teamLean'
import { NEON, NEON_T, MUTED, CARD, BORDER, TEXT } from './botShared.jsx'
import CallChips from './CallChips.jsx'

const R = 'Rajdhani, sans-serif'


function RankBadge({ rank }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6, padding: '0 5px', borderRadius: 5, border: `1px solid rgba(189,255,0,0.4)`, background: 'rgba(189,255,0,0.1)', verticalAlign: 'middle' }}>
      <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>#{rank}</span>
    </span>
  )
}

export default function SpotlightTicker({ token, onOpen, onAddToSlip }) {
  const [signals, setSignals] = useState([])
  const [open, setOpen] = useState(false)
  const [record, setRecord] = useState(null)  // model lean track record (strong subset = Spotlight)
  const [propRec, setPropRec] = useState(null) // PHLT hitter-prop record (self-grading loop)

  // Pull the graded records when the panel opens (free DB reads).
  useEffect(() => {
    if (!open || !token || record) return
    fetch('/api/lean-record', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(j => { if (j?.ok) setRecord(j) }).catch(() => {})
    fetch('/api/prop-record', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(j => { if (j) setPropRec(j) }).catch(() => {})
  }, [open, token, record])

  // ⬡ KBO — FREE overnight scan (TheSportsDB + Open-Meteo, 0 credits). Korean baseball plays while
  // MLB is dark, so it fills the overnight Spotlight slot. Projection model, no market line yet (BETA).
  const [kbo, setKbo] = useState([])
  const [kboOpen, setKboOpen] = useState(false)   // collapsed by default — tap to expand
  const [kboView, setKboView] = useState('today') // 'today' (live scan) | 'yesterday' (locked grades)
  const [kboYest, setKboYest] = useState(null)     // { games, record } from /api/kbo-record (DB truth)
  useEffect(() => {
    let cancel = false
    fetch('/api/kbo-scan').then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancel) setKbo(j?.games || []) }).catch(() => {})
    return () => { cancel = true }
  }, [])
  // Yesterday = LOCKED grades from the DB (never a live re-scan — that's what caused phantom losses).
  // Fetched EAGERLY on mount (not just when the tab is opened) so the section can stay visible on KBO
  // off-days (e.g. Mondays, when today's slate is empty) and you can still review the overnight record.
  useEffect(() => {
    const kstNow = new Date(Date.now() + 9 * 3600e3)
    const y = new Date(kstNow.getTime() - 86400e3).toISOString().slice(0, 10)
    fetch(`/api/kbo-record?date=${y}`).then(r => r.ok ? r.json() : null)
      .then(j => setKboYest(j || { games: [], record: { w: 0, l: 0, p: 0 } })).catch(() => {})
  }, [])
  // On a KBO off-day (no games today) but with gradeable games yesterday, land on the Yesterday tab so
  // the section opens to something useful instead of "No KBO games today."
  useEffect(() => {
    if (kbo.length === 0 && (kboYest?.games?.length > 0)) setKboView('yesterday')
  }, [kbo, kboYest])

  useEffect(() => {
    if (!token) { setSignals([]); return }
    let cancel = false
    const load = async () => {
      let todays = []
      try {
        const { data } = await fetchEvents('mlb', 'today')
        todays = (data || []).filter(e => e.away_team && e.home_team && e.status !== 'FT' && e.status !== 'AOT')
      } catch { todays = [] }
      if (!todays.length) { if (!cancel) setSignals([]); return }
      const res = await Promise.all(todays.map(async (ev) => {
        try {
          const iso = ev.start_time ? `&iso=${encodeURIComponent(ev.start_time)}` : ''
          const r = await fetch(`/api/game-info?sport=MLB&away=${encodeURIComponent(ev.away_team)}&home=${encodeURIComponent(ev.home_team)}${iso}`, { headers: { Authorization: `Bearer ${token}` } })
          if (!r.ok) return null
          const j = await r.json()
          // Snapshot every directional lean (not just strong) so we can grade the model's record
          // after the game finishes. Fire-and-forget; the endpoint locks the first pre-game lean/day
          // per market. Now carries the per-side run engine's ML + Run-Line picks too (graded like totals).
          const bets = j?.ou?.proj2?.bets
          const directionalTotal = (j?.ou?.lean === 'OVER' || j?.ou?.lean === 'UNDER')
          const confidentMl = !!(bets?.ml?.pick && bets?.ml?.winProb >= 0.55)
          if ((directionalTotal || confidentMl) && (ev.external_event_id || ev.id)) {
            fetch('/api/snapshot-lean', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ sport: 'MLB', external_event_id: String(ev.external_event_id || ev.id), away_team: ev.away_team, home_team: ev.home_team, away_abbr: ev.away_abbr, home_abbr: ev.home_abbr, lean: j.ou.lean, total_line: j.ou.total?.current, confidence: j.ou.confidence, strong: !!j.ou.strong, reason: j.ou.reason, start_time: ev.start_time, edge_runs: j.ou.edgeRuns, model_version: j.ou.modelVersion, ml_pick: bets?.ml?.pick, ml_win_prob: bets?.ml?.winProb, rl_pick: bets?.rl?.pick, rl_cover_prob: bets?.rl?.coverProb }) }).catch(() => {})
          }
          // Only SURFACE a lean that has a real market total to anchor to — a lean with no line
          // ("OVER —") isn't actionable and breaks +Slip. (We still snapshot it above for grading.)
          const hasLine = j?.ou?.total?.current != null
          return ((j?.ou?.lean === 'OVER' || j?.ou?.lean === 'UNDER') && hasLine) ? { ev, ou: j.ou } : null
        } catch { return null }
      }))
      if (cancel) return
      setSignals(res.filter(Boolean).sort((a, b) =>
        (b.ou.confidence || 0) - (a.ou.confidence || 0)
        || `${a.ev.away_abbr}@${a.ev.home_abbr}`.localeCompare(`${b.ev.away_abbr}@${b.ev.home_abbr}`)))
    }
    load()
    const id = setInterval(load, 180000)
    return () => { cancel = true; clearInterval(id) }
  }, [token])

  // Spotlight ALWAYS lives at the top of Game Center — even with no directional leans it stays put
  // (an honest empty state), rather than vanishing and looking broken.
  const directional = signals.filter(s => s.ou.lean === 'OVER' || s.ou.lean === 'UNDER')
  const ranked = signals.map((s, i) => ({ ...s, rank: i + 1 }))
  // Top bar shows EVERY directional read (not just the "strong" subset) so all Spotlight reads are
  // visible up top — matches the count badge, which already counts all directional leans. Strong ones
  // still stand out via the brighter lean color (confidence ≥ 3 → NEON).
  const featured = directional
  const featuredRanked = featured.map((s, i) => ({ ...s, rank: ranked.find(r => r.ev.id === s.ev.id)?.rank ?? i + 1 }))
  const loop = [...featuredRanked, ...featuredRanked]
  // Conviction color: 3+ factors = bright NEON (strong), exactly 2 = white (weakest that still qualifies).
  const leanColor = (ou) => (ou.confidence >= 3 ? NEON : TEXT)
  const Chip = ({ ev, ou, rank }) => (
    <button onClick={() => onOpen?.(ev)} style={{ background: 'none', border: 'none', cursor: onOpen ? 'pointer' : 'default', padding: 0, fontFamily: R, fontWeight: 700, fontSize: '13px', color: TEXT, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
      <RankBadge rank={rank} />
      {ev.away_abbr}@{ev.home_abbr}{' '}
      <span style={{ color: leanColor(ou) }}>{ou.lean === 'OVER' ? '📈 OVER' : '📉 UNDER'}{ou.total?.current != null ? ` ${ou.total.current}` : ''}</span>
      {ou.total?.open != null && ou.total?.current != null && ou.total.open !== ou.total.current && (
        <span style={{ color: (ou.edge && ou.edge.startsWith('value')) ? NEON : MUTED, fontSize: '11px' }}>{' '}{ou.total.open}→{ou.total.current}</span>
      )}
      {/* If the game also has a team ML/RL call, ride it as its own chip to the right of the total. */}
      {teamLeanLines(ou.proj2?.bets, ev.away_abbr, ev.home_abbr).map((ln) => (
        <span key={ln.market} style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, padding: '0 6px', borderRadius: 5, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)', fontSize: '11px', fontWeight: 700, color: NEON_T, verticalAlign: 'middle' }}>{ln.label}</span>
      ))}
    </button>
  )
  return (
    <div>
      <div style={{ border: `1px solid rgba(189,255,0,0.25)`, borderRadius: '10px', background: 'rgba(189,255,0,0.04)', padding: '9px 0 9px 12px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <style>{`@keyframes rml-spot{from{transform:translateX(0)}to{transform:translateX(-50%)}}.rml-spot-track{display:inline-flex;gap:26px;white-space:nowrap;animation:rml-spot 40s linear infinite;will-change:transform}.rml-spot-track:hover{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.rml-spot-track{animation:none}}`}</style>
        <button onClick={() => setOpen(o => !o)} title="Spotlight — tap for the ranked list" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, flexShrink: 0, textTransform: 'uppercase' }}>
          ⬡ Spotlight ({directional.length})
          <span style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', background: 'rgba(255,174,43,0.12)', border: '1px solid rgba(255,174,43,0.35)', borderRadius: '3px', padding: '1px 4px' }}>BETA</span>
          <span style={{ display: 'inline-block', fontSize: '8px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {featured.length > 0 ? (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="rml-spot-track">
              {loop.map(({ ev, ou, rank }, i) => <span key={ev.id + '-' + i}><Chip ev={ev} ou={ou} rank={rank} /></span>)}
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, flex: 1 }}>no directional leans yet today — model stays neutral until there’s an edge</span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: '6px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD, padding: '12px 14px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase', marginBottom: '2px' }}>⬡ Spotlight — Today, ranked strongest first</div>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginBottom: '6px' }}>#1 = strongest model lean · LINE = open → current total (green = moved to a better number)</div>
          {/* Honest beta disclaimer — the model is experimental and being calibrated; not advice. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,174,43,0.08)', border: '1px solid rgba(255,174,43,0.3)' }}>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', flexShrink: 0, marginTop: '1px' }}>BETA</span>
            <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, lineHeight: 1.5 }}>Experimental model in testing — leans are informational signals we're still calibrating, not guarantees or advice. The record is shown for transparency.</span>
          </div>
          {/* KEY / legend for the market terms */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: '8px', fontFamily: R, fontSize: '9px' }}>
            <span><b style={{ color: NEON_T }}>VALUE</b> <span style={{ color: MUTED }}>line moved against the lean — better number</span></span>
            <span><b style={{ color: '#FF3B3B' }}>LATE</b> <span style={{ color: MUTED }}>line already moved your way — edge priced in</span></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ranked.map(({ ev, ou, rank }) => (
              <div key={ev.id} onClick={() => { onOpen?.(ev); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: ou.strong ? 'rgba(189,255,0,0.08)' : 'rgba(189,255,0,0.02)', border: ou.strong ? `1px solid rgba(189,255,0,0.35)` : `1px solid ${BORDER}`, borderRadius: '7px', padding: '7px 10px', cursor: onOpen ? 'pointer' : 'default', textAlign: 'left' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: NEON_T, flexShrink: 0, width: 22 }}>#{rank}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{ev.away_abbr}@{ev.home_abbr} </span>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: leanColor(ou) }}>{ou.lean === 'OVER' ? 'OVER' : 'UNDER'}{ou.total?.current != null ? ` ${ou.total.current}` : ''}</span>
                    {/* Quick-look in its own box = PUBLIC market info only (open→current line + value/late). Factors hidden — that's the edge. */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: '4px', padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)', fontFamily: R, fontSize: '9px' }}>
                      {(() => {
                        const ts = ev.start_time ? Date.parse(ev.start_time) : null
                        const live = ts != null && ts <= Date.now()
                        const timeLabel = ts == null ? null : (live ? 'LIVE' : new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
                        const line = ou.total?.current
                        const openLine = ou.total?.open
                        const moved = openLine != null && line != null && openLine !== line
                        const moveColor = (ou.edge && ou.edge.startsWith('value')) ? NEON_T : MUTED
                        const edge = ou.edgeRuns
                        const strong = edge != null && Math.abs(edge) >= 1.5
                        // Result: graded (✓HIT/✗MISS), or live total-so-far vs the line (cashing/busted/alive).
                        const g = record?.games?.[String(ev.external_event_id)] || null
                        const liveTotal = (ev.home_score != null && ev.away_score != null) ? Number(ev.home_score) + Number(ev.away_score) : null
                        let result = null
                        if (g?.result) {
                          const win = g.result === 'W', push = g.result === 'P'
                          result = { c: win ? NEON_T : push ? MUTED : '#FF3B3B', t: `${win ? '✓ HIT' : push ? 'PUSH' : '✗ MISS'}${g.finalTotal != null ? ` ${g.finalTotal}` : ''}` }
                        } else if (live && liveTotal != null && line != null) {
                          const won = ou.lean === 'OVER' && liveTotal > line
                          const lost = ou.lean === 'UNDER' && liveTotal >= line
                          result = { c: won ? NEON_T : lost ? '#FF3B3B' : '#FFAE2B', t: `${won ? '✓' : lost ? '✗' : '●'} ${liveTotal} v ${line}` }
                        }
                        return (
                          <>
                            {timeLabel && <span style={{ color: live ? '#FF3B3B' : MUTED, fontWeight: 700 }}>{timeLabel}</span>}
                            <span style={{ color: MUTED }}>LINE</span>
                            {moved
                              ? <span style={{ fontWeight: 700 }}><span style={{ color: MUTED }}>{openLine}</span><span style={{ color: moveColor, margin: '0 3px' }}>→</span><span style={{ color: TEXT }}>{line}</span></span>
                              : <span style={{ color: TEXT, fontWeight: 700 }}>{line != null ? line : '—'}</span>}
                            <span style={{ color: MUTED }}>EDGE</span><span style={{ color: strong ? NEON_T : TEXT, fontWeight: 700 }}>{edge != null ? `${edge > 0 ? '+' : ''}${edge}` : '—'}</span>
                            {result && <span style={{ color: result.c, fontWeight: 700 }}>{result.t}</span>}
                          </>
                        )
                      })()}
                    </span>
                    {onAddToSlip
                      ? <CallChips game={ev} ou={ou} onAddToSlip={onAddToSlip} token={token} style={{ marginTop: '6px' }} />
                      : (() => {
                          // Read-only context (no slip handler): show the team leans as plain text.
                          const tl = teamLeanLines(ou.proj2?.bets, ev.away_abbr, ev.home_abbr)
                          return tl.length ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: '4px', fontFamily: R, fontSize: '9px' }}>
                              <span style={{ color: MUTED, fontWeight: 700, letterSpacing: '0.12em' }}>MODEL</span>
                              {tl.map((ln) => <span key={ln.market} style={{ color: NEON_T, fontWeight: 700, whiteSpace: 'nowrap' }}>{ln.label}</span>)}
                            </span>
                          ) : null
                        })()}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: ou.confidence >= 3 ? NEON : MUTED }}>{ou.confidence}<span style={{ fontSize: '7px', letterSpacing: '0.1em' }}> FACTOR{ou.confidence === 1 ? '' : 'S'}</span></span>
                </span>
              </div>
            ))}
          </div>
          {(kbo.length > 0 || kboYest?.games?.length > 0 || kboView === 'yesterday') && (() => {
            // ONE source per view: Today = live scan; Yesterday = LOCKED DB grades (no re-scan, so
            // no phantom W/L). Both normalize to the same row shape, so the renderer is identical.
            const src = kboView === 'yesterday' ? (kboYest?.games || []) : kbo
            const rows = [...src].sort((a, b) => {
              const ax = a.lean !== 'LEAN' ? Math.abs(a.edge || 0) : -1
              const bx = b.lean !== 'LEAN' ? Math.abs(b.edge || 0) : -1
              return bx - ax
            })
            const pickCount = src.filter(g => g.lean !== 'LEAN').length
            const rec = kboYest?.record
            // Lean = a real side taken (OVER or UNDER) → GREEN. LEAN = no pick → grey. (One color = "we picked".)
            const leanColor = (lean) => (lean === 'OVER' || lean === 'UNDER') ? NEON_T : MUTED
            return (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={() => setKboOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase' }}>⬡ KBO — Overnight (Korea) ({pickCount})</span>
                <span style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', background: 'rgba(255,174,43,0.12)', border: '1px solid rgba(255,174,43,0.35)', borderRadius: '3px', padding: '1px 4px' }}>BETA</span>
                <span style={{ marginLeft: 'auto', fontSize: '8px', color: MUTED, transform: kboOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </button>
              {kboOpen && (<>
              {/* Today / Yesterday switch — Yesterday shows the locked, already-graded results. */}
              <div style={{ display: 'flex', gap: '6px', margin: '8px 0 6px' }}>
                {['today', 'yesterday'].map(v => (
                  <button key={v} onClick={() => setKboView(v)} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', color: kboView === v ? NEON_T : MUTED, background: kboView === v ? 'rgba(189,255,0,0.1)' : 'transparent', border: `1px solid ${kboView === v ? NEON : BORDER}` }}>{v}</button>
                ))}
                {kboView === 'yesterday' && rec && (
                  <span style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T }}>
                    {rec.w}-{rec.l}{rec.p ? `-${rec.p}` : ''}<span style={{ fontSize: '8px', color: MUTED, fontWeight: 400 }}> record</span>
                  </span>
                )}
              </div>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginBottom: '6px' }}>
                {kboView === 'yesterday'
                  ? 'graded results · green = we picked a side · grey = no pick (not counted)'
                  : '#1 = strongest projection edge · park + weather model · no market line yet'}
              </div>
              {rows.length === 0 ? (
                <div style={{ fontFamily: R, fontSize: '11px', color: MUTED, padding: '8px 2px' }}>{kboView === 'yesterday' ? 'No graded KBO games for yesterday.' : 'No KBO games today.'}</div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rows.map((g, i) => {
                  const noPick = g.lean === 'LEAN'
                  const rank = i + 1
                  const strong = Math.abs(g.edge) >= 0.5
                  const fin = g.finalTotal
                  const err = (fin != null && g.projTotal != null) ? Math.round((Number(fin) - Number(g.projTotal)) * 10) / 10 : null
                  // RESULT: never for a no-pick. Yesterday = the locked DB grade; Today = live vs baseline.
                  let result = null
                  if (!noPick) {
                    if (kboView === 'yesterday') {
                      result = g.result === 'W' ? { t: '✓ W', c: NEON_T }
                        : g.result === 'L' ? { t: '✗ L', c: '#FF3B3B' }
                        : g.result === 'P' ? { t: 'PUSH', c: MUTED } : null
                    } else if (fin != null) {
                      const base = Number(g.baseline ?? 9.8)
                      result = Number(fin) === base ? { t: 'PUSH', c: MUTED }
                        : (g.lean === 'OVER' ? Number(fin) > base : Number(fin) < base) ? { t: '✓ W', c: NEON_T } : { t: '✗ L', c: '#FF3B3B' }
                    }
                  }
                  return (
                    <div key={g.id || g.matchup} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: !noPick ? 'rgba(189,255,0,0.08)' : 'rgba(189,255,0,0.02)', border: !noPick ? `1px solid rgba(189,255,0,0.35)` : `1px solid ${BORDER}`, borderRadius: '7px', padding: '7px 10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                        <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: !noPick ? NEON_T : MUTED, flexShrink: 0, width: 22 }}>{!noPick ? `#${rank}` : '—'}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{g.matchup} </span>
                          {/* OVER/UNDER both green (= a side was taken); no-pick reads "NO PICK" in grey. */}
                          {noPick
                            ? <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: MUTED }}>NO PICK</span>
                            : <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: leanColor(g.lean) }}>{g.lean} {g.projTotal}</span>}
                          {/* Quick-look box — same chrome as the MLB rows above: venue + factors context. */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: '4px', padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)', fontFamily: R, fontSize: '9px' }}>
                            {/* PROJ vs BASE so today's number is readable BEFORE the game is final */}
                            {!noPick && g.projTotal != null && (
                              <>
                                <span style={{ color: MUTED }}>PROJ</span>
                                <span style={{ color: TEXT, fontWeight: 700 }}>{g.projTotal}</span>
                                <span style={{ color: MUTED }}>vs BASE</span>
                                <span style={{ color: TEXT, fontWeight: 700 }}>{g.baseline ?? 9.8}</span>
                              </>
                            )}
                            <span style={{ color: MUTED }}>{g.venue || 'venue —'}</span>
                            {(g.factors || []).length > 0 && <span style={{ color: TEXT, fontWeight: 700 }}>{(g.factors || []).join(' · ')}</span>}
                          </span>
                          {/* Grading line — labeled PROJ · ACTUAL · ERROR · RESULT once final. */}
                          {fin != null && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: '5px', fontFamily: R, fontSize: '9px', alignItems: 'center' }}>
                              <span style={{ color: MUTED }}>PROJ <b style={{ color: TEXT }}>{g.projTotal}</b></span>
                              <span style={{ color: MUTED }}>ACTUAL <b style={{ color: TEXT }}>{fin}</b></span>
                              {err != null && <span style={{ color: MUTED }}>ERROR <b style={{ color: err > 0 ? '#FFAE2B' : TEXT }}>{err > 0 ? '+' : ''}{err}</b></span>}
                              {result ? <span style={{ color: result.c, fontWeight: 700 }}>{result.t}</span>
                                : noPick && <span style={{ color: MUTED, fontWeight: 700 }}>NO PICK · not counted</span>}
                            </span>
                          )}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: strong && !noPick ? NEON : MUTED }} title="projected total vs KBO baseline">{g.edge > 0 ? '+' : ''}{g.edge}<span style={{ fontSize: '7px', letterSpacing: '0.1em' }}> EDGE</span></span>
                      </span>
                    </div>
                  )
                })}
              </div>
              )}
              </>)}
            </div>
            )
          })()}
          {(() => {
            // Record MATRIX — rows = Today / Yesterday / All-time, columns = each call type (titles on
            // top), plus an ALL "master" column that combines everything per period. One compact box.
            const fmtRec = (r) => r && (r.w + r.l + r.p) > 0 ? `${r.w}-${r.l}${r.p ? `-${r.p}` : ''}` : '—'
            const pct = (r) => { const n = r ? r.w + r.l : 0; return n >= 3 ? `${Math.round((r.w / n) * 100)}%` : '' }
            const sumRec = (...recs) => recs.reduce((acc, r) => ({ w: acc.w + (r?.w || 0), l: acc.l + (r?.l || 0), p: acc.p + (r?.p || 0) }), { w: 0, l: 0, p: 0 })
            const propP = { today: propRec?.today, yesterday: propRec?.yesterday, allTime: propRec?.overall }
            const cols = [
              { key: 'O/U',  sub: 'totals', get: (p) => record?.all?.[p] },
              { key: 'TEAM', sub: 'ML',     get: (p) => record?.ml?.[p] },
              { key: 'RUN',  sub: 'line',   get: (p) => record?.rl?.[p] },
              { key: 'PHLT', sub: 'prm',    get: (p) => p === 'allTime' ? propRec?.byTier?.A : null },
              { key: 'PHLT', sub: 'str',    get: (p) => p === 'allTime' ? propRec?.byTier?.B : null },
              { key: 'PHLT', sub: 'cau',    get: (p) => p === 'allTime' ? propRec?.byTier?.C : null },
              { key: 'ALL',  sub: 'master', master: true, get: (p) => sumRec(record?.all?.[p], record?.ml?.[p], record?.rl?.[p], propP[p]) },
            ]
            const periods = [['today', 'Today'], ['yesterday', 'Yest'], ['allTime', 'All-time']]
            return (
              <div style={{ marginTop: '10px', background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr repeat(6, 0.82fr) 1fr', gap: '7px 4px', alignItems: 'start', textAlign: 'center' }}>
                  <span />
                  {cols.map((c, i) => (
                    <div key={i} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, lineHeight: 1.2, color: c.master ? NEON_T : MUTED }}>{c.key}<br /><span style={{ color: MUTED, fontSize: '8px' }}>{c.sub}</span></div>
                  ))}
                  {periods.map(([pk, plabel]) => (
                    <Fragment key={pk}>
                      <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, textAlign: 'left', borderTop: `1px solid ${BORDER}`, paddingTop: '7px' }}>{plabel}</div>
                      {cols.map((c, i) => {
                        const r = c.get(pk)
                        const has = r && (r.w + r.l + r.p) > 0
                        return (
                          <div key={i} style={{ borderTop: `1px solid ${c.master ? 'rgba(189,255,0,0.3)' : BORDER}`, paddingTop: '7px' }}>
                            <div style={{ fontFamily: R, fontSize: c.master ? '13px' : '12px', fontWeight: 700, color: c.master ? NEON : (has ? TEXT : 'rgba(255,255,255,0.22)') }}>{fmtRec(r)}</div>
                            {pct(r) && <div style={{ fontFamily: R, fontSize: '8.5px', fontWeight: 700, color: MUTED }}>{pct(r)}</div>}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
                <div style={{ marginTop: '9px', fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.5 }}>self-graded · BETA — builds as games settle · ML/RL reset at the Jun&nbsp;22 fix</div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
