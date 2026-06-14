// Derive a LIVE consensus two-way price for each market from the /api/game-lines response
// (the live multi-book paid feed). This is what makes Win Probability, Fair Value and the
// odds cards reflect the live market instead of the 15-min cron-written events.odds_* values.
//
// Consensus rule per outcome: prefer the SHARP book's price (Pinnacle de-vigs cleanest), and
// only at the modal line; otherwise the median price across reputable books on the modal line.
// Pure + deterministic so it's unit-testable.

const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

export function median(nums) {
  const a = (nums || []).filter(v => v != null).slice().sort((x, y) => x - y)
  const n = a.length
  if (!n) return null
  return n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2)
}

// One outcome's consensus american price within a compareBooks market ({outcomes, rows, modalPoint}).
export function consensusPrice(mkt, name) {
  if (!mkt || !mkt.rows) return null
  const mp = mkt.modalPoint ? mkt.modalPoint[name] : null
  const onLine = (r) => mp == null || r.points[name] === mp
  const sharp = mkt.rows.find(r => r.sharp && r.prices[name] != null && onLine(r))
  if (sharp) return sharp.prices[name]
  return median(mkt.rows.filter(r => r.prices[name] != null && onLine(r)).map(r => r.prices[name]))
}

// markets = { h2h, spreads, totals } from game-lines. Returns live consensus odds keyed
// to away/home (+ over/under), or nulls per market when not available.
export function liveConsensus(markets, away, home) {
  const out = { ml: null, spread: null, total: null }
  if (!markets) return out
  const nameFor = (mkt, team) => (mkt && mkt.outcomes) ? (mkt.outcomes.find(n => lw(n) === lw(team)) || null) : null

  const h2h = markets.h2h
  if (h2h) {
    const an = nameFor(h2h, away), hn = nameFor(h2h, home)
    const a = an && consensusPrice(h2h, an), h = hn && consensusPrice(h2h, hn)
    if (a != null && h != null) out.ml = { away: a, home: h }
  }
  const sp = markets.spreads
  if (sp) {
    const an = nameFor(sp, away), hn = nameFor(sp, home)
    const aj = an && consensusPrice(sp, an), hj = hn && consensusPrice(sp, hn)
    const point = hn && sp.modalPoint ? sp.modalPoint[hn] : null
    if (aj != null && hj != null) out.spread = { point, away: aj, home: hj }
  }
  const tot = markets.totals
  if (tot && tot.outcomes) {
    const on = tot.outcomes.find(n => /^o/i.test(n)), un = tot.outcomes.find(n => /^u/i.test(n))
    const oj = on && consensusPrice(tot, on), uj = un && consensusPrice(tot, un)
    const point = on && tot.modalPoint ? tot.modalPoint[on] : null
    if (oj != null && uj != null) out.total = { point, over: oj, under: uj }
  }
  return out
}
