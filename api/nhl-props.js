// NHL shots-on-goal verdicts — mirrors api/wnba-props.js: client sends the prop players it
// already has, we fetch (cached) ESPN skater gamelogs per player (TOI + SOG per game), the
// synced event row (opponent team stats) from Supabase, run the PURE scorer
// (src/lib/nhlVerdict.js, built on the CONFIRMED nhlSog engine) and return one verdict per
// requested name. Only player_shots_on_goal is modeled — other markets → honest no-verdict.
// HONEST-NULL: any player whose inputs can't be derived gets { score: null } — never a filler.
// opponentSogAllowed: first choice is the field-probe on the event row (sogAllowedFrom); the
// current sync writes no allowed-style field, so the REAL fallback derives it from our own
// events table — average of the OPPOSING side's box sog across the opponent's last ~10
// completed games (derivedSogAllowed → concededSogAvg, pure + tested). <3 usable games →
// null → honest no-verdict. Never fabricated.
// Free sources only (ESPN + already-synced Supabase rows) — zero Odds-API credits.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'
import { buildIndex } from './player-search.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { nhlVerdict, NHL_SOG_MARKET, parseToi } from '../src/lib/nhlVerdict.js'
import { concededSogAvg } from './_lib/sogAllowed.js'

export const config = { maxDuration: 30 }

const ESPN = { sport: 'hockey', league: 'nhl' }
const FORM_TTL_MS = 30 * 60 * 1000   // a skater's recent form is stable within the slate (like PHLT)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'`’\-]/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

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

// Probe one team-stats object for a season shots-ALLOWED style field. The current NHL sync
// (parseTeamStats) writes only box stats (sog = shots FOR — NOT usable as "allowed": using a
// team's own shot volume as its shots conceded would be a fabricated input). Returns null
// today; automatically starts working if the sync ever adds an allowed field.
function sogAllowedFrom(stats) {
  if (!stats || typeof stats !== 'object') return null
  for (const k of ['sogAllowed', 'shotsAgainst', 'shotsAgainstPerGame', 'sogAllowedPerGame']) {
    const n = toNum(stats[k])
    if (n != null && n > 0) return n
  }
  return null
}

// REAL shots-allowed derivation from our OWN events table (no external fetch, no fabrication):
// a team's shots ALLOWED in one completed game = the OPPOSING side's box sog, which the sync
// already writes into metadata.{away,home}_team_stats.sog on every final. Average that over the
// team's last ~10 completed games with sog present (concededSogAvg, pure + tested) → the shots
// that team concedes per game; nhlVerdict normalizes it vs the ~30 league ref. Fail-soft: <3
// usable games → null (honest no-verdict). Used only when the field-probe finds nothing.
async function derivedSogAllowed(sb, team) {
  if (!sb || !team) return null
  try {
    const { data } = await sb.from('events')
      .select('away_team, home_team, status, metadata')
      .eq('sport', 'NHL')
      .or(`home_team.eq.${JSON.stringify(String(team))},away_team.eq.${JSON.stringify(String(team))}`)
      .in('status', ['FT', 'AOT', 'FINAL', 'Final', 'final'])
      .order('start_time', { ascending: false })
      .limit(15)
    return concededSogAvg(data || [], team)
  } catch { return null }
}

// The synced event row for this matchup — per-side opponent SOG allowed (away players face
// the HOME team's defense and vice versa). Same soonest-matching-row pattern as wnba-props.
// First choice: probe the event row itself for an allowed-style field (sogAllowedFrom); when
// absent (the current sync writes none), fall back to the derivedSogAllowed average above.
async function eventTeamStats(away, home) {
  const sb = db(); if (!sb) return null
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
  try {
    const { data: evs } = await sb.from('events')
      .select('external_event_id, away_team, home_team, start_time, metadata')
      .eq('sport', 'NHL')
      .gte('start_time', new Date(Date.now() - 8 * 3600e3).toISOString())
      .lte('start_time', new Date(Date.now() + 30 * 3600e3).toISOString())
      .order('start_time', { ascending: true }).limit(60)
    const ev = (evs || []).find(e => lw(e.home_team) === lw(home) && lw(e.away_team) === lw(away)) || null
    if (!ev) return null
    const m = ev.metadata || {}
    // Opponent allowance per side: an away skater's opponent is the home team. Field-probe
    // first; derive from our own completed-game rows when the probe finds nothing.
    let awayOpp = sogAllowedFrom(m.home_team_stats)
    let homeOpp = sogAllowedFrom(m.away_team_stats)
    if (awayOpp == null) awayOpp = await derivedSogAllowed(sb, ev.home_team)
    if (homeOpp == null) homeOpp = await derivedSogAllowed(sb, ev.away_team)
    return {
      awayOppSogAllowed: awayOpp,
      homeOppSogAllowed: homeOpp,
      awayTeam: ev.away_team, homeTeam: ev.home_team,
    }
  } catch { return null }
}

