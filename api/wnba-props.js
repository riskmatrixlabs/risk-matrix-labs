// WNBA prop verdicts — mirrors api/phlt.js: client sends the prop players it already has,
// we fetch (cached) ESPN gamelogs per player (MIN + the stat per game), the synced event row
// (odds_total / odds_spread_home) from Supabase, run the PURE scorer (src/lib/wnbaVerdict.js,
// built on the CONFIRMED wnbaProps engine) and return one verdict per requested name.
// HONEST-NULL: any player whose inputs can't be derived gets { score: null } — never a filler.
// Free sources only (ESPN + already-synced Supabase rows) — zero Odds-API credits.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'
import { buildIndex } from './player-search.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { wnbaVerdict, LEAGUE_REF_PER_MIN } from '../src/lib/wnbaVerdict.js'

export const config = { maxDuration: 30 }

const ESPN = { sport: 'basketball', league: 'wnba' }
const FORM_TTL_MS = 30 * 60 * 1000   // a player's recent form is stable within the slate (like PHLT)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'`’\-]/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

// Odds-API prop market → ESPN gamelog stat column. Only markets with a reference scale in the
// verdict lib are modeled; anything else → honest no-verdict.
const MARKET_STAT = { player_points: 'PTS', player_rebounds: 'REB', player_assists: 'AST' }

const db = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
  : null

async function getJson(url, ms = 7000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}

// Roster index (name → {id, team}) — same cached PLAYERS:<sport> index scan-props/phlt use.
async function rosterIndex(sport) {
  const dateYmd = todayStr().replace(/-/g, '')
  const cached = await readScan(`PLAYERS:${sport}`, dateYmd)
  let index = cached?.payload?.index
  if (!index?.length) {
    try { const built = await buildIndex(sport); index = built.index; await writeScan(`PLAYERS:${sport}`, dateYmd, built, null) }
    catch { index = [] }
  }
  const byFull = {}, byLast = {}
  for (const r of index || []) {
    const v = { id: r.id || null, team: r.team || null }
    const n = norm(r.player)
    byFull[n] = v; byLast[n.split(/\s+/).pop()] = v
  }
  return { byFull, byLast }
}

// The synced event row for this matchup — odds_total (pace proxy) + odds_spread_home (blowout
// risk). Same soonest-matching-row pattern as game-info.js totalAnchor. Missing → no verdicts.
async function eventOdds(away, home) {
  const sb = db(); if (!sb) return null
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
  try {
    const { data: evs } = await sb.from('events')
      .select('external_event_id, away_team, home_team, odds_total, odds_spread_home, start_time')
      .eq('sport', 'WNBA')
      .gte('start_time', new Date(Date.now() - 8 * 3600e3).toISOString())
      .lte('start_time', new Date(Date.now() + 30 * 3600e3).toISOString())
      .order('start_time', { ascending: true }).limit(60)
    const matches = (evs || []).filter(e => lw(e.home_team) === lw(home) && lw(e.away_team) === lw(away))
    const hasOdds = (e) => e.odds_total != null && Number(e.odds_total) > 0 && e.odds_spread_home != null
    const ev = matches.find(hasOdds) || null
    if (!ev) return null
    return { oddsTotal: Number(ev.odds_total), oppSpread: Number(ev.odds_spread_home) }
  } catch { return null }
}

