// Sport-aware grouping of prop market keys into the category tabs shown on the game page.

const SPORT_CATEGORIES = {
  MLB: ['Strikeouts', 'Home Runs', 'Batter Props', 'Pitcher Props'],
  NBA: ['Points', 'Rebounds', 'Assists', 'Threes'],
  WNBA: ['Points', 'Rebounds', 'Assists', 'Threes'],
  NHL: ['Points', 'Shots', 'Goals', 'Saves'],
}

const MARKET_MAP = {
  MLB: {
    pitcher_strikeouts: 'Strikeouts',
    batter_home_runs: 'Home Runs',
    batter_hits: 'Batter Props',
    batter_total_bases: 'Batter Props',
    batter_rbis: 'Batter Props',
    batter_runs_scored: 'Batter Props',
    batter_stolen_bases: 'Batter Props',
    batter_walks: 'Batter Props',
    batter_singles: 'Batter Props',
    batter_doubles: 'Batter Props',
    batter_triples: 'Batter Props',
    batter_hits_runs_rbis: 'Batter Props',
    pitcher_outs: 'Pitcher Props',
    pitcher_earned_runs: 'Pitcher Props',
    pitcher_hits_allowed: 'Pitcher Props',
    pitcher_walks: 'Pitcher Props',
  },
  NBA: {
    player_points: 'Points',
    player_rebounds: 'Rebounds',
    player_assists: 'Assists',
    player_threes: 'Threes',
    player_points_rebounds_assists: 'Points',
    player_points_rebounds: 'Points',
    player_points_assists: 'Points',
    player_rebounds_assists: 'Rebounds',
    player_blocks: 'Points',
    player_steals: 'Points',
    player_turnovers: 'Points',
  },
  NHL: {
    player_points: 'Points',
    player_shots_on_goal: 'Shots',
    player_goals: 'Goals',
    player_total_saves: 'Saves',
    player_assists: 'Points',
    player_blocked_shots: 'Shots',
    player_power_play_points: 'Points',
  },
}
MARKET_MAP.WNBA = MARKET_MAP.NBA

const FALLBACK = { MLB: 'Batter Props', NBA: 'Points', WNBA: 'Points', NHL: 'Points' }

export function categoriesForSport(sport) {
  return SPORT_CATEGORIES[sport] || ['Props']
}

export function categoryOf(marketKey, sport) {
  const map = MARKET_MAP[sport]
  if (!map) return 'Props'
  return map[marketKey] || FALLBACK[sport] || 'Props'
}

export function groupPropsByCategory(rows, sport) {
  const out = {}
  for (const cat of categoriesForSport(sport)) out[cat] = []
  for (const r of rows || []) {
    const cat = categoryOf(r.market, sport)
    ;(out[cat] = out[cat] || []).push(r)
  }
  return out
}
