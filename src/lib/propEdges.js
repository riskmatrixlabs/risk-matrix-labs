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

// No Pinnacle? Build a fair line from the MARKET CONSENSUS: de-vig each book that prices BOTH
// sides, then average the fair Over prob across books. Less sharp than Pinnacle (books carry
// bias) but a real "is it priced well?" signal from data we already paid for. Needs ≥2 two-way books.
function consensusFair(sides) {
  const over = {}, under = {}
  for (const q of sides.Over || []) over[q.book] = q.price
  for (const q of sides.Under || []) under[q.book] = q.price
  const fairs = []
  for (const book of Object.keys(over)) {
    if (under[book] == null) continue
    const dv = devigTwoWay(over[book], under[book])
    if (dv && dv.fairA != null) fairs.push(dv.fairA)
  }
  if (fairs.length < 2) return null
  const fairOver = fairs.reduce((s, v) => s + v, 0) / fairs.length
  return { fairOver, fairUnder: 1 - fairOver, books: fairs.length }
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
      // every book's price for a side → powers the Bet Matrix line-shop page for props
      const bb = (s) => Object.fromEntries((sides[s] || []).filter(q => q.price != null).map(q => [q.book, q.price]))
      // every book's DEEP bet-slip link (when the feed carries one) → line-shop can place on any book
      const bbLink = (s) => Object.fromEntries((sides[s] || []).filter(q => q.price != null && q.link).map(q => [q.book, q.link]))
      if (dv) {
        const sharpHoldPct = dv.holdPct
        for (const [side, best, fairProb] of [['Over', bestOver, dv.fairA], ['Under', bestUnder, dv.fairB]]) {
          if (!best) continue
          const ev = evPct(best.price, fairProb)
          const edge = { ...base, side, best: { book: best.book, price: best.price, link: best.link }, byBook: bb(side), byBookLink: bbLink(side), fairProb, sharpHoldPct, evPct: ev }
          if (isCredibleEdge({ evPct: ev }, o)) edges.push(edge)
        }
      } else {
        // No sharp anchor → consensus de-vig edge from all books (capped 1%–15% to reject noise/errors).
        const cons = consensusFair(sides)
        for (const [side, best, fairP] of [['Over', bestOver, cons?.fairOver], ['Under', bestUnder, cons?.fairUnder]]) {
          if (!best) continue
          const row = { ...base, side, best: { book: best.book, price: best.price, link: best.link }, byBook: bb(side), byBookLink: bbLink(side) }
          if (cons && fairP != null) {
            const ev = evPct(best.price, fairP)
            if (ev != null && ev >= 1 && ev <= 15) { edges.push({ ...row, fairProb: fairP, evPct: ev, consensus: true, consensusBooks: cons.books }); continue }
          }
          lineShopOnly.push(row)
        }
      }
    }
  }
  edges.sort((a, b) => b.evPct - a.evPct)
  return { edges, lineShopOnly }
}
