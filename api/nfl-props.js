// NFL prop verdicts — mirrors api/nba-props.js / api/wnba-props.js (which mirror api/phlt.js):
// the client sends the prop players it already has, we fetch (cached) ESPN gamelogs per player
// (the market's stat + its opportunity column per game), the synced event row (odds_total /
// odds_spread_home + team abbrs) from Supabase, run the PURE scorer (src/lib/nflPropVerdict.js)
// and return one verdict per requested name.
//
// ⚠️ The NFL prop model is SESSION-AUTHORED — MODELS.md has no owner NFL prop formula. See the
// header of src/lib/nflPropVerdict.js for every weight and derivation.
//
// HONEST-NULL: any player whose inputs can't be derived gets { score: null } — never a filler.
// Free sources only (ESPN + already-synced Supabase rows) — zero Odds-API credits.
//
// NFL gamelog shape differs from basketball/hockey: there is no MIN column, and `labels` REPEATS
// ('YDS','TD','LNG' appear for both passing and rushing). We therefore index by the gamelog's
// `names` array (unique semantic keys: passingYards, rushingAttempts, receivingTargets…), never
// by label.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'
import { buildIndex } from './player-search.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { nflPropVerdict, REF_VOLUME_PER_GAME } from '../src/lib/nflPropVerdict.js'

export const config = { maxDuration: 30 }

const ESPN = { sport: 'football', league: 'nfl' }
const FORM_TTL_MS = 30 * 60 * 1000   // a player's recent form is stable within the slate (like PHLT)
const MIN_GAMES = 3                  // last-3 form needs three real played games — else no verdict
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'`’\-]/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

// Odds-API prop market → { stat, volume } ESPN gamelog `names` columns. `volume` is the
// OPPORTUNITY column the model's volume/role input is derived from. Markets absent here are
// not modeled → honest no-verdict (anytime/1st TD are yes-no markets with no O/U line).
export const MARKET_COLS = {
  player_pass_yds:      { stat: 'passingYards',       volume: 'passingAttempts' },
  player_pass_tds:      { stat: 'passingTouchdowns',  volume: 'passingAttempts' },
  player_rush_yds:      { stat: 'rushingYards',       volume: 'rushingAttempts' },
  player_reception_yds: { stat: 'receivingYards',     volume: 'receivingTargets' },
  player_receptions:    { stat: 'receptions',         volume: 'receivingTargets' },
}

const db = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
  : null

async function getJson(url, ms = 7000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}

// Roster index (name → {id, team}) — same cached PLAYERS:<sport> index the siblings use.
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

// The synced event row for this matchup — odds_total + odds_spread_home (the HOME spread) and
// both team abbrs, so a player's own team spread can be signed correctly. Same soonest-matching
// -row pattern as api/nba-props.js eventContext. Missing odds → no verdicts.
export async function eventContext(away, home, iso) {
  const sb = db(); if (!sb) return null
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
  try {
    const anchor = iso && !isNaN(Date.parse(iso)) ? Date.parse(iso) : Date.now()
    const { data: evs } = await sb.from('events')
      .select('external_event_id, away_team, home_team, away_abbr, home_abbr, odds_total, odds_spread_home, start_time')
      .eq('sport', 'NFL')
      .gte('start_time', new Date(anchor - 8 * 3600e3).toISOString())
      .lte('start_time', new Date(anchor + 30 * 3600e3).toISOString())
      .order('start_time', { ascending: true }).limit(60)
    const matches = (evs || []).filter(e => lw(e.home_team) === lw(home) && lw(e.away_team) === lw(away))
    const hasOdds = (e) => e.odds_total != null && Number(e.odds_total) > 0 && e.odds_spread_home != null
    const ev = matches.find(hasOdds) || null
    if (!ev) return null
    return {
      oddsTotal: Number(ev.odds_total),
      homeSpread: Number(ev.odds_spread_home),
      homeAbbr: ev.home_abbr || null, awayAbbr: ev.away_abbr || null,
    }
  } catch { return null }
}

// Sign the spread for the player's OWN team. Unknown side → null (no verdict, never a guess).
export function teamSpreadFor(teamAbbr, ctx) {
  if (!ctx || !teamAbbr) return null
  const t = String(teamAbbr).toUpperCase()
  if (ctx.homeAbbr && t === String(ctx.homeAbbr).toUpperCase()) return ctx.homeSpread
  if (ctx.awayAbbr && t === String(ctx.awayAbbr).toUpperCase()) return -ctx.homeSpread
  return null
}

