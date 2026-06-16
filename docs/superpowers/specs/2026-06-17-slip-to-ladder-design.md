# Slip → Ladder + Spotlight → Slip (design)

**Date:** 2026-06-17 · branch `feat/game-browser-lab`

## Goal
Let a Spotlight signal (or any card pick) flow into the bet slip carrying its **real free odds**, and from the slip into the **ladder** as the next rung — without manual entry and without spending Odds-API credits.

## Key facts (verified)
- Synced `events` rows already carry, FREE: `odds_total` (the number) AND `metadata.over_juice` / `metadata.under_juice` (the price). e.g. MIN@TEX total 8.5, over −108 / under −112.
- So a Spotlight O/U lean CAN be turned into a fully-priced slip leg with zero credits. `game-info` just needs to pass the juice through in `ou`.
- Ladder = sequence of rungs; each rung's **stake is formula-driven** (funded from prior rung's winnings). Adding a bet fills a rung's **content** (pick · odds · book), NOT its stake.

## Flow
1. **+ Slip** on each Spotlight panel row (and game cards) → adds a priced leg to the slip.
   - Leg = `{ pick: 'OVER 8.5', odds: <over_juice>, sport, event: 'MIN@TEX', book: <best/blank> }`.
   - OVER → over_juice; UNDER → under_juice. Real numbers from the free event row.
2. **In the slip**, each pick gets a small **"→ Ladder"** button (send that one) + a slip-level **"Add all to Ladder"** (send all, in order).
3. **→ Ladder** fills the **next open/TBD rung** in the current ladder session with the pick + odds + book. Stake stays the ladder formula. If no open rung exists, append a new rung (existing `addRung`).

## Components touched
- `api/game-info.js` — add `overJuice`/`underJuice` to the `ou` object (pull from the event row already loaded for the anchor).
- `src/components/SpotlightTicker.jsx` — `+ Slip` action per panel row; needs an `onAddToSlip(leg)` prop.
- Slip UI (`src/App.jsx`) — per-leg "→ Ladder" + slip-level "Add all to Ladder"; a `addToLadder(leg)` that fills the next rung.
- `LadderTracker` / ladder state — `fillNextRung(leg)` helper: find next TBD rung (or append), set pick/odds/book, keep formula stake.

## Out of scope (later)
- Pulling live odds (credits) — not needed, free juice covers it.
- Parlays as a single rung — a rung is one bet.
- Spotlight tracking table (separate project).

## Test
- Add a Spotlight OVER to slip → leg shows real over juice.
- Slip "→ Ladder" → next rung shows the pick + odds + book, stake = formula.
- "Add all to Ladder" with 3 picks → next 3 rungs fill in order.
- Verify live in Chrome; zero credit spend.
