// Pure helpers for the free guided prop builder. No React, no network.
import { PROP_MARKETS, labelFor } from './propMarkets.js'
import { resolveStat } from './statProgress.js'

// Scope player-search matches to the game the user is viewing. Match by TEAM ABBR — NOT the
// player-search game id — because ESPN's live scoreboard can roll to the next slate late at
// night, so its game ids won't line up with the events-table game on screen (this is why the
// game-scoped search came up empty). Falls back to all matches if neither team is in today's
// index, so the search never mysteriously empties.
export function scopeToGame(rows = [], game) {
  if (!game) return rows
  const aw = String(game.away_abbr || '').toUpperCase()
  const hm = String(game.home_abbr || '').toUpperCase()
  if (!aw && !hm) return rows
  const scoped = rows.filter(m => { const t = String(m.team || '').toUpperCase(); return t === aw || t === hm })
  return scoped.length ? scoped : rows
}

// Synthetic stat record with every key resolveStat reads, all set so any
// resolvable market returns a number. Markets resolveStat can't read (total
// bases, threes) return null here and are therefore excluded from the builder.
const SYNTH = {
  hits: 1, runs: 1, RBIs: 1, homeRuns: 1, walks: 1, strikeouts: 1, earnedRuns: 1,
  points: 1, rebounds: 1, assists: 1, steals: 1, blocks: 1, goals: 1,
  shotsTotal: 1, shots: 1, saves: 1,
}

// Markets the live box score can't truly read. resolveStat probes catch most
// (e.g. Total Bases returns null), but 'Threes' slips through because its label
// substring-collides with the home-run branch ('tHRees' -> hr), so it's listed
// explicitly here.
const UNTRACKABLE = new Set(['player_threes', 'batter_total_bases'])

// The stat options to offer for a sport = its basic prop markets, filtered to
// the ones the live box score can actually track. Returns [{ key, label }].
export function trackableStatOptions(sport) {
  const markets = PROP_MARKETS[String(sport || '').toUpperCase()] || []
  return markets
    .filter(key => !UNTRACKABLE.has(key) && resolveStat(SYNTH, labelFor(key)) != null)
    .map(key => ({ key, label: labelFor(key) }))
}

const sideWord = (s) => (String(s).toLowerCase() === 'under' ? 'Under' : 'Over')

// Assemble the canonical pick string + prop object the parents consume.
export function assembleProp({ player, side, line, statLabel, sport, event, odds = null }) {
  const pick = `${String(player).trim()} ${sideWord(side)} ${line} ${statLabel}`
  return {
    sport, event,
    player: String(player).trim(),
    stat: statLabel,
    side: String(side).toLowerCase() === 'under' ? 'under' : 'over',
    line: Number(line),
    odds: odds == null ? null : Number(odds),
    pick,
  }
}

// Map a prop market to the gamelog label token(s) used by /api/player-stats.
// Combo markets sum their components. Exact (case-insensitive) label match so
// 'H' never collides with 'HR'.
const STAT_TOKENS = {
  pitcher_strikeouts: ['K', 'SO'], batter_hits: ['H'], batter_home_runs: ['HR'],
  batter_rbis: ['RBI'], batter_walks: ['BB'],
  player_points: ['PTS'], player_rebounds: ['REB'], player_assists: ['AST'],
  player_points_rebounds_assists: ['PTS', 'REB', 'AST'],
  player_shots_on_goal: ['SOG', 'S'], player_goals: ['G'], player_total_saves: ['SV', 'SA'],
}

function sumTokens(entries, tokens) {
  if (!Array.isArray(entries)) return null
  let total = 0, hit = false
  for (const tok of tokens) {
    const e = entries.find(x => String(x.label).trim().toUpperCase() === tok)
    if (e != null) { total += Number(e.value) || 0; hit = true }
  }
  return hit ? total : null
}

// Returns { seasonPerGame, last5PerGame } or null if the stat isn't in the log.
// For combo markets (…_rebounds_assists) all tokens are summed; otherwise the
// first token that exists wins (so 'H' vs 'HR' never collide).
export function pickStatValue(resp, market) {
  if (!resp || !resp.found) return null
  const tokens = STAT_TOKENS[market]
  if (!tokens) return null
  const isCombo = market.endsWith('_rebounds_assists')
  const valueFor = (entries) => {
    if (isCombo) return sumTokens(entries, tokens)
    for (const tok of tokens) { const v = sumTokens(entries, [tok]); if (v != null) return v }
    return null
  }
  const seasonTotal = valueFor(resp.season)
  if (seasonTotal == null) return null
  const last5Total = valueFor(resp.last5)
  const games = resp.games || 1
  const l5g = resp.last5games || 0
  return {
    seasonPerGame: seasonTotal / games,
    last5PerGame: l5g ? (last5Total ?? 0) / l5g : null,
  }
}
