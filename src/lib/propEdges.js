// Sharp-anchored player-prop edges for ONE game. Props are 2-way (Over/Under a line);
// we group by player+line, de-vig the Pinnacle pair for true probs, then find the best
// reputable-book price and its EV. No Pinnacle pair → line-shop only (no EV claim).
import { devigTwoWay, americanToDecimal } from './devig.js'
import { evPct, SHARP_BOOK } from './oddsEdge.js'
import { REPUTABLE_BOOKS, DEFAULTS, isCredibleEdge } from './edgeFilter.js'
import { labelFor } from './propMarkets.js'

const groupKey = (player, point) => `${player}__${point}`

// Collect every (player, point, side) quote across reputable books for one market.
// → Map key → { player, point, sides: { Over: [{book,price,link}], Under: [...] } }
function collect(bookmakers, marketKey, nowMs, opts) {
  const { maxStaleMin } = { ...DEFAULTS, ...opts }
  const cutoff = nowMs - maxStaleMin * 60_000
  const groups = new Map()
  for (const b of bookmakers || []) {
    if (!REPUTABLE_BOOKS.has(b.key)) continue
    if (b.last_update != null) { const t = Date.parse(b.last_update); if (!Number.isNaN(t) && t < cutoff) continue }
    const m = (b.markets || []).find(x => x.key === marketKey)
    if (!m) continue
    for (const o of m.outcomes || []) {
      const player = o.description, side = o.name, point = o.point
      if (!player || (side !== 'Over' && side !== 'Under') || point == null) continue
      const key = groupKey(player, point)
      if (!groups.has(key)) groups.set(key, { player, point, sides: { Over: [], Under: [] } })
      groups.get(key).sides[side].push({ book: b.key, price: o.price, link: o.link ?? null })
    }
  }
  return groups
}

// Best (highest decimal) quote for a side across books.
function bestOf(quotes) {
  let best = null
  for (const q of quotes || []) {
    const d = americanToDecimal(q.price)
    if (d == null) continue
    if (!best || d > best.decimal) best = { book: q.book, price: q.price, link: q.link, decimal: d }
  }
  return best
}

export function propEdges(event, marketKeys, nowMs, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  if (o.preGameOnly && event?.commence_time != null) {
    const start = Date.parse(event.commence_time)
    if (!Number.isNaN(start) && start <= nowMs) return { edges: [], lineShopOnly: [] }
  }
  const edges = [], lineShopOnly = []
  for (const marketKey of marketKeys || []) {
    const groups = collect(event?.bookmakers, marketKey, nowMs, o)
    for (const { player, point, sides } of groups.values()) {
      const bestOver = bestOf(sides.Over), bestUnder = bestOf(sides.Under)
      // Sharp anchor: Pinnacle's own Over+Under for this player+line.
      const pinOver  = sides.Over.find(q => q.book === SHARP_BOOK)
      const pinUnder = sides.Under.find(q => q.book === SHARP_BOOK)
      const dv = (pinOver && pinUnder) ? devigTwoWay(pinOver.price, pinUnder.price) : null
      const base = { player, market: marketKey, marketLabel: labelFor(marketKey), point }
      if (dv) {
        const sharpHoldPct = dv.holdPct
        for (const [side, best, fairProb] of [['Over', bestOver, dv.fairA], ['Under', bestUnder, dv.fairB]]) {
          if (!best) continue
          const ev = evPct(best.price, fairProb)
          const edge = { ...base, side, best: { book: best.book, price: best.price, link: best.link }, fairProb, sharpHoldPct, evPct: ev }
          if (isCredibleEdge({ evPct: ev }, o)) edges.push(edge)
        }
      } else {
        for (const [side, best] of [['Over', bestOver], ['Under', bestUnder]]) {
          if (!best) continue
          lineShopOnly.push({ ...base, side, best: { book: best.book, price: best.price, link: best.link } })
        }
      }
    }
  }
  edges.sort((a, b) => b.evPct - a.evPct)
  return { edges, lineShopOnly }
}
