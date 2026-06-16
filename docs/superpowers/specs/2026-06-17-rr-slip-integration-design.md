# Round Robin ↔ Slip integration (design)

**Date:** 2026-06-17 · branch `feat/game-browser-lab`

## Problem
The RR Engine does the combo math but only takes **raw odds** — it doesn't know the actual picks, so it can't tell you *which parlays to build* or let you place them. And exchanges like **Novig have no auto-round-robin** — users manually build every combo, which is confusing and error-prone. Auto-building the real combos solves a pain no competitor handles well.

## Goal
Make the RR Engine work with **real picks** and wire it **two-way** with the bet slip:
1. **Slip → RR ("Float to RR")** — send slip picks into the RR Engine; it auto-builds every combo and shows the outcome matrix (what results are possible).
2. **RR → Slip (+ Add to Slip)** — each generated combo can be added back to the slip to place/log; the full combo list is the Novig manual-rebuild aid.
3. **Add picks directly in RR** — a search/add box in the RR tab so you can build without the slip.

## Reuse (already built)
- RR math + outcome matrix: `RREngine` (App.jsx ~L1109) — `nCr`, `getCombos`, `outcomeMatrix`, exact results.
- Slip: `slip` state, `addToSlip(leg)`, legs carry `{ pick, odds, book, byBook, byBookLink, sport, event }`.
- Per-book odds (free): `byBook` from cached game-lines (the Spotlight enrichment).
- Pick search/add: EventsPicker / player-search patterns.

## Design

### Data
RR legs become real picks, not just odds: `{ pick, odds, book, byBook, event, sport, result }`. The existing `legs` state in RREngine extends to carry pick metadata (keep `odds` for the math).

### Phase 1 — Slip → RR float + outcome preview
- Slip gets a **"🎲 Float to RR"** action (when ≥3 enabled picks) → stashes the enabled picks (with odds) into a shared store and routes to Dashboard → RR Engine.
- RREngine reads the floated picks → pre-fills legs with real pick labels + odds → the outcome matrix renders immediately ("2 of 3 → +$X", etc.).
- Each RR leg row shows the **pick label** (e.g. "NYM@CIN Over 9.5") instead of a bare odds box.

### Phase 2 — RR → Slip + direct add
- Each generated **combo** (a 2-leg/Ns parlay) lists its legs + combined odds + **"+ Add to Slip"** (adds that combo as a parlay leg-set to the slip → places/logs like any parlay).
- A **"+ Add pick"** search box in the RR tab (reuse EventsPicker/search) to add teams/totals directly; each carries odds (consensus over/under juice or typed).
- The combo list doubles as the **Novig rebuild sheet** (each combo clearly labeled).

### Carrying picks between tabs
A lightweight shared store (App-level state `rrFloat` passed to RREngine, or a ref) — NOT localStorage (ephemeral). Slip "Float to RR" sets it + switches tab; RREngine consumes on mount.

## Also (quick fix, fold in)
- **$ stake-mode box**: verify the Stake/Combo input is visible + usable in Dollars mode (user reported it vanishing). Fix layout if it's being clipped.

## Out of scope
- True one-tap placement on Novig (no public bet-slip API — same constraint as elsewhere; the combo list + Add-to-Slip is the workaround).
- Auto-pricing exotic combos beyond product-of-legs.

## Test
- Slip with 3 Spotlight picks → Float to RR → legs pre-fill with labels + odds; outcome matrix shows.
- A combo → + Add to Slip → appears in slip as a parlay, places/logs.
- Direct add a pick in RR → combos update.
- $ mode shows a usable stake box.
- Verify live in Chrome; zero credits (reuses cached odds).
