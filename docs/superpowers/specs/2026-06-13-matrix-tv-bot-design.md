# Matrix TV Bot — Design Spec

**Date:** 2026-06-13 · **Status:** approved vision, ready to plan
**Owner:** Risk Matrix Labs

## 1. What we're building (one sentence)
A standalone **"Bot" tab** styled like a **retro broadcast TV**, that scans every sportsbook for the best prices + real +EV edges, lets the user swipe games and filter, and flows each pick straight into RML's existing discipline / bankroll / CLV tracking.

## 2. Why (positioning)
- Competitors (OddsJam, Pikkit, Prop Professor, SharpMoney, Juice Reel) all find edges / shop lines — that part is **commodity data**, and their UIs are often **messy** (owner's words on Prop Professor).
- **RML's wedge is not "more edges" — it's edges FUSED with discipline** (sizing to bankroll + risk caps, session grading, CLV) wrapped in a UI that actually feels good. *"They tell you what to bet. We make sure you don't blow your bankroll betting it."*
- Price to **undercut** Pikkit Pro ($30) and Prop Professor ($50); deliver more value than we charge.

## 3. The core insight (resolves the "3 interfaces" confusion)
EV, Line Movement, and CLV are **not three apps — they're three steps of one journey**:
1. **FIND** — the EV feed (scan the board → filtered list of best plays)
2. **LOOK** — tap a play → line-movement chart (every book's price over time)
3. **TRACK** — after you bet → CLV grades you vs the closing line (RML already has the bet log + CLV)

One Bot, three "channels," consistent retro-TV skin.

## 4. Navigation & UX (mobile-first)
- **Top slider:** horizontal, swipeable game chips (time + two teams), à la Pikkit. Tap one to focus that game; the feed below scopes to it. A "ALL GAMES" mode shows the whole board.
- **Filter pills:** sport, market (ML / spread / total / props), **Props toggle** (paid), **min EV%**, and **which books** the user has. Model = **scan everything → filter** (OddsJam / Prop Professor), but with a clean UI.
- **Feed:** retro-TV broadcast frame (scanlines, "ON AIR", green phosphor). Each row = a play: bet + best book + true EV% + **suggested unit size** + a ticker of prices.
- **Tap a play →** line-movement channel (multi-book traces, "By Book / Best Available", book chips, BET button).
- **After betting →** CLV replay channel (you took vs closed, "BEAT THE CLOSE", season CLV).

## 5. Aesthetic
Retro broadcast TV: CRT bezel, subtle scanlines, `ON AIR`/channel chrome, neon-green (#BDFF00) phosphor on near-black (#0A0A0A), monospace accents, red (#FF3B3B) for live/alerts. Consistent across all three channels. Mobile-first, one-handed.

## 6. Data & engine (already built this session)
- **Source:** The Odds API (swappable provider adapter — `api/_lib/oddsProviders/`). Key in `ODDS_API_KEY` (Vercel + `.env.local`, server-side only). Free tier 500 credits/mo.
- **Engine (done, tested):** `src/lib/oddsEdge.js` (Pinnacle de-vig → true fair → best line → true EV), `src/lib/edgeFilter.js` (reputable-book whitelist, EV cap, freshness, pre-game gate, `compareBooks` with point-aware best line + `scanEdges`).
- **Endpoints (done):** `api/scan-edges.js` (ranked edges for a sport), `api/game-lines.js` (per-game multi-book comparison, ML/spread/total).
- **Discipline core (already in app):** bet log, unit sizing (`masterBankroll × unitPct%`), risk caps, CLV (`src/lib/clv.js`), session grading.

## 7. Credit discipline (critical — owner felt the waste)
- **Never call the API when there's nothing to find:** disable scan on live/final games (pre-game only). Zero call = zero credits.
- **Cache** each scan; re-tapping shows cached result, no re-charge.
- Show "no pre-game games right now" instead of a blank box.
- Sparse, on-demand (tap-to-scan), not constant polling. Respect the 500/mo budget; surface credits remaining.

## 8. Phasing
- **Phase 1 — Game-line Bot, FREE.** Feed + filters + line chart + sizing + CLV flow, game lines (ML/spread/total). Engine already built; this is mostly UI + the retro-TV skin + credit guards.
- **Phase 2 — Props, PAID tier.** Player props (the money-maker). Needs: paid Odds-API props add-on, multi-way de-vig (props can be 3+ outcomes), per-event fetching, player+stat picker, a non-Pinnacle sharp anchor where needed. Undercut Prop Professor's $50.
- **Phase 3 — Bet sync.** Auto-import bets (photo/OCR first, full sync later). "Then we add bet sync, we blow up."

## 9. Out of scope (told owner honestly)
- **Public Bet% / Money% / handle splits** — The Odds API doesn't sell this; needs a separate pricey feed. Off-brand anyway. Skip.
- **Per-book line-movement HISTORY** at launch — requires storing multi-book snapshots over time (a background job). The chart can start "live-only" and gain history once we store snapshots.

## 10. Success criteria
- Owner opens the Bot pre-game, swipes a game or filters, sees clean best-line + any +EV with sizing, taps to a line chart, places it, and it grades CLV in the log — all in the retro-TV skin, on a phone, without wasting credits or seeing a confusing blank.
