# HANDOFF — Session 60 (Jun 17 2026)

**Branch:** `feat/game-browser-lab` — **MERGED to main this session** (main == branch). SW **rml-v340**. Prod deployed. Odds API ~3.8k credits.

## What shipped (all live + verified in Chrome on app.riskmatrixlabs.com)

### 1. Model lean tracking + auto-grading (NEW — the big one)
The O/U model now keeps a real, permanent track record.
- **Table:** Supabase `lean_results` (migration applied; RLS + service_role grants set). Columns: sport, game_date (ET), external_event_id, teams/abbrs, lean, total_line, confidence, strong, reason, final_total, result (W/L/P), snapshot_at, graded_at. Unique(external_event_id, game_date).
- **`api/snapshot-lean`** (POST, authed): SpotlightTicker loops every game and POSTs each directional lean; locks the FIRST pre-game lean/game/day (insert-if-absent, `start_time > now` gate). Free.
- **`api/cron-grade-leans`** (vercel.json `*/30 1-9 * * *` + `0 14 * * *`): for ungraded rows whose event is FINAL, total = away+home runs vs locked line → W/L/P.
- **`api/lean-record`** (GET): Today/Yesterday/All-time, split **strong (Spotlight) vs all leans**, plus a per-game map for the card chips.
- **UI:** `OuFlag` in LiveCenter shows a **✓HIT/✗MISS GradeChip** on the card (inline/mini) AND the detail (full); shared module-memoized `getLeanGames()` (one fetch). SpotlightTicker footer shows **Today · Yesterday · All-time** (strong + "all" subline).
- **GOTCHA (fixed):** when backfilling, use each game's **ET date = (start_time - 4h)::date**, NOT a UTC-date window — a UTC window mixes two ET evenings. The automatic snapshot endpoint already uses ET (`etDate(start_time)`); only the one-time manual backfill had this bug, now corrected.

### 2. O/U offense upgrade (fixes structural over-bias)
- **`api/_lib/offense.js`** (pure tested fns + `getOffense` orchestrator): `lineupXwoba` (posted MLB Stats lineups → Savant batter xwOBA, platoon-adjusted vs starter hand), `offenseFactor` (±1), `formFactor` (±1 on last-~7 combined R/G). Fallback chain: posted lineup → team-season OPS proxy → none. Tunable `OFF` constants at top. Tests in `tests/offense.test.js`.
- Wired **additively** into `game-info.js` O/U `Promise.all` + score (uses `MLB_TEAM_ID` map for ids); exposes `ou.offenseSource` = lineup|team|none. Never required — if data missing, identical to old model.
- **Why:** old model read only pitching (all over-pushing) → 3-7 (1-5 strong) on a heavy-under night. Now it can lean UNDER. Spec `docs/superpowers/specs/2026-06-17-ou-offense-upgrade-design.md`, plan `docs/superpowers/plans/2026-06-17-ou-offense-upgrade.md`. Built test-first via subagent-driven-development.
- **MEASURE NEXT WEEK:** watch `lean_results` win% before/after; if over-bias persists, tune `OFF` thresholds.

### 3. Other
- **Spotlight panel = ALL leans** (ticker stays strong-only).
- **Bankroll reset to $500** + 89 test bets wiped. Required closing the tab (live React re-push = the #4 bug, witnessed). localStorage bet cache key = `rml_session_v1_<userId>`.
- **Credit-leak fix:** `api/cron-warm-props.js` (slate prop pre-warm, us-only, floored 1500cr).
- **PHLT stale-gamelog bug fixed** (hitterForm now sorts all events by real gameDate).
- **Hard Rock placement:** `copyPickAndOpen()` copy-pick-to-clipboard on every place path.
- Whitelisted `tjoel6788@gmail.com`. Footer "gamble"→"bet" responsibly.

## Known state / caveats
- Tonight's (Jun 16 ET) slate was partially captured (feature deployed mid-evening). 5 still-live games captured as **pending** — they auto-grade as they go final. Tomorrow's slate is the first fully-clean automatic run.
- Records as of session end: **Yesterday (Jun 15) 4-4 (strong 3-3) · Today (Jun 16) 2-4 (strong 0-2, partial) · All-time 6-8.** These are the OLD (pre-offense) model — the upgraded model's first real test is the next slate.

## NEXT (in order)
1. **#4 Finish "reset doesn't stick"** — guard `resetSession` (App.jsx ~L2761) against load-restore/sync-up re-push; clear `rml_session_v1_<uid>`; surface delete errors. Memory `rml-reset-sync-loop`.
2. **EV Brain** — decide 3 (rename MLB PHLT model / ModelProb=de-vig consensus / "Play" label) → Phase 1 `evBrain.ts` → Phase 2 wire feeds. Memory `rml-evbrain-spec`.
3. **Spotlight #8 (half done)** — add PHLT prop + EV signals to the same snapshot/grade pipeline.
4. Polish: CH3 gear stubs; per-leg box scores; HR-in-scan; LineShop tap.
5. Pending: `ANTHROPIC_API_KEY` (OCR), NFL.
