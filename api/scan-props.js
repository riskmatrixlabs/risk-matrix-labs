// On-demand per-game player-prop scan. Free /events call maps our game → Odds API event id,
// then one paid per-event odds call fetches the sport's prop markets; propEdges ranks them.
// Auth-gated — each scan spends credits. Pre-game only (the engine enforces the gate).
import { requireAuth } from './_lib/auth.js'
import { fetchSportEvents, fetchEventOdds, SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { propEdges } from '../src/lib/propEdges.js'
import { PROP_MARKETS, PROP_MARKETS_FULL } from '../src/lib/propMarkets.js'
import { readScan, writeScan, isFresh } from './_lib/scanStore.js'

export const config = { maxDuration: 20 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
// Same per-game props paid for once per 2 min, no matter how many spots request them
// (bot props board, player-prop CH2 view, etc.) — protects credits.
const PROPS_TTL_MS = 2 * 60 * 1000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const full = String(req.query.full ?? '') === '1'
  const markets = (full ? PROP_MARKETS_FULL[sport] : PROP_MARKETS[sport])
  if (!markets?.length) return res.status(200).json({ found: false, reason: 'no prop markets for sport' })

  res.setHeader('Cache-Control', 'no-store')

  // Per-game props cache — protects credits across the bot board + player-prop views.
  const ckSport = `PROPS:${sport}${full ? ':FULL' : ''}`
  const ckGame = `${lastWord(away)}@${lastWord(home)}`
  const cached = await readScan(ckSport, ckGame)
  if (cached && isFresh(cached.scanned_at, Date.now(), PROPS_TTL_MS) && cached.payload) {
    return res.status(200).json({ ...cached.payload, cached: true })
  }

  try {
    const { events } = await fetchSportEvents({ sport })
    const match = events.find(e => lastWord(e.home_team) === lastWord(home) && lastWord(e.away_team) === lastWord(away))
    if (!match) return res.status(200).json({ found: false })

    // Try the requested market set (timeboxed). If it fails (e.g. a market the plan rejects → 422,
    // or a slow call) AND we asked for the full set, degrade to the base set so props never blank.
    let game = null, credits = { remaining: undefined }, usedMarkets = markets
    const tiers = (full && markets !== PROP_MARKETS[sport]) ? [markets, PROP_MARKETS[sport]] : [markets]
    let lastErr = null
    for (const mk of tiers) {
      try { const r = await fetchEventOdds({ sport, eventId: match.id, markets: mk, regions: ['us', 'us2'], timeoutMs: 8000 }); game = r.game; credits = r.credits; usedMarkets = mk; break }
      catch (e) { lastErr = e }
    }
    if (!game) {
      if (lastErr) throw lastErr
      return res.status(200).json({ found: false, creditsRemaining: credits.remaining })
    }

    const { edges, lineShopOnly } = propEdges(game, usedMarkets, Date.now())
    const payload = {
      found: true, away: game.away_team, home: game.home_team,
      edges, lineShopOnly,
      creditsRemaining: credits.remaining,
      scannedAt: new Date().toISOString(),
    }
    await writeScan(ckSport, ckGame, payload, credits.remaining)
    return res.status(200).json(payload)
  } catch (e) {
    console.error('scan-props failed:', e.message)
    return res.status(502).json({ error: 'prop scan failed', detail: e.message })
  }
}
