// Pure pick/filter logic for the model-prop snapshot loop (WNBA/NBA/NHL — the PHLT siblings).
// Two jobs, both pure so they're testable without a DB or network:
//   1. pickPropPerPlayer — from a game's cached prop rows, choose ONE prop per player to score:
//      prefer the sport's PRIMARY market (points for basketball, shots-on-goal for NHL); among
//      rows of the same market, take the highest evPct. Same logic as the MatrixBot dispatch.
//   2. topModelPicks — from a verdicts map, keep the top non-faded A/B/C picks (score >= minScore),
//      sorted by score desc and capped per game — same volume discipline as cron-snapshot-phlt.

// The market each sport's model treats as primary (the one a per-player verdict should score).
export const PRIMARY_MARKET = {
  WNBA: 'player_points',
  NBA: 'player_points',
  NBASL: 'player_points',   // Summer League games route through the NBA model
  NHL: 'player_shots_on_goal',
  NFL: 'player_pass_yds',   // the highest-volume modeled football market
}

// rows: [{ player, market, point, evPct, ... }] → { [player]: chosenRow }
// Preference: primary market first; within the same market, highest evPct (null evPct loses).
export function pickPropPerPlayer(rows, primaryMarket) {
  const pick = {}
  for (const p of rows || []) {
    if (!p?.player) continue
    const c = pick[p.player]
    const better = !c ||
      ((p.market === primaryMarket) - (c.market === primaryMarket)) > 0 ||
      (p.market === c.market && (p.evPct ?? -99) > (c.evPct ?? -99))
    if (better) pick[p.player] = p
  }
  return pick
}

// verdicts: { [player]: { score, tier, faded, ... } } → { top: [{ player, v }], dropped }
// Keeps non-faded picks whose tier is allowed and score >= minScore, score-desc, capped.
export function topModelPicks(verdicts, { minScore = 52, topPerGame = 8, tiers = new Set(['A', 'B', 'C']) } = {}) {
  const picks = Object.entries(verdicts || {})
    .map(([player, v]) => ({ player, v }))
    .filter(({ v }) => v && !v.faded && tiers.has(String(v.tier)) && Number(v.score) >= minScore)
    .sort((a, b) => Number(b.v.score) - Number(a.v.score))
  const dropped = Math.max(0, picks.length - topPerGame)
  return { top: picks.slice(0, topPerGame), dropped }
}
