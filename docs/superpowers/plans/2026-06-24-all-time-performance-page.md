# Plan — Public "All-Time Performance" Page (SharpMoney-style)

> Status: 🔵 in design · Owner-approved concept (backlog "highest-leverage *buildable* work").
> Read first: `docs/superpowers/specs/2026-06-13-rml-backlog.md` (Session 68 NEXT block, line 46),
> `src/components/SpotlightTicker.jsx` (the record MATRIX, lines 339–382 — this is the v0 to extend).

## Goal
A filterable dashboard showing the platform's **graded model track record** (not user bets) —
W-L-P, win%, CLV, and breakdowns across every model surface: O/U totals, Team ML, Run Line
(all in `lean_results`), and PHLT hitter props (`prop_results`). Frame as **transparency / a
self-graded record**, never "picks" or guarantees. This is the EV-Brain's first full public surface.

## Why now (data already exists — no new capture)
The grading loops are already baking and writing rows:
- `lean_results` ← `api/snapshot-lean.js` (locks pre-game) + `api/cron-grade-leans.js` (grades).
- `prop_results` ← `api/cron-snapshot-phlt.js` + `api/cron-grade-props.js`.
- `bets` ← the user's own logged bets (separate, personal — NOT the model record; keep distinct).

## Data dimensions available (the filter/breakdown surface)

### `lean_results` (read by `api/lean-record.js`)
Selected columns (`lean-record.js:32-34`): `external_event_id, game_date, market, lean,
pick_side, total_line, confidence, strong, result, final_total, closing_line, clv`.
Written by `buildLeanRows` (`api/snapshot-lean.js:23-78`) — also has `sport` (default `MLB`,
upper-cased, `snapshot-lean.js:28`), `edge_runs`, `model_version`.
- **market** — `total` | `ml` | `rl` (one row per game/day/market; unique key
  `external_event_id,game_date,market`, `snapshot-lean.js:95`).
- **strong** (bool) — the Spotlight-surfaced subset. KEY filter ("strong-only").
- **result** — `W` | `L` | `P` | null(pending).
- **clv** / **closing_line** — closing-line value, already captured (great for a CLV tile).
- **confidence** (factor count), **edge_runs** (projected edge), **game_date** (ET, `YYYY-MM-DD`).
- ⚠️ **ML/RL reset**: `lean-record.js:43` gates ML/RL counts to `game_date >= '2026-06-23'`
  (the HFA-bug fix). O/U counts all. Carry this rule into the new endpoint verbatim.

### `prop_results` (read by `api/prop-record.js`)
Columns (`prop-record.js:34-39` + writer `cron-snapshot-phlt.js:71-83`): `game_date, sport,
external_event_id, away_team, home_team, away_abbr, home_abbr, player, prop_market` (=`hits`),
`prop_line` (0.5), `lean` (OVER), `phlt_tier` (A/B/C = Prime/Strong/Caution), `result`.
- **phlt_tier** is the breakdown dimension. AVOID/null tiers ignored in `byTier`
  (`src/lib/propRecord.js:5`). Pushes excluded from win% denominator (`propRecord.js:7-11`).

### What's FREE vs paid
- **100% FREE** — every record number is a pure Supabase read of already-graded rows
  (`lean-record.js`, `prop-record.js` set no-store, hit no Odds-API). The whole page costs
  **0 Odds-API credits**. Charts/filters/aggregates are all client- or SQL-side.
- **Paid / not available** — none required for v0–v2. (Per-bet ROI in *units* needs a stake
  assumption; we treat each model call as a flat 1u to compute units/ROI — documented, not paid.)

## How the existing record UI works (the v0 base to lift from)
`SpotlightTicker.jsx` already fetches both endpoints when its panel opens
(`SpotlightTicker.jsx:31-34`) and renders a **record MATRIX** (`:339-382`):
- rows = Today / Yesterday / All-time; columns = O/U · TEAM ML · RUN line · PHLT(A/B/C) · ALL master.
- pure helpers inline: `fmtRec`, `pct`, `sumRec` (`:342-344`) — **extract these to a lib** so the
  new page and Spotlight share one source of truth (currently duplicated/inline).
This matrix IS the all-time table v0 — the new page is "this matrix, full-screen, with filters + charts."

