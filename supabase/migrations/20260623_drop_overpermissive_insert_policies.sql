-- Tighten two over-permissive INSERT policies flagged by the RLS audit (backlog S67).
--
-- Code analysis (api/ + src/) confirms ALL legitimate writes to these tables go through
-- the SERVICE_ROLE key, which BYPASSES RLS entirely. Nothing client-side (anon/authenticated)
-- inserts to them — the frontend only SELECTs (movement charts, model records).
--
--   odds_history writers (all SUPABASE_SERVICE_ROLE_KEY):
--     api/cron-capture-book-odds.js:73, api/cron-sync-events.js:525,
--     api/cron-sync-live.js (flatten→insert), api/backfill-book-odds.js:102,
--     api/game-lines.js:96
--   odds_history readers (anon key, SELECT only — KEEP read access):
--     src/lib/oddsHistory.js (fetchLineMovement / fetchBookMovement / closingLine),
--     api/game-info.js:57, api/cron-grade-leans.js:66
--
--   lean_results writers (all SUPABASE_SERVICE_ROLE_KEY):
--     api/snapshot-lean.js:95 (upsert), api/cron-grade-leans.js:108 (update)
--   lean_results readers (anon key, SELECT only — KEEP read access):
--     src/App.jsx:2371, api/lean-record.js:32, src/lib/calibration.js
--
-- Therefore: drop the anon/auth INSERT policies and revoke the matching table GRANTs.
-- Service-role writes are unaffected; anon SELECT (read) is preserved.

-- ── odds_history ──────────────────────────────────────────────
-- Drop the WITH CHECK(true) anon INSERT policy (leftover from initial migration).
drop policy if exists odds_history_insert on public.odds_history;

-- The policy alone isn't enough — the original migration also granted INSERT + sequence
-- USAGE to anon. Revoke those so anon truly cannot write. (SELECT grant + read policy stay.)
revoke insert on public.odds_history from anon;
revoke usage, select on sequence public.odds_history_id_seq from anon;

-- ── lean_results ──────────────────────────────────────────────
-- Drop the WITH CHECK(true) authenticated INSERT policy.
-- (Policy name assumed from convention; the IF EXISTS guard makes this a no-op if it differs.)
drop policy if exists lean_results_insert on public.lean_results;

-- Belt-and-suspenders: revoke any INSERT grant the authenticated role may hold.
revoke insert on public.lean_results from authenticated;
