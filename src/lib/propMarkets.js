// Curated, liquid player-prop markets per sport ("all props" = this set, extendable).
export const PROP_MARKETS = {
  MLB:  ['pitcher_strikeouts', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_walks'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_total_saves'],
}
// NBA Summer League shares NBA's prop markets.
PROP_MARKETS.NBASL = PROP_MARKETS.NBA

// Expanded, opt-in prop-market set per sport (served only when a caller passes ?full=1).
export const PROP_MARKETS_FULL = {
  MLB:  ['pitcher_strikeouts', 'pitcher_outs', 'pitcher_earned_runs', 'pitcher_hits_allowed', 'pitcher_walks', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_runs_scored', 'batter_singles', 'batter_doubles', 'batter_triples', 'batter_walks', 'batter_stolen_bases', 'batter_hits_runs_rbis'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists', 'player_blocks', 'player_steals', 'player_turnovers', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists', 'player_blocks', 'player_steals', 'player_turnovers', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_assists', 'player_total_saves', 'player_blocked_shots', 'player_power_play_points'],
}
PROP_MARKETS_FULL.NBASL = PROP_MARKETS_FULL.NBA

export const MARKET_LABELS = {
  pitcher_strikeouts: 'Strikeouts', batter_hits: 'Hits', batter_total_bases: 'Total Bases',
  batter_home_runs: 'Home Runs', batter_rbis: 'RBIs', batter_walks: 'Walks',
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
  player_threes: 'Threes', player_points_rebounds_assists: 'Pts+Reb+Ast',
  player_shots_on_goal: 'Shots on Goal', player_goals: 'Goals', player_total_saves: 'Saves',
  pitcher_outs: 'Outs', pitcher_earned_runs: 'Earned Runs', pitcher_hits_allowed: 'Hits Allowed',
  batter_runs_scored: 'Runs', batter_singles: 'Singles', batter_doubles: 'Doubles',
  batter_triples: 'Triples', batter_stolen_bases: 'Stolen Bases', batter_hits_runs_rbis: 'Hits+Runs+RBIs',
  player_blocks: 'Blocks', player_steals: 'Steals', player_turnovers: 'Turnovers',
  player_points_rebounds: 'Pts+Reb', player_points_assists: 'Pts+Ast', player_rebounds_assists: 'Reb+Ast',
  player_assists: 'Assists', player_blocked_shots: 'Blocked Shots', player_power_play_points: 'PP Points',
}

export const labelFor = (key) => MARKET_LABELS[key] || key