## Routing / where the page slots in
There is **no react-router** — navigation is a single `tab` string state in `App.jsx`
(`const [tab,setTab] = useState(...)`, `App.jsx:2467`); content renders via `{tab === '...' && ...}`
blocks. Three pillars: `live` (Game Center) · Dashboard group · `bot` (Matrix Bot).
- **Desktop nav**: primary pillars at `App.jsx:4545`; the Dashboard **sub-row** `sub` array at
  `App.jsx:4546` (`overview/analytics/ladder/bet log/rr engine/session/partners`).
- **Mobile**: bottom-nav `nav` button array at `App.jsx:5528-5536`.
- **Decision**: "All-Time Performance" is an analytics surface → it belongs in the **Dashboard
  pillar** as a new sub-tab `'performance'`. Add `['performance','Performance']` to the desktop
  `sub` array (`:4546`) AND the mobile bottom-nav array (`:5528`, pick an icon e.g. `Trophy`/`Award`
  from lucide), AND the Spotlight-visible tab list (`:4641`) so the ⬡ ticker shows above it.
- Render with `{tab === 'performance' && <PerformancePage token={token} ... />}` alongside the other
  `tab ===` blocks (same pattern as `tab === 'overview'` at `App.jsx:4669`).

## Page design

### Filters (top, sticky, mobile-first chip row)
- **Model** — All · O/U Totals · Team ML · Run Line · PHLT Props (maps to `market` + prop tiers).
- **Strong-only** toggle — filters `lean_results.strong` (the Spotlight subset). Headline question:
  "does the strong filter actually pick winners?" (the endpoint comment at `lean-record.js:3-4`).
- **Date range** — All-time · Last 7d · Last 30d · This month (windows on `game_date`).
- **Sport** — All · MLB (today only MLB has graded model rows; KBO lives separately in `kbo_leans`
  via `api/kbo-record.js` — surface as its own optional section, not the main filter, to start).
- (PHLT-only) **Tier** — A/B/C when Model = PHLT.

### Summary tiles (responsive grid, brand cards)
1. **Record** — W-L-P (reuse `fmtRec`).
2. **Win %** — pushes excluded from denominator (match `propRecord.winPct`, `lean-record` `pct`).
3. **Units / ROI** — flat-1u model: units = `(W·(dec−1)) − L`; ROI = units / (W+L). For O/U/props
   use −110 default when no price stored; for ML use `pick_side` price if available, else flat.
   Label "model units (1u flat)" so it's honest, not a bankroll claim.
4. **CLV** — average `lean_results.clv` over graded rows that have it (totals have it today). Strong
   selling point — "we beat the close by X%."
5. **Sample size** (n graded) — with a "still calibrating" note under the threshold (mirror the
   `pct` n≥3 guard and `calibration.js` `ready` flag at n≥250).

### Breakdowns / charts (phased)
- **By model** table — O/U vs ML vs RL vs PHLT-tier (the Spotlight matrix, full width).
- **Strong vs All** side-by-side (the endpoint already returns both: `record.all` vs `record.strong`).
- **Win% over time** line/bar by day or week (group graded rows by `game_date`).
- **CLV distribution** histogram (buckets of `clv`).
- **Recent graded calls** feed — last N graded rows with ✓HIT/✗MISS chips (reuse the chip styling
  from `SpotlightTicker.jsx:190-206`).

### Brand rules (CLAUDE.md:24-33, BRAND_VOICE.md)
- Colors via CSS vars / constants only: `#BDFF00` (NEON), `#0A0A0A` (bg), `#FF3B3B` (danger);
  Rajdhani headlines + Inter body. Use existing `botShared.jsx` exports (`NEON, MUTED, CARD,
  BORDER, TEXT`) — already imported by Spotlight.
- **No gambling words** (no picks/tips/lock/gamble/bettors). Use "leans / signals / calls / record".
  Keep the **BETA** disclaimer block (copy `SpotlightTicker.jsx:156-160`).
- Operators-not-gamblers tone; mobile-first (single 580px desktop column per S58 unification).

## API: reuse vs new

### v0/v1 — REUSE existing endpoints (no new API)
`api/lean-record.js` already returns `{ all, strong, team, ml, rl, games }` each split
today/yesterday/allTime; `api/prop-record.js` returns `{ overall, byTier, today, yesterday }`.
For the first cut, fetch both (exactly as Spotlight does) and render full-screen. **No backend work.**

