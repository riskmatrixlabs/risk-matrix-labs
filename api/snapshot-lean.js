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

// Build the lean_results rows to upsert from a snapshot body — 0..3 independent rows keyed by market
// ('total' | 'ml' | 'rl'). Pure: no DB, no clock (caller does the pre-game guard). The unique key is
// (external_event_id, game_date, market), so total + ml + rl can each lock one row per game/day.
export function buildLeanRows(body) {
  const b = body || {}
  if (!b.external_event_id) return []

  const common = {
    sport: String(b.sport || 'MLB').toUpperCase(),
    game_date: etDate(b.start_time),
    external_event_id: String(b.external_event_id),
    away_team: b.away_team || null, home_team: b.home_team || null,
    away_abbr: b.away_abbr || null, home_abbr: b.home_abbr || null,
    edge_runs: b.edge_runs != null ? Number(b.edge_runs) : null,
    model_version: b.model_version || null,
  }
  const rows = []

  // TOTAL — preserve today's behavior exactly: directional lean + a real market line.
  const lean = String(b.lean || '').toUpperCase()
  if ((lean === 'OVER' || lean === 'UNDER') && b.total_line != null) {
    rows.push({
      ...common,
      market: 'total',
      lean,
      total_line: Number(b.total_line),
      confidence: b.confidence != null ? Number(b.confidence) : null,
      strong: !!b.strong,
      reason: b.reason || null,
    })
  }

  // ML — a confident moneyline pick (>= 0.55). lean is NOT NULL → mirror pick_side.
  const mlPick = String(b.ml_pick || '').toUpperCase()
  if ((mlPick === 'HOME' || mlPick === 'AWAY') && Number(b.ml_win_prob) >= 0.55) {
    rows.push({
      ...common,
      market: 'ml',
      lean: mlPick,
      pick_side: mlPick,
      win_prob: Number(b.ml_win_prob),
      total_line: null,
    })
  }

  // RL — a run-line pick (e.g. 'HOME -1.5') with >= 0.50 cover prob.
  const rlPick = b.rl_pick ? String(b.rl_pick) : ''
  if (rlPick && Number(b.rl_cover_prob) >= 0.50) {
    rows.push({
      ...common,
      market: 'rl',
      lean: rlPick,
      pick_side: rlPick,
      cover_prob: Number(b.rl_cover_prob),
      total_line: null,
    })
  }

  return rows
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const user = await requireAuth(req, res); if (!user) return
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  const b = req.body || {}
  // Pre-game only — lock leans before first pitch (don't snapshot a live/finished game).
  if (b.start_time && Date.parse(b.start_time) <= Date.now()) return res.status(200).json({ ok: true, skipped: 'not pre-game' })

  const rows = buildLeanRows(b)
  if (!rows.length) return res.status(200).json({ ok: true, skipped: 'nothing to snapshot' })

  // Insert-if-absent per market: lock the first pre-game lean of the day per game/market (never overwrite).
  for (const row of rows) {
    const { error } = await sb.from('lean_results').upsert(row, { onConflict: 'external_event_id,game_date,market', ignoreDuplicates: true })
    if (error) return res.status(200).json({ ok: false, error: error.message })
  }
  return res.status(200).json({ ok: true, inserted: rows.map(r => r.market) })
}
