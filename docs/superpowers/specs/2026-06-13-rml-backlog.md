# Risk Matrix Labs — Master Backlog

> ⚠️ The dated sections below (session 50 → 61) are a **historical log** — kept for context, not the live list.
> The **CURRENT OPEN list is right here at the top.** Status: 🟢 done · 🟡 queued · 🔵 in design · ⚪ idea

## 🟢 CURRENT STATE — Session 66 (SW v479, on main · 2026-06-21→22)
**Bet-tracking correctness sweep → two new free features → parallel quick-wins → parallel model builds + a security fix.** All shipped to prod & merged to main; 455 tests green.

### 🟢 SHIPPED THIS SESSION (v468 → v479, all verified)
- 🟢 **Live win-prob ring (v468–v470)** — the ring "wasn't moving" because it de-vigged the FROZEN pre-game moneyline. Now pulls ESPN live game-winner % (`/api/box-score` `winPct`) for **ML legs only** (totals/props keep implied), updates every 60s, $0. Parlay ML legs resolve per-leg too. Memory `rml-live-winprob`.
- 🟢 **Pikkit-style ring colors (v471)** — live ring shifts with win prob (≥60% green / 40–60% amber / <40% red); settled locks W/L/P. `liveRingColor` in BetCard.jsx.
- 🟢 **Postponed games sink to bottom (v472)** — Game Center slate: live/upcoming → finished → dead (PPD/CXL) at the very bottom; DLY/SUS stay up (can resume).
- 🟢 **FREE GUIDED PROP BUILDER (v474)** — `PropBuilder` (player search → auto-matched game → stat/side/line/odds + free season/L5 context). Mounts: LOG BET **Player Prop** type + Game Center Insights **"Build a prop"** above Line Shop → slip. Only live-trackable stats offered; NO EV (paid); word "free" kept out of UI (brand). Spec+plan in docs/superpowers. Memory `rml-prop-builder`.
- 🟢 **PARLAY AUTO-SETTLE (v476)** — was straights-only; parlays sat Open forever. New `gradeParlay` (pure): early-loss, **push-reduction** (drop pushed legs, recompute payout), reduced-odds pnl via `settleBet(oddsOverride)`. Settled-parlay header now reads WON/LOST/PUSH (was stale "LIVE"). Verified: owner's NYM@PHI parlay settled W **+$55** (not +$90). Memory `rml-parlay-autosettle`.
- 🟢 **Ladder rung-dupe guard (v477)** — `startSession` seeded 6 rungs with no idempotency guard → double-fire = dups. Guard added (`canSeedLadder`). DB currently clean (no migration). *(Future cross-device sync-loop resurfacing is the separate reset-sync-loop concern.)*
- 🟢 **Prop cached-line auto-fill (v477)** — `api/prop-open.js` (free, reads `prop_history`) → prop builder pre-fills line/odds + shows "open" when a scan exists; types-yourself when not. $0.
- 🟢 **Per-leg box score for cross-game parlay legs (v478)** — `withLogos` now takes a box-score MAP keyed by event id (was single primary-game stats) + `liveBetGameKeys` fetches each leg's game, so a prop leg in a *different* game gets its own live stat bar. Mirrors the `winPctByEvent` refactor.
- 🟢 **proj2 MARKET-ANCHOR (v479) — Phase-3 Task 1 DONE** — `anchorProjection(raw, marketTotal, 0.65)` in `runModel.js`: blends the per-side projected total toward the market (margin-preserving — margin drives ML/RL), wired in `game-info.js` (additive/BETA). Kills the league-avg drift: raw 8.6 on a 6.5 line → **7.24** (was 8.6). Verified: algebra sound (home−away=margin, home+away=total), 5 new tests. **This UNBLOCKS surfacing team picks + EV-Brain model-edge wiring.**
- 🟢 **Calibration harness (v479) — dormant** — `src/lib/calibration.js` (`wilsonInterval` [verified vs textbook: 18/32→[.393,.718]], `bucketByEdge`, `summarize` with `ready` flag at gradedN≥250) + read-only runner `scripts/calibration-report.mjs`. Lights up when graded edges accrue (~mid-July). 14 tests.
- 🟢 **SECURITY: RLS enabled (v479)** — 3 tables were exposed to the anon key (`scan_cache` + both `*_backup_20260620` tables holding **real user bet history/settings**). Confirmed server-only access (service_role bypasses RLS), enabled RLS (no policies) → anon locked, app unaffected. Advisor `rls_disabled_in_public` ERROR cleared. *(Built A+B as parallel subagents in isolated worktrees, reviewed + merged serially; then logic-verified both modules independently.)*

### 🟡 OPEN BOARD — what's left (priority order)
**Big model builds:**
1. 🟡 **Phase 3 — team picks** — ✅ Task 1 (market-anchor) DONE. **Remaining = Tasks 2–5:** new `ml_rl_results` table + persist the ML/RL pick (`snapshot-lean` sibling) → grade from final scores (`cron-grade-leans` sibling) → surface ML/RL in Spotlight + game card (`SpotlightTicker.jsx`). Plan `docs/superpowers/plans/2026-06-21-phase3-finish-team-picks.md`. Sequential, model-layer.
2. 🟡 **EV Brain — remaining** *(now unblocked by the anchor)* — **first step (S):** wire `modelProbForBet` (already built+tested) into MLB-total EV so the verdict reflects the model edge, not just market. Then: persist PHLT score at prop-log time → verdict; add CLV to Operator; thread Discipline into the per-bet verdict; verdict tooltip. NBA/WNBA/NHL = no model yet (data sourcing, defer). Audit findings drive the order.
3. 🟡 **O/U calibration** — harness BUILT (above); now data-blocked. Graded edges = **0** today (`edge_runs` started logging 6/22); `strong` 56% vs 50% (n≈33) is noise. Re-derive the rating once ~250–300 graded edges accrue (**~July 18–26**). Also: verify the auto-grader actually grades the `edge_runs` rows (snapshot-lock concern).

