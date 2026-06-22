// Snapshot a model O/U lean so it can be graded after the game finishes. Called by the client
// (SpotlightTicker loops every game's lean) — we lock the FIRST pre-game lean seen each day per
// game (insert-if-absent), so the recorded number can't drift as the model re-scores on live data.
// Free: pure DB write, no Odds-API credits. Grading happens server-side in cron-grade-leans.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// ET day (UTC-4) — matches the rest of the app's day windowing.
function etDate(iso) {
  const t = iso ? Date.parse(iso) : Date.now()
  return new Date(t - 4 * 3600e3).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const user = await requireAuth(req, res); if (!user) return
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  const b = req.body || {}
  const lean = String(b.lean || '').toUpperCase()
  // Only snapshot a real directional lean; skip neutral "LEAN" and require an event id + line.
  if (lean !== 'OVER' && lean !== 'UNDER') return res.status(200).json({ ok: true, skipped: 'not directional' })
  if (!b.external_event_id || b.total_line == null) return res.status(200).json({ ok: true, skipped: 'missing id/line' })
  // Pre-game only — lock the lean before first pitch (don't snapshot a live/finished game).
  if (b.start_time && Date.parse(b.start_time) <= Date.now()) return res.status(200).json({ ok: true, skipped: 'not pre-game' })

  const row = {
    sport: String(b.sport || 'MLB').toUpperCase(),
    game_date: etDate(b.start_time),
    external_event_id: String(b.external_event_id),
    away_team: b.away_team || null, home_team: b.home_team || null,
    away_abbr: b.away_abbr || null, home_abbr: b.home_abbr || null,
    lean,
    total_line: Number(b.total_line),
    confidence: b.confidence != null ? Number(b.confidence) : null,
    strong: !!b.strong,
    reason: b.reason || null,
    // Calibration (S65): persist the CONTINUOUS edge + model version so we can fit win% vs edge later
    // (the 1–4 confidence bucket alone is too coarse — the analysis couldn't calibrate on it).
    edge_runs: b.edge_runs != null ? Number(b.edge_runs) : null,
    model_version: b.model_version || null,
  }
  // Insert-if-absent: lock the first pre-game lean of the day per game (never overwrite).
  const { error } = await sb.from('lean_results').upsert(row, { onConflict: 'external_event_id,game_date', ignoreDuplicates: true })
  if (error) return res.status(200).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true })
}
