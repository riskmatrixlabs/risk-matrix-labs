import { supabase } from './supabase'

// Open → current → delta for one market/side's chronological snapshots.
export function computeMovement(snapshots) {
  if (!snapshots || !snapshots.length) return null
  const sorted = [...snapshots].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
  const open = sorted[0].value
  const current = sorted[sorted.length - 1].value
  return { open, current, delta: Math.round((current - open) * 100) / 100, points: sorted.length }
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
