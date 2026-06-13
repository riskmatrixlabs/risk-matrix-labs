// On-demand per-game player-prop scan. Free /events call maps our game → Odds API event id,
// then one paid per-event odds call fetches the sport's prop markets; propEdges ranks them.
// Auth-gated — each scan spends credits. Pre-game only (the engine enforces the gate).
import { requireAuth } from './_lib/auth.js'
import { fetchSportEvents, fetchEventOdds, SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { propEdges } from '../src/lib/propEdges.js'
import { PROP_MARKETS } from '../src/lib/propMarkets.js'

export const config = { maxDuration: 20 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const markets = PROP_MARKETS[sport]
  if (!markets?.length) return res.status(200).json({ found: false, reason: 'no prop markets for sport' })

  res.setHeader('Cache-Control', 'no-store')
  try {
    const { events } = await fetchSportEvents({ sport })
    const match = events.find(e => lastWord(e.home_team) === lastWord(home) && lastWord(e.away_team) === lastWord(away))
    if (!match) return res.status(200).json({ found: false })

    const { game, credits } = await fetchEventOdds({ sport, eventId: match.id, markets })
    if (!game) return res.status(200).json({ found: false, creditsRemaining: credits.remaining })

    const { edges, lineShopOnly } = propEdges(game, markets, Date.now())
    return res.status(200).json({
      found: true, away: game.away_team, home: game.home_team,
      edges, lineShopOnly,
      creditsRemaining: credits.remaining,
      scannedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('scan-props failed:', e.message)
    return res.status(502).json({ error: 'prop scan failed', detail: e.message })
  }
}
