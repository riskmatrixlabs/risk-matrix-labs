import { supabase } from './supabase'

// Open → current → delta (+ the full value series for sparklines) for one
// market/side's chronological snapshots.
export function computeMovement(snapshots) {
  if (!snapshots || !snapshots.length) return null
  const sorted = [...snapshots].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
  const series = sorted.map(s => s.value)
  const open = series[0]
  const current = series[series.length - 1]
  return { open, current, delta: Math.round((current - open) * 100) / 100, points: series.length, series }
}

// Fetch all snapshots for an event and reduce to per-market/side movement.
// Key format: `${market}_${side}` for two-sided markets, or `${market}` when side is null.
export async function fetchLineMovement(externalEventId) {
  const { data, error } = await supabase
    .from('odds_history')
    .select('*')
    .eq('external_event_id', String(externalEventId))
    .is('book', null)              // market-level consensus only — per-book rows feed the By-Sportsbook chart, not this
    .order('captured_at', { ascending: true })
  if (error || !data?.length) return {}
  const groups = {}
  for (const r of data) {
    const key = r.side ? `${r.market}_${r.side}` : r.market
    ;(groups[key] ??= []).push(r)
  }
  const out = {}
  for (const [key, snaps] of Object.entries(groups)) out[key] = computeMovement(snaps)
  return out
}

// Per-BOOK movement for one event's market/side — powers the "By Sportsbook" chart.
// Returns { [book]: { open, current, series } } for every book we've captured snapshots for.
export async function fetchBookMovement(externalEventId, market = 'ml', side = 'away') {
  let q = supabase
    .from('odds_history')
    .select('book, value, captured_at')
    .eq('external_event_id', String(externalEventId))
    .eq('market', market)
    .not('book', 'is', null)
  q = side == null ? q.is('side', null) : q.eq('side', side)
  const { data, error } = await q.order('captured_at', { ascending: true })
  if (error || !data?.length) return {}
  // Clean the data so spikes don't wreck the chart:
  // 1) sane American odds only, 2) reject points that deviate hard from the CONSENSUS (data errors /
  //    stale one-book blips). Real books cluster tight, so an outlier vs the median is junk.
  const toDec = (a) => (typeof a === 'number' && Number.isFinite(a) && Math.abs(a) >= 100 && Math.abs(a) <= 2000)
    ? (a > 0 ? 1 + a / 100 : 1 + 100 / -a) : null
  // Gather sane points per book, then drop any point that strays far from THAT book's own median
  // (a lone dip while the book otherwise sits at +115 is a data error, not real movement).
  const rawByBook = {}
  for (const r of data) { if (toDec(r.value) != null) (rawByBook[r.book] ??= []).push({ t: r.captured_at, v: r.value }) }
  const out = {}
  for (const [book, pts] of Object.entries(rawByBook)) {
    const decs = pts.map(p => toDec(p.v)).sort((a, b) => a - b)
    const med = decs[Math.floor(decs.length / 2)]
    const keep = pts.filter(p => { const d = toDec(p.v); return d >= med * 0.82 && d <= med * 1.25 })
    if (!keep.length) continue
    out[book] = { open: keep[0].v, current: keep[keep.length - 1].v, series: keep.map(p => p.v), times: keep.map(p => p.t) }
  }
  return out
}

// The closing line = the most recent snapshot for a market/side.
export async function closingLine(externalEventId, market, side) {
  let q = supabase
    .from('odds_history')
    .select('*')
    .eq('external_event_id', String(externalEventId))
    .eq('market', market)
  q = side == null ? q.is('side', null) : q.eq('side', side)
  const { data, error } = await q.order('captured_at', { ascending: false }).limit(1)
  if (error || !data?.length) return null
  return data[0].value
}