// Pure gamelog → per-game form. Exported for tests: takes the raw ESPN gamelog JSON.
// Games are ordered newest-first by REAL game date (the same date-sort lesson as api/phlt.js).
// A game counts when the player APPEARED — i.e. his row records any non-zero value at all.
// Deliberately NOT "had opportunity in this market > 0": excluding a real 0-carry game from a
// rushing rate would bias every rate upward. An all-zero row is a DNP and carries no signal.
export function formFromGamelog(gl, statName, volumeName) {
  const names = gl?.names
  if (!Array.isArray(names) || !names.length) return null
  const iStat = names.indexOf(statName), iVol = names.indexOf(volumeName)
  if (iStat < 0 || iVol < 0) return null

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

  const VOL = (e) => toNum(e.stats[iVol]) || 0
  const STAT = (e) => toNum(e.stats[iStat]) || 0
  const played = evs.filter(e => e.stats.some(s => (toNum(s) || 0) !== 0))
  if (played.length < MIN_GAMES) return null                 // too little history — honest null
  const last3 = played.slice(0, 3)
  const avg = (arr, f) => arr.reduce((s, e) => s + f(e), 0) / arr.length
  return {
    volumePerGame: +avg(played, VOL).toFixed(3),
    last3Rate: +avg(last3, STAT).toFixed(3),
    seasonRate: +avg(played, STAT).toFixed(3),
    games: played.length,
  }
}

// Cached per athlete per market-column pair.
export async function playerForm(id, statName, volumeName) {
  if (!id) return null
  const date = todayStr()
  const key = `NFLGL:${id}:${statName}`
  const cached = await readScan(key, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), FORM_TTL_MS)) return cached.payload

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${ESPN.sport}/${ESPN.league}/athletes/${id}/gamelog`)
  const form = formFromGamelog(gl, statName, volumeName)
  if (!form) return null
  await writeScan(key, date, form)
  return form
}

// Reusable per-game NFL verdict compute (like the siblings' *VerdictsForGame) — the snapshot
// cron imports this without HTTP. `names`/`markets`/`lines`/`evs` are per-index aligned arrays.
export async function nflVerdictsForGame({ away, home, iso, names = [], markets = [], lines = [], evs = [] } = {}) {
  const [roster, ctx] = await Promise.all([rosterIndex('NFL'), eventContext(away, home, iso)])

  const verdicts = {}
  await Promise.all(names.map(async (name, i) => {
    const nn = norm(name)
    const r = roster.byFull[nn] || roster.byLast[nn.split(/\s+/).pop()]
    const market = markets[i] || 'player_pass_yds'
    const cols = MARKET_COLS[market]
    const line = toNum(lines[i]), evPct = toNum(evs[i])
    if (!r?.id) { verdicts[name] = { score: null, tier: null, note: 'no roster match' }; return }
    if (!cols || !REF_VOLUME_PER_GAME[market]) { verdicts[name] = { score: null, tier: null, note: 'market not modeled' }; return }
    if (!ctx) { verdicts[name] = { score: null, tier: null, note: 'no synced odds for game' }; return }
    const teamSpread = teamSpreadFor(r.team, ctx)
    if (teamSpread == null) { verdicts[name] = { score: null, tier: null, note: 'team side unresolved' }; return }
    const form = await playerForm(r.id, cols.stat, cols.volume)
    if (!form) { verdicts[name] = { score: null, tier: null, note: 'no gamelog' }; return }
    const v = nflPropVerdict({
      market,
      volumePerGame: form.volumePerGame, last3Rate: form.last3Rate, seasonRate: form.seasonRate,
      oddsTotal: ctx.oddsTotal, teamSpread, evPct, line,
    })
    verdicts[name] = v ? { ...v, team: r.team || null } : { score: null, tier: null, note: 'missing inputs' }
  }))

  return { verdicts, hadOdds: !!ctx }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  res.setHeader('Cache-Control', 'public, max-age=300')   // 5-min cache like phlt's slate stability

  const away = String(req.query.away || ''), home = String(req.query.home || '')
  const names = String(req.query.names || '').split('|').map(s => s.trim()).filter(Boolean)
  if (!away || !home || !names.length) return res.status(400).json({ error: 'need away, home, names' })
  const split = (k) => String(req.query[k] || '').split('|').map(s => s.trim())

  const { verdicts, hadOdds } = await nflVerdictsForGame({
    away, home, iso: req.query.iso, names,
    markets: split('markets'), lines: split('lines'), evs: split('evs'),
  })

  return res.status(200).json({
    ok: true, sport: 'NFL', verdicts,
    meta: { matched: Object.values(verdicts).filter(v => v.score != null).length, requested: names.length, hadOdds },
  })
}
