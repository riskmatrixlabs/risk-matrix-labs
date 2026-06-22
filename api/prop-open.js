// Prop open/cached-line lookup — FREE (reads prop_history only, zero Odds-API credits).
// When a player+stat has already been scanned for a game, the paid scan persisted best-price
// snapshots to prop_history. This endpoint surfaces the most-recent cached line/price (so the
// free prop builder can pre-fill) plus the earliest captured line/price (the "open").
//
// Params: sport, game (external_event_id), player (name), market (prop key), side (optional).
// Returns: { found, line, price, openLine, openPrice }. found:false when nothing is cached.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

export const config = { maxDuration: 10 }

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
}

const NOT_FOUND = { found: false, line: null, price: null, openLine: null, openPrice: null }

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return

  const game = String(req.query.game || req.query.event || '').trim()
  const player = String(req.query.player || '').trim()
  const market = String(req.query.market || '').trim()
  const wantSide = String(req.query.side || '').trim().toLowerCase() // optional: over|under
  if (!game || !player || !market) return res.status(200).json(NOT_FOUND)

  res.setHeader('Cache-Control', 'public, max-age=120')

  const supabase = client()
  if (!supabase) return res.status(200).json(NOT_FOUND)

  let rows = []
  try {
    const { data, error } = await supabase
      .from('prop_history')
      .select('point, side, price, captured_at')
      .eq('external_event_id', game)
      .eq('player', player)
      .eq('market', market)
      .order('captured_at', { ascending: true })
    if (error) return res.status(200).json(NOT_FOUND)
    rows = Array.isArray(data) ? data : []
  } catch { return res.status(200).json(NOT_FOUND) }

  if (!rows.length) return res.status(200).json(NOT_FOUND)

  // Prefer the requested side; if none cached for it, fall back to Over, then anything.
  const sideRows = (s) => rows.filter(r => String(r.side || '').toLowerCase() === s)
  let scoped = wantSide ? sideRows(wantSide) : []
  if (!scoped.length) scoped = sideRows('over')
  if (!scoped.length) scoped = rows

  const earliest = scoped[0]
  const latest = scoped[scoped.length - 1]
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }

  return res.status(200).json({
    found: true,
    line: num(latest.point),
    price: num(latest.price),
    openLine: num(earliest.point),
    openPrice: num(earliest.price),
  })
}
