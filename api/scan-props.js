// On-demand per-game player-prop scan. Free /events call maps our game → Odds API event id,
// then one paid per-event odds call fetches the sport's prop markets; propEdges ranks them.
// Auth-gated — each scan spends credits. Pre-game only (the engine enforces the gate).
import { requireAuth } from './_lib/auth.js'
import { fetchSportEvents, fetchEventOdds, SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { propEdges } from '../src/lib/propEdges.js'
import { PROP_MARKETS, PROP_MARKETS_FULL } from '../src/lib/propMarkets.js'
import { readScan, writeScan, isFresh, capturePropSnapshots, fetchPropOpens } from './_lib/scanStore.js'
import { buildIndex, norm } from './player-search.js'

export const config = { maxDuration: 20 }

// Real ESPN headshots + team, joined onto props by player name (free roster index, cached per sport/day).
async function rosterMap(sport) {
  try {
    const dateYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const cached = await readScan(`PLAYERS:${sport}`, dateYmd)
    let index = cached?.payload?.index
    if (!index) { const built = await buildIndex(sport); index = built.index; await writeScan(`PLAYERS:${sport}`, dateYmd, built, null) }
    const byFull = {}, byLast = {}
    for (const r of index || []) {
      const n = norm(r.player)
      const v = { headshot: r.headshot || null, team: r.team || null }
      byFull[n] = v
      byLast[n.split(/\s+/).pop()] = v
    }
    return { byFull, byLast }
  } catch { return { byFull: {}, byLast: {} } }
}

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
// Props are paid for ONCE per game per 30 min, shared across every viewer (stored in scan_cache).
// Prop lines barely move pre-game, so a long window slashes credit burn during slip-building;
// the RE-SCAN button forces a fresh pull on demand. (Game lines stay live/90s — watched live.)
const PROPS_TTL_MS = 30 * 60 * 1000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const full = String(req.query.full ?? '') === '1'
  // us_ex (Novig/exchanges) is ~1.5x the credit cost — only pull it on an explicit refresh (ex=1),
  // not on the auto-scan that fires every time a game is opened.
  const ex = String(req.query.ex ?? '') === '1'
  const REGIONS = ex ? ['us', 'us2', 'us_ex'] : ['us', 'us2']
  // cacheOnly: serve from cache only — NEVER spend credits. Opening a game uses this so just
  // browsing costs nothing; a fresh paid scan happens only on an explicit tap/refresh.
  const cacheOnly = String(req.query.cacheOnly ?? '') === '1'
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
  if (cacheOnly) return res.status(200).json({ found: false, notCached: true })

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
      try { const r = await fetchEventOdds({ sport, eventId: match.id, markets: mk, regions: REGIONS, timeoutMs: ex ? 12000 : 8000 }); game = r.game; credits = r.credits; usedMarkets = mk; break }
      catch (e) { lastErr = e }
    }
    if (!game) {
      if (lastErr) throw lastErr
      return res.status(200).json({ found: false, creditsRemaining: credits.remaining })
    }

    // Props are always findable (no pre-game gate) so you can build a slip even once a game tips off.
    const { edges, lineShopOnly } = propEdges(game, usedMarkets, Date.now(), { preGameOnly: false })
    // join real headshots + team by player name (full match, then last-name fallback)
    const roster = await rosterMap(sport)
    // view-driven prop history: snapshot best price per side, then read the OPEN (earliest) for movement
    const snaps = [...edges, ...lineShopOnly]
      .filter(p => p.best?.price != null)
      .map(p => ({ external_event_id: match.id, sport, player: p.player, market: p.market, point: p.point ?? null, side: p.side, price: p.best.price, book: p.best.book || null }))
    await capturePropSnapshots(snaps)
    const opens = await fetchPropOpens(match.id)
    const withShot = (p) => {
      const n = norm(p.player); const hit = roster.byFull[n] || roster.byLast[n.split(/\s+/).pop()] || {}
      return { ...p, headshot: hit.headshot || null, team: hit.team || null, openPrice: opens[`${p.player}|${p.market}|${p.point}|${p.side}`] ?? null }
    }
    const payload = {
      found: true, away: game.away_team, home: game.home_team,
      edges: edges.map(withShot), lineShopOnly: lineShopOnly.map(withShot),
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
