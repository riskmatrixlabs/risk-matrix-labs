// Pure split/tally helpers for api/lean-record.js — extracted so the record math is unit-testable.
//
// lean_results now carries NFL SHADOW rows (sport 'NFL', market 'rl', model 'nfl-shadow-v0')
// alongside the MLB rows. Every EXISTING response field (all/strong/team/ml/rl/games) must stay
// computed from non-NFL rows only, so graded NFL rows can never pollute the MLB Run Line record.
// The NFL shadow record is exposed separately (the `nfl` block).

export function tally(rows) {
  const r = { w: 0, l: 0, p: 0, pending: 0 }
  for (const x of rows) {
    if (x.result === 'W') r.w++
    else if (x.result === 'L') r.l++
    else if (x.result === 'P') r.p++
    else r.pending++
  }
  return r
}

export const isNfl = (r) => String(r.sport || '').toUpperCase() === 'NFL'
export const isNhl = (r) => String(r.sport || '').toUpperCase() === 'NHL'
// Shadow-model sports — their rows must never pollute the MLB-facing sets.
export const isShadowSport = (r) => isNfl(r) || isNhl(r)

// Team ML/RL had a home-field-advantage bug fixed Jun 22 ET. Only COUNT graded ML/RL games from
// the next slate forward so the broken version's losses don't pollute the record. O/U was
// unaffected (HFA doesn't touch totals) → it counts all.
export const ML_FIX_DATE = '2026-06-23'

// rows → the market splits lean-record serves. All MLB-facing sets exclude the shadow
// sports (NFL + NHL); nflRl = NFL rl rows, nflTotals / nhlTotals = each shadow totals record.
export function splitLeanRows(rows) {
  const base = rows.filter(r => !isShadowSport(r))
  const totals = base.filter(r => (r.market || 'total') === 'total')
  const mlAll = base.filter(r => r.market === 'ml')
  const rlAll = base.filter(r => r.market === 'rl')
  const mlRows = mlAll.filter(r => r.game_date >= ML_FIX_DATE)
  const rlRows = rlAll.filter(r => r.game_date >= ML_FIX_DATE)
  const teamRows = [...mlAll, ...rlAll]
  const strong = totals.filter(r => r.strong)
  const nflRl = rows.filter(r => isNfl(r) && r.market === 'rl')
  const nflTotals = rows.filter(r => isNfl(r) && (r.market || 'total') === 'total')
  const nhlTotals = rows.filter(r => isNhl(r) && (r.market || 'total') === 'total')
  return { totals, mlAll, rlAll, mlRows, rlRows, teamRows, strong, nflRl, nflTotals, nhlTotals }
}
