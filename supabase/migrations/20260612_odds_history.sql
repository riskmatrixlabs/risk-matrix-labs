-- Append-only odds snapshots for line movement + CLV.
-- Captured every sync from the current events odds; never updated/deleted.
create table if not exists public.odds_history (
  id                bigserial primary key,
  external_event_id text not null,
  provider          text not null default 'espn',
  sport             text not null,
  market            text not null,         -- 'ml' | 'spread' | 'total'
  side              text,                  -- 'home' | 'away' | null (total)
  value             numeric not null,      -- american odds for ml, line for spread/total
  captured_at       timestamptz not null default now()
);

create index if not exists odds_history_event_idx
  on public.odds_history (external_event_id, captured_at);

alter table public.odds_history enable row level security;

-- This project's cron writes via the ANON key (same pattern as the events table),
-- so anon needs SELECT (frontend reads movement) AND INSERT (cron appends snapshots),
-- plus USAGE on the bigserial sequence. Table-level GRANTs are required in addition
-- to RLS policies — a policy alone is not enough (PostgREST returns 42501 otherwise).
grant select, insert on public.odds_history to anon;
grant usage, select on sequence public.odds_history_id_seq to anon;

drop policy if exists odds_history_read on public.odds_history;
create policy odds_history_read on public.odds_history
  for select to anon using (true);

drop policy if exists odds_history_insert on public.odds_history;
create policy odds_history_insert on public.odds_history
  for insert to anon with check (true);
