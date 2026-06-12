-- Run once in Supabase SQL editor to seed today's MLB slate for testing.
-- Replace '2026-06-10' with today's actual date if needed.

insert into public.events
  (external_event_id, provider, sport, league, start_time, status,
   home_team, away_team, home_abbr, away_abbr,
   home_score, away_score, home_record, away_record,
   odds_ml_home, odds_ml_away, odds_spread_home, odds_spread_away, odds_total)
values
  ('mlb-seed-1', 'manual', 'MLB', 'MLB', '2026-06-10T18:10:00Z', 'NS',
   'San Diego Padres', 'Cincinnati Reds', 'SD', 'CIN',
   null, null, '34-32', '32-34',
   -173, 145, -1.5, 1.5, 8.5),
  ('mlb-seed-2', 'manual', 'MLB', 'MLB', '2026-06-10T19:05:00Z', 'NS',
   'New York Yankees', 'Boston Red Sox', 'NYY', 'BOS',
   null, null, '38-28', '31-35',
   -145, 125, -1.5, 1.5, 9.0),
  ('mlb-seed-3', 'manual', 'MLB', 'MLB', '2026-06-10T22:10:00Z', 'NS',
   'Los Angeles Dodgers', 'San Francisco Giants', 'LAD', 'SF',
   null, null, '40-26', '29-37',
   -195, 165, -1.5, 1.5, 7.5)
on conflict (external_event_id, provider) do nothing;
