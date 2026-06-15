// Line-shopping endpoint for the Odds Comparison card. Fetches multi-book odds for a
// sport, finds the requested game, and returns every reputable book's price (best flagged,
// sharp marked). Auth-gated — spends API credits like the bot scan.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'
import { getProvider } from './_lib/oddsProviders/index.js'
import { SPORT_KEYS, fetchSportEvents, fetchEventOdds } from './_lib/oddsProviders/theOddsApi.js'
import { compareBooks, REPUTABLE_BOOKS } from '../src/lib/edgeFilter.js'
import { americanToDecimal } from '../src/lib/devig.js'
import { readScan, writeScan, isFresh } from './_lib/scanStore.js'

export const config = { maxDuration: 20 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

// Per-sport FULL market list (real Odds-API keys only). MLB gets period segments;
// other sports stay safe with just team_totals to avoid 422s on per-sport period keys.
const FULL_MARKETS = {
  MLB: ['h2h', 'spreads', 'totals', 'team_totals',
    'h2h_1st_1_innings', 'totals_1st_1_innings', 'spreads_1st_1_innings',
    'h2h_1st_5_innings', 'totals_1st_5_innings', 'spreads_1st_5_innings',
    'h2h_1st_7_innings', 'totals_1st_7_innings'],
  NBA:  ['h2h', 'spreads', 'totals', 'team_totals'],
  WNBA: ['h2h', 'spreads', 'totals', 'team_totals'],
  NHL:  ['h2h', 'spreads', 'totals', 'team_totals'],
}
const BASE_FULL = ['h2h', 'spreads', 'totals', 'team_totals']
const BASE_THREE = ['h2h', 'spreads', 'totals']

// Build a segment object (only non-empty sub-markets included).
function buildSegment(bk, subs) {
  const seg = {}
  for (const [name, key] of Object.entries(subs)) {
    const cmp = compareBooks(bk, key)
    if (cmp && cmp.outcomes && cmp.outcomes.length) seg[name] = cmp
  }
  return Object.keys(seg).length ? seg : null
}

// The Odds-API `team_totals` market keys outcomes by name ("Over"/"Under") with the TEAM
// in `description`. compareBooks would merge both teams, so parse it locally: group by
// team (description) → side (over/under) with rows + best per side.
function parseTeamTotals(bookmakers, opts = {}) {
  const { whitelist = REPUTABLE_BOOKS } = opts
  const books = (bookmakers || []).filter(b => whitelist.has(b.key) && (b.markets || []).some(m => m.key === 'team_totals'))
  if (!books.length) return null
  const teams = {}
  for (const b of books) {
    const m = b.markets.find(x => x.key === 'team_totals')
    if (!m) continue
    for (const o of (m.outcomes || [])) {
      const team = o.description
      if (!team) continue
      const side = /^o/i.test(o.name) ? 'over' : /^u/i.test(o.name) ? 'under' : null
      if (!side) continue
      teams[team] ||= { over: { point: null, best: null, rows: [] }, under: { point: null, best: null, rows: [] } }
      const slot = teams[team][side]
      slot.rows.push({ book: b.key, price: o.price, point: o.point ?? null })
      if (o.point != null && slot.point == null) slot.point = o.point
      const d = americanToDecimal(o.price)
      if (d != null && (!slot.best || d > slot.best.decimal)) slot.best = { book: b.key, price: o.price, decimal: d }
    }
  }
  return Object.keys(teams).length ? teams : null
}

// VIEW-DRIVEN per-book history: when a game is opened (fresh fetch), persist each book's
// ML/spread/total price to odds_history. No cron, no extra API cost (we already paid for this
// fetch) — the By-Sportsbook RL/Total movement chart fills in from real usage, $0 when idle.
async function persistSnapshots({ eventId, sport, away, home, markets }) {
  if (!eventId || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  const MK = { h2h: 'ml', spreads: 'spread', totals: 'total' }
  const rows = []
  const at = new Date().toISOString()
  for (const [key, cmp] of Object.entries(markets || {})) {
    if (!cmp || !cmp.rows) continue
    for (const r of cmp.rows) {
      for (const name of cmp.outcomes) {
        const price = r.prices[name]
        if (price == null) continue
        const side = key === 'totals'
          ? (/^o/i.test(name) ? 'over' : 'under')
          : (lastWord(name) === lastWord(away) ? 'away' : lastWord(name) === lastWord(home) ? 'home' : null)
        if (!side) continue
        // Persist the consensus LINE NUMBER too (total/spread) so the since-open move on the
        // number itself accrues — powers the game card's "LEANS OVER vs 8.5 · opened 8 ▲".
        const point = (key === 'totals' || key === 'spreads') ? (cmp.modalPoint ?? r.points?.[name] ?? null) : null
        rows.push({ external_event_id: String(eventId), provider: 'oddsapi', sport, market: MK[key], side, value: price, point, book: r.book, captured_at: at })
      }
    }
  }
  if (!rows.length) return
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
    await db.from('odds_history').insert(rows)
  } catch { /* best-effort — never block the response */ }
}
// Live-on-open serves identical odds to every viewer of a game for a short window. A 90s
// cache means rapid re-opens / multiple viewers cost 0 extra credits while staying "live".
const LINES_TTL_MS = 90 * 1000
// cacheOnly opens (the free auto-load) accept a warmer/longer cache — the cron pre-fills the whole
// slate every ~15 min, so opening any game shows best lines for free. A manual REFRESH still
// re-pulls anything older than 90s for live freshness.
const WARM_TTL_MS = 18 * 60 * 1000

// Pre-warm the WHOLE slate's cheap game-lines cache with ONE bulk call per sport — so opening any
// game serves best lines for FREE (cacheOnly). Called by cron-warm-lines. Returns a small summary.
export async function warmSlate(sport) {
  const sp = String(sport).toUpperCase()
  if (!SPORT_KEYS[sp]) return { skipped: 'unsupported sport' }
  const provider = getProvider()
  const { games, credits } = await provider.fetchOdds({ sport: sp, markets: ['h2h', 'spreads', 'totals'], regions: ['us', 'us2'] })
  let written = 0
  for (const game of games || []) {
    if (!game?.away_team || !game?.home_team) continue
    const markets = {
      h2h:     compareBooks(game.bookmakers, 'h2h'),
      spreads: compareBooks(game.bookmakers, 'spreads'),
      totals:  compareBooks(game.bookmakers, 'totals'),
    }
    const payload = { found: true, away: game.away_team, home: game.home_team, markets, creditsRemaining: credits.remaining, fetchedAt: new Date().toISOString() }
    await writeScan(`LINES:${sp}`, `${lastWord(game.away_team)}@${lastWord(game.home_team)}`, payload, credits.remaining)
    written++
  }
  return { written, games: games?.length || 0, creditsRemaining: credits.remaining }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  const eventId = String(req.query.eventId ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const full = String(req.query.full ?? '') === '1'
  // us_ex (Novig/exchanges) ~1.5x credits — only on explicit refresh (ex=1), not the auto-load.
  const ex = String(req.query.ex ?? '') === '1'
  const REGIONS = ex ? ['us', 'us2', 'us_ex'] : ['us', 'us2']
  // cacheOnly: serve cache only, never spend credits (used by the auto-load on game open).
  const cacheOnly = String(req.query.cacheOnly ?? '') === '1'

  res.setHeader('Cache-Control', 'no-store')

  // Short server cache keyed per game — protects credits on repeat/concurrent opens.
  // Full payloads cache under a separate key so cheap/full never collide.
  const ckSport = full ? `LINES:${sport}:FULL` : `LINES:${sport}`
  const ckGame = `${lastWord(away)}@${lastWord(home)}`
  const ttl = cacheOnly ? WARM_TTL_MS : LINES_TTL_MS   // free opens ride the cron-warmed cache
  const cached = await readScan(ckSport, ckGame)
  if (cached && isFresh(cached.scanned_at, Date.now(), ttl) && cached.payload) {
    return res.status(200).json({ ...cached.payload, cached: true })
  }
  if (cacheOnly) return res.status(200).json({ found: false, notCached: true })

  if (full) {
    try {
      // (1) BASE LINES via the fast, reliable bulk endpoint — same call cheap mode uses (~1s).
      //     This guarantees the page always gets game lines; segments are a bonus layered on top.
      const provider = getProvider()
      const { games, credits } = await provider.fetchOdds({ sport, markets: ['h2h', 'spreads', 'totals'], regions: REGIONS })
      const baseGame = games.find(g => lastWord(g.home_team) === lastWord(home) && lastWord(g.away_team) === lastWord(away))
      if (!baseGame) return res.status(200).json({ found: false, creditsRemaining: credits.remaining })

      const markets = {
        h2h:     compareBooks(baseGame.bookmakers, 'h2h'),
        spreads: compareBooks(baseGame.bookmakers, 'spreads'),
        totals:  compareBooks(baseGame.bookmakers, 'totals'),
      }

      // (2) SEGMENTS + TEAM TOTALS via the per-event endpoint — BEST-EFFORT, hard-timeboxed so it
      //     can never blow the function budget. Any failure/timeout just leaves these empty.
      let segments = {}, teamTotals = null, segCredits
      try {
        const { events } = await fetchSportEvents({ sport })
        const match = events.find(e => lastWord(e.home_team) === lastWord(home) && lastWord(e.away_team) === lastWord(away))
        if (match) {
          const tiers = sport === 'MLB' ? [FULL_MARKETS.MLB, BASE_FULL] : [BASE_FULL]
          let evGame = null
          for (const mk of tiers) {
            try { const r = await fetchEventOdds({ sport, eventId: match.id, markets: mk, regions: REGIONS, timeoutMs: 7000 }); evGame = r.game; segCredits = r.credits?.remaining; break }
            catch (e) { /* unsupported markets / slow — try next tier */ }
          }
          if (evGame) {
            const bk = evGame.bookmakers
            const s1 = buildSegment(bk, { h2h: 'h2h_1st_1_innings', totals: 'totals_1st_1_innings', spreads: 'spreads_1st_1_innings' })
            const s5 = buildSegment(bk, { h2h: 'h2h_1st_5_innings', totals: 'totals_1st_5_innings', spreads: 'spreads_1st_5_innings' })
            const s7 = buildSegment(bk, { h2h: 'h2h_1st_7_innings', totals: 'totals_1st_7_innings' })
            if (s1) segments['1st_1'] = s1
            if (s5) segments['1st_5'] = s5
            if (s7) segments['1st_7'] = s7
            teamTotals = parseTeamTotals(bk)
          }
        }
      } catch (e) { console.error('game-lines segments best-effort failed:', e.message) }

      const payload = {
        found: true,
        away: baseGame.away_team,
        home: baseGame.home_team,
        markets,
        segments,
        teamTotals,
        creditsRemaining: segCredits ?? credits.remaining,
        fetchedAt: new Date().toISOString(),
      }
      await writeScan(ckSport, ckGame, payload, payload.creditsRemaining)
      await persistSnapshots({ eventId, sport, away: baseGame.away_team, home: baseGame.home_team, markets })
      return res.status(200).json(payload)
    } catch (e) {
      console.error('game-lines full failed:', e.message)
      return res.status(502).json({ error: 'line fetch failed', detail: e.message })
    }
  }

  try {
    const provider = getProvider()
    const { games, credits } = await provider.fetchOdds({ sport, markets: ['h2h', 'spreads', 'totals'], regions: REGIONS })
    const game = games.find(g => lastWord(g.home_team) === lastWord(home) && lastWord(g.away_team) === lastWord(away))
    if (!game) return res.status(200).json({ found: false, creditsRemaining: credits.remaining })

    const payload = {
      found: true,
      away: game.away_team,
      home: game.home_team,
      markets: {                                  // each: { outcomes, rows, modalPoint, best } or null
        h2h:     compareBooks(game.bookmakers, 'h2h'),
        spreads: compareBooks(game.bookmakers, 'spreads'),
        totals:  compareBooks(game.bookmakers, 'totals'),
      },
      creditsRemaining: credits.remaining,
      fetchedAt: new Date().toISOString(),
    }
    await writeScan(ckSport, ckGame, payload, credits.remaining)
    await persistSnapshots({ eventId, sport, away: game.away_team, home: game.home_team, markets: payload.markets })
    return res.status(200).json(payload)
  } catch (e) {
    console.error('game-lines failed:', e.message)
    return res.status(502).json({ error: 'line fetch failed', detail: e.message })
  }
}