// A skater's TOI + SOG form from the ESPN gamelog (newest-first by real game date — same
// date-sort lesson as api/phlt.js hitterForm). TOI arrives as 'MM:SS' → parseToi (defensive).
// SOG column label probed defensively ('SOG' expected; 'S'/'SHOTS' fallbacks).
export async function skaterForm(id) {
  if (!id) return null
  const date = todayStr()
  const key = `NHLGL:${id}:SOG`
  const cached = await readScan(key, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), FORM_TTL_MS)) return cached.payload

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${ESPN.sport}/${ESPN.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels; if (!Array.isArray(labels) || !labels.length) return null
  const idx = (names) => labels.findIndex(l => names.includes(String(l).toUpperCase()))
  const iToi = idx(['TOI', 'TOI/G', 'MIN'])
  const iSog = idx(['SOG', 'S', 'SHOTS'])
  if (iToi < 0 || iSog < 0) return null

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

  const TOI = (e) => parseToi(e.stats[iToi]) || 0
  const SOG = (e) => toNum(e.stats[iSog]) || 0
  const played = evs.filter(e => TOI(e) > 0)              // scratches/DNPs carry no ice-time signal
  if (!played.length) return null
  const last5 = played.slice(0, 5)
  const sum = (arr, f) => arr.reduce((s, e) => s + f(e), 0)
  const form = {
    sogPerGame: +(sum(played, SOG) / played.length).toFixed(2),
    seasonToiMinutes: +(sum(played, TOI) / played.length).toFixed(2),
    last5ToiMinutes: +(sum(last5, TOI) / last5.length).toFixed(2),
    last5SogPerGame: +(sum(last5, SOG) / last5.length).toFixed(2),
    games: played.length,
  }
  await writeScan(key, date, form)
  return form
}

// Core — same contract as the WNBA sibling flow: assemble roster + event stats + per-player
// form, run the pure scorer, return { ok, sport, verdicts, meta }. Exported for reuse/tests.
export async function nhlVerdictsForGame({ away, home, iso, names, markets = [], lines = [], evs = [] } = {}) { // eslint-disable-line no-unused-vars
  const [roster, teamStats] = await Promise.all([rosterIndex('NHL'), eventTeamStats(away, home)])
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

  const verdicts = {}
  await Promise.all((names || []).map(async (name, i) => {
    const nn = norm(name)
    const r = roster.byFull[nn] || roster.byLast[nn.split(/\s+/).pop()]
    const market = markets[i] || NHL_SOG_MARKET
    const line = toNum(lines[i]), evPct = toNum(evs[i])
    if (!r?.id) { verdicts[name] = { score: null, tier: null, note: 'no roster match' }; return }
    if (market !== NHL_SOG_MARKET) { verdicts[name] = { score: null, tier: null, note: 'market not modeled' }; return }
    // Which defense does this skater face? Roster team is an abbreviation; event teams are
    // full names — match by ESPN team abbr suffix is unreliable, so side-match on last word
    // of team name when possible, else fall back to the away side being first-listed.
    let oppSogAllowedPerGame = null
    if (teamStats) {
      const isHome = r.team && (lw(teamStats.homeTeam) === lw(r.team) || String(teamStats.homeTeam || '').toUpperCase().includes(String(r.team).toUpperCase()))
      oppSogAllowedPerGame = isHome ? teamStats.homeOppSogAllowed : teamStats.awayOppSogAllowed
    }
    if (oppSogAllowedPerGame == null) { verdicts[name] = { score: null, tier: null, note: 'no opponent shots-allowed data' }; return }
    const form = await skaterForm(r.id)
    if (!form) { verdicts[name] = { score: null, tier: null, note: 'no gamelog' }; return }
    const v = nhlVerdict({
      market,
      sogPerGame: form.sogPerGame, seasonToiMinutes: form.seasonToiMinutes,
      last5ToiMinutes: form.last5ToiMinutes, last5SogPerGame: form.last5SogPerGame,
      oppSogAllowedPerGame, evPct, line,
    })
    verdicts[name] = v ? { ...v, team: r.team || null } : { score: null, tier: null, note: 'missing inputs' }
  }))

  return {
    ok: true, sport: 'NHL', verdicts,
    meta: { matched: Object.values(verdicts).filter(v => v.score != null).length, requested: (names || []).length, hadTeamStats: !!teamStats },
  }
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

  const out = await nhlVerdictsForGame({
    away, home, iso: String(req.query.iso || ''),
    names, markets: split('markets'), lines: split('lines'), evs: split('evs'),
  })
  return res.status(200).json(out)
}