**Bugs / correctness:**
- 🟡 **Reset doesn't fully stick** + reset-UI split ("new bankroll keeps history" vs "nuke account") — needs owner product call. Memory `rml-reset-sync-loop`.
- 🟡 **Manual parlay settle not push-aware** — auto-settle is; tapping WIN by hand still pays full ticket odds. Needs a per-leg settle UI. Low priority.
- 🟡 **Bonus security (from RLS audit)** — `odds_history` has an **anon INSERT** `WITH CHECK(true)` policy (anon could spam rows; likely a leftover, written server-side); `lean_results` has an authenticated INSERT `WITH CHECK(true)`; leaked-password protection is off. Confirm nothing legit writes via those roles, then tighten.

**Quick wins / polish:**
- 🟡 **Bet log redesign** — parlays read like a sportsbook slip; per-leg box-score for cross-game prop legs.
- 🟡 **Bet-to-line full** — market-tab chart in bet Insights (only the row-reorder Option A shipped; B/C = port CH2 tabs).
- 🟡 **Perf/credit** — near-game odds-capture tiering ("30-min is dumb"); odds push alerts (infra exists).
- 🟡 **KBO scan sharpening** — add pitcher FIP + offense layer (free-data sourcing — focused solo task, not parallel-safe). Memory `rml-kbo-scan`.

**New surface:** 🟡 NFL support (new sport key + prop markets).

### 🙅 OWNER-ONLY (unblocks real value — needs YOU)
- **Affiliate signup** (FanDuel/DK/Caesars) — revenue share on bets we already deep-link.
- **ANTHROPIC_API_KEY** — unlocks the (already-built) OCR bet-slip upload.
- **Product calls:** reset split · (PHLT name + "Play" label already resolved).
- **Paid data:** on-court dots / timeouts / $-handle — needs a paid sharp feed.

---

## 📜 HISTORICAL — Session 65 (SW v467)
**Marathon session. Model sprint → 4 backlog wins → EV Brain Phase 2 → then a deep bet-tracking debug chain.**

