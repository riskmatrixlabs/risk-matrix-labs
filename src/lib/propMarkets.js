// Curated, liquid player-prop markets per sport ("all props" = this set, extendable).
export const PROP_MARKETS = {
  MLB:  ['pitcher_strikeouts', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_walks'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_total_saves'],
  // NFL — the liquid core. Keys verified against The Odds API betting-markets docs (2026-08-12);
  // note the provider's abbreviations: pass/rush yards are `_yds` and receiving yards are
  // `player_reception_yds` (NOT `player_receiving_yds`).
  NFL:  ['player_pass_yds', 'player_pass_tds', 'player_rush_yds', 'player_reception_yds', 'player_receptions', 'player_anytime_td'],
}
// NBA Summer League shares NBA's prop markets.
PROP_MARKETS.NBASL = PROP_MARKETS.NBA

// Expanded, opt-in prop-market set per sport (served only when a caller passes ?full=1).
export const PROP_MARKETS_FULL = {
  MLB:  ['pitcher_strikeouts', 'pitcher_outs', 'pitcher_earned_runs', 'pitcher_hits_allowed', 'pitcher_walks', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_runs_scored', 'batter_singles', 'batter_doubles', 'batter_triples', 'batter_walks', 'batter_stolen_bases', 'batter_hits_runs_rbis'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists', 'player_blocks', 'player_steals', 'player_turnovers', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists', 'player_blocks', 'player_steals', 'player_turnovers', 'player_points_rebounds', 'player_points_assists', 'player_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_assists', 'player_total_saves', 'player_blocked_shots', 'player_power_play_points'],
  NFL:  ['player_pass_yds', 'player_pass_tds', 'player_rush_yds', 'player_reception_yds', 'player_receptions', 'player_anytime_td',
         'player_pass_attempts', 'player_pass_completions', 'player_pass_interceptions', 'player_rush_attempts',
         'player_rush_reception_yds', 'player_kicking_points', 'player_1st_td'],
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
  // NFL
  player_pass_yds: 'Pass Yards', player_pass_tds: 'Pass TDs', player_rush_yds: 'Rush Yards',
  player_reception_yds: 'Receiving Yards', player_receptions: 'Receptions', player_anytime_td: 'Anytime TD',
  player_pass_attempts: 'Pass Attempts', player_pass_completions: 'Completions',
  player_pass_interceptions: 'Interceptions', player_rush_attempts: 'Rush Attempts',
  player_rush_reception_yds: 'Rush+Rec Yards', player_kicking_points: 'Kicking Points',
  player_1st_td: 'First TD',
}

export const labelFor = (key) => MARKET_LABELS[key] || key
