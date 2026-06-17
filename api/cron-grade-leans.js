// Grade snapshotted O/U leans once their game is final. Pure server + DB (free): for each ungraded
// lean_results row, find its event's final score, compute the actual total, and mark W/L/P from the
// model's perspective (OVER wins if total > line; UNDER wins if total < line; equal = Push).
//
// SELF-HEALING: our `events` table can freeze a late/overnight game at status 'IP' with a STALE
// mid-game score (cron-sync-events only covers the current game window, so yesterday's late finals
// never get synced). Trusting that score grades games wrong (a 5-5 freeze that really finished 5-6).
// So when our row isn't FINAL we fetch the TRUE final straight from ESPN and backfill `events` too.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export const config = { maxDuration: 60 }

const FINAL_STATUSES = new Set(['FT', 'AOT', 'FINAL', 'Final', 'final'])
// sport key → ESPN [sport, league] path segment (matches cron-sync-events).
const ESPN_PATH = { MLB: ['baseball', 'mlb'], NBA: ['basketball', 'nba'], NHL: ['hockey', 'nhl'], WNBA: ['basketball', 'wnba'] }
const MAX_ESPN = 80 // cap external calls per run as a safety net

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

// Fetch the true final from ESPN. Returns { home, away } only when the game is actually completed.
async function espnFinal(sport, id) {
  const [s, lg] = ESPN_PATH[String(sport || 'MLB').toUpperCase()] || ESPN_PATH.MLB
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${s}/${lg}/summary?event=${id}`, { signal: AbortSignal.timeout(7000) })
    if (!r.ok) return null
    const d = await r.json()
    const c = d?.header?.competitions?.[0]
    const t = c?.status?.type
    if (!t || !(t.completed || String(t.name || '').startsWith('STATUS_FINAL'))) return null
    const comps = c?.competitors || []
    const home = Number(comps.find(x => x.homeAway === 'home')?.score)
    const away = Number(comps.find(x => x.homeAway === 'away')?.score)
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null
    return { home, away }
  } catch { return null }
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const sb = db(); if (!sb) return res.status(200).json({ ok: false, note: 'no db' })

  // Ungraded leans from the last few days (avoid scanning ancient rows).
  const since = new Date(Date.now() - 4 * 86400e3).toISOString().slice(0, 10)
  const { data: pending } = await sb.from('lean_results')
    .select('id, external_event_id, sport, lean, total_line, game_date')
    .is('result', null).gte('game_date', since).limit(500)
  if (!pending?.length) return res.status(200).json({ ok: true, graded: 0, note: 'nothing pending' })

  const ids = [...new Set(pending.map(p => p.external_event_id).filter(Boolean))]
  const { data: evs } = await sb.from('events')
    .select('external_event_id, status, home_score, away_score, start_time').in('external_event_id', ids)
  const byId = {}
  for (const e of evs || []) byId[String(e.external_event_id)] = e

  // Closing total = the last total-line snapshot at/before first pitch. CLV = how far the market
  // moved toward our lean after we locked it (the sharpest signal: was the model right, win or lose).
  const halfBelow = (n) => (n == null ? null : (Number.isInteger(n) ? n - 0.5 : n))
  async function closingTotal(eid, startIso) {
    let q = sb.from('odds_history').select('value, captured_at')
      .eq('external_event_id', String(eid)).eq('market', 'total')
      .not('value', 'is', null).gt('value', 0).order('captured_at', { ascending: false }).limit(1)
    if (startIso) q = q.lte('captured_at', startIso)
    const { data } = await q
    return data?.length ? halfBelow(Number(data[0].value)) : null
  }

  let graded = 0, healed = 0, espnCalls = 0
  for (const p of pending) {
    const e = byId[String(p.external_event_id)]
    const localFinal = e && FINAL_STATUSES.has(String(e.status)) && e.home_score != null && e.away_score != null

    let home, away
    if (localFinal) {
      home = Number(e.home_score); away = Number(e.away_score)
    } else if (espnCalls < MAX_ESPN) {
      // Our table isn't final (missing or frozen at IP) — get the truth from ESPN.
      espnCalls++
      const fin = await espnFinal(p.sport, p.external_event_id)
      if (!fin) continue // genuinely not final yet
      home = fin.home; away = fin.away
      // Backfill events so the rest of the app shows the correct final too.
      await sb.from('events').update({ status: 'FT', home_score: home, away_score: away })
        .eq('external_event_id', String(p.external_event_id))
      healed++
    } else {
      continue
    }

    const total = home + away
    const line = Number(p.total_line)
    let result
    if (total === line) result = 'P'
    else if (p.lean === 'OVER') result = total > line ? 'W' : 'L'
    else result = total < line ? 'W' : 'L'
    // CLV: did the closing line move toward our lean? (Over → line up = +CLV; Under → line down = +CLV.)
    const close = await closingTotal(p.external_event_id, e?.start_time || null)
    let clv = null
    if (close != null && Number.isFinite(line)) {
      clv = Math.round((p.lean === 'OVER' ? close - line : line - close) * 10) / 10
    }
    const { error } = await sb.from('lean_results')
      .update({ final_total: total, result, closing_line: close, clv, graded_at: new Date().toISOString() })
      .eq('id', p.id)
    if (!error) graded++
  }
  return res.status(200).json({ ok: true, graded, healed, checked: pending.length })
}
