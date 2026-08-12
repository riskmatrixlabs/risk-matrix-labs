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
export const isWnba = (r) => String(r.sport || '').toUpperCase() === 'WNBA'
// NBA covers Summer League ('NBASL') too — the same 'nba-total-shadow-v0' model produces
// both, and the record is read as one NBA shadow record. 'WNBA' must NOT match.
export const isNba = (r) => ['NBA', 'NBASL'].includes(String(r.sport || '').toUpperCase())
// Shadow-model sports — their rows must never pollute the MLB-facing sets. WNBA is NOT a
// blanket shadow sport (it has legitimate prop rows — in prop_results, a different table):
// its lean_results shadow rows are excluded by model_version instead (isShadowModel).
export const isShadowSport = (r) => isNfl(r) || isNhl(r)
// Any shadow model row, sport-agnostic — '-shadow-' is stamped in every shadow
// model_version ('nfl-shadow-v0', 'nfl-total-shadow-v0', 'nhl-total-shadow-v0',
// 'wnba-total-shadow-v0'). Excluded from the MLB-facing sets alongside the shadow sports.
export const isShadowModel = (r) => /-shadow-|-shadow$/.test(String(r.model_version || ''))

// Team ML/RL had a home-field-advantage bug fixed Jun 22 ET. Only COUNT graded ML/RL games from
// the next slate forward so the broken version's losses don't pollute the record. O/U was
// unaffected (HFA doesn't touch totals) → it counts all.
export const ML_FIX_DATE = '2026-06-23'

// rows → the market splits lean-record serves. All MLB-facing sets exclude the shadow
// sports (NFL + NHL); nflRl = NFL rl rows, nflTotals / nhlTotals = each shadow totals record.
export function splitLeanRows(rows) {
  const base = rows.filter(r => !isShadowSport(r) && !isShadowModel(r))
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
  const wnbaTotals = rows.filter(r => isWnba(r) && isShadowModel(r) && (r.market || 'total') === 'total')
  // Shadow MONEYLINE splits — ml picks derived from the same shadow totals projections
  // ('wnba-total-shadow-v0' / 'nhl-total-shadow-v0'). Keyed sport + shadow model + market
  // 'ml' so a future non-shadow ml row for either sport can never be mistaken for these.
  const wnbaMl = rows.filter(r => isWnba(r) && isShadowModel(r) && r.market === 'ml')
  const nhlMl = rows.filter(r => isNhl(r) && isShadowModel(r) && r.market === 'ml')
  // NBA (incl. Summer League) shadow splits — same posture as WNBA: NBA is NOT a blanket
  // shadow sport (it has legitimate prop rows in prop_results), so these are keyed on
  // sport + '-shadow-' model_version + market.
  const nbaTotals = rows.filter(r => isNba(r) && isShadowModel(r) && (r.market || 'total') === 'total')
  const nbaMl = rows.filter(r => isNba(r) && isShadowModel(r) && r.market === 'ml')
  // NFL MONEYLINE — the explicit ML call ('nfl-shadow-v0'), separate from the SPREAD lean
  // that snapshots as market 'rl'. NFL is already a blanket shadow sport, so nothing here
  // can reach the MLB-facing sets.
  const nflMl = rows.filter(r => isNfl(r) && r.market === 'ml')
  return { totals, mlAll, rlAll, mlRows, rlRows, teamRows, strong, nflRl, nflTotals, nhlTotals, wnbaTotals, wnbaMl, nhlMl, nbaTotals, nbaMl, nflMl }
}

// Per-game DISPLAY map for today + yesterday, keyed by external_event_id, so a card can grade
// EVERY call it showed. This is NOT a record tally — it must include the SHADOW rows (NFL/NHL/
// WNBA), otherwise a graded shadow lean could never reach a card chip. The record splits above
// stay shadow-free (record purity); this map deliberately does not.
//   top-level = the TOTALS lean (back-compat with the MLB O/U flag)
//   .ml / .rl = the team calls' grades
// A game is one sport, and the map is keyed per game, so shadow rows can't contaminate an MLB
// entry. Rows are consumed newest-first (the caller orders by game_date desc); later rows for
// the same id only fill what an earlier row already set, matching the previous Object.assign order.
export function buildGamesMap(rows, today, yesterday) {
  const games = {}
  const ensure = (id) => (games[id] ??= {})
  const inWindow = (r) => r.game_date === today || r.game_date === yesterday
  for (const r of rows) {
    if (!inWindow(r)) continue
    if ((r.market || 'total') !== 'total') continue
    Object.assign(ensure(r.external_event_id), {
      lean: r.lean, line: r.total_line, strong: r.strong,
      result: r.result || null, finalTotal: r.final_total ?? null, date: r.game_date,
      closingLine: r.closing_line ?? null, clv: r.clv ?? null,
    })
  }
  for (const r of rows) {
    if (!inWindow(r)) continue
    if (r.market !== 'ml' && r.market !== 'rl') continue
    ensure(r.external_event_id)[r.market] = { pick: r.pick_side || r.lean || null, result: r.result || null, date: r.game_date }
  }
  return games
}
