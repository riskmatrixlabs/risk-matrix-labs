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
          return (j?.ou?.lean === 'OVER' || j?.ou?.lean === 'UNDER') ? { ev, ou: j.ou } : null
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

  if (!signals.length) return null
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
          ⬡ Spotlight ({strongSignals.length}) <span style={{ display: 'inline-block', fontSize: '8px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {strongSignals.length > 0 ? (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="rml-spot-track">
              {loop.map(({ ev, ou, rank }, i) => <span key={ev.id + '-' + i}><Chip ev={ev} ou={ou} rank={rank} /></span>)}
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, flex: 1 }}>tap for all leans ▾</span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: '6px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: CARD, padding: '12px 14px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T, textTransform: 'uppercase', marginBottom: '2px' }}>⬡ Spotlight — Today, ranked strongest first</div>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginBottom: '6px' }}>#1 = strongest model lean · line = open → current (▲ market up, ▼ down)</div>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: '4px', padding: '2px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)', fontFamily: R, fontSize: '9px' }}>
                      {ou.total?.open != null && ou.total?.dir ? (
                        <><span style={{ color: MUTED }}>LINE</span><span style={{ color: TEXT, fontWeight: 700 }}>{ou.total.open} → {ou.total.current}</span>{ou.edge && <span style={{ fontWeight: 700, color: ou.edge.startsWith('value') ? NEON_T : '#FF3B3B' }}>{ou.edge.startsWith('value') ? 'VALUE' : 'LATE'}</span>}</>
                      ) : (
                        <><span style={{ color: MUTED }}>LINE</span><span style={{ color: TEXT, fontWeight: 700 }}>{ou.total?.current != null ? ou.total.current : '—'}</span><span style={{ color: MUTED }}>· no move yet</span></>
                      )}
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
          {(() => {
            const s = record?.strong, a = record?.all
            const fmtRec = (r) => r && (r.w + r.l + r.p) > 0 ? `${r.w}-${r.l}${r.p ? `-${r.p}` : ''}` : '—'
            const pct = (r) => { const n = r ? r.w + r.l : 0; return n >= 3 ? ` · ${Math.round((r.w / n) * 100)}%` : '' }
            return (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div><div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Yesterday</div><div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{fmtRec(s?.yesterday)}</div></div>
                <div><div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>All-time</div><div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>{fmtRec(s?.allTime)}{pct(s?.allTime)}</div></div>
                <div style={{ flex: 1, alignSelf: 'flex-start', fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.04em', textAlign: 'right', lineHeight: 1.5 }}>
                  Spotlight (strong) leans{a ? <><br/>All leans: <span style={{ color: TEXT }}>{fmtRec(a.allTime)}{pct(a.allTime)}</span></> : ''}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
