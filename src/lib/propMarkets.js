// Curated, liquid player-prop markets per sport ("all props" = this set, extendable).
export const PROP_MARKETS = {
  MLB:  ['pitcher_strikeouts', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_walks'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_total_saves'],
}

export const MARKET_LABELS = {
  pitcher_strikeouts: 'Strikeouts', batter_hits: 'Hits', batter_total_bases: 'Total Bases',
  batter_home_runs: 'Home Runs', batter_rbis: 'RBIs', batter_walks: 'Walks',
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
  player_threes: 'Threes', player_points_rebounds_assists: 'Pts+Reb+Ast',
  player_shots_on_goal: 'Shots on Goal', player_goals: 'Goals', player_total_saves: 'Saves',
}

export const labelFor = (key) => MARKET_LABELS[key] || key
