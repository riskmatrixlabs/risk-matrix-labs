// Pure aggregation helpers for the All-Time Performance page (and shared with Spotlight's
// record matrix). No I/O — every fn takes plain graded rows and returns numbers/strings.
// Mirrors the inline helpers in SpotlightTicker.jsx + lean-record.js conventions:
//  - win% EXCLUDES pushes from the denominator (propRecord.winPct)
//  - the ML/RL HFA-bug reset: ml/rl rows before 2026-06-23 are dropped (lean-record.js:43)

// ML/RL records reset at the home-field-advantage fix; older broken rows must not count.
const ML_FIX_DATE = '2026-06-23'

// "W-L-P" string; pushes omitted when p === 0 (e.g. "12-8" vs "12-8-1").
export function fmtRec({ w = 0, l = 0, p = 0 } = {}) {
  return p ? `${w}-${l}-${p}` : `${w}-${l}`
}

// Rounded integer win% with pushes excluded; null when no graded W/L decisions.
export function winPct(w = 0, l = 0) {
  const denom = w + l
  if (denom < 1) return null
  return Math.round((w / denom) * 100)
}

// Merge any number of {w,l,p} records into one.
export function sumRec(...recs) {
  return recs.reduce(
    (acc, r) => ({
      w: acc.w + (r?.w || 0),
      l: acc.l + (r?.l || 0),
      p: acc.p + (r?.p || 0),
    }),
    { w: 0, l: 0, p: 0 },
  )
}

// Tally W/L/P over a set of rows (internal).
function tally(rows) {
  const r = { w: 0, l: 0, p: 0 }
  for (const x of rows) {
    if (x.result === 'W') r.w++
    else if (x.result === 'L') r.l++
    else if (x.result === 'P') r.p++
  }
  return r
}

// Filter graded rows by the page's settings.
//  model: 'all' | 'total' | 'ml' | 'rl' | 'phlt' (phlt = rows that carry a phlt_tier)
//  strong: keep only rows where row.strong is truthy
//  sport: case-insensitive match on row.sport
//  from/to: inclusive game_date window (YYYY-MM-DD string compare)
export function applyFilters(rows = [], { model = 'all', strong = false, sport = 'all', from = null, to = null } = {}) {
  return rows.filter((r) => {
    // ML/RL reset gate — drop broken pre-fix rows regardless of the model filter.
    if ((r.market === 'ml' || r.market === 'rl') && r.game_date < ML_FIX_DATE) return false

    if (model === 'phlt') {
      if (!r.phlt_tier) return false
    } else if (model === 'total') {
      // Totals only: exclude ml/rl AND prop rows (props carry a phlt_tier, no market).
      if (r.phlt_tier) return false
      if ((r.market || 'total') !== 'total') return false
    } else if (model === 'ml' || model === 'rl') {
      if (r.market !== model) return false
    } // 'all' → no model constraint

    if (strong && !r.strong) return false

    if (sport && sport !== 'all') {
      if ((r.sport || '').toLowerCase() !== sport.toLowerCase()) return false
    }

    if (from && r.game_date < from) return false
    if (to && r.game_date > to) return false

    return true
  })
}

// American-odds price → decimal-minus-1 units won on a W (flat 1u staked).
function americanToProfit(american) {
  const a = Number(american)
  if (!Number.isFinite(a) || a === 0) return null
  return a > 0 ? a / 100 : 100 / -a
}

// Flat-1u model: W wins (dec-1) units, L loses 1u, P is 0. Uses a per-row stored price
// (pick_side price / odds) when present, else priceDefault (-110 for O/U & props).
export function unitsRoi(rows = [], { priceDefault = -110 } = {}) {
  let units = 0
  let decisions = 0
  for (const r of rows) {
    if (r.result === 'W') {
      const price = r.price ?? r.odds ?? (r.pick_side && typeof r.pick_side === 'object' ? r.pick_side.price : null) ?? priceDefault
      const profit = americanToProfit(price)
      units += profit == null ? (americanToProfit(priceDefault) || 0) : profit
      decisions++
    } else if (r.result === 'L') {
      units -= 1
      decisions++
    } // P → 0, not a decision
  }
  const roi = decisions > 0 ? (units / decisions) * 100 : 0
  return { units: Math.round(units * 100) / 100, roi: Math.round(roi * 10) / 10 }
}

// Mean of non-null numeric clv across rows, rounded 2dp; null if none.
export function avgClv(rows = []) {
  const vals = rows.map(r => r.clv).filter(v => v != null && Number.isFinite(Number(v))).map(Number)
  if (!vals.length) return null
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.round(mean * 100) / 100
}

// Per-day series for the win%-over-time chart, sorted ascending by date.
export function dailySeries(rows = []) {
  const byDate = {}
  for (const r of rows) {
    const d = r.game_date
    if (!d) continue
    ;(byDate[d] ??= []).push(r)
  }
  return Object.keys(byDate).sort().map((date) => {
    const { w, l, p } = tally(byDate[date])
    return { date, w, l, p, winPct: winPct(w, l) }
  })
}
