# Matrix EV Bot — Phase 2: Props + Bet-Links (Design Spec)

**Date:** 2026-06-13 · **Status:** approved design, ready to plan
**Owner:** Risk Matrix Labs · **Builds on:** Phase 1 (Matrix EV Bot tab, shipped Session 47, SW rml-v88)

## 1. What we're building (one sentence)
Add a **PROPS** tab to the Bot's game-drill-in (CH2 LOOK) that pulls a game's player props, surfaces the **sharp-anchored +EV** ones with suggested unit sizing, and gives every edge (props *and* game lines) a **"Bet at \<book\> →"** deep-link — while still logging to RML for CLV.

## 2. Why
- Props are where the real +EV lives — the PRO money-maker (undercut Prop Professor's $50).
- "Bet at \<book\>" deep-links close the one-click gap vs Pikkit / OddsJam / SharpMoney. **No app actually places bets** (that needs credential sync we deliberately skip); the big apps hand off to the book via a link and/or import after. We do the same hand-off, keep our discipline/CLV layer they lack, and can monetize links via affiliate later.

## 3. The per-event reality (shapes the whole design)
The Odds API serves props from a **per-event** endpoint keyed by **its own event ID** (not our ESPN `external_event_id`). So opening a game's PROPS tab is a two-call flow:
1. **Free:** `GET /sports/{sportKey}/events` → list of `{id, home_team, away_team, commence_time}` → match our game by team last-word → get the Odds API event ID. **0 credits.**
2. **Paid (once):** `GET /sports/{sportKey}/events/{id}/odds?markets=<props>&regions=us,eu&oddsFormat=american&includeLinks=true` → the prop lines + book links. **Credits spent here.**

Result cached per `game:date` (same `scanCache` pattern from Phase 1) → re-opening never re-charges.

## 4. Engine — `src/lib/propEdges.js` (new, fully unit-tested)
A prop market (e.g. `pitcher_strikeouts`) holds many outcomes — each *player × Over/Under* carrying a line (`point`). New logic:
- **Group** outcomes by `(player, point)` into Over/Under pairs.
- For each pair where **Pinnacle** has the line: **de-vig the Pinnacle Over/Under** (reuse `src/lib/devig.js` `devigTwoWay`) → true prob per side → find **best price across reputable books** (reuse `REPUTABLE_BOOKS` from `edgeFilter.js`) → **EV%** (`evPct`) per side.
- **Quality filter** (reuse `isCredibleEdge` thresholds: minEV / maxEV cap; pre-game gate; reputable books only).
- **No Pinnacle prop** for that player+line → emit a **best-price-only** row (no EV claim — honest). These render in a separate "Line shop (no sharp anchor)" group, never as "+EV".
- Output shape per edge: `{ player, market, marketLabel, side: 'Over'|'Under', point, best: {book, price, link}, evPct, fairProb, sharpHoldPct }`.

Only the grouping is new; the math reuses Phase-1 primitives. `propEdges.js` is pure (takes a normalized event + `nowMs`), so it's TDD'd in isolation.

## 5. Provider adapter — extend `api/_lib/oddsProviders/theOddsApi.js` (same swappable contract)
- `fetchSportEvents(sport)` → `{ events: [{id, home_team, away_team, commence_time}], credits }` (free `/events` call).
- `fetchEventOdds({ sport, eventId, markets, regions })` → normalized single game `{ ..., bookmakers:[{key, markets:[{key, outcomes:[{name, price, point, link}]}]}] }` + credits. Adds `includeLinks=true`; captures per-outcome `link` (fallback to market/bookmaker link).
- Also add `includeLinks=true` to the existing `fetchOdds` (game-line) call so the Phase-1 feed + LineShop get bet-links too (no extra credits).
- `index.js` registry unchanged (methods are additive).

## 6. Endpoint — `api/scan-props.js` (new, auth-gated)
`GET /api/scan-props?sport=MLB&away=<name>&home=<name>` → `requireAuth` → `fetchSportEvents` (match) → `fetchEventOdds` (props markets for sport) → `propEdges` → `{ found, away, home, edges:[...], lineShopOnly:[...], creditsRemaining, scannedAt }`. Pre-game only (mirror the game-line gate). 502 on provider failure.

## 7. UX — `PROPS` tab inside CH2 LOOK
- In `MatrixBot.jsx` `LookChannel`, add `PROPS` to the market tab row (`ML · [Spread] · Total · PROPS`).
- PROPS tab: **Scan Props** button (own credit spend; shows "scans left"; cached per game/day). States mirror EVBot: idle → scanning → done.
- **Done:** ranked +EV prop cards — *Player · stat label · Over/Under · line · best book · price · EV% · suggested unit size* (neon card, same language as the game-line feed). Below them, a muted "LINE SHOP (no sharp anchor)" group for best-price-only props. Honest **"NO VALID PROP MATRIX"** when nothing's +EV.
- Each prop card (and each game-line feed row / LineShop cell) gets two actions: **"Bet at \<book\> →"** (opens `link` in a new tab) and the existing **tap-to-log** (`onLogPosition` with a parsed pick like `"Aaron Judge Over 1.5 Total Bases"`).

## 8. Prop market map — `PROP_MARKETS` config (keyed by sport)
Curated liquid set ("all props" = this, trivially extendable):
- **MLB:** `pitcher_strikeouts`, `batter_hits`, `batter_total_bases`, `batter_home_runs`, `batter_rbis`, `batter_walks`.
- **NBA / WNBA:** `player_points`, `player_rebounds`, `player_assists`, `player_threes`, `player_points_rebounds_assists`.
- **NHL:** `player_shots_on_goal`, `player_points`, `player_goals`, `player_total_saves`.
Labels (`marketLabel`) map keys → plain English ("Strikeouts", "Total Bases", "Points + Reb + Ast").

## 9. Gating — one capability flag
`propsEnabled` — true for any logged-in subscriber now (the existing token gate + paywall already restrict access; props ride on it as a launch perk). Single point to flip to Pro-only later (a Stripe tier) with zero rework. No billing work in this phase.

## 10. Bet-links + affiliate
- Outcome `link` from the API renders as **"Bet at \<book\> →"** (target=_blank, rel=noopener).
- Affiliate is deferred: a tiny `src/lib/betLinks.js` `decorate(book, url)` passthrough now, so wrapping with affiliate params later is a one-file change. No affiliate accounts required to ship.

## 11. Credit discipline
- Props are **per-event, on-demand only** — never slate-wide. Free `/events` map + one paid event-odds call per game-scan, cached per game/day. "Scans left" surfaced. 20K/mo budget comfortably covers it.

## 12. Out of scope (Phase 3+)
- Multi-way (3+ outcome) exotic props (most props are 2-way O/U; skip the few that aren't).
- Slate-wide props feed in CH1 FIND (credit cost too high).
- A real paid Pro tier in Stripe (deferred until we split the `propsEnabled` gate).
- Affiliate account setup / link monetization (wrapper is ready; deals come later).
- Photo/OCR bet import (Phase 3 bet-sync track).

## 13. Success criteria
Owner opens a pre-game game in the Bot → PROPS tab → Scan Props → sees that game's +EV props with best book, price, EV%, and unit size in the retro-TV skin → taps **"Bet at FanDuel →"** to place it and it's logged in RML for CLV — all on a phone, credit-disciplined, no faked edges.

## 14. New/changed files
| File | Change |
|------|--------|
| `src/lib/propEdges.js` | **New** — prop grouping + sharp-anchored EV (TDD). |
| `src/lib/betLinks.js` | **New** — affiliate-ready link passthrough (TDD). |
| `api/_lib/oddsProviders/theOddsApi.js` | **Modify** — `fetchSportEvents`, `fetchEventOdds`, `includeLinks` on `fetchOdds`. |
| `api/scan-props.js` | **New** — auth-gated per-game prop scan endpoint. |
| `src/components/MatrixBot.jsx` | **Modify** — PROPS tab in LookChannel + Bet-at-book buttons on feed/props. |
| `tests/prop-edges.test.js`, `tests/bet-links.test.js` | **New** — unit tests. |
| `public/sw.js` | **Modify** — SW bump. |
