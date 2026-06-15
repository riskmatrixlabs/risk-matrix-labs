# CH3 · EV TRACK + Universal Bet Card — Design Spec

**Date:** 2026-06-15 · **Branch:** `feat/game-browser-lab` · **Status:** approved design, pre-plan

## Goal
Redesign CH3 (TRACK) into a real **EV Track channel** and, in doing so, build the
**universal `BetCard`** — one reusable, brand-styled card for a bet, used across the
whole site (CH3, bet log, in-app slip, share card). This is the long-pending
"bet-log / card redesign — read multi-leg parlays like a sportsbook slip, team logos"
backlog item, finally built as a shared component.

**Hard rule (owner):** nothing is removed from CH3. SCOREBOARD and TRACKED POSITIONS
stay; we add on top and make them richer + better looking.

**Forward-compat:** the card's grade-badge slot and the scoreboard's Operator Rating
tile are deliberate empty homes for the EV Brain (`rml-evbrain-spec`) verdict
(Play/Small/Lean/Pass) and Operator Rating (Clean/Risky/Degen) when phases 1–2 land.

## The reusable unit: `BetCard`
A single outlined card is the atom. A straight bet = one card. A parlay = the same
leg-cards connected into one ticket.

**Single card contains:**
- **Avatar** — player **headshot** for player props; **team logo** for team bets
  (ML/spread/total/team-total). Both already fetched free (ESPN via `scan-props`,
  `game-info`, `player-search`). Fallback: initials tile in team color.
- **Title** — player or team name (Rajdhani, bold).
- **Subtitle** — market + matchup (e.g. "Over 1.5 Total Bases · NYY @ BOS").
- **Entry odds** + **book chip** (e.g. FD).
- **Grade badge slot** — EV and/or PHLT now; same slot hosts the EV Brain verdict later.
- **Status** drives the accent color + icon:
  - won → neon `#BDFF00`, `ti-check`
  - lost → red `#FF3B3B`, `ti-x`, title struck-through
  - live/pending → amber `#FFB800`, `ti-clock`, "needs this to cash"

**Parlay = connected stack:**
- Leg-cards rendered as connected rows joined on **both left and right edges** (a
  bracket/spine so it reads as one ticket, not floating cards). Status node sits on
  the rail per leg.
- Header: `N-LEG PARLAY` + status pill `3 OF 6 HIT · LIVE`.
- Each leg shows `entry · closed` odds inline (feeds slip CLV).
- Footer row: `odds · stake → win` tile + `TICKET EV` tile.
- **CLV bar** (bottom, full width): `YOU BEAT THE CLOSE +X% CLV` (neon when beat,
  red when worse than close). This is the per-slip "truth" line.

**Component shape:** `BetCard` (single) composes into `BetTicket` (parlay wrapper:
header + connected legs + footer + CLV bar). A straight bet renders `BetCard` with
the same footer/CLV bar but no leg rail. Pure presentational; takes a normalized
bet object + grade object; no data fetching inside.

## Channel layout (top → bottom)
1. **Header** — `⬡ EV TRACK · BEAT THE CLOSE`, with a **⚙ gear** on the right.
2. **SCOREBOARD (top = lifetime truth)** — collapsible `LookSection`, stays.
   - Existing: Avg CLV · Beat-Close % · Avg EV.
   - **Add — record line:** `W-L-P · ±Nu · ROI ±X%`.
   - **Add — Operator Rating tile:** empty home for EV Brain (Clean/Risky/Degen);
     shows "—" / "soon" until wired.
   - **Add — status filter chips:** All · Live · Pending · Settled (filters the
     positions list below).
3. **TRACKED POSITIONS (bottom = the action)** — collapsible `LookSection`, stays.
   - BetCards/BetTickets grouped **by date, Today first**, then descending days.
   - Each date group has a sub-header with that day's mini-tally
     (e.g. `Tue · 2-1 · +0.8u`).
   - **Live auto-refresh** for in-progress legs (poll/refresh so amber legs update).
   - **Empty state:** "Log a play on CH1/2 — it grades here."

## Gear menu (top-right of SCOREBOARD header)
Opens a small sheet:
- **Time scope** — All-time · 30d · 7d · Today (filters scoreboard + positions).
- **Sport filter** — All · MLB · NHL · NBA · WNBA.
- **Status filter** — All · Live · Pending · Settled · Won · Lost (mirrors chips).
- **Settle manually** — mark a position Won/Lost when auto-grading can't match.
- **Delete a position** — remove a logged bet.
- **Reset scoreboard** — wipe record (confirm dialog; destructive).
- **Share record** — push scoreboard to a share card.

## Data flow
- Bets come from the existing bet log only (logged on CH1/CH2). **No manual entry form.**
- Today/past events fetched via `fetchEvents`; bets matched via `matchBetToEvent`;
  graded via `evaluateBet` (EV/CLV) — all already exist in `MatrixBot.jsx`.
- Record line (W-L-P, units, ROI) computed from settled bets in the log.
- CLV per leg/slip = entry odds vs closing odds (closing from `game-lines` /
  `odds_history`).
- Live refresh re-runs the grade pass for in-progress games on an interval.

## Explicitly out of scope (YAGNI)
- Manual bet entry form (bets originate from CH1/2).
- Charts/graphs (scoreboard numbers suffice until volume exists).
- EV Brain scoring itself — only the empty UI homes are built here.

## Brand / constraints
- Colors `#BDFF00` / `#0A0A0A` / `#FF3B3B`; Rajdhani headers + Inter body. Mobile-first.
- No gambling words (no "lock/pick/play/tips/luck"); operators not gamblers.
  "Beat the close" / "EV Track" / "tracked positions" language stays.
- Reuse existing `LookSection`, `TvFrame`, `ClosingLines`, `Stat` where possible.

## Affected files (anticipated)
- `src/components/MatrixBot.jsx` — `TrackChannel`, `TrackGameCard`, `Stat` → recompose
  around new cards + scoreboard adds + gear.
- New: `src/components/BetCard.jsx` (or `src/lib`/components) — shared `BetCard` +
  `BetTicket`. Replace ad-hoc bet rendering on the slip / bet log with this card too.
- `src/App.jsx` — swap slip/bet-log bet rendering to the universal card.

## Open visual details (defaulted; owner can correct)
- **Avatar:** headshot for props / team logo for team bets (chosen).
- **Connector:** legs joined on both left + right edges as one ticket (chosen).
- **CLV bar:** per-slip "YOU BEAT THE CLOSE +X%" at ticket bottom (chosen).
