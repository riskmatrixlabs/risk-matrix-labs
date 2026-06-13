// Adapter: The Odds API → RML's normalized game shape.
// Provider-agnostic contract every adapter must satisfy:
//   fetchOdds({ sport, markets, regions, apiKey }) →
//     { games: NormalizedGame[], credits: { remaining, used, last } }
//
// NormalizedGame = { sport_key, commence_time, home_team, away_team,
//   bookmakers: [{ key, last_update, markets: [{ key, outcomes: [{ name, price, point? }] }] }] }
// (This is exactly the shape oddsEdge.js / edgeFilter.js consume.)

export const NAME = 'theOddsApi'
const BASE = 'https://api.the-odds-api.com/v4'

// RML sport → The Odds API sport key.
export const SPORT_KEYS = {
  MLB:  'baseball_mlb',
  NBA:  'basketball_nba',
  WNBA: 'basketball_wnba',
  NHL:  'icehockey_nhl',
}

// Normalize one provider game to RML's shape. The Odds API is already close; we map
// explicitly so the contract is enforced (and other providers conform to the same output).
function normalizeGame(g) {
  return {
    sport_key: g.sport_key,
    commence_time: g.commence_time,
    home_team: g.home_team,
    away_team: g.away_team,
    bookmakers: (g.bookmakers || []).map(b => ({
      key: b.key,
      last_update: b.last_update,
      markets: (b.markets || []).map(m => ({
        key: m.key,
        outcomes: (m.outcomes || []).map(o => ({ name: o.name, price: o.price, point: o.point, description: o.description, link: o.link })),
      })),
    })),
  }
}

export async function fetchOdds({ sport, markets = ['h2h'], regions = ['us', 'eu'], apiKey = process.env.ODDS_API_KEY }) {
  if (!apiKey) throw new Error('ODDS_API_KEY missing')
  const sportKey = SPORT_KEYS[sport] || sport
  const url = `${BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}`
    + `&regions=${regions.join(',')}&markets=${markets.join(',')}&oddsFormat=american&includeLinks=true`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`theOddsApi ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    games: (Array.isArray(data) ? data : []).map(normalizeGame),
    credits: {
      remaining: Number(res.headers.get('x-requests-remaining')),
      used: Number(res.headers.get('x-requests-used')),
      last: Number(res.headers.get('x-requests-last')),
    },
  }
}

// Free events list (0 credits) → map our game to The Odds API's event id by team names.
export async function fetchSportEvents({ sport, apiKey = process.env.ODDS_API_KEY }) {
  if (!apiKey) throw new Error('ODDS_API_KEY missing')
  const sportKey = SPORT_KEYS[sport] || sport
  const res = await fetch(`${BASE}/sports/${sportKey}/events/?apiKey=${apiKey}`)
  if (!res.ok) throw new Error(`theOddsApi events ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = await res.json()
  return {
    events: (Array.isArray(data) ? data : []).map(e => ({ id: e.id, home_team: e.home_team, away_team: e.away_team, commence_time: e.commence_time })),
    credits: { remaining: Number(res.headers.get('x-requests-remaining')), used: Number(res.headers.get('x-requests-used')), last: Number(res.headers.get('x-requests-last')) },
  }
}

// Paid per-event odds (props live here). Returns one normalized game + credits.
export async function fetchEventOdds({ sport, eventId, markets, regions = ['us', 'eu'], apiKey = process.env.ODDS_API_KEY }) {
  if (!apiKey) throw new Error('ODDS_API_KEY missing')
  const sportKey = SPORT_KEYS[sport] || sport
  const url = `${BASE}/sports/${sportKey}/events/${eventId}/odds/?apiKey=${apiKey}`
    + `&regions=${regions.join(',')}&markets=${markets.join(',')}&oddsFormat=american&includeLinks=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`theOddsApi event-odds ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = await res.json()
  return {
    game: data && data.id ? normalizeGame(data) : null,
    credits: { remaining: Number(res.headers.get('x-requests-remaining')), used: Number(res.headers.get('x-requests-used')), last: Number(res.headers.get('x-requests-last')) },
  }
}
