// Line-shopping endpoint for the Odds Comparison card. Fetches multi-book odds for a
// sport, finds the requested game, and returns every reputable book's price (best flagged,
// sharp marked). Auth-gated — spends API credits like the bot scan.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'
import { getProvider } from './_lib/oddsProviders/index.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { compareBooks } from '../src/lib/edgeFilter.js'
import { readScan, writeScan, isFresh } from './_lib/scanStore.js'

export const config = { maxDuration: 20 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

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
        rows.push({ external_event_id: String(eventId), provider: 'oddsapi', sport, market: MK[key], side, value: price, book: r.book, captured_at: at })
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

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  const eventId = String(req.query.eventId ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })

  res.setHeader('Cache-Control', 'no-store')

  // Short server cache keyed per game — protects credits on repeat/concurrent opens.
  const ckSport = `LINES:${sport}`
  const ckGame = `${lastWord(away)}@${lastWord(home)}`
  const cached = await readScan(ckSport, ckGame)
  if (cached && isFresh(cached.scanned_at, Date.now(), LINES_TTL_MS) && cached.payload) {
    return res.status(200).json({ ...cached.payload, cached: true })
  }

  try {
    const provider = getProvider()
    const { games, credits } = await provider.fetchOdds({ sport, markets: ['h2h', 'spreads', 'totals'], regions: ['us', 'us2'] })
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