// A player's minutes + stat form from the ESPN gamelog (newest-first by real game date —
// same date-sort lesson as api/phlt.js hitterForm). Cached per athlete per stat.
export async function playerForm(id, statLabel) {
  if (!id) return null
  const date = todayStr()
  const key = `WNBAGL:${id}:${statLabel}`
  const cached = await readScan(key, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), FORM_TTL_MS)) return cached.payload

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${ESPN.sport}/${ESPN.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels; if (!Array.isArray(labels) || !labels.length) return null
  const idx = (name) => labels.findIndex(l => String(l).toUpperCase() === name)
  const iMin = idx('MIN'), iStat = idx(statLabel)
  if (iMin < 0 || iStat < 0) return null

  const meta = gl.events || {}
  const evs = []
  for (const st of (gl.seasonTypes || []))
    for (const cat of (st.categories || []))
      for (const e of (cat.events || [])) if (Array.isArray(e.stats)) {
        const d = meta[e.eventId]?.gameDate || meta[e.id]?.gameDate || null
        evs.push({ ...e, _d: d ? Date.parse(d) : 0 })
      }
  if (!evs.length) return null
  evs.sort((a, b) => b._d - a._d)

  const MIN = (e) => toNum(e.stats[iMin]) || 0
  const STAT = (e) => toNum(e.stats[iStat]) || 0
  const played = evs.filter(e => MIN(e) > 0)              // DNPs carry no minutes signal
  if (!played.length) return null
  const last5 = played.slice(0, 5)
  const sum = (arr, f) => arr.reduce((s, e) => s + f(e), 0)
  const min5 = sum(last5, MIN), minAll = sum(played, MIN)
  const form = {
    last5Minutes: +(min5 / last5.length).toFixed(2),
    seasonMinutes: +(minAll / played.length).toFixed(2),
    recentMaxMinutes: Math.max(...played.slice(0, 10).map(MIN)),
    last5Rate: min5 > 0 ? +(sum(last5, STAT) / min5).toFixed(4) : null,
    seasonRate: minAll > 0 ? +(sum(played, STAT) / minAll).toFixed(4) : null,
    games: played.length,
  }
  await writeScan(key, date, form)
  return form
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  res.setHeader('Cache-Control', 'public, max-age=300')   // 5-min cache like phlt's slate stability

  const away = String(req.query.away || ''), home = String(req.query.home || '')
  const names = String(req.query.names || '').split('|').map(s => s.trim()).filter(Boolean)
  if (!away || !home || !names.length) return res.status(400).json({ error: 'need away, home, names' })
  // Per-name aligned pipe-lists: the client already holds each prop's market/line/evPct — the
  // real observed values lineValue/edge need. Missing entry → that player gets no verdict.
  const split = (k) => String(req.query[k] || '').split('|').map(s => s.trim())
  const markets = split('markets'), lines = split('lines'), evs = split('evs')

  const [roster, odds] = await Promise.all([rosterIndex('WNBA'), eventOdds(away, home)])

  const verdicts = {}
  await Promise.all(names.map(async (name, i) => {
    const nn = norm(name)
    const r = roster.byFull[nn] || roster.byLast[nn.split(/\s+/).pop()]
    const market = markets[i] || 'player_points'
    const statLabel = MARKET_STAT[market]
    const line = toNum(lines[i]), evPct = toNum(evs[i])
    if (!r?.id) { verdicts[name] = { score: null, tier: null, note: 'no roster match' }; return }
    if (!statLabel || !LEAGUE_REF_PER_MIN[market]) { verdicts[name] = { score: null, tier: null, note: 'market not modeled' }; return }
    if (!odds) { verdicts[name] = { score: null, tier: null, note: 'no synced odds for game' }; return }
    const form = await playerForm(r.id, statLabel)
    if (!form) { verdicts[name] = { score: null, tier: null, note: 'no gamelog' }; return }
    const v = wnbaVerdict({
      market,
      perMinRate: form.seasonRate, last5Minutes: form.last5Minutes, seasonMinutes: form.seasonMinutes,
      recentMaxMinutes: form.recentMaxMinutes, last5Rate: form.last5Rate, seasonRate: form.seasonRate,
      oddsTotal: odds.oddsTotal, oppSpread: odds.oppSpread, evPct, line,
    })
    verdicts[name] = v ? { ...v, team: r.team || null } : { score: null, tier: null, note: 'missing inputs' }
  }))

  return res.status(200).json({
    ok: true, sport: 'WNBA', verdicts,
    meta: { matched: Object.values(verdicts).filter(v => v.score != null).length, requested: names.length, hadOdds: !!odds },
  })
}
