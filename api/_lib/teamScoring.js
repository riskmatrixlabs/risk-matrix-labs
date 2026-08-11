// Pure derivation of a team's goals scored / conceded per game from our OWN synced final
// events (same pattern as sogAllowed.js, generalized to the score columns every final row
// carries). Real synced data, never a fabricated input.
//
// scoredAvg(rows, team)   = mean of the team's OWN final score over its recent finals
// concededAvg(rows, team) = mean of the OPPOSING side's final score over the same window
//
// Window: last ≤ MAX_GAMES usable finals; FAIL-SOFT: fewer than MIN_GAMES → null (no lean),
// never a filler. A score of 0 is a real, usable value (unlike sog, shutouts happen).

const MIN_GAMES = 5
const MAX_GAMES = 15

const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
// Number(null) === 0 would turn a MISSING score into a fake shutout — guard nullish first.
const toNum = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const avg = (vals) => (vals.length < MIN_GAMES) ? null : +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)

// rows: completed events involving `team` (newest first), each { away_team, home_team, away_score, home_score }.
// pick(r, isHome) → the score to count for that row.
function collect(rows, team, pick) {
  const t = lw(team)
  const vals = []
  for (const r of rows || []) {
    if (vals.length >= MAX_GAMES) break
    let v = null
    if (lw(r?.home_team) === t) v = pick(r, true)
    else if (lw(r?.away_team) === t) v = pick(r, false)
    if (v != null && v >= 0) vals.push(v)
  }
  return avg(vals)
}

export function scoredAvg(rows, team) {
  return collect(rows, team, (r, isHome) => toNum(isHome ? r.home_score : r.away_score))
}

export function concededAvg(rows, team) {
  return collect(rows, team, (r, isHome) => toNum(isHome ? r.away_score : r.home_score))
}
