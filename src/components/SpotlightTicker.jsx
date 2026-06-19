// ⬡ SPOTLIGHT — shared signals ticker, unified across Game Center · Dashboard · Matrix Bot.
// Self-fetches today's slate (free Supabase events) + the free, server-cached O/U model per MLB
// game; keeps only `strong` leans, ranks them #1.. by factor count. Auto-refreshes every 3 min
// (model is FREE — safe to poll, unlike paid scans). Tap a signal → onOpen(event) if provided.
import { useState, useEffect } from 'react'
import { fetchEvents } from '../lib/events'
import { decorate } from '../lib/betLinks'
import { NEON, NEON_T, MUTED, CARD, BORDER, TEXT } from './botShared.jsx'

// Enrich a Spotlight leg with per-book odds from the FREE cached game-lines (same data Channel 2
// uses) so the slip shows all books + places like a CH2 pick. Falls back to the bare leg if nothing
// is cached. Zero credits (cacheOnly=1).
async function enrichWithBooks(leg, ev, ou, token) {
  if (!token) return leg
  try {
    const r = await fetch(`/api/game-lines?sport=MLB&away=${encodeURIComponent(ev.away_team)}&home=${encodeURIComponent(ev.home_team)}&cacheOnly=1`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return leg
    const j = await r.json()
    const tot = j?.markets?.totals
    if (!tot?.rows?.length) return leg
    const re = ou.lean === 'OVER' ? /^o/i : /^u/i
    const name = (tot.outcomes || []).find(n => re.test(n))
    if (!name) return leg
    const byBook = {}, byBookLink = {}
    for (const row of tot.rows) {
      const pr = row.prices?.[name]; if (pr == null) continue
      byBook[row.book] = pr
      const dl = decorate(row.book, row.links?.[name]); if (dl) byBookLink[row.book] = dl
    }
    if (Object.keys(byBook).length) return { ...leg, byBook, byBookLink }
  } catch { /* fall through to bare leg */ }
  return leg
}

const R = 'Rajdhani, sans-serif'

// Line-movement arrow vs the open total. ▲ = total climbed, ▼ = dropped since open.
// Green when the move is "value" (line moved against the lean → better number); grey when "late".
function MoveArrow({ ou }) {
  const dir = ou?.total?.dir
  if (!dir) return null
  const good = ou?.edge && ou.edge.startsWith('value')
  return <span title={ou.edge || (dir > 0 ? 'total up since open' : 'total down since open')} style={{ marginLeft: 4, fontSize: '10px', color: good ? NEON : MUTED }}>{dir > 0 ? '▲' : '▼'}</span>
}

function RankBadge({ rank }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, padding: '0 5px', borderRadius: 5, border: `1px solid rgba(189,255,0,0.4)`, background: 'rgba(189,255,0,0.1)', verticalAlign: 'middle' }}>
      <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>#{rank}</span>
    </span>
  )
}

// Build a fully-priced slip leg from a signal — uses the FREE synced over/under juice (zero credits).
function signalToLeg(ev, ou) {
  const side = ou.lean === 'OVER' ? 'Over' : 'Under'
  const juice = ou.lean === 'OVER' ? ou.total?.overJuice : ou.total?.underJuice
  const matchup = `${ev.away_abbr}@${ev.home_abbr}`
  return {
    // Include the matchup so two games with the same total (e.g. both "Over 10") don't collide in the slip's dedup.
    pick: `${matchup} ${side} ${ou.total?.current ?? ''}`.trim(),
    odds: juice != null ? juice : -110,
    sport: 'MLB',
    event: matchup,
    book: null,
  }
}

