create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  external_event_id   text not null,
  provider            text not null default 'api-sports',
  sport               text not null,
  league              text not null,
  start_time          timestamptz not null,
  status              text not null default 'NS',
  home_team           text not null,
  away_team           text not null,
  home_abbr           text,
  away_abbr           text,
  home_score          int,
  away_score          int,
  home_record         text,
  away_record         text,
  odds_ml_home        int,
  odds_ml_away        int,
  odds_spread_home    numeric(5,1),
  odds_spread_away    numeric(5,1),
  odds_total          numeric(5,1),
  metadata            jsonb default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create unique index if not exists events_external_provider_idx
  on public.events (external_event_id, provider);

alter table public.events enable row level security;

create policy "events_read_all" on public.events
  for select using (true);

create policy "events_service_write" on public.events
  for all using (auth.role() = 'service_role');

grant select on public.events to authenticated, anon;
