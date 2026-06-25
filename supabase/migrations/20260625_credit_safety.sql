-- Credit-safety layer: a circuit breaker + single-flight lock for paid Odds-API spend.
-- AUTHOR ONLY — apply via the lead's migration flow. Both tables are SERVICE-ROLE ONLY:
-- RLS is enabled with NO policies (service_role bypasses RLS; anon/authenticated get nothing),
-- and all grants are revoked from anon/authenticated so the guard state can never leak/be edited
-- by the client.

-- Single-row KV holding the last-known provider credit balance (the circuit-breaker reads this).
create table if not exists public.odds_credit_state (
  id          boolean primary key default true check (id),  -- single-row: only `true` allowed
  remaining   integer,
  updated_at  timestamptz not null default now()
);

-- Single-flight locks: one in-flight paid pull per cache_key. Self-expiring (stale rows reclaimed).
create table if not exists public.scan_locks (
  cache_key   text primary key,
  locked_at   timestamptz not null default now()
);

alter table public.odds_credit_state enable row level security;
alter table public.scan_locks        enable row level security;

-- No policies created on purpose: service_role bypasses RLS, anon/auth get nothing.
revoke all on public.odds_credit_state from anon, authenticated;
revoke all on public.scan_locks        from anon, authenticated;

-- REQUIRED: new public tables do NOT auto-grant service_role — without this the server's
-- service-role client gets "permission denied" and the breaker/lock writes fail SILENTLY
-- (supabase-js .upsert returns {error}, it does not throw). See memory rml-supabase-grants-gotcha.
grant select, insert, update, delete on public.odds_credit_state to service_role;
grant select, insert, update, delete on public.scan_locks        to service_role;
