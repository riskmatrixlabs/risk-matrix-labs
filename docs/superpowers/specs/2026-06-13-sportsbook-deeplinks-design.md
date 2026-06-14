# Sportsbook Deep-Links in the Line Shop — Design

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Sub-project:** 1 of the "3-pillar" vision (see `2026-06-13-rml-backlog.md`)

## Problem

The Line Shop (shared `LineShop` component, used in **both** Game Center → Insights and Matrix Bot → Channel 2) lets you tap a book's price to **log a bet**. The footer says "tap a book to bet there," but nothing actually opens the sportsbook — a half-finished promise. We pay for The Odds API, which returns a deep **bet-slip link** per outcome for the major US books, but `compareBooks` discards those links before they reach the UI.

## Goal

Tapping a book's price should let the operator **log the bet to their bet log AND jump straight to that book's bet slip** — with an explicit confirm so nothing happens by accident. Manual by design (no book account syncing).

## Validated facts

- One shared component → fixing `LineShop` fixes both Line Shops.
- The Odds API (`includeLinks=true`, already used by `game-lines`) returns **outcome-level bet-slip links** for: FanDuel, DraftKings, Caesars (`williamhill_us`), BetMGM, BetRivers. **No** outcome link for: Fanatics, Bovada, offshore.
- The adapter (`theOddsApi.normalizeGame`) already captures `o.link`; `compareBooks` (`src/lib/edgeFilter.js`) drops it.
- `src/lib/betLinks.js` already exposes `decorate(book, url)` (affiliate-ready passthrough).

## Design

### 1. Carry links through the data
`compareBooks` adds a `links` map per outcome to every row (and to the `best` entry), sourced from each outcome's `link`. `game-lines` returns `compareBooks` output unchanged, so links reach both Line Shops with **no API or cron changes**.

Row shape becomes: `{ book, sharp, prices, points, links }` where `links[outcomeName] = url | null`.

### 2. "Tappable" rule
A price cell is tappable only when `decorate(book, row.links[name])` returns a non-null URL. No link → the price still renders (for comparison) but is not tappable. This naturally limits tap-to-bet to the books that actually support it.

### 3. Tap → inline confirm → log + open
Tapping a tappable price expands a small inline confirm directly under the row (not a modal — smoother on mobile):

> **Bet HOU ML −120 at DraftKings?**   [ Log & Open ]   [ Cancel ]

- **Log & Open** → `onLogPosition(event, { pick, odds, book })` **and** `window.open(decoratedUrl, '_blank', 'noopener,noreferrer')`.
- **Cancel** → collapse, no action.
- Only one confirm open at a time.

Tapping no longer silently logs — logging happens only on explicit confirm.

### 4. Affordance
Tappable prices show a small `↗` marker so it's obvious which books can be bet. Non-tappable prices look plain. Footer text updated (e.g. "↗ = log & bet at that book · green = best price on the main line").

### 5. Logging records the book
`onLogPosition` payload gains `book`. Small change, but it sets up the later bet-log / parlay sub-projects (knowing where each leg was placed). Existing callers that ignore extra fields are unaffected.

## Components touched

| Unit | Change |
|---|---|
| `src/lib/edgeFilter.js` (`compareBooks`) | include `links` per outcome on rows + best |
| `src/lib/betLinks.js` | already done (`decorate`) — reused |
| `src/components/LiveCenter.jsx` (`LineShop`) | tappable rule, inline confirm, `↗` affordance, footer copy, pass `book` to log |
| `api/game-lines.js` | none (passes `compareBooks` through) |
| tests | `compareBooks` carries links; pure `isTappable`/decorated-url helper |

## Out of scope (later sub-projects)
Bet-log redesign, parlay/multi-leg slips, player search, bet-to-line (per-bet-market chart), Dashboard tab. The only forward-looking hook here is passing `book` into the log.

## Testing
- Unit: `compareBooks` returns `links`; tappable helper returns URL only when a decorated link exists; returns null for no-link books.
- Build green + existing 181 tests still pass.
- Manual: tap DK price → confirm → logs + opens bet slip; tap Fanatics → not tappable.
