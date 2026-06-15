# Risk Matrix Labs — Master Backlog (snapshot 2026-06-13, session 50)

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
