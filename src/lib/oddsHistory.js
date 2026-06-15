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
  // Clean the data so spikes don't wreck the chart. Real books cluster TIGHT (a few cents of juice
  // apart), so we score every point by its implied probability and reject anything that strays far
  // from the cross-book CONSENSUS. This catches errors the old per-book-median band missed near the
  // +100/-100 flip (e.g. a stale -105 while everyone else is +135 — different favorite entirely).
  const toProb = (a) => (typeof a === 'number' && Number.isFinite(a) && Math.abs(a) >= 100 && Math.abs(a) <= 2000)
    ? (a > 0 ? 100 / (a + 100) : -a / (-a + 100)) : null
  const sane = data.filter(r => toProb(r.value) != null)
  if (!sane.length) return {}
  const probs = sane.map(r => toProb(r.value)).sort((a, b) => a - b)
  const consensus = probs[Math.floor(probs.length / 2)]   // median implied prob over the whole window
  const MAX_DEV = 0.06                                     // >6 percentage points off consensus = junk
                                                          // (a -105 'pick-em' when consensus is +135 ≈ 8pp → dropped)
  const rawByBook = {}
  for (const r of sane) {
    if (Math.abs(toProb(r.value) - consensus) > MAX_DEV) continue
    ;(rawByBook[r.book] ??= []).push({ t: r.captured_at, v: r.value })
  }
  const out = {}
  for (const [book, pts] of Object.entries(rawByBook)) {
    if (!pts.length) continue   // pts already in captured_at order from the query
    out[book] = { open: pts[0].v, current: pts[pts.length - 1].v, series: pts.map(p => p.v), times: pts.map(p => p.t) }
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
