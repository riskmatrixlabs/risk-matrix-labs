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

-- Read-only to anon (frontend reads movement); writes happen via service-role cron.
drop policy if exists odds_history_read on public.odds_history;
create policy odds_history_read on public.odds_history
  for select to anon using (true);
