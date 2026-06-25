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
const RANGES = [['all', 'All-time'], ['7d', '7d'], ['30d', '30d']]

// ET YYYY-MM-DD for an offset in days (matches lib/events.js etDate)
function etDate(offsetDays = 0) {
  const now = new Date()
  const etMs = now.getTime() + (-4 * 60) * 60 * 1000 + offsetDays * 86400000
  return new Date(etMs).toISOString().slice(0, 10)
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
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 13px', minWidth: 0 }}>
      <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: '21px', fontWeight: 700, color: danger ? DANGER : NEON_T, lineHeight: 1 }}>{value}</div>
      {sub != null && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

// One call → result chip
function ResultChip({ result }) {
  const map = {
    W: { t: '✓ HIT', c: NEON_T, bg: 'rgba(189,255,0,0.10)', bd: 'rgba(189,255,0,0.35)' },
    L: { t: '✗ MISS', c: DANGER, bg: 'rgba(255,59,59,0.10)', bd: 'rgba(255,59,59,0.35)' },
    P: { t: 'PUSH', c: MUTED, bg: 'rgba(255,255,255,0.05)', bd: BORDER },
  }
  const s = map[result] || { t: '● LIVE', c: '#FFAE2B', bg: 'rgba(255,174,43,0.10)', bd: 'rgba(255,174,43,0.35)' }
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

// Build the per-row display from a unified call (lean or prop)
function CallRow({ call }) {
  const ev = call.event || {}
  const leagueFallback = LEAGUE_LOGO[String(call.sport || ev.sport || 'MLB').toUpperCase()] || null
  const matchup = ev.away_abbr && ev.home_abbr ? `${ev.away_abbr}@${ev.home_abbr}` : (call.player ? '' : '—')

  let crest, label, line
  if (call.kind === 'prop') {
    crest = { logo: ev.away_logo || leagueFallback, logo2: ev.home_logo || null }
    label = <><span style={{ color: TEXT }}>{call.player}</span> <span style={{ color: NEON_T }}>{(call.lean === 'UNDER' ? 'u' : 'o')}{call.prop_line} {call.prop_market}</span></>
    line = call.phlt_tier ? `Tier ${call.phlt_tier}` : null
  } else if (call.market === 'total') {
    crest = { logo: ev.away_logo || leagueFallback, logo2: ev.home_logo || null }
    const c = call.lean === 'OVER' ? NEON_T : '#5BC8FF'
    label = <span style={{ color: c }}>{call.lean} {call.total_line}</span>
    line = call.final_total != null ? `${call.total_line} → ${call.final_total}` : null
  } else {
    // ml / rl — single crest of the picked side
    const side = call.pick_side === 'HOME' ? ev.home_logo : ev.away_logo
    crest = { logo: side || leagueFallback, logo2: null }
    const abbr = call.pick_side === 'HOME' ? ev.home_abbr : ev.away_abbr
    const tag = call.market === 'rl' ? '-1.5' : 'ML'
    label = <span style={{ color: NEON_T }}>{abbr || call.pick_side} {tag}</span>
    line = ev.away_score != null && ev.home_score != null ? `${ev.away_score}-${ev.home_score}` : null
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', borderRadius: '8px',
      background: call.strong ? 'rgba(189,255,0,0.06)' : 'rgba(255,255,255,0.015)',
      border: `1px solid ${call.strong ? 'rgba(189,255,0,0.25)' : BORDER}` }}>
      <Avatar logo={crest.logo} logo2={crest.logo2} size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {matchup && <span style={{ color: TEXT, marginRight: '6px' }}>{matchup}</span>}
          {label}
          {call.strong && <span style={{ fontSize: '8px', color: NEON_T, marginLeft: '6px', letterSpacing: '0.1em' }}>★</span>}
        </div>
        <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, marginTop: '2px' }}>
          {line && <span>{line}</span>}
          {call.clv != null && <span style={{ marginLeft: line ? '8px' : 0, color: call.clv > 0 ? NEON_T : MUTED }}>CLV {call.clv > 0 ? '+' : ''}{call.clv}</span>}
        </div>
      </div>
      <ResultChip result={call.result} />
    </div>
  )
}

export default function PerformancePage({ token }) {
  const [data, setData] = useState(null)   // { leans, props }
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState('all')
  const [strong, setStrong] = useState(false)
  const [range, setRange] = useState('all')

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

  // Unify leans + props into one stream, tag kind, then filter
  const calls = useMemo(() => {
    if (!data) return []
    const leans = (data.leans || []).map(r => ({ ...r, kind: 'lean' }))
    const props = (data.props || []).map(r => ({ ...r, kind: 'prop' }))
    const from = range === '7d' ? etDate(-7) : range === '30d' ? etDate(-30) : null
    const rows = applyFilters([...leans, ...props], { model, strong, from })
    return rows.sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)))
  }, [data, model, strong, range])

  const graded = calls.filter(c => c.result === 'W' || c.result === 'L' || c.result === 'P')
  const rec = { w: graded.filter(c => c.result === 'W').length, l: graded.filter(c => c.result === 'L').length, p: graded.filter(c => c.result === 'P').length }
  const wp = winPct(rec.w, rec.l)
  const clv = avgClv(graded)
  const { units, roi } = unitsRoi(graded)

  // Group graded+pending rows by date for the feed
  const byDate = useMemo(() => {
    const m = new Map()
    for (const c of calls) { const d = c.game_date || '—'; if (!m.has(d)) m.set(d, []); m.get(d).push(c) }
    return [...m.entries()]
  }, [calls])

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto', padding: '14px 12px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: NEON_T }}>⬡ Full Record</div>
        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginTop: '2px' }}>Every model call, graded in public — self-graded from final results.</div>
      </div>

      {/* BETA disclaimer (mirrors Spotlight) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '12px', padding: '7px 9px', borderRadius: '7px', background: 'rgba(255,174,43,0.08)', border: '1px solid rgba(255,174,43,0.3)' }}>
        <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: '#FFAE2B', flexShrink: 0, marginTop: '1px' }}>BETA</span>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, lineHeight: 1.5 }}>Experimental models in testing — calls are informational signals we're still calibrating, not guarantees or advice. The record is shown for transparency.</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
        {MODELS.map(([v, l]) => <Chip key={v} active={model === v} onClick={() => setModel(v)}>{l}</Chip>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px', alignItems: 'center' }}>
        {RANGES.map(([v, l]) => <Chip key={v} active={range === v} onClick={() => setRange(v)}>{l}</Chip>)}
        <span style={{ width: '1px', height: '18px', background: BORDER, margin: '0 3px' }} />
        <Chip active={strong} onClick={() => setStrong(s => !s)}>★ Strong only</Chip>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '8px', marginBottom: '16px' }}>
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
              {rows.map((c, i) => <CallRow key={(c.external_event_id || '') + (c.market || c.player || '') + i} call={c} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
