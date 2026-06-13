// Multi-book edge engine. Pure, no deps beyond devig.
//
// Input shape mirrors The Odds API (provider-agnostic — adapters normalize to this):
//   bookmakers: [{ key, title, markets: [{ key: 'h2h'|'spreads'|'totals',
//                  outcomes: [{ name, price /* american */, point? }] }] }]
//
// The sharp book (Pinnacle by default) is the ANCHOR: we de-vig ITS two-way market to
// get the honest "true" probability, then measure every other book's price against it.
// That is what makes EV here a real edge — not a single-book de-vig against itself.
import { americanToDecimal, devigTwoWay } from './devig.js'

export const SHARP_BOOK = 'pinnacle'

// Pull one bookmaker's market (e.g. pinnacle's h2h) from a game's bookmakers array.
export function getMarket(bookmakers, bookKey, marketKey) {
  const bk = (bookmakers || []).find(b => b.key === bookKey)
  if (!bk) return null
  return (bk.markets || []).find(m => m.key === marketKey) || null
}

// No-vig fair probabilities from the SHARP book's two-way market.
// Returns { [outcomeName]: fairProb } or null if the sharp book/market isn't a clean 2-way.
export function sharpFairProbs(bookmakers, marketKey, sharpBook = SHARP_BOOK) {
  const m = getMarket(bookmakers, sharpBook, marketKey)
  const outs = m?.outcomes
  if (!outs || outs.length !== 2) return null
  const dv = devigTwoWay(outs[0].price, outs[1].price)
  if (!dv) return null
  return { [outs[0].name]: dv.fairA, [outs[1].name]: dv.fairB, _hold: dv.holdPct }
}

// Best (most favorable to the bettor) price for one outcome across ALL books.
// Higher decimal = better payout. Returns { book, price, decimal } or null.
// `atPoint` matters for spreads/totals: a -5.5 and a -7.5 are DIFFERENT bets, so when a
// point is given we only compare books sitting on that same line (h2h passes null → all).
export function bestLine(bookmakers, marketKey, outcomeName, atPoint = null) {
  let best = null
  for (const b of bookmakers || []) {
    const m = (b.markets || []).find(x => x.key === marketKey)
    const o = m?.outcomes?.find(x => x.name === outcomeName)
    if (!o) continue
    if (atPoint != null && o.point !== atPoint) continue   // different line → not the same bet
    const dec = americanToDecimal(o.price)
    if (dec == null) continue
    if (!best || dec > best.decimal) best = { book: b.key, price: o.price, decimal: dec }
  }
  return best
}

// EV% of taking `american` when the true win prob is `fairProb`.
// EV% = (fairProb * decimalOdds - 1) * 100. Positive = +EV edge.
export function evPct(american, fairProb) {
  const dec = americanToDecimal(american)
  if (dec == null || fairProb == null) return null
  return (fairProb * dec - 1) * 100
}

// Full edge read for one market of one game: for each outcome, the sharp fair prob,
// the best line across books, and that best line's true EV vs the sharp anchor.
// Returns [] when the sharp book can't anchor the market (no honest baseline → no claim).
export function marketEdges(bookmakers, marketKey, sharpBook = SHARP_BOOK) {
  const fair = sharpFairProbs(bookmakers, marketKey, sharpBook)
  if (!fair) return []
  const sharpMkt = getMarket(bookmakers, sharpBook, marketKey)
  const isPointMarket = marketKey === 'spreads' || marketKey === 'totals'
  const names = Object.keys(fair).filter(k => k !== '_hold')
  return names.map(name => {
    // Anchor the comparison to the SHARP's line. On a point market (spread/total) a missing
    // point means we CANNOT honestly compare lines — refuse to claim an edge rather than
    // let a different line leak in as a fake +EV. Moneyline legitimately has no point.
    const point = sharpMkt?.outcomes?.find(o => o.name === name)?.point
    if (isPointMarket && point == null) {
      return { outcome: name, point: null, fairProb: fair[name], best: null, evPct: null, plusEV: false, sharpHoldPct: fair._hold }
    }
    const best = bestLine(bookmakers, marketKey, name, isPointMarket ? point : null)
    const ev = best ? evPct(best.price, fair[name]) : null
    return {
      outcome: name,
      point: point ?? null,       // spread/total line this edge sits on; null for ML
      fairProb: fair[name],
      best,                       // { book, price, decimal }
      evPct: ev,                  // true EV of the BEST available price vs sharp fair
      plusEV: ev != null && ev > 0,
      sharpHoldPct: fair._hold,
    }
  })
}
