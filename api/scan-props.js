// On-demand per-game player-prop scan. Free /events call maps our game → Odds API event id,
// then one paid per-event odds call fetches the sport's prop markets; propEdges ranks them.
// Auth-gated — each scan spends credits. Pre-game only (the engine enforces the gate).
import { requireAuth } from './_lib/auth.js'
import { fetchSportEvents, fetchEventOdds, SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { propEdges } from '../src/lib/propEdges.js'
import { PROP_MARKETS, PROP_MARKETS_FULL } from '../src/lib/propMarkets.js'
import { readScan, writeScan, isFresh, capturePropSnapshots, fetchPropOpens } from './_lib/scanStore.js'
import { creditFloorBlocked, recordCredits } from './_lib/creditGuard.js'
import { acquireLock, releaseLock } from './_lib/scanLock.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { buildIndex, norm } from './player-search.js'

// Service-role client for the credit guard + single-flight lock (same env/transport as scanStore).
function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}

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
      const v = { headshot: r.headshot || null, team: r.team || null, id: r.id ?? null }
      byFull[n] = v
      byLast[n.split(/\s+/).pop()] = v
    }
    return { byFull, byLast }
  } catch { return { byFull: {}, byLast: {} } }
}

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
// Props are paid for ONCE per game per ~90 min, shared across every viewer (stored in scan_cache)
// AND pre-warmed for the whole slate by cron-warm-props so opening a game is FREE (like lines/PHLT).
// Prop lines barely move pre-game, so a long window slashes credit burn; the RE-SCAN button forces
// a fresh pull (incl. us_ex/Novig) on demand. (Game lines stay live/90s — watched live.)
export const PROPS_TTL_MS = 90 * 60 * 1000

// Core per-game prop scan — shared by the HTTP handler AND cron-warm-props, so a warmed game is
// byte-identical to an on-demand scan (same cache key + payload shape). Returns { payload, served }
// where served = 'cache' (no credits spent) | 'live' (paid pull written to cache) | 'none'. Throws
// only on a hard odds-API failure (the handler maps that to a 502).
//   cacheOnly: serve cache only, NEVER spend credits (auto-load on game open)
//   force:     bypass the cache and do a fresh paid pull (manual ↻ REFRESH — lets it add us_ex)
//   regions:   region list for the paid pull (the warm cron passes ['us'] to halve the credit cost)
//   ttlMs:     freshness window for the cache-hit short-circuit (warm uses a shorter age to re-warm
//              before the read-TTL expires, so users never hit an expired gap)
export async function scanGameProps({ sport, away, home, full = false, cacheOnly = false, force = false, regions = ['us', 'us2'], ttlMs = PROPS_TTL_MS }) {
  const markets = full ? PROP_MARKETS_FULL[sport] : PROP_MARKETS[sport]
  if (!markets?.length) return { payload: { found: false, reason: 'no prop markets for sport' }, served: 'none' }

  // Per-game props cache — protects credits across the bot board + player-prop views.
  const ckSport = `PROPS:${sport}${full ? ':FULL' : ''}`
  const ckGame = `${lastWord(away)}@${lastWord(home)}`
  if (!force) {
    const cached = await readScan(ckSport, ckGame)
    if (cached && isFresh(cached.scanned_at, Date.now(), ttlMs) && cached.payload) {
      return { payload: { ...cached.payload, cached: true }, served: 'cache' }
    }
    if (cacheOnly) return { payload: { found: false, notCached: true }, served: 'none' }
  }

  // ── CREDIT SAFETY (applies even to force=true, so a forced REFRESH can't drain below floor) ──
  const supa = db()

  // (1) CIRCUIT BREAKER: if we KNOW we're below the credit floor, do NOT spend. Serve stale cache
  //     if one exists, else an honest empty. Fail-open: unknown/error => not blocked (spends).
  if (!cacheOnly && (await creditFloorBlocked(supa))) {
    const cached = await readScan(ckSport, ckGame)
    if (cached?.payload) return { payload: { ...cached.payload, cached: true, creditFloor: true }, served: 'cache' }
    return { payload: { found: false, creditFloor: true }, served: 'none' }
  }

  // (2) SINGLE-FLIGHT: only one worker pulls a given game at once. Losers re-read the cache the
  //     winner is writing. Fail-open: a lock error returns true (we proceed) rather than hang.
  const lockKey = `props:${ckSport}:${ckGame}`
  if (!(await acquireLock(supa, lockKey))) {
    const cached = await readScan(ckSport, ckGame)
    if (cached?.payload) return { payload: { ...cached.payload, cached: true }, served: 'cache' }
    return { payload: { found: false, inFlight: true }, served: 'none' }
  }

  try {
  const { events } = await fetchSportEvents({ sport })
  const match = events.find(e => lastWord(e.home_team) === lastWord(home) && lastWord(e.away_team) === lastWord(away))
  if (!match) return { payload: { found: false }, served: 'live' }

  // Try the requested market set (timeboxed). If it fails (e.g. a market the plan rejects → 422,
  // or a slow call) AND we asked for the full set, degrade to the base set so props never blank.
  let game = null, credits = { remaining: undefined }, usedMarkets = markets
  const tiers = (full && markets !== PROP_MARKETS[sport]) ? [markets, PROP_MARKETS[sport]] : [markets]
  let lastErr = null
  for (const mk of tiers) {
    try { const r = await fetchEventOdds({ sport, eventId: match.id, markets: mk, regions, timeoutMs: force ? 12000 : 8000 }); game = r.game; credits = r.credits; usedMarkets = mk; break }
    catch (e) { lastErr = e }
  }
  if (!game) {
    if (lastErr) throw lastErr
    await recordCredits(supa, credits.remaining)
    return { payload: { found: false, creditsRemaining: credits.remaining }, served: 'live' }
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
    return { ...p, headshot: hit.headshot || null, team: hit.team || null, id: hit.id ?? null, openPrice: opens[`${p.player}|${p.market}|${p.point}|${p.side}`] ?? null }
  }
  const payload = {
    found: true, away: game.away_team, home: game.home_team,
    edges: edges.map(withShot), lineShopOnly: lineShopOnly.map(withShot),
    creditsRemaining: credits.remaining,
    scannedAt: new Date().toISOString(),
  }
  await writeScan(ckSport, ckGame, payload, credits.remaining)
  await recordCredits(supa, credits.remaining)
  return { payload, served: 'live' }
  } finally {
    // Always free the single-flight lock, even on a thrown odds-API failure.
    await releaseLock(supa, lockKey)
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const full = String(req.query.full ?? '') === '1'
  // us_ex (Novig/exchanges) is ~1.5x the credit cost — only pulled on an explicit refresh (ex=1),
  // which also forces a fresh pull (bypasses the warmed us cache so REFRESH always adds exchanges).
  const ex = String(req.query.ex ?? '') === '1'
  const regions = ex ? ['us', 'us2', 'us_ex'] : ['us', 'us2']
  // cacheOnly: serve from cache only — NEVER spend credits. Opening a game uses this so just
  // browsing costs nothing; a fresh paid scan happens only on an explicit ↻ REFRESH (ex=1).
  const cacheOnly = String(req.query.cacheOnly ?? '') === '1'

  res.setHeader('Cache-Control', 'no-store')
  try {
    const { payload } = await scanGameProps({ sport, away, home, full, cacheOnly, force: ex, regions })
    return res.status(200).json(payload)
  } catch (e) {
    console.error('scan-props failed:', e.message)
    return res.status(502).json({ error: 'prop scan failed', detail: e.message })
  }
}