### 🟢 BET TRACKING — fully fixed (v456–v467, the "it's not tracking" saga)
The tracker now does the full loop end-to-end, all verified live against the DB + console:
- 🟢 **Auto-settle (v456)** — bets grade themselves W/L/P from the final score (`gradeBetResult.js`); was a planned "Phase 4" never built.
- 🟢 **Event-matching timezone bug (v461)** — events store `start_time` in UTC → late-ET games land next UTC day → a bet matched BOTH today's + last-night's game; `.find` grabbed the wrong/finished one → mis-tracked AND risked mis-grading. Fixed with `findEventForBet` (line + ET-date disambiguation), wired into all 8 match sites incl. auto-settle. See memory `rml-event-matching-utc-bug`. (Validated: PIT@COL graded a correct WIN that the old matcher would've called a wrong loss.)
- 🟢 **Live tracking on dashboard cards (v459)** + **score polling every 60s (v462)** — Overview/Bet Log/Ladder cards now light up like CH3 (was a one-time fetch holding stale scores).
- 🟢 **Win-prob ring → 100% on win / 0% on loss (v463)** — was stuck showing static implied %.
- 🟢 **Live progress bar + run count (v467)** — THE root cause: `parseTotal` was anchored (`^Over 11.5$`) so it couldn't read bet titles with the matchup prefix (`PIT@COL Over 11.5`) → bar never built. Now shows `14 / 11.5` filling green. 5 regression tests added.
- 🟢 Ladder: CH3 shows only the ACTIVE rung (was dumping all 18 rungs from 3 sessions); Ladder + Overview cards got team logos (v458).

### 🟢 EV BRAIN PHASE 2 — BUILT & LIVE (v453–v455, subagent-driven, plan `docs/superpowers/plans/2026-06-21-evbrain-phase2.md`)

### 🟢 EV BRAIN PHASE 2 — BUILT & LIVE (v453–v455, subagent-driven, plan `docs/superpowers/plans/2026-06-21-evbrain-phase2.md`)
- Labels = **Green/Small/Lean/Pass** (brand-safe, no "Play"); grader = **"EV Brain"**, MLB model keeps **PHLT**.
- `src/lib/evBrainFeeds.js` (tested): `modelProbForBet` (de-vig consensus + model edge), `clvForBet` (close from odds_history), `disciplineFromBetLog` + `operatorFromBetLog`.
- **OPERATOR tile filled** (MatrixBot TrackChannel; empty-state until ≥3 settled bets). **BetCard verdict pill enriched** (score + EV/CLV breakdown + tooltip). Verified live on real bets.

### 🟢 AUTO-SETTLE — BUILT & LIVE (v456, the "not tracking" root cause)
- Auto-settle was a planned "Phase 4" that **never shipped** — bets only settled manually, so the record/operator never tracked themselves. FIXED: `src/lib/gradeBetResult.js` (tested, grades total/ML/spread from final score) + an App.jsx effect that settles Open bets whose game is FINAL (conservative: parlays/ladder-TBD/in-progress → left Open). Verified live: owner's CIN@NYY auto-graded to L on load. Also fixed `created_at`→`updated_at`/`date` bug in the operator sort (v457).

**Earlier today — deep O/U-model sprint (NOT from this backlog — triggered by grading the Jun-20 loss):**
- Park de-correlation + extreme-park guard (Coors over-projection de-emphasized).
- **Phase 2 O/U signals ALL wired & live:** wind-vs-park, pitcher skill (CSW/K-BB), handedness (L/R platoon), umpire, **bullpen fatigue** (owner's #1; b2b-bias bug found in verification + fixed → volume-only).
- **Phase 3 per-side run engine LIVE as `proj2`** (BETA, additive) — projects each team's runs → Total/ML/RL from one engine. ⚠️ NOT trustworthy yet: drifts to league-avg on sharp-pitching games (needs market-anchoring); ML/RL not surfaced/graded. See plan `docs/superpowers/plans/2026-06-21-phase3-per-side-run-model.md`.
- **Calibration foundation:** added `edge_runs`+`model_version` to `lean_results`, now logged per snapshot. The confidence/`strong` rating is NOISE (strong 53% < non-strong 59% over 59 leans) — cosmetic until ~250–300 graded edges accrue. See memory `rml-ou-model`.
- Whitelisted `ryancollado7@gmail.com` (founder's brother, tester).

### 🤖 AGENT-SHRINKABLE — ✅ CLEARED S65 (subagent-driven, sequential, each shipped + Chrome-verified)
- 🟢 **Perf (v449)** — parallelized the startup cloud load (bets/settings/templates → `Promise.all`) + added a 75s per-game cache to `fetchLineMovement` (`oddsHistory.js`) so re-opening a game's Insights skips the Supabase round-trip.
- 🟢 **Bet-log headshots (v450)** — player-prop legs now resolve real ESPN headshots via the existing `withLogos`/`rosterMap` + `player-search?all=1` pattern (matched by name, last-name fallback); team legs keep logos; unmatched → graceful badge fallback.
- 🟢 **Demo safety-net slate (v451)** — `SAMPLE_SLATE` (3 `__sample:true` games) renders ONLY when `isDemo` (`?demo=true`) AND the real board is empty; verified real users (isDemo=false) can never see it (display-only, no write paths).
- 🟢 **Bet-to-line (v452, Option A)** — in a bet's Insights "Line Movement" list, the bet's own market rows (`ml`/`spread`/`total`) float to the top when there's exactly one single-market bet; no-bet/parlay/multi-bet cases unchanged. NOTE: the *literal* ask (market-tab chart defaulting) was NOT built — the bet-Insights chart is hardcoded ML with no market tabs; full version (port CH2 tabs into `BookLineMovement`, or wire a bet→CH2 hand-off) is a larger build, logged as Option B/C in the agent's findings.
- 🟢 **rml-master.html + this backlog refresh** — doc work (lead).

### 🙅 NOT agent-doable (owner / business / blocked — needs YOU)
- **Affiliate signup** (FanDuel/DK/Caesars revenue share) — account+financial signup, owner-only.
- **ANTHROPIC_API_KEY** (unlocks OCR bet-slip upload) — owner-pending.
- **Product decisions:** EV-Brain "Play" label vs brand rule · reset "nuke account" split · PHLT name collision.
- **Paid data:** on-court dots / timeouts / $-handle — needs a paid sharp feed.

### 🏗️ BIG BUILDS (not "easy" — need a plan first, then subagent-driven)
- 🟡 **Phase 3 finish** — market-anchor the per-side engine (it drifts to league-avg on sharp games), then surface + GRADE ML/RL (needs new graded columns + cron). Plan only ~40% written. THE highest-value model work left.
- 🟡 **EV Brain — remaining** — wire PHLT (MLB hitter) component into the bet grade; ladder/RR fit scoring; other sports (NBA/WNBA prop, NHL SOG) need new free-data sourcing.
- 🟡 **NFL support** — new sport key + prop markets.
- 🟡 **Bet-to-line full** — market-tab chart in bet Insights (Option B/C; only shipped the row-reorder Option A).

### 🤖 SMALLER AGENT-SHRINKABLE (next easy wins)
- 🟡 **Bet log redesign** — read multi-leg parlays like a sportsbook slip; per-leg box-score for cross-game prop legs.
- 🟡 **Perf/credit polish** — faster near-game odds capture (the "30-min is dumb" tiering); odds push alerts (infra exists).
- 🟡 **Reset UI decision** — bets-only (done) vs full "nuke account" split (needs YOUR product call first).

---

## 🟢 CURRENT STATE — Session 63 (SW v378+, branch `chore/backlog-gear-brand-sweep`)
Session 62 (merged to main, SW v378) shipped: onboarding re-fire fix, bet hand-off (FanDuel/DK/Caesars/MGM/ESPN/BetRivers deep-link; HR/Novig app-open only — needs affiliate), 4-way slip (RR → RR Engine), RR Engine⇄slip two-way, bets-only reset, Spotlight always-renders, 24/7 event sync.

**Session 63 (SW v378→v400, on main, all verified live):**
- 🟢 **FREE LIVE ODDS** — game open = $0; `live-game` returns ESPN pickcenter (ML+run line+total, run-line price via pointSpread.close.odds); poll 10s live/30s pre; game-lines cacheOnly on open, paid only on LineShop REFRESH.
- 🟢 **Honest PRE-GAME labeling** — free odds = latest line, not live-ticking (verified); odds sections read grey PRE-GAME, never fake LIVE; shared StatusPill; score header keeps real live.
- 🟢 **Game Center UX** — sections collapsed by default · faster refresh (open 10s/slate 20s) · +Slip from odds cards (no Line Shop) · Spotlight pinned on game page · slip FAB lifted above the z-9999 detail overlay.
- 🟢 **Win Prob + Line Movement** — run line/total on each side (matches Fair Value); sparkline+arrows by implied prob (shorter price = UP).
- 🟢 **By-sportsbook chart premium redesign** (tap-to-compare, decimal scaling, dots/gridlines/dashed-sharp, favorite-on-top, ⓘ how-to-read) · 🟢 consensus odds team labels + run line each side + O/U "0" fix · 🟢 weather Feels-like+Humidity + retractable roofs · 🟢 footer centered · 🟢 picks→legs · 🟢 CH3 sport-selector · 🟢 280/280 tests.
- 🟢 **Lean grading verified CORRECT** (DB-checked) — snapshot locks first pre-game directional lean+line, grades vs locked line. "Phantom grey miss" was a real strong miss. No change needed.
- 🟢 **🇰🇷 KBO SCAN (new free league)** — `api/kbo-scan.js` (TheSportsDB 4830 + Open-Meteo, 0 credits; park×baseline+weather, no Statcast); `kbo_leans` table + `cron-kbo-leans` (04:00+14:00 UTC) self-grades proj-vs-actual; Spotlight KBO section (collapsed, BETA, PROJ→ACTUAL→ERR→HIT/MISS) fills the OVERNIGHT slot. Projections rough → **next: add pitcher FIP + offense layer to sharpen**. See memory `rml-kbo-scan`.

### ⛔ BLOCKED on paid data (proved this session — NOT a UI fix)
- **In-game on-court dot (#3)** + **timeouts remaining (#4)** — ESPN free summary exposes neither (probed live: no "timeout" field; only active/starter/DNP roster flags). Same class as the chart's **$ handle/money axis**. All need a **paid sharp/live feed** (how Apple Sports / Sharp Money do it).

### 🎯 OPEN NOW — start here (in priority order)
1. 🟡 **EV Brain Phase 2** *(biggest remaining build)* — wire PHLT components (live MLB model) + discipline/operator (bet-log behavior) into the verdict; feed the empty CH3 OPERATOR tile (`operatorRating`); tooltips; Spotlight ranking by final score. Phase 1 + verdict-pill slice already shipped (`src/lib/evBrain.js`). ⚠️ Verdict pill never visually confirmed live (owner acct had 0 bets — log a test bet).
2. 🟡 **Monetize the bet hand-off** *(business, not code)* — deep-linking needs NO partnership (we already send bets); **affiliate = revenue share**. Apply to FanDuel/DraftKings/Caesars affiliate programs to get PAID on clicks we already send. (HR/Novig stay app-open-only by their own choice — see memory `rml-bet-placement-blocker`.)
3. 🟡 **Bet-to-line** — CH2/Insights chart shows the line for the bet's *actual* market (F5/total/spread), not just game ML.
4. 🟡 **Bet log redesign** — team logos + read multi-leg parlays like a sportsbook slip. Headshots in the bet log still show a league badge (needs per-sport roster fetch). Per-leg box-score for cross-game parlay prop legs.
5. 🟡 **Reset UI product decision** — bets-only (done) vs a full "Nuke account" split; decide before wiring more.
6. 🟡 **Perf/credit polish** — speed up Insights (parallelize 3 Supabase queries + cache); faster per-book capture inside 3h of game; pre-game odds in EV; tighten `cron-sync-events` (15-min board staleness); demo safety-net slate; odds push alerts.

**Blocked/pending:** paid sharp-data feed (on-court/timeouts/$ handle) · ANTHROPIC_API_KEY (OCR, owner-pending) · NFL support · umpire+lineups for O/U (no free data) · bullpen FATIGUE (needs daily IP accumulation).

---

# 📜 HISTORICAL LOG (session 50 → 61, snapshot 2026-06-13)

Single view of everything pending + the new "3-pillar" vision. Status: 🟢 done · 🟡 queued · 🔵 in design · ⚪ idea

## The 3-pillar vision (mobile top nav)
**Game Center · Dashboard · Matrix Bot** — three views that work together.
- **Game Center** — premium Apple-Sports + Insights (watch + read). 🟢 exists
- **Dashboard** — NEW middle tab: analytics home, *track everything* (bet log, record, CLV/EV, performance). ⚪ idea
- **Matrix Bot** — find & search value. 🟢 exists

## New vision sub-projects (sequenced)
The shared backbone is a real **bet model** (players + parlays + per-bet markets). Order matters.

1. 🟢 **Sportsbook deep-links** (DONE v115/v116) — tap a book/odds-card → confirm → log bet + open that book's bet slip. Both Line Shops (Insights + CH2) AND the Insights Odds cards (best-book + Compare Books). Spec: `2026-06-13-sportsbook-deeplinks-design.md`.
2. 🟢 **Player search** (DONE v117–v119) — 🔍 knob on CH1 → player card (headshot/pos/team) → CH2 player-props (best book + tap-to-bet). Free ESPN rosters, 0 credits.
3. ⬜ **Bet-to-line, not game-to-line** — Channel 2 / Insights chart shows the line for the **bet's actual market** (F5, total, spread…), not just game ML. "See the line that matches my bet."
4. ⬜ **Bet log + card/overview redesign** — nothing removed, just rearranged + better looking, **team logos**, must read **multi-leg parlays** like a sportsbook / Pikkit slip. Manual (not synced). Logging lands here.
5. 🟢 **Dashboard tab** (DONE v127/v128) — 📊 door in mobile top bar between Game Center & Matrix Bot → routes to Overview (main analytics landing). 3-pillar nav complete.
6. ⬜ **In-app bet slip + parlay logging** — "+ Add to slip" on each pick → running slip → Log Parlay (manual, no OCR).

## Bot UX shipped this session (v120–v126)
- 🟢 **SW network-first** (v120) — fixed the cache-first bug that served stale builds; deploys now auto-show on reload.
- 🟢 **TV control deck → CH1 bottom** (v121/v122) — 🔍 SEARCH (left) · ⚙ SETTINGS (right) under the 📺 TV·GO LIVE·BOARD slider bar; panels open inside the screen.
- 🟢 **Ticker** (v123/v124) — game times in user-local tz; LIVE games ride the ticker (red ●LIVE+score) before the pre-game slate.
- 🟢 **Settings panel rebuilt** (v125/v126) — Sport · Team (menu→jump) · Market · Prop (sport-correlated menu) · Book (filter board to a sportsbook) · Min EV.

## Earlier pending (pre-vision)
- 🟡 **Speed up Insights** — parallelize the 3 Supabase queries + cache per game. *(pure polish, no credit cost)*
- 🟡 **Faster per-book capture inside 3h of game** — the "30 min is stupid" fix; tier cadence so near-game lines catch movement, stay under 20k credits.
- 🟡 **Time-frame chips** (6h / 24h / Since open) on Line Movement.
- 🟡 **Pre-game odds in EV** — "for true EV use live AND pre-game odds."
- 🟡 **List/feed glance still 15-min** — tighten `cron-sync-events` so the board isn't stale (live-on-open already done for detail view).
- 🟡 **Demo safety-net** — sample slate so a live sales demo never shows an empty board.
- 🟡 **Odds push alerts** — ping when a big edge appears (push infra exists).
- ⚪ **Spread/Total per-book chart** — DROPPED (owner: "forget it" — credit cost not worth it).

## Recently shipped (session 50, for context)
- 🟢 Per-book chart: reputable-books filter, By Sportsbook / Best Available toggle, historical SEED (27.6k rows).
- 🟢 Insights reorder (owner-specified) + collapsible By Book chart matching theme.
- 🟢 **Live odds on open** — Win Prob / Fair Value / odds cards from live multi-book feed (90s cache).
- 🟢 CH2 Compare Books stays open (frame remount fix); CH3 card redesign.
- 🟢 Game Center: finished games sink to bottom.

## Maintenance / hygiene
- 🔴 **rml-master.html is STALE** — owner wants it brought up to date (single source of truth per CLAUDE.md).

## 🆕 QUEUED — PHLT + EV Brain (owner spec, session 55) — see memory `rml-evbrain-spec`
The universal **bet-quality + discipline grader** (sits on top of our sport models). NOT picks — a risk dashboard. Verdict: **Play / Small Play / Lean / Pass**; operator label **Clean / Risky / Degen**.
- 🟡 **Phase 1 — Brain core** (`src/lib/evBrain.ts`): pure scoring fns (PHLT Score, EV, CLV, Ladder, Round Robin, Discipline, Operator Rating, Final Decision) + constants + bet JSON schema + labels + tests. ~1 session, low risk, unlocks all.
- 🟡 **Phase 2 — Wire real feeds + UI**: ModelProb ← de-vig consensus + live MLB models; CLV ← odds_history; Discipline/Operator ← bet-log behavior; bet-grade card + operator tile + tooltips on dashboard. ~2 sessions → MLB MVP.
- 🟡 **Phase 3 — Other sports**: NBA/WNBA prop, NHL SOG, MLB team total (free-data sourcing risk, like bullpen). ~1 session each.
- ⚠️ **DECIDE FIRST:** (1) PHLT name collision — owner's PHLT (Player/Price/Probability/Line/Tempo grader) vs our shipped PHLT (Pitcher Hit Likelihood Targeting MLB model) → rename baseball one. (2) ModelProb source (recommend de-vig consensus). (3) "Play" label vs brand no-"play" rule.

## ✅ SHIPPED sessions 53–55 (CH2 + models + infra)
- 🟢 **CH2 analysis engine** — line movement (since-open verdict, timeframe chips), props GROUPED BY PLAYER, unified search, compare books, credit discipline (0-cost open).
- 🟢 **PHLT v2.2 hitter model LIVE** — A/B/C/Fade badges on prop cards (Pitcher/Form/Matchup/Park-Weather/Streak), sorted, fades, breakdown. Free Statcast (`api/savant.js`) + ESPN form + handedness platoon + weather.
- 🟢 **O/U Model B v2 LIVE** — lean on Statcast xERA/xBA/K% + **bullpen ERA** (MLB Stats API) + weather + park, **anchored to live total** + since-open/value verdict. On CH2 game card AND Game Center (outside + inside).
- 🟢 **Game Center flags + swipe fix** — O/U flag on list cards + detail; prev/next chevrons + touch-swipe between games.
- 🟢 **Caching fix** — scan_cache/prop_history were silently failing (missing service_role grants); now cache (props 0-cost open, models stop re-fetching). See memory `rml-supabase-grants-gotcha`.
- 🟢 CH2 polish — squarish centered league tiles, search↔date swap, brand-safe labels (Prime/Strong/Caution/Fade, never "lock").
- Prod SW **rml-v234**, branch `feat/game-browser-lab`.

## ✅ SHIPPED Session 56 (Game Center polish + credit pre-warm + education clarity · SW rml-v254)
- 🟢 **Slate-wide line pre-warm** (`cron-warm-lines` */15) — opening ANY game shows best lines FREE (cacheOnly, 18-min WARM_TTL); 1 bulk call/sport; also feeds the By-Sportsbook chart. Props still pay-on-demand.
- 🟢 **Caching fixed** (service_role grants) — props/savant/roster now cache (was a silent bleed).
- 🟢 **Game Center detail clarity:** O/U flag → footer; status tags (Postponed/Delayed/Suspended/Canceled); OPS in box score; injury away/home tabs; "Your Bet" → slim chip; all Insights sections collapsible (open default); Win Prob + Fair Value clearer (both sides + odds + pre-game/live tag; line on each side w/ correct sign); Line Movement LINE-vs-PRICE relabel; HOLD tooltip; square tabs.
- 🟢 **CH2:** squarish centered league tiles; search↔date swap.

## ✅ SHIPPED Session 57 (CH3 EV TRACK rebuilt + universal bet cards + live stat bars · SW rml-v254→v269)
Full CH3 redesign via brainstorm→spec→plan→subagent-driven build (spec+plan in `docs/superpowers/`), then ~10 polish/fix passes verified live in Chrome.
- 🟢 **Universal BetCard** — `src/components/BetCard.jsx` (BetCard + BetTicket) + pure `src/lib/betCard.js` (21 tests). Used in CH3 + App.jsx bet log. Connected parlay legs, "X OF N HIT" pill, status-color left accent stripe, footer matches single card.
- 🟢 **CH3 TrackChannel recompose** — SCOREBOARD: 3 tiles + RECORD line (W-L-P·units·ROI) + OPERATOR tile (SOON, EV-Brain home) + status chips + ⚙ gear (time scope + RESET stub). TRACKED POSITIONS: date-grouped (TODAY first + tally), 60s refresh, empty state. Loads today+yesterday events.
- 🟢 **Win-prob ring** (Pikkit) — de-vig fair % (live ML), orange=pending/green=won/red=lost; parlay = combined product.
- 🟢 **Live stat bars** — `api/box-score.js` (FREE ESPN boxscore) + `src/lib/statProgress.js`. Prop→stat÷line, total→score÷line, ML/spread→score line. Green/red, **win=100%**, live+finished. Always shows on O/U cards (empty pre-game), **above the odds**.
- 🟢 **Headshots + team logos** — `player-search?all=1` roster map (FREE); parlay legs match each leg to its own game for real team logos/score.
- 🟢 **Slip multi-add FIXED** — `addToSlip` no longer auto-opens drawer (overlay was blocking). Verified: logged a 2-leg parlay end-to-end.
- 🟢 **Home-book pin** — Hard Rock pinned to top of Compare Books + parlay PLACE-ON for FL. (HR intermittently absent from cheap cache → REFRESH re-pulls.)
- 🟢 **O/U total-anchor BUG FIXED** — `game-info.js totalAnchor` grabbed wrong day's row on repeated matchups (→ total 0/stale); now windows + orders + prefers a real total.

## ✅ SHIPPED Session 58 (bet-logging accuracy test → UX/polish sprint · SW rml-v269→v293)
**Owner-driven live-iteration sprint (verified in Chrome each step). NONE of the planned "NEXT SESSION" items (Spotlight/EV Brain) were touched — they remain next, untouched.** 19 commits, all pushed to `feat/game-browser-lab`.
- 🟢 **Log Bet form** (`b6a1540`): typeable +/- odds sign (was silently logging plus-odds as favorites); **parlay leg-builder** (Parlay/SGP/RR → per-leg pick·odds·event editor → real `legs[]`); sticky-footer clearance.
- 🟢 **CH1 bot outputs** (`2a04256`,`21d4815`,`7e8662a`): one-tap **+Slip** + share on every scan output (no more re-finding in CH2) + whole-board share; richer cards w/ logos/headshots; toned action icons to grey.
- 🟢 **CREDIT 911 FIX** (`14d76e9`): killed CH1's 2-min `runScan(force=true)` auto-refresh that re-hit paid `/api/scan-edges` for every sport on a timer = constant drain. **Scanning is now tap-only.** See memory `feedback-rml-no-paid-timer`.
- 🟢 **Shared bet filter** (`835c24f`): Bets tab is master (Sport + ALL/OPEN/W/L/P), CH3 mirrors it bidirectionally. App-level `sportFilter`/`resultFilter` threaded into CH3.
- 🟢 **Parlay grading** (`16cabc3`, `d809aea`): CH3 + Bets-tab parlays grade EV (∏ leg true-prob × parlay dec) + CLV (combined closing line). New `src/lib/gradeBet.js` (4 tests) extracts the math so the Bets tab grades like CH3.
- 🟢 **Bets-tab cards = Wheeler look** (`e7e33e9`,`b8b9406`,`69b2332`): App.jsx `BetCard` now renders the universal BetCard/BetTicket (real logos via exported `withLogos` + a free today/yesterday `betEvents` fetch) with boxed footer (`ODDS · STAKE→WIN · EV · CLV · P&L`); settle/edit/share collapse into a tap-the-card max-height drawer (Safari-safe).
- 🟢 **Totals show BOTH team crests** (`1657501`,`811b7c1`): `Avatar` `logo2` → diagonal dual crests for over/under (was one team / MLB badge). Backfilled the 3-leg, 4-leg, AND round-robin test bets with real `legs[]` via Supabase.
- 🟢 **Card polish** (`811b7c1`): dropped the card-in-a-card outer frame, removed fake ◷ timers, brightened orange (#FFB800→#FFAE2B), narrowed desktop.
- 🟢 **Room unification** (`e932716`,`0b481b2`,`14c64bb`,`7e05335`,`dd5bc6b`): all 3 pillars (Game Center · Dashboard · Matrix Bot) **AND the game-detail overlay** now share ONE **580px** desktop column (Matrix Bot inherits the app width = single control). **3-pillar desktop nav** (Game Center · Dashboard · Matrix Bot) + dashboard sub-row that only shows in Dashboard (replaced the ugly flat 9-tab wrap). Logo nowrap; header controls wrap so Share isn't clipped.
- ⚠️ **Round Robin** logged as ONE parlay ticket (option B) — owner never chose A (split into 3 real 2-leg sub-parlays). True RR grading = all-must-hit, NOT accurate; revisit if owner wants A.
- 🟡 Open loose ends: player **headshots in the bet log** show league badge (team logos passed, not roster headshots — needs the per-sport roster fetch); branch still **NOT merged to main**.

## ✅ FIXED (session 59, SW v297) — Cloud writes now stick (was 3 symptoms, one root)
Local+UI clear but the Supabase copy survives and resurrects on reload. Confirmed in THREE places, all one fix:
1. **Per-bet DELETE** (edit-modal trash + bet-log) — `deleteBet` supabase.js:63 gated by `cloudSyncedRef.current` or fails silently (`.catch` swallows).
2. **Reset All Data** — `resetSession` App.jsx (see below) hits the cloud↔local↔memory restore loop.
3. **Bankroll/settings revert** — `user_settings` same loop; owner's bankroll was stuck at $15,514.84, reverted on every settings-load (App.jsx ~L2563). Fixed manually + verified a fresh value sticks.
**THE FIX (one pass):** await the cloud write, surface errors to the user, and don't trust/clear local until the cloud confirms. Add a sync guard so load-restore + sync-up can't repopulate during a reset/delete. See memory `rml-reset-sync-loop`.

## 🐛 KNOWN BUG — Reset doesn't stick (found session 59)
Bets resurrect after reset: they live in Supabase `bets` + localStorage + live React memory, and the load logic (App.jsx ~L2536) restores from whichever layer still has data → endless loop. Manual wipe done for owner (session 59). **TO FIX:** `resetSession` (App.jsx ~L2761) must guard-flag to suppress load-restore + sync-up, `setBets([])` FIRST, then delete cloud + clear localStorage, then re-enable sync; surface delete errors (silent now); make reset findable (buried in Matrix Bot ⚙ Settings). Consider split: "New Bankroll (keeps history)" vs "Nuke account." See memory `rml-reset-sync-loop`.

## ✅ SHIPPED Session 60 (SW v331→v340 · branch MERGED to main)
- 🟢 **MODEL LEAN TRACKING + AUTO-GRADING** (new): `lean_results` table + `api/snapshot-lean` (pre-game lock) + `api/cron-grade-leans` (*/30 1-9 + 14:00 UTC) + `api/lean-record`. ✓HIT/✗MISS chips on Game Center cards (outside+detail), Spotlight footer Today/Yesterday/All-time, split strong-vs-all. Spec/plan in docs/superpowers.
- 🟢 **O/U OFFENSE UPGRADE** (`api/_lib/offense.js`, tested): lineup xwOBA (platoon-adj) + recent scoring form added to game-info.js O/U score → can lean UNDER now, not just over. Built test-first (subagent-driven). Verified live (offenseSource=lineup). Spec+plan committed. Watch the tracked record ~1wk, tune `OFF` constants if needed.
- 🟢 **Spotlight** panel = ALL leans (ticker stays strong).
- 🟢 **#0 BET PLACEMENT (interim DONE):** `copyPickAndOpen()` copies the pick to clipboard + opens book on every path, relabeled "Log·Copy·Open →". Real HR betslip deep-link still needs an affiliate deal (decorate() hook ready).
- 🟢 **#0b TEST-DATA CLEAN (DONE):** wiped 89 test bets, bankroll set to **$500**. Had to CLOSE the tab — live React memory re-pushed on every delete (the #4 bug, live). 
- 🟢 **CREDIT-LEAK FIX:** `api/cron-warm-props.js` warms slate props us-only, floored 1500cr (was ~1.1k/day bleed). 🟢 **PHLT stale-gamelog bug FIXED** (form/streak now fresh). 🟢 whitelisted tjoel6788@gmail.com. 🟢 footer "gamble"→"bet" responsibly.

## 🎯 NEXT SESSION — start here (in order)

### ✅ #0 — RESET DOESN'T STICK — FIXED (session 61, SW v341, deployed)
Root cause: `syncAllBets` is upsert-only (supabase.js:69), and the debounced bets auto-sync (App.jsx:2528) had NO outbound suppression — only `realtimeIgnoreUntil` (inbound echo). A stale `syncAllBets(oldBets)` timer firing during the awaited cloud delete re-created the just-deleted rows (why the wipe only stuck after closing the tab). FIX: added `syncSuspendedRef` — set true before any cloud delete in `resetSession` + `deleteBetReliable`, checked in the auto-sync effect, cleared 100ms after the empty state settles. Build clean, deployed to app.riskmatrixlabs.com, verified live (v341, no console errors). NOTE: full add→reset→reload behavioral test NOT run on owner's live account (resetSession zeroes bankroll = destructive to real data) — verify on a throwaway account or after owner OK.
**STILL OPEN (separate, needs a product decision):** real reset UI + CH3 "RESET SCOREBOARD" stub (MatrixBot.jsx:1469) — decide bets-only vs nuke-everything (the "New Bankroll keeps history" vs "Nuke account" split) before wiring.

### 🆕 #0b — EV BRAIN — Phase 1 + first Phase-2 slice DONE (session 61, SW v342)
3 decisions made & baked in: ModelProb=de-vig consensus; "play" killed by brand rule → verdicts = **Prime/Strong/Lean/Pass**; universal grader keeps "PHLT" name (MLB hitter model untouched — no UI collision).
- 🟢 **Phase 1** `src/lib/evBrain.js` — pure core: evScore/clvScore/phltScore/disciplineScore(+penalties)/operatorRating/ladder/roundRobin/finalBetScore + label tiers + WEIGHTS (asserted sum=1). 24 tests.
- 🟢 **Phase 2 slice 1** — `verdictFromBetGrade` adapter feeds gradeBet.js's real evPct/clvPct/winProb (de-vig consensus closing lines) → **verdict pill on every BetCard + BetTicket header**. Grades on EV+CLV today; PHLT/discipline weights renormalize until those feeds land. Deployed, bundle healthy.
- ⬜ **Phase 2 remaining:** wire PHLT components (live MLB model) + discipline/operator (bet-log behavior) into the verdict; CH3 OPERATOR tile (already built, empty — feed operatorRating); tooltips; Spotlight ranking by final score. NOTE: verdict pill only renders when a bet is on screen — wasn't visually confirmed live (owner account had 0 bets; didn't log a test bet on the real account).

### ✅ SHIPPED Session 61 (SW v341→v360 · ~29 commits · all verified live in Chrome)
The model went from "looks broken / oversold" → honest, tracked, and surfaced everywhere. Themes:

**O/U model quality & honesty:**
- 🟢 **OVER-bias fix** — each factor's UNDER trigger made symmetric with its OVER trigger (ace arm / one shutdown pen / one tough-contact arm now push UNDER). Was 68% OVER leans @ 46%.
- 🟢 **Rating rebuilt as EDGE, not factor-count** — `game-info.js` now builds an INDEPENDENT projected total (park·starters·pens·offense·weather) and rates by `proj − market line`. `strong` = ≥1.5-run gap (rare, real). Backtest on yesterday was honest (3-5) — coefficients are a hypothesis, validated by the tracked record over time.
- 🟢 **BETA labeling** — amber BETA tag on the Spotlight ticker + every O/U flag + a panel disclaimer ("experimental, calibrating, not advice"). Positioning locked: **data, not picks.**
- ⚠️ **Rating is non-predictive on the current sample** (hi-conf 50%, lo-conf 57% over ~19) — known; needs weeks of data. Real fix = historical backtest (not tweakable tonight).

**Lean tracking / grading (now works end-to-end):**
- 🟢 **Self-heal from ESPN** — `cron-grade-leans` fetches the true final from ESPN when our `events` row is stale/frozen at IP (the overnight freeze). Captures **closing line + CLV** too (new `closing_line`/`clv` cols).
- 🟢 **Grades during the day** — cron widened `*/30 13-23 + 0-9 UTC` (was overnight + 14 UTC only), so afternoon/evening finals grade within 30 min.
- 🟢 **Result floats onto game cards** — `LiveResultChip` checks the lean off live (✓ Over cashed / ✗ Under bust / ● alive vs line), matching the Spotlight panel; locks to ✓HIT/✗MISS when final.
- 🟢 Spotlight rows: dead "no move yet" → **game time + model EDGE + live/graded result**; record panel = labeled grid (strong vs all, win % on both).

**Bad-data patches:**
- 🟢 `odds_total` 0/null → no longer becomes a fake `-0.5` line (game-info guard + sync guards write 0 as null + carry forward last good total). Manually set COL@CHC & SD@STL to their real 10.
- 🟢 Resumed/suspended games now show as LIVE (`fetchLiveEvents`/`isLiveEvent` 7h→30h) + stale "will resume" note hidden once live (fixed app showing 5 live vs Apple's 6).

**CH2 player-props flow (search → player):**
- 🟢 Killed the duplicate all-markets card (had the repeated Home Runs). Player season + last-5 **stats now sit on top of the PHLT card** (free ESPN; roster id map so every card can pull them).
- 🟢 Search lands clean: searched player **first**, **only their card open**, default team = their team + stat = first prop. All other cards **closed by default** (open on tap) so switching filters stays tidy.
- 🟢 **PLAYER PROPS moved up** — right under the today's-games slider, above Line Movement & Compare Books.

**Also:** EV Brain Phase 1 + verdict pill (see #0b above), reset-doesn't-stick fix (#0 above).

### ✅ SHIPPED Session 59 (SW v293→v331)
Spotlight (3-pillar ticker + panel, factors hidden, +Slip w/ real free odds), totals half-point default, cloud-sync delete/reset/bankroll FIX, slip centered + per-single stake/book chooser, slip↔ladder, RR Engine (single-col, team inputs, slate search, Float-to-RR, Combos Built/Novig sheet), universal card cleanup. Specs: `2026-06-17-slip-to-ladder-design.md`, `2026-06-17-rr-slip-integration-design.md`.

### Then (was the priority before placement surfaced):
**(Spotlight v0 shipped; EV Brain still queued.)**
0. 🟢 **SPOTLIGHT v0 SHIPPED (session 59, SW v298)** — `SpotlightTicker` in LiveCenter.jsx: Game Center tagline replaced with a scrolling ⬡ SPOTLIGHT (N) ticker (CH1-TV-crawl style) of today's STRONG O/U leans (self-fetches free cached game-info per MLB game, `strong`-gated), tap-to-open the game. NEXT for Spotlight: add PHLT prop signals + EV edges (needs slate-wide prop cron = credits); snapshot-at-surface to track Spotlight win-rate; the real cross-type ranking still wants the EV Brain unified score.
1. 🆕 **Spec SPOTLIGHT** (superseded by v0 above — extend it) (new idea, owner-approved concept) — dismissible, confidence-ranked panel of today's GREEN model signals (O/U leans + PHLT + EV edges) → clickable to game/log. NOT a moving marquee (off-brand/bad UX) — a pinned static panel `⬡ SPOTLIGHT (N)`. **It's the EV Brain's first surface** (real cross-type ranking needs the unified score). v0: `strong`-gate + factor-count + bullpen-priority + `edge` value-tag as lines move. Free O/U leans fill cheaply; prop signals need a slate-wide cron (credits). Future: snapshot at surface-time → track Spotlight win-rate. Frame as "leans/edges," never "picks." (Today's proven list: 5 strong OVERs — KC@WSH, PIT@ATH, COL@CHC, TB@LAD, DET@HOU.)
2. ⚠️ **DECIDE 3 things** before EV Brain code (memory `rml-evbrain-spec`): (a) PHLT name collision → rename MLB hitter model; (b) ModelProb source → de-vig consensus; (c) "Play" label vs no-"play" brand rule.
3. 🟡 **EV Brain Phase 1** — `src/lib/evBrain.ts` pure scoring fns + constants + bet schema + labels + tests. Unlocks Spotlight ranking + CH3 OPERATOR tile + verdict badges.
4. 🟡 **EV Brain Phase 2** — wire ModelProb/CLV/Discipline to real feeds; fills the empty CH3 OPERATOR tile + card verdict slots (already built waiting).
5. 🟡 **CH3 gear deferred actions** — settle-manually, sport-filter, share, delete-position, real RESET handler (all stubs now).
6. 🟡 **Per-leg box-score** for cross-game parlay prop legs (currently only the bet-level matched game gets box scores). + make Hard Rock always-in-scan + fix LineShop "show-all-first" tap.

**Pending/blocked:** ANTHROPIC_API_KEY (OCR, owner-pending) · NFL · umpire + lineups for O/U (no free data) · bullpen FATIGUE (needs daily IP accumulation).

**Done this session, do NOT redo:** CH3 TRACK redesign (was item #4 — DONE), universal bet cards, live stat bars, win rings, slip multi-add fix.
