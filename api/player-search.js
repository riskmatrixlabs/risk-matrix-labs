// Player search → which of today's games a player is in. Resolves a typed name to that
// player's game using FREE ESPN rosters (zero Odds-API credits). The bot then opens that
// game in Channel 2, where props / line movement / logging already live.
//
// A per-sport-per-day roster index is cached (scan_cache) so only the first search of the
// day pays the ESPN roster fetches; the rest filter the cached index in memory.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh } from './_lib/scanStore.js'

export const config = { maxDuration: 60 }

const INDEX_TTL_MS = 12 * 60 * 60 * 1000   // rebuild the day's roster index at most ~twice
const SPORTS = {
  MLB:  { sport: 'baseball',   league: 'mlb'  },
  WNBA: { sport: 'basketball', league: 'wnba' },
  NBA:  { sport: 'basketball', league: 'nba'  },
  NHL:  { sport: 'hockey',     league: 'nhl'  },
}
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) return null
  return r.json().catch(() => null)
}

function extractAthletes(roster) {
  const out = []
  const push = (a) => { if (a?.displayName) out.push({ name: a.displayName, pos: a.position?.abbreviation || '', headshot: a.headshot?.href || '' }) }
  for (const g of roster?.athletes || []) {
    if (Array.isArray(g?.items)) { for (const a of g.items) push(a) }
    else push(g)
  }
  return out
}

// Build the day's player→game index for one sport from ESPN scoreboard + rosters.
export async function buildIndex(sportKey) {
  const cfg = SPORTS[sportKey]
  // No `dates` param → ESPN's natural current slate (matches what the bot shows). Passing a
  // UTC date returned the WRONG day in the evening (next-day games), so search came back blank.
  const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard`)
  const events = sb?.events || []
  const games = events.map(ev => {
    const comp = ev.competitions?.[0]
    const cs = comp?.competitors || []
    const home = cs.find(c => c.homeAway === 'home')?.team
    const away = cs.find(c => c.homeAway === 'away')?.team
    if (!home || !away) return null
    return {
      external_event_id: String(ev.id),
      commenceTime: ev.date,
      home: home.displayName, away: away.displayName,
      home_abbr: home.abbreviation || '', away_abbr: away.abbreviation || '',
      homeId: home.id, awayId: away.id,
    }
  }).filter(Boolean)

  const teamRefs = games.flatMap(g => [{ id: g.homeId, g }, { id: g.awayId, g }])
  const rosters = await Promise.all(teamRefs.map(t =>
    getJson(`https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/teams/${t.id}/roster`)))

  const index = []
  rosters.forEach((roster, i) => {
    const ref = teamRefs[i]
    const teamAbbr = ref.id === ref.g.homeId ? ref.g.home_abbr : ref.g.away_abbr
    for (const a of extractAthletes(roster)) {
      index.push({ player: a.name, pos: a.pos, headshot: a.headshot, team: teamAbbr, sport: sportKey, game: { sport: sportKey, ...gameFields(ref.g) } })
    }
  })
  return { hadGames: games.length > 0, index }
}

function gameFields(g) {
  return {
    away: g.away, home: g.home, away_abbr: g.away_abbr, home_abbr: g.home_abbr,
    external_event_id: g.external_event_id, commenceTime: g.commenceTime,
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const q = norm(req.query.q)
  const reqSport = req.query.sport ? String(req.query.sport).toUpperCase() : null
  const sports = reqSport && SPORTS[reqSport] ? [reqSport] : Object.keys(SPORTS)
  if (q.length < 2) return res.status(200).json({ matches: [], reason: 'type at least 2 letters' })

  const dateYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  res.setHeader('Cache-Control', 'no-store')

  let anyGames = false
  const matches = []
  for (const s of sports) {
    let payload = null
    const cached = await readScan(`PLAYERS:${s}`, dateYmd)
    if (cached && isFresh(cached.scanned_at, Date.now(), INDEX_TTL_MS) && cached.payload) {
      payload = cached.payload
    } else {
      try { payload = await buildIndex(s); await writeScan(`PLAYERS:${s}`, dateYmd, payload, null) }
      catch { payload = { hadGames: false, index: [] } }
    }
    if (payload.hadGames) anyGames = true
    for (const row of payload.index) {
      if (norm(row.player).includes(q)) matches.push(row)
    }
  }
  // de-dupe (same player can appear once) and cap
  const seen = new Set()
  const out = matches.filter(m => {
    const k = `${m.player}|${m.game.external_event_id}`
    if (seen.has(k)) return false
    seen.add(k); return true
  }).slice(0, 25)

  return res.status(200).json({ matches: out, anyGames })
}