export default function SpotlightTicker({ token, onOpen, onAddToSlip }) {
  const [signals, setSignals] = useState([])
  const [open, setOpen] = useState(false)
  const [record, setRecord] = useState(null)  // model lean track record (strong subset = Spotlight)

  // Pull the graded record when the panel opens (free DB read).
  useEffect(() => {
    if (!open || !token || record) return
    fetch('/api/lean-record', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(j => { if (j?.ok) setRecord(j) }).catch(() => {})
  }, [open, token, record])

  // ⬡ KBO — FREE overnight scan (TheSportsDB + Open-Meteo, 0 credits). Korean baseball plays while
  // MLB is dark, so it fills the overnight Spotlight slot. Projection model, no market line yet (BETA).
  const [kbo, setKbo] = useState([])
  const [kboOpen, setKboOpen] = useState(false)   // collapsed by default — tap to expand
  useEffect(() => {
    let cancel = false
    fetch('/api/kbo-scan').then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancel) setKbo(j?.games || []) }).catch(() => {})
    return () => { cancel = true }
  }, [])

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
          // after the game finishes. Fire-and-forget; the endpoint locks the first pre-game lean/day.
          if ((j?.ou?.lean === 'OVER' || j?.ou?.lean === 'UNDER') && (ev.external_event_id || ev.id)) {
            fetch('/api/snapshot-lean', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ sport: 'MLB', external_event_id: String(ev.external_event_id || ev.id), away_team: ev.away_team, home_team: ev.home_team, away_abbr: ev.away_abbr, home_abbr: ev.home_abbr, lean: j.ou.lean, total_line: j.ou.total?.current, confidence: j.ou.confidence, strong: !!j.ou.strong, reason: j.ou.reason, start_time: ev.start_time }) }).catch(() => {})
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
  const strongSignals = signals.filter(s => s.ou.strong)
  const ranked = signals.map((s, i) => ({ ...s, rank: i + 1 }))
  const strongRanked = strongSignals.map((s, i) => ({ ...s, rank: ranked.find(r => r.ev.id === s.ev.id)?.rank ?? i + 1 }))
  const loop = [...strongRanked, ...strongRanked]
  // Conviction color: 3+ factors = bright NEON (strong), exactly 2 = white (weakest that still qualifies).
  const leanColor = (ou) => (ou.confidence >= 3 ? NEON : TEXT)
  const Chip = ({ ev, ou, rank }) => (
    <button onClick={() => onOpen?.(ev)} style={{ background: 'none', border: 'none', cursor: onOpen ? 'pointer' : 'default', padding: 0, fontFamily: R, fontWeight: 700, fontSize: '13px', color: TEXT, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
      {ev.away_abbr}@{ev.home_abbr}{' '}
      <span style={{ color: leanColor(ou) }}>{ou.lean === 'OVER' ? '📈 OVER' : '📉 UNDER'}{ou.total?.current != null ? ` ${ou.total.current}` : ''}</span>
      <MoveArrow ou={ou} />
      <RankBadge rank={rank} />
    </button>
  )
  return (
    <div>
      <div style={{ border: `1px solid rgba(189,255,0,0.25)`, borderRadius: '10px', background: 'rgba(189,255,0,0.04)', padding: '9px 0 9px 12px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <style>{`@keyframes rml-spot{from{transform:translateX(0)}to{transform:translateX(-50%)}}.rml-spot-track{display:inline-flex;gap:26px;white-space:nowrap;animation:rml-spot 40s linear infinite;will-change:transform}.rml-spot-track:hover{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.rml-spot-track{animation:none}}`}</style>
        <button onClick={() => setOpen(o => !o)} title="Spotlight — tap for the ranked list" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, flexShrink: 0, textTransform: 'uppercase' }}>
          ⬡ Spotlight ({strongSignals.length})
          <span style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', background: 'rgba(255,174,43,0.12)', border: '1px solid rgba(255,174,43,0.35)', borderRadius: '3px', padding: '1px 4px' }}>BETA</span>
          <span style={{ display: 'inline-block', fontSize: '8px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {strongSignals.length > 0 ? (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="rml-spot-track">
              {loop.map(({ ev, ou, rank }, i) => <span key={ev.id + '-' + i}><Chip ev={ev} ou={ou} rank={rank} /></span>)}
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, flex: 1 }}>{signals.length ? 'tap for all leans ▾' : 'no strong leans yet today — model stays neutral until there’s an edge'}</span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: '6px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD, padding: '12px 14px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase', marginBottom: '2px' }}>⬡ Spotlight — Today, ranked strongest first</div>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginBottom: '6px' }}>#1 = strongest model lean · line = open → current (▲ market up, ▼ down)</div>
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
                    <MoveArrow ou={ou} />
                    {/* Quick-look in its own box = PUBLIC market info only (open→current line + value/late). Factors hidden — that's the edge. */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: '4px', padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)', fontFamily: R, fontSize: '9px' }}>
                      {(() => {
                        const ts = ev.start_time ? Date.parse(ev.start_time) : null
                        const live = ts != null && ts <= Date.now()
                        const timeLabel = ts == null ? null : (live ? 'LIVE' : new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
                        const line = ou.total?.current
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
                            <span style={{ color: MUTED }}>LINE</span><span style={{ color: TEXT, fontWeight: 700 }}>{line != null ? line : '—'}</span>
                            <span style={{ color: MUTED }}>EDGE</span><span style={{ color: strong ? NEON_T : TEXT, fontWeight: 700 }}>{edge != null ? `${edge > 0 ? '+' : ''}${edge}` : '—'}</span>
                            {result && <span style={{ color: result.c, fontWeight: 700 }}>{result.t}</span>}
                          </>
                        )
                      })()}
                    </span>
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: ou.confidence >= 3 ? NEON : MUTED }}>{ou.confidence}<span style={{ fontSize: '7px', letterSpacing: '0.1em' }}> FACTOR{ou.confidence === 1 ? '' : 'S'}</span></span>
                  {onAddToSlip && <button onClick={async e => { e.stopPropagation(); onAddToSlip(await enrichWithBooks(signalToLeg(ev, ou), ev, ou, token)) }} title="Add to slip" style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: NEON_T, background: 'rgba(189,255,0,0.1)', border: `1px solid ${NEON}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ SLIP</button>}
                </span>
              </div>
            ))}
          </div>
          {kbo.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
              <button onClick={() => setKboOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase' }}>⬡ KBO — Overnight (Korea) ({kbo.filter(g => g.lean !== 'LEAN').length})</span>
                <span style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', background: 'rgba(255,174,43,0.12)', border: '1px solid rgba(255,174,43,0.35)', borderRadius: '3px', padding: '1px 4px' }}>BETA</span>
                <span style={{ marginLeft: 'auto', fontSize: '8px', color: MUTED, transform: kboOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </button>
              {kboOpen && (<>
              <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, margin: '4px 0 6px' }}>free projection model · park + weather · no market line yet · calibrating</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {kbo.map((g) => (
                  <div key={g.id || g.matchup} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: g.lean !== 'LEAN' ? 'rgba(189,255,0,0.05)' : 'rgba(189,255,0,0.02)', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '7px 10px' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT }}>{g.matchup} </span>
                      <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: g.lean === 'OVER' ? NEON_T : g.lean === 'UNDER' ? '#FF3B3B' : MUTED }}>{g.lean === 'LEAN' ? 'LEAN' : g.lean} {g.projTotal}</span>
                      <div style={{ fontFamily: R, fontSize: '8.5px', color: MUTED, marginTop: '2px' }}>{g.venue || ''}{(g.factors || []).length ? ` · ${(g.factors || []).join(' · ')}` : ' · neutral'}</div>
                    </span>
                    <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: Math.abs(g.edge) >= 0.5 ? NEON_T : MUTED, flexShrink: 0 }} title="projected total vs KBO baseline">{g.edge > 0 ? '+' : ''}{g.edge}</span>
                  </div>
                ))}
              </div>
              </>)}
            </div>
          )}
          {(() => {
            // Record panel as a labeled grid: rows = time period, columns = Spotlight (strong) vs
            // All leans, each with its own win %. The column headers say which number is which, so
            // you read it by position instead of decoding a sentence.
            const s = record?.strong, a = record?.all
            const fmtRec = (r) => r && (r.w + r.l + r.p) > 0 ? `${r.w}-${r.l}${r.p ? `-${r.p}` : ''}` : '—'
            const pct = (r) => { const n = r ? r.w + r.l : 0; return n >= 3 ? `${Math.round((r.w / n) * 100)}%` : '' }
            const cell = (rec, color) => (
              <div style={{ textAlign: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: '7px' }}>
                <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color }}>{fmtRec(rec)}</span>
                {pct(rec) && <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: MUTED, marginLeft: '4px' }}>{pct(rec)}</span>}
              </div>
            )
            const periodLabel = (txt) => (
              <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: '7px' }}>{txt}</div>
            )
            const grid = { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '5px 10px', alignItems: 'center' }
            return (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
                <div style={grid}>
                  <div />
                  <div style={{ textAlign: 'center', fontFamily: R, fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.08em', color: NEON_T, lineHeight: 1.3 }}>SPOTLIGHT<br /><span style={{ color: MUTED }}>(strong)</span></div>
                  <div style={{ textAlign: 'center', fontFamily: R, fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.08em', color: MUTED, lineHeight: 1.3 }}>ALL<br /><span style={{ color: MUTED }}>leans</span></div>
                  {periodLabel('Today')}     {cell(s?.today, NEON_T)}     {cell(a?.today, TEXT)}
                  {periodLabel('Yesterday')} {cell(s?.yesterday, TEXT)}  {cell(a?.yesterday, TEXT)}
                  {periodLabel('All-time')}  {cell(s?.allTime, TEXT)}    {cell(a?.allTime, TEXT)}
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${BORDER}`, fontFamily: R, fontSize: '8.5px', color: MUTED, letterSpacing: '0.03em', lineHeight: 1.5 }}>
                  <span style={{ color: NEON_T }}>Spotlight</span> = high-confidence leans we feature · <span style={{ color: TEXT }}>All</span> = every model lean
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
