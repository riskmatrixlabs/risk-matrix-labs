# Risk Matrix Labs — Claude Rulebook

## PROJECT
- **App:** https://app.riskmatrixlabs.com
- **Landing:** https://riskmatrixlabs.com
- **Stack:** React 18 + Vite + Supabase + Stripe + Vercel
- **GitHub:** github.com/riskmatrixlabs/risk-matrix-labs (private)
- **Version:** v2.6
- **Owner email:** michaeltejeda08@gmail.com (bypasses paywall)

## RULES — ALWAYS FOLLOW
- Fix one bug at a time
- Explain what you find before fixing
- Use brand colors always (#BDFF00 / #0A0A0A / #FF3B3B)
- Mobile first always
- Clean scalable production-ready code
- Do not rush
- Do not overwhelm
- Step by step always
- Operate With Discipline
- **ALWAYS ASK BEFORE ACTING** — when there is ANY ambiguity (wrong files, multiple options, unclear intent), stop and clarify. Never assume and execute. Show what you found, ask which to use, then proceed.
- **NEVER POST OR PUBLISH ANYTHING** without explicit user approval first.

## BRAND
- **Primary:** #BDFF00 neon green
- **Background:** #0A0A0A
- **Danger:** #FF3B3B red
- **Fonts:** Rajdhani (headlines) + Inter (body)
- **Tagline:** "Operate With Discipline."
- **Positioning:** "Bankroll Simulator" (product) by Risk Matrix Labs (company)
- Users are "operators" not "gamblers" or "bettors"
- Avoid: gamble/gambling, luck, easy, tips, picks, tracker

## PLUGINS / MCPs INSTALLED
- Superpowers (skills system)
- Vercel MCP
- Supabase MCP
- GitHub MCP
- Canva MCP
- Notion MCP → workspace: Risk Matrix Labs HQ
- Buffer MCP → org: My Organization (riskmatrixlabs@gmail.com)
  - Instagram channel ID: 6a1e6212c687a22dd44f24c5
  - TikTok channel ID:    6a1e629dc687a22dd44f261b
  - X/Twitter channel ID: 6a1e63d0c687a22dd44f2d3b

## CONTENT AUTOMATION (as of Session 36 — Jun 10 2026)
Pipeline: Claude writes → Notion Post Queue (Draft) → YOU approve → Claude pushes to Buffer

**Notion Post Queue:**
- URL: https://app.notion.com/p/f0a42a8582b94884937d80ff0b90bb97
- Parent: Content Calendar → Risk Matrix Labs HQ
- Status flow: Draft → Approved → Scheduled → Posted

**How to trigger a Buffer push:**
1. Open Post Queue in Notion
2. Set Status = Approved on posts you want scheduled
3. Tell Claude: "push approved posts to Buffer"
4. Claude reads Approved rows → creates Buffer posts → updates Status to Scheduled

**Image limitation:** Buffer API needs hosted image URLs, not local file paths.
To attach images: upload to Canva/Google Drive/Imgur → paste URL into "Image File" column before approving.

**Campaign images location:** ~/Desktop/rml-reel/public/campaign/ (24 files)

## ARTIFACT TO ALWAYS UPDATE
After every session where we add new tools, prompts, install commands, or workflow updates:
- Update `/Users/michaeltejeda/Desktop/rml-master.html` with new information
- Never let it go stale — this is the single source of truth

## DEPLOY
```
npm run ship      # GUARDED: runs tests + undefined-variable check + build, deploys ONLY if all pass
```
(`npm run ship` = `test && check:undef && build && vercel deploy --prod --force`. The `check:undef` step
catches the class of bug that crashed prod when <MoveArrow> was deleted but still referenced.)
Raw deploy (skips the guard — avoid): `npm run build && npx vercel deploy --prod --force`
Always bump `public/sw.js` CACHE (`rml-vNNN`) before any deploy or the PWA serves a stale white screen.

## TEST
```
npm test                          # 40 unit tests
npx vite build && npx vite preview --port 4173   # prod preview for Playwright
```
Never use the Vite dev server for Playwright testing — always prod build.

## KEY IDs
| Service | ID |
|---|---|
| GTM | GTM-T5VS52G8 |
| GA4 | G-8N1DZQECLP |
| TikTok Pixel | D8EJ2KRC77UA4F3II3R0 |
| Meta Pixel | 974544022029123 |
| Rewardful | fdbb6c |
| Crisp | 470f77af-d0cb-4f5c-a540-44cbf5d7465c |
| Beehiiv Form | d6ea407b-4704-4045-be5f-b241d4b3c26b |
| Supabase | ocsrwhjypawbeoeyhfnc.supabase.co |
| Stripe Monthly | price_1Tf56QJEv6JkAZy9zxplxbSI |
| Stripe Annual | price_1Tf58cJEv6JkAZy9kzUbPCDV |

## PAYWALL BYPASS WHITELIST
- michaeltejeda08@gmail.com (owner)
- josiahteem@yahoo.com
- tremizy@gmail.com
- j.willey2489@gmail.com
- lauriesjeanpaul@gmail.com
- tjoel6788@gmail.com
- mmartinez2014@icloud.com
- ryancollado7@gmail.com (founder's younger brother — internal tester)

## WORKFLOW FOLDER
```
workflow/
├── scripts/     ← Claude writes video scripts here
├── prompts/     ← image + video prompts saved
├── remotion/    ← branded video templates
├── assets/      ← generated images + clips
└── n8n/         ← automation workflows
```

## BANKROLL MODEL
- `masterBankroll` → primary display, unit/risk calcs (unit = masterBankroll × 2%)
- `bankroll` → starting bankroll — ALWAYS starts $0, never persisted to localStorage
- `ladderStarting` → ladder session stake, auto-inits to 15% of masterBankroll
- Ladder uses session key UUID — never delete bets, just scope by key

## SUPABASE TABLES
- `bets` — all bet data including ladder_session field
- `user_settings` — settings including ladder_session_key
- `deleted_bets` — deletion tombstones (user_id + client_id); read on load so a deleted bet can't resurrect via stale-device merge (S68 sync fix; see `src/lib/reconcileBets.js`)
- `subscriptions` — Stripe subscription status
- `push_subscriptions` — web push tokens

## API FILES
| File | Purpose |
|---|---|
| `api/webhook.js` | Stripe webhook handler — sends win-back email on subscription.deleted |
| `api/create-checkout.js` | Creates Stripe checkout session |
| `api/billing-portal.js` | Opens Stripe billing portal |
| `api/lib/emails.js` | All 8 email functions: sendWelcome, sendTrialEnding, sendPaymentFailed, sendSubscriptionActivated, sendDayOne, sendTrialExpired, sendWinBack, sendReengagement |
| `api/cron-day-one.js` | Runs 3pm daily — finds users created 23-25h ago, sends sendDayOne |
| `api/cron-trial-expired.js` | Runs 4pm daily — finds trialing subscribers past trial_end, sends sendTrialExpired |
| `api/cron-reengagement.js` | Runs 1pm daily — finds active subscribers with no bets in 14+ days, sends sendReengagement |
| `api/cron-trial-ending.js` | Existing — trial ending warning |

## GA4 EVENTS (dataLayer push → GTM)
| Event | Where | Trigger |
|---|---|---|
| `trial_started` | AppRoot.jsx | checkout=success URL param |
| `subscribed` | AppRoot.jsx | subStatus resolves active |
| `churned` | AppRoot.jsx | subStatus resolves canceled |
| `bet_logged` | App.jsx | First non-ladder bet only |

## PRICING (DO NOT CHANGE WITHOUT SESSION)
- $29/mo or $149/yr (annual default on paywall)
- 3-day free trial — no charge until day 4

## SESSION 50 ADDITIONS (Jun 14 2026 · SW rml-v144 · commit b7c55a3)
**New API files:**
| File | Purpose |
|---|---|
| `api/player-search.js` | typed name → today's game via FREE ESPN rosters (0 Odds-API credits), cached `PLAYERS:<sport>:<date>` |
| `api/parse-betslip.js` | **OCR**: bet-slip photo → legs via Claude vision. **NEEDS `ANTHROPIC_API_KEY`** |
| `api/backfill-book-odds.js` | one-time per-book history seed, guarded `?confirm=SEED&sport=&hours=&stepMin=&regions=&markets=` |
| `api/cron-capture-book-odds.js` | per-book ML snapshots */30 (regions us,us2,eu — eu only for Pinnacle); registered in vercel.json |
- `api/game-lines.js` + `api/scan-props.js` now per-game CACHED (90s / 2min) via scanStore; game-lines persists per-book ML/spread/total snapshots to `odds_history` on view.

**Keys / env:**
- ⚠️ **PENDING: `ANTHROPIC_API_KEY`** — owner is creating it; add to Vercel env, then Upload Pic OCR works. (Model in code: `claude-haiku-4-5-20251001`.)
- `ODDS_API_KEY` = paid plan (~11.7k credits left as of session end).

**Supabase changes:**
- `bets` table: added `legs jsonb` (parlay legs `[{pick,odds,book,sport,event}]`, null = straight) + `ladder_session text`.
- `odds_history` table: `book` column = per-book snapshots (powers By-Sportsbook chart + Bet Matrix line-shop).

**Resume point:** Bet Matrix (slip + parlay + per-book line-shop "link page" for game lines AND props) is fully wired. Only OCR is dark — drop in ANTHROPIC_API_KEY to finish. Full backlog: `docs/superpowers/specs/2026-06-13-rml-backlog.md`.

## SESSION 52 (Jun 14 2026 · branch `feat/game-browser-lab`, NOT merged to main · prod deployed from this branch)
**Game browser added to CH2 as a free game-picker.** Read `docs/superpowers/HANDOFF-game-browser.md` FIRST — it has full state, invariants, gotchas.
- **CH1/CH3 untouched. CH2 LookChannel detail (chart/line-shop/movement/props) untouched.** Only change: CH2's no-game landing now shows `EventsPicker` (free sport circles + search + today's slate w/ team logos, 0 Odds-API credits). Tapping a game → `tuneTo(g)` → the SAME existing LookChannel renders. Two doors now feed `tuneTo`: CH1 scan/search + the CH2 browser.
- **Parked / unused:** `GameBrowser.jsx` + `GamePage.jsx` (Lab's standalone market-tab UI — duplicated LookChannel, removed from flow; decide delete vs salvage). `?full=1` path on `game-lines.js`/`scan-props.js` (segments, team totals, 16 prop markets) is DORMANT — it timed out in serverless (returned HTML), so the Lab uses the cheap proven endpoints. Revisit deeper markets via precompute/cron, NOT on-demand.
- **⚠️ NEXT = design the end-to-end UX flows for all 3 channels BEFORE coding** (owner says current flows aren't right). Then build CH3. Don't guess flows.
- Gotchas: `vite preview` doesn't run `/api`; preview `*.vercel.app` URLs serve HTML for `/api` (always test on app.riskmatrixlabs.com); `ODDS_API_KEY`/`VITE_SUPABASE_*` are Production-scoped only.

## SESSION 53 (Jun 14 2026 · branch `feat/game-browser-lab` · SW rml-v177 · prod deployed)
**CH2 rebuilt into the analysis engine + bug fixes. Verified live via Chrome MCP on the slate.** Files: `src/components/MatrixBot.jsx`, `src/components/EventsPicker.jsx`, `src/App.jsx`, `src/lib/propEdges.js`, `src/lib/oddsHistory.js`, `api/scan-props.js`, `api/player-search.js`, `api/_lib/scanStore.js`.

**CH2 layout (one screen, slider always on top, detail inline — no page switch):**
- `EventsPicker` = game selector ALWAYS on top: square-card slider (incl. LIVE games tagged ● LIVE — `isLiveEvent` no longer hides them), league-logo sport circles (small), **unified free search of teams AND players** (player match → `onPickPlayer` → tuneTo game+player). Selected card highlighted.
- Detail order: **LINE MOVEMENT** (top, open) → **PLAYER PROPS** (collapsed default) → **COMPARE BOOKS**. Each a collapsible `LookSection` (grid 0fr→1fr animation).
- **LINE MOVEMENT** = by-book chart, ML/Run Line/Total tabs, **Since Open / 24H / 6H** time-frame chips (client-side window, free), **SINCE OPEN verdict** (open→now, ▲ moved your way / ▼ late). Junk-odds filtered per-book in `fetchBookMovement` (oddsHistory.js): drop points outside the book's own median ×0.82–×1.25 (kills -5000/-50000/-2000 spikes).
- **PLAYER PROPS = grouped BY PLAYER** (PrizePicks model): scannable collapsed player list (accordion, one open at a time) → expand → lines grouped by stat type, compact rows (line# + ▲more/▼less price chips). Stat tabs (sport-correlated `PROP_MARKETS[sport]`) + **team filter (BOTH·away·home)** pinned on top, always present. Counts reflect active filters. **Real ESPN headshots** joined by name in scan-props (`rosterMap`, last-name fallback). Props **always findable** — removed pre-game gate (`preGameOnly:false`) so you can build a slip on live games too.

**Edge model on props (the "is it a good bet" answer):** each chip shows best price + book + edge. `+X%` = sharp (Pinnacle de-vig). `~X%` = **consensus edge** (de-vig every book, average fair prob; `propEdges.consensusFair`, capped 1–15%). ▲/▼ = **since-open movement** (NEW — see prop history).

**NEW — prop history (`prop_history` table, migration applied):** view-driven snapshots in scan-props (`capturePropSnapshots`), `fetchPropOpens` returns earliest price = "open"; each prop gets `openPrice` → ▲/▼ vs open on the chip. **Builds over time** — first scan: open=current (no arrow); fills as scans accumulate. $0 extra credits.

**Bet Matrix (`src/App.jsx` ~3056):** redesigned — books **on top** (best book ✓ + neon border), **bold neon odds/payout** (20px per-book combo, 16px legs/payout/header), drawer `maxHeight:72vh` + scroll.

**Bugs fixed this session:** (1) **sport mismatch** — props/chart used the filter sport not the game's → sent `sport=NHL` for an MLB game = blank props; now `game.sport || sport` everywhere. (2) live games hidden from picker. (3) duplicate "ALL" + filter count showing total not filtered.

**Caching/credits (~8k left — DISCIPLINE):** props cached **30 min** (was 2 min), shared in `scan_cache`; stat/team/player filtering = client-side FREE; RE-SCAN = manual refresh. Game-lines stay live 90s (owner watches). See [[rml-ch2-vision]] in memory for the locked CH2 spec.

**Still open / next:** ANTHROPIC_API_KEY for OCR Upload Pic (still pending owner); prop "open" accuracy improves as history accrues; NFL not supported (only MLB/NHL/NBA/WNBA — adding it = new sport key + prop markets); CH3 TRACK still original (collapsible panels added but not redesigned); decide GamePage delete vs salvage; for LIVE games props can be 30-min stale (shorten cache for live if wanted). `rml-master.html` NOT updated this session.

## SESSION 54 (Jun 15 2026 · branch `feat/game-browser-lab` · SW rml-v178→v217 · all deployed) — see docs/superpowers/HANDOFF-models.md
**Big slip + CH2 polish pass, then the start of two real models.** ~40 deploys; tree clean.
- **Slip → bottom-left neon ticket FAB** (opens upward; 📷 Pic + 📊 Analyze + ➦ Share). Centered confirm + log modals. **Parlay/Straights toggle**, per-leg on/off switches, edge badges, "PLACE ON <book>" CTA, every parlay book row tappable, per-book **deep links** (`byBookLink`), "not in region" → top-2 + dropdown. Crisp chat removed.
- **CH2:** chart junk-spike fixed (consensus-prob outlier reject); date strip wired; Line-Movement ⚙ gear; props open by default + ↻ REFRESH; all prop cards open; stat tab defaults to first prop; **−EV no longer green** (green=+EV, red=−EV, fixed the "+EV but negative" confusion); Player Props moved BELOW Compare Books; `--muted` brightened for readability.
- **Books:** Novig/ProphetX/Fliff/Rebet surfaced via `us_ex` region (Onyx = sign-up only, not in feed); nationwide-placeable in `geoBooks`.
- **CREDIT FIX (important):** opening a game = **0 credits**. `scan-props`+`game-lines` serve `cacheOnly` on auto-load; paid fetch only on explicit ↻ REFRESH (which adds `us_ex`/Novig). Was bleeding before.
- **Player card:** real ESPN stats — season line + LAST-5 form (`api/player-stats.js`, free, 15min cache; id captured in `player-search`).
- **Game card:** `api/game-info.js` (free ESPN, date-aware, fetch-timeout + try/catch hardened) → logos, W-L, status/score, MLB pitchers + ERA, and **Over/Under lean flag** (ballpark factor + starter ERA). New `GameCard` in MatrixBot.
- **Flows verified live:** CH1 search→CH2 and CH1 bot-pick→CH2 both carry through. Fixed a credit leak in the player-search path (PlayerProps was paid; now cacheOnly).

**NEXT = build two models, both FREE (planned, not built):** **(A) PHLT v2.2** hitter-hit prop scorer (Pitcher 30/Form 30/Matchup 15/Park-Weather 10/Streak 15 → A/B/C/Avoid + fades) into Player Props — Statcast (whiff/xBA) confirmed free from **Baseball Savant CSV**, match by name. **(B) O/U totals** model on the game card — add bullpen+weather+umpire+lineups, anchor lean to the live total. Full plans + memory: `rml-phlt-model`, `rml-ou-model`, `HANDOFF-models.md`. Still open from before: ANTHROPIC_API_KEY (OCR), CH3 TRACK redesign + parlay grading, NFL.
