// Grade snapshotted O/U leans once their game is final. Pure server + DB (free): for each ungraded
// lean_results row, find its event's final score, compute the actual total, and mark W/L/P from the
// model's perspective (OVER wins if total > line; UNDER wins if total < line; equal = Push).
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export const config = { maxDuration: 30 }

const FINAL_STATUSES = new Set(['FT', 'AOT', 'FINAL', 'Final', 'final'])

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  // Ungraded leans from the last few days (avoid scanning ancient rows).
  const since = new Date(Date.now() - 4 * 86400e3).toISOString().slice(0, 10)
  const { data: pending } = await sb.from('lean_results')
    .select('id, external_event_id, lean, total_line, game_date')
    .is('result', null).gte('game_date', since).limit(500)
  if (!pending?.length) return res.status(200).json({ ok: true, graded: 0, note: 'nothing pending' })

  const ids = [...new Set(pending.map(p => p.external_event_id).filter(Boolean))]
  const { data: evs } = await sb.from('events')
    .select('external_event_id, status, home_score, away_score').in('external_event_id', ids)
  const byId = {}
  for (const e of evs || []) byId[String(e.external_event_id)] = e

  let graded = 0
  for (const p of pending) {
    const e = byId[String(p.external_event_id)]
    if (!e) continue
    const final = FINAL_STATUSES.has(String(e.status)) && e.home_score != null && e.away_score != null
    if (!final) continue
    const total = Number(e.home_score) + Number(e.away_score)
    const line = Number(p.total_line)
    let result
    if (total === line) result = 'P'
    else if (p.lean === 'OVER') result = total > line ? 'W' : 'L'
    else result = total < line ? 'W' : 'L'
    const { error } = await sb.from('lean_results')
      .update({ final_total: total, result, graded_at: new Date().toISOString() })
      .eq('id', p.id)
    if (!error) graded++
  }
  return res.status(200).json({ ok: true, graded, checked: pending.length })
}
