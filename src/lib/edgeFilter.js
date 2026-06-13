// The quality filter — the part that makes multi-book edges CREDIBLE instead of garbage.
// Raw best-line-across-all-books surfaces stale/offshore mirages (+400% "edges").
// This layer enforces: reputable books only, sane EV cap, line freshness, and
// pre-game-only (a live game's stale pre-match line is not a real edge).
//
// Everything here is pure: pass `nowMs` in so it's deterministic and testable.
import { marketEdges, SHARP_BOOK } from './oddsEdge.js'
import { americanToDecimal } from './devig.js'

// Books we trust to price honestly + settle. Pinnacle stays (it's the sharp ANCHOR,
// even though we rarely bet it). Hard Rock included — the owner bets there.
export const REPUTABLE_BOOKS = new Set([
  'pinnacle',
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'williamhill_us',
  'betrivers', 'espnbet', 'fanatics', 'hardrockbet',
  'betfair_ex_us', 'betfair_ex_eu',
])

export const DEFAULTS = {
  minEvPct: 1,        // ignore sub-1% noise
  maxEvPct: 15,       // anything above this is almost always a stale/error line, not alpha
  maxStaleMin: 10,    // a book's price must be updated within this many minutes
  preGameOnly: true,  // skip games that have already started
}

// Keep only reputable books whose price was updated recently (drops stale lines).
export function filterBooks(bookmakers, nowMs, opts = {}) {
  const { maxStaleMin } = { ...DEFAULTS, ...opts }
  const cutoff = nowMs - maxStaleMin * 60_000
  return (bookmakers || []).filter(b => {
    if (!REPUTABLE_BOOKS.has(b.key)) return false
    if (b.last_update == null) return true            // no timestamp → don't penalize
    const t = Date.parse(b.last_update)
    return Number.isNaN(t) ? true : t >= cutoff
  })
}

// Is this edge worth surfacing? Within [minEv, maxEv] and actually +EV.
export function isCredibleEdge(edge, opts = {}) {
  const { minEvPct, maxEvPct } = { ...DEFAULTS, ...opts }
  return edge.evPct != null && edge.evPct >= minEvPct && edge.evPct <= maxEvPct
}

// Credible edges for ONE game's market. Returns [] when filtered out or no sharp anchor.
export function gameEdges(game, marketKey, nowMs, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  if (o.preGameOnly && game.commence_time != null) {
    const start = Date.parse(game.commence_time)
    if (!Number.isNaN(start) && start <= nowMs) return []   // game live/done → skip
  }
  const books = filterBooks(game.bookmakers, nowMs, o)
  return marketEdges(books, marketKey, o.sharpBook || SHARP_BOOK)
    .filter(e => isCredibleEdge(e, o))
    .map(e => ({
      ...e,
      sport: game.sport_key,
      away: game.away_team,
      home: game.home_team,
      commenceTime: game.commence_time,
      market: marketKey,
    }))
}

// Line-shopping comparison: every reputable book's price for one market of one game,
// with the best price per outcome flagged and the sharp book marked. Powers the
// "Odds Comparison" card (the Pikkit book-chips view).
export function compareBooks(bookmakers, marketKey, opts = {}) {
  const { whitelist = REPUTABLE_BOOKS, sharpBook = SHARP_BOOK } = opts
  const books = (bookmakers || []).filter(b => whitelist.has(b.key) && (b.markets || []).some(m => m.key === marketKey))
  if (!books.length) return null
  const ref = (books.find(b => b.key === sharpBook) || books[0]).markets.find(m => m.key === marketKey)
  const outcomes = ref.outcomes.map(o => o.name)

  const rows = books.map(b => {
    const m = b.markets.find(x => x.key === marketKey)
    const prices = {}, points = {}
    for (const name of outcomes) {
      const o = m.outcomes.find(x => x.name === name)
      prices[name] = o ? o.price : null
      points[name] = (o && o.point != null) ? o.point : null   // spread/total line; null for moneyline
    }
    return { book: b.key, sharp: b.key === sharpBook, prices, points }
  })

  // Most common line per outcome — comparing prices across DIFFERENT points is invalid,
  // so "best" is only crowned among books sitting on this modal line.
  const modalPoint = {}
  for (const name of outcomes) {
    const counts = {}
    for (const r of rows) { const p = r.points[name]; if (p != null) counts[p] = (counts[p] || 0) + 1 }
    const keys = Object.keys(counts)
    modalPoint[name] = keys.length ? Number(keys.reduce((a, b) => counts[b] > counts[a] ? b : a)) : null
  }

  const best = {}
  for (const name of outcomes) {
    let bb = null
    for (const r of rows) {
      const p = r.prices[name]
      if (p == null) continue
      if (modalPoint[name] != null && r.points[name] !== modalPoint[name]) continue  // off the main line → not eligible
      const d = americanToDecimal(p)
      if (d == null) continue
      if (!bb || d > bb.decimal) bb = { book: r.book, price: p, decimal: d }
    }
    best[name] = bb
  }
  return { outcomes, rows, modalPoint, best }
}

// Scan many games → all credible edges, highest EV first.
export function scanEdges(games, marketKey, nowMs, opts = {}) {
  return (games || [])
    .flatMap(g => gameEdges(g, marketKey, nowMs, opts))
    .sort((a, b) => b.evPct - a.evPct)
}
