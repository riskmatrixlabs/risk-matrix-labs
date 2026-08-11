// Pure derivation of a team's shots-on-goal ALLOWED per game from our OWN synced events table.
// The NHL sync (parseTeamStats) writes each side's box-score sog (shots FOR) into
// metadata.away_team_stats / metadata.home_team_stats on every completed game. A team's shots
// ALLOWED in one game is therefore the OPPOSING side's sog in that row — real synced data, not
// a fabricated input. Averaging that over the team's recent completed games gives the shots it
// concedes per game (the opponentSogAllowed input; nhlVerdict normalizes it vs the ~30 ref).
// FAIL-SOFT: fewer than MIN_GAMES usable rows → null (no verdict), never a filler.

const MIN_GAMES = 3
const MAX_GAMES = 10

const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const toNum = (v) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : null }

// rows: completed events involving `team` (newest first), each { away_team, home_team, metadata }.
// Returns the mean sog conceded by `team` over its last MAX_GAMES usable rows, or null (<MIN_GAMES).
export function concededSogAvg(rows, team) {
  const t = lw(team)
  const vals = []
  for (const r of rows || []) {
    if (vals.length >= MAX_GAMES) break
    const m = r?.metadata || {}
    let oppSog = null
    if (lw(r?.home_team) === t) oppSog = toNum(m.away_team_stats?.sog)      // team was home → conceded away's sog
    else if (lw(r?.away_team) === t) oppSog = toNum(m.home_team_stats?.sog) // team was away → conceded home's sog
    if (oppSog != null && oppSog > 0) vals.push(oppSog)
  }
  if (vals.length < MIN_GAMES) return null
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
}
