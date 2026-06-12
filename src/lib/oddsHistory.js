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