### v1/v2 — NEW combined `api/performance.js` (when filters need server aggregation)
The existing endpoints hard-code today/yesterday/allTime and pre-split markets — they can't do
arbitrary date ranges or per-day series. Add **one** new read-only endpoint:
- `GET /api/performance?model=&strong=&sport=&from=&to=` → returns the raw graded rows (or
  pre-aggregated tiles + a daily series) from `lean_results` + `prop_results`.
- Pattern-match the existing files: `requireAuth` (`api/_lib/auth.js:8`), `db()` service-role
  client, `etDate` helper, `Cache-Control: no-store`, fail-soft `{ ok:false, ...EMPTY }` at 200.
- Keep ALL aggregation math in a **pure lib** (below) so it's unit-tested and shared with Spotlight.

## New pure lib functions (testable, shared)
Create `src/lib/performance.js`:
- `fmtRec(r)`, `winPct(w,l)` (reuse/move from `propRecord.js`), `sumRec(...recs)` — lifted from the
  inline Spotlight helpers (`SpotlightTicker.jsx:342-344`) so both surfaces share them.
- `unitsRoi(rows, {priceDefault=-110})` → `{ units, roi }` (flat-1u model).
- `avgClv(rows)` → mean of non-null `clv`.
- `dailySeries(rows)` → `[{date, w, l, p, winPct}]` for the over-time chart.
- `bucketClv(rows)` → histogram buckets.
- `applyFilters(rows, {model, strong, sport, from, to})` → filtered subset (enforce the
  `ML_FIX_DATE >= '2026-06-23'` gate for ml/rl, mirroring `lean-record.js:43-47`).
Tests go in `tests/performance.test.js` (Vitest — matches `tests/propRecord.test.js`,
`tests/gradeLean.test.js` convention). Cover: win% push-exclusion, units math, ML-fix-date gate,
empty/zero rows, date-range windowing.

## Phased, task-by-task build

### Phase 0 — extract shared record helpers (refactor, no behavior change)
- T0.1 Create `src/lib/performance.js` with `fmtRec`, `winPct`, `sumRec` (move from inline).
- T0.2 Write `tests/performance.test.js` for those three (TDD).
- T0.3 Refactor `SpotlightTicker.jsx:342-344` to import from the lib (verify matrix unchanged in Chrome).

### Phase 1 — v0 page (reuse endpoints, static all-time)
- T1.1 Create `src/components/PerformancePage.jsx` — fetch `/api/lean-record` + `/api/prop-record`
  (copy Spotlight's fetch, `:31-34`), render: header + BETA disclaimer + summary tiles (Record,
  Win%, n) + the full record matrix (lift `:339-382`) + Strong-vs-All.
- T1.2 Wire routing: add `'performance'` to desktop `sub` (`App.jsx:4546`), mobile bottom-nav
  (`:5528`), Spotlight-visible list (`:4641`); add `{tab === 'performance' && <PerformancePage .../>}`.
