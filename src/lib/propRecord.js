// Pure tally helper for the PHLT prop track record (Plan A, record side).
// Counts W/L/P from graded prop_results rows and computes win% with pushes
// EXCLUDED from the denominator. Used by api/prop-record.js.

const TIER_KEYS = { A: 'A', B: 'B', C: 'C' } // AVOID/null tiers are ignored in byTier

function winPct(w, l) {
  const denom = w + l
  if (denom <= 0) return null
  return Math.round((w / denom) * 100)
}

// Count W/L/P across a set of rows.
function count(rows) {
  const r = { w: 0, l: 0, p: 0 }
  for (const x of rows) {
    if (x.result === 'W') r.w++
    else if (x.result === 'L') r.l++
    else if (x.result === 'P') r.p++
  }
  return r
}

// rows: graded prop_results (result in W/L/P). today/yesterday: ET date strings.
export function tallyProps(rows = [], { today = null, yesterday = null } = {}) {
  const overall = count(rows)
  const n = overall.w + overall.l + overall.p

  const byTier = {}
  for (const key of Object.values(TIER_KEYS)) {
    const c = count(rows.filter(r => r.phlt_tier === key))
    byTier[key] = { ...c, winPct: winPct(c.w, c.l) }
  }

  const today_ = count(rows.filter(r => r.game_date === today))
  const yesterday_ = count(rows.filter(r => r.game_date === yesterday))

  return {
    overall: { ...overall, n, winPct: winPct(overall.w, overall.l) },
    byTier,
    today: today_,
    yesterday: yesterday_,
  }
}

export { winPct }
