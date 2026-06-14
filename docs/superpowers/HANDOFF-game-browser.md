# Game Browser — Session Handoff

**Branch:** `feat/game-browser-lab` (NOT merged to main). Prod is deployed from this branch.
**Status:** Working but flows are NOT finalized. Channel 3 not started.

## What's deployed & working (prod = app.riskmatrixlabs.com)
- **CH1 · FIND** — original, untouched. Scan + player search → `tuneTo(game)` → CH2. Works.
- **CH2 · LOOK** — original LookChannel (by-book chart `BookMoveChart`, `LineShop`, `MarketSummary`, `PlayerProps`, ML/RunLine/Total chart tabs) is INTACT and unchanged.
  - NEW: when no game is tuned, CH2's landing shows the **free game browser** (`EventsPicker`: sport circles + search + today's slate w/ team logos, from `fetchEvents` = Supabase, 0 Odds-API credits). Tapping a game calls `onTune` → `tuneTo(g)` → the SAME LookChannel renders (chart/line-shop/props all present).
- **CH3 · TRACK** — original `TrackChannel`. Not touched. Next to design.

## Architecture (how it connects)
- `MatrixBot` holds: `channel` (find|look|track), `game`, `sport`, `player`. The ONLY way a game loads is `tuneTo(g, p)` → sets game/sport/player + `channel='look'`.
- Two doors now feed `tuneTo`: CH1 scan/search, AND the CH2-landing `EventsPicker`. Both land in the one real CH2 detail view.

## Files
- `src/components/EventsPicker.jsx` — the free slate picker (USED, in CH2 landing). Emits `onPickGame(buildGame(ev))` in tuneTo shape. Has search + sport circles + visual-only date strip + team logos.
- `src/lib/propCategories.js` (+ `tests/prop-categories.test.js`) — sport→category + market mapping. USED by GamePage; harmless if GamePage retired.
- `src/components/GameBrowser.jsx`, `src/components/GamePage.jsx` — the Lab's standalone game-detail UI (OddsJam market-tab grid, prop subtypes, segments). **Currently UNUSED / parked.** Was removed from CH2 because it duplicated LookChannel and lacked the chart/line-shop. Decide: delete, or salvage its market-grid into LookChannel as an addition.
- `api/game-lines.js`, `api/scan-props.js`, `src/lib/propMarkets.js` — gained a `?full=1` path (segments, team totals, 16-market props). **The Lab currently does NOT use full=1** (it was unreliable in serverless — timed out → HTML). Cheap path (no full=1) is what CH2 uses and is reliable. The full=1 code is dormant; revisit via precompute/cron if those deeper markets are wanted.

## Known-good invariants (do NOT break)
- CH1 and CH3 untouched. CH2 LookChannel detail untouched. The only CH2 change is the no-game landing.
- `EventsPicker.buildGame` shape MUST match `tuneTo`/`LookChannel` (away, home, away_abbr, home_abbr, sport, external_event_id, commenceTime).
- The full=1 endpoints time out in serverless — do not put them back on the on-demand path.

## Open / next (the real work)
1. **Define the intended UX flows** for all 3 channels end-to-end (this is what's "not correct" — needs the owner to spell out the desired flow, then build to it). Don't guess.
2. **Channel 3** — not started; design what TRACK should do.
3. Decide GamePage's fate (delete vs salvage market grid into CH2).
4. Logos/info polish; date strip is visual-only (wire real multi-day fetch if wanted).

## Gotchas learned this session
- `vite preview` does NOT run `/api` functions — only a real Vercel deploy does.
- Preview deployment URLs (`risk-matrix-labs-xxx.vercel.app`) serve HTML for `/api` (protection) — always test on `app.riskmatrixlabs.com`.
- `ODDS_API_KEY` + `VITE_SUPABASE_*` are Production-scoped only (not Preview).