- T1.3 Chrome-verify live on app.riskmatrixlabs.com (NOT vite preview — `/api` won't run, per CLAUDE.md:84).

### Phase 2 — v1 filters (new endpoint + lib aggregation)
- T2.1 Add `api/performance.js` (auth, service-role read of both tables, fail-soft).
- T2.2 Add `applyFilters`, `unitsRoi`, `avgClv` to `performance.js` lib + tests.
- T2.3 Wire filter chip row (Model / Strong-only / Date range / Sport) → re-query or client-filter;
  add Units/ROI + CLV tiles.

### Phase 3 — v2 charts
- T3.1 Add `dailySeries` + `bucketClv` lib fns + tests.
- T3.2 Win%-over-time chart + CLV histogram + recent-graded-calls feed (reuse chip styling).
  Reuse `BookMoveChart.jsx` conventions if a chart primitive helps; otherwise lightweight SVG.

## Risks / gotchas
- **ML/RL reset date** (`lean-record.js:43`) — must carry the `>= 2026-06-23` gate or the record
  shows the broken HFA losses. Single source: enforce in `applyFilters`.
- **Tiny sample** — most cells are n<10 today; keep the n≥3 win% guard + BETA note (don't oversell).
- **Don't conflate** the user's `bets` record with the model record — this page is the MODEL's
  track record. (A user-bet performance view is a separate, existing CH3/Dashboard surface.)
- **Test on prod build only** for `/api` (CLAUDE.md:82-84); bump `public/sw.js` CACHE before deploy.
- `npm run ship` is guarded (test + check:undef + build) — keep tests green (currently 534).

## ⭐ REFINEMENT (Session 68, owner-directed) — DETAILED CALL LIST + logos + panel entry

Owner's ask: the page is "where you list ALL calls, detailed, **with logos** + **settings/filters**" — not just the tally matrix. And the **entry point is a button in the Spotlight panel's top-right corner**, not a new nav item front-and-center.

### Entry point — `FULL RECORD →` button (Spotlight panel corner)
- Location: `src/components/SpotlightTicker.jsx:154` — the panel header line `⬡ Spotlight — Today, ranked strongest first`. Make that a `justify-content: space-between` flex row; pin a small ghost button to the **right corner** (Rajdhani 9–10px, neon text, 1px neon-dim border, transparent bg). NO height added, NO side-by-side waste.
- Behavior: new optional prop `onOpenRecord` on `SpotlightTicker`; parents (`LiveCenter.jsx` Game Center + `MatrixBot.jsx` top bar) pass a handler → `setTab('performance')`. Panel renders in BOTH pillars → two doors for free.
- Label decided: `FULL RECORD →`.

### Detailed per-call row (THE main content — with logos)
Reuse, don't reinvent (per the S68 research sweep):
- **Logos:** join `lean_results`/`prop_results` → `events` on `external_event_id` → `events.away_logo`/`home_logo` (`src/lib/events.js:11`). Render with the existing **`Avatar`** (`src/components/BetCard.jsx:111`): **dual diagonal crests for O/U totals**, **single crest for ML/RL** (resolve via `pick_side` HOME/AWAY), **`LEAGUE_LOGO[sport]` fallback** (`MatrixBot.jsx:31`).
- **Result chips:** reuse `GradedFlag` / `TeamGradedFlags` / `LiveResultChip` (`LiveCenter.jsx:142/159/193`) — ✓HIT / ✗MISS / ● alive.
- **Row anatomy (left→right):** crest(s) · `AWAY@HOME` · the call (`OVER 8.5` colored by side / `TB ML` / PHLT `player hits o0.5` + tier badge) · `LINE open→final` · CLV · result chip · date. Strong leans get the neon-tint background (match Spotlight row `:168`).
- Group/sort: newest first; section dividers by date; PHLT props grouped under their game.

### New endpoint — `api/all-time-calls.js` (per-call rows; the existing record APIs are aggregate-only)
- `GET /api/all-time-calls?model=&strong=&sport=&from=&to=` → `{ leans:[...], props:[...] }`, each row already joined to `events(away_logo,home_logo,away_abbr,home_abbr,away_team,home_team,sport,status,away_score,home_score)`.
- Pattern-match `lean-record.js`: `requireAuth`, service-role `db()`, `Cache-Control: no-store`, fail-soft `{ok:false,leans:[],props:[]}` at 200. `.order('game_date',{ascending:false})` + `.limit(2000)` (date-filter for older). FREE (0 Odds-API).
- Carry the **ML/RL `game_date >= '2026-06-23'` gate** (`lean-record.js:43`) into `applyFilters`.

### Settings / filter chip row (sticky top, mobile-first)
Model (All · O/U · ML · Run Line · PHLT) · Strong-only toggle · Date range (All · 7d · 30d · Month) · Sport. PHLT→Tier (A/B/C) appears when Model=PHLT. All client-filtered off the fetched rows (or re-query the endpoint for big ranges).

### Build order (revised)
1. Corner button + `onOpenRecord` wiring + empty `'performance'` route (ships immediately, button can be flag-gated until page lands).
2. `api/all-time-calls.js` + `src/lib/performance.js` (`applyFilters`, `unitsRoi`, `avgClv`, helpers) + Vitest.
3. `PerformancePage.jsx`: filter chips + summary tiles (Record/Win%/CLV/units/n) + **detailed call list with logos** + record matrix. Reuse `Avatar`/result chips/`botShared` tokens.
4. Chrome-verify live (prod only — `/api` doesn't run in vite preview), bump `sw.js`, ship.

## Critical Files for Implementation
- /Users/michaeltejeda/Desktop/risk-matrix-labs/src/components/SpotlightTicker.jsx
- /Users/michaeltejeda/Desktop/risk-matrix-labs/api/lean-record.js
- /Users/michaeltejeda/Desktop/risk-matrix-labs/api/prop-record.js
- /Users/michaeltejeda/Desktop/risk-matrix-labs/src/App.jsx
- /Users/michaeltejeda/Desktop/risk-matrix-labs/src/lib/propRecord.js
