// Per-call detail feed for the All-Time Performance page. The existing record APIs
// (lean-record.js / prop-record.js) are aggregate-only — this returns the RAW graded
// rows so the page can render a detailed call list (with team logos joined from events).
// Free: pure Supabase read of already-graded rows (0 Odds-API credits). Fail-soft.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// Build a { external_event_id -> event } map with logos pulled from events.metadata
// (mirrors src/lib/events.js mapRow). lean_results.external_event_id matches the
// events.external_event_id column (the provider's event id), not the events PK `id`.
function buildEventMap(events) {
  const map = {}
  for (const e of events || []) {
    const m = e.metadata ?? {}
    const ev = {
      away_logo: e.away_logo ?? m.away_logo ?? null,
      home_logo: e.home_logo ?? m.home_logo ?? null,
      away_abbr: e.away_abbr ?? null,
      home_abbr: e.home_abbr ?? null,
      away_team: e.away_team ?? null,
      home_team: e.home_team ?? null,
      sport: e.sport ?? null,
      status: e.status ?? null,
      start_time: e.start_time ?? m.start_time ?? null,
      away_score: e.away_score ?? null,
      home_score: e.home_score ?? null,
    }
    if (e.external_event_id != null) map[e.external_event_id] = ev
    if (e.id != null) map[e.id] ??= ev
  }
  return map
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  res.setHeader('Cache-Control', 'no-store')

  try {
    const sb = db()
    if (!sb) return res.status(200).json({ ok: false, leans: [], props: [] })

    const [{ data: leansRaw }, { data: propsRaw }] = await Promise.all([
      sb.from('lean_results')
        .select('external_event_id, game_date, sport, market, lean, pick_side, total_line, confidence, strong, result, final_total, closing_line, clv')
        .order('game_date', { ascending: false }).limit(2000),
      sb.from('prop_results')
        .select('external_event_id, game_date, sport, player, prop_market, prop_line, lean, phlt_tier, result')
        .order('game_date', { ascending: false }).limit(2000),
    ])

    const leans = leansRaw || []
    const props = propsRaw || []

    // Collect event ids from both sets and fetch the events once.
    const ids = [...new Set([...leans, ...props].map(r => r.external_event_id).filter(v => v != null))]
    let eventMap = {}
    if (ids.length) {
      const { data: events } = await sb.from('events')
        .select('id, external_event_id, sport, status, start_time, away_team, home_team, away_abbr, home_abbr, away_score, home_score, metadata')
        .in('external_event_id', ids)
      eventMap = buildEventMap(events)
    }

    const attach = (r) => ({ ...r, event: eventMap[r.external_event_id] ?? null })

    return res.status(200).json({
      ok: true,
      leans: leans.map(attach),
      props: props.map(attach),
    })
  } catch {
    return res.status(200).json({ ok: false, leans: [], props: [] })
  }
}
