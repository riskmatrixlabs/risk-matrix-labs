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

## 🎯 NEXT SESSION — start here (in order)

### 🚨🚨 #0 — BET PLACEMENT TO HARD ROCK (owner stopped here frustrated — SW v331)
Owner: "trying to place top 4 on Hard Rock, no link works. if i can't do that users won't use it." The "Place" buttons open the HR OneLink (app/homepage) but **don't pre-fill the pick** — no public betslip deep-link exists. **THIS is the #1 priority.** Fix paths: (a) Hard Rock **affiliate/data deal** with real betslip deep-links — code hook ready in `decorate()` (`src/lib/betLinks.js`, empty passthrough); (b) if no deal, **relabel "Open Hard Rock →"** + set expectations + **copy pick to clipboard** so user pastes/searches fast; (c) test if HR app has ANY share/betslip URL scheme on a real device. See memory `rml-bet-placement-blocker`.

### 🧹 #0b — CLEAN TEST-DATA POLLUTION
Owner bankroll inflated to ~$11k (unit $221.94) + 4 fake "live bets" from Claude's flow-testing. NOT real. Delete the test bets + reset bankroll to owner's real start (ASK the number). Delete/reset works now (cloud-sync bug fixed) — but close all sessions/tabs first (a live tab re-pushes; see `rml-reset-sync-loop`).

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
