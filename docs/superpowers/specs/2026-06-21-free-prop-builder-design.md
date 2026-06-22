# Free Guided Prop Builder — Design Spec

Date: 2026-06-21
Branch: `feat/free-prop-builder`
Status: Approved design, pending spec review

## Problem

There is no **free** way to *build* a player prop. You can log a prop by typing the exact
string `"<Player> Over/Under <line> <Stat>"` into LOG BET (free, and it tracks live), but
there is no guided helper — no player search, no stat picker, no line guidance. The only
guided prop experience is the Matrix Bot (CH2) prop scan, which is the **paid-data** path
(book lines + cross-book edge). So a free user has no assisted prop entry. This closes
that gap with a guided builder that uses only free data sources.

## Goals

- A guided prop builder that costs **0 Odds-API credits** end to end.
- Reused in two places via one shared component.
- Output is a prop that **tracks live** (free ESPN box score) and **auto-grades** at final,
  exactly like the manually-typed path does today.
- Honest free/paid boundary: the user supplies the **line + odds**; the paid scan keeps
  ownership of the real book line, real odds, and cross-book edge/EV.

## Non-goals

- No EV/edge/CLV on free props (those require the paid de-vig market data).
- No line/odds autofill from a book (that is the paid scan's value).
- No new sports — MLB, NBA, NHL, WNBA only (what `player-search` supports today; NFL stays
  out, consistent with the paid scan).

## Architecture

### Shared component: `PropBuilder`

A single self-contained component, new file `src/components/PropBuilder.jsx`.

**Interface**
```
<PropBuilder
  sport={'MLB'|'NBA'|'NHL'|'WNBA'}     // required: scopes player search + stat list
  game={event | null}                   // optional: when given, scopes search to this game's
                                         //   rosters and pre-fills the event; null = search all
                                         //   of today's players for the sport
  token={string}                        // auth token for the free APIs
  onSubmit={(prop) => void}             // called when the user confirms (see prop shape below)
  submitLabel={'+ LOG PROP' | '+ ADD TO SLIP'}
/>
```

**Output `prop` shape** (the only thing the component emits):
```
{
  sport, event,            // event = "<Away> vs <Home>" (matches the events row for tracking)
  player,                  // display name
  stat,                    // canonical stat label (must be resolveStat-readable)
  side,                    // 'over' | 'under'
  line,                    // number (user-typed)
  odds,                    // american int (user-typed)
  pick,                    // assembled: `${player} ${Over|Under} ${line} ${stat}`
}
```

**Internal flow / sub-steps**
1. **Player search** — debounced input → `GET /api/player-search?sport=<sport>` (typed-name
   mode) or, when `game` is provided, filter that game's rosters. Result rows carry
   `{ player, headshot, id, event/game }`. Picking a player resolves the **event** (from the
   player's game) so the logged prop matches a slate game for live tracking.
2. **Stat + side** — stat dropdown is the **intersection** of `PROP_MARKETS[sport]`
   (`src/lib/propMarkets.js`) and the stats `resolveStat` (`src/lib/statProgress.js`) can read
   from a box score. Stats the box score cannot track are **not offered**, which guarantees
   every free prop draws the live bar. Side is an Over/Under toggle, default **Over**.
3. **Free form context** — once player + stat are chosen, `GET /api/player-stats?...&id=<id>`
   (free, 15-min cache) returns season + last-5; show season-per-game and the last-5 line for
   the chosen stat. Pure context to help set a line; no book data.
4. **Line + odds** — two numeric inputs, user-typed. American odds parsed like the existing
   AddBet form (`replace(/[−–—]/g,'-')`).
5. **Live preview** — assembles `pick` and shows it with a `TRACKS LIVE · FREE` badge and a
   `your number — not a book line` honesty label. Submit button calls `onSubmit(prop)`.

The component does **not** know whether it is logging or adding to a slip — the parent decides
via `onSubmit` + `submitLabel`.

### Mount 1 — LOG BET modal (direct log)

`AddBetModal` (`src/App.jsx`):
- Add `'Player Prop'` to the bet-type chips (a new single-leg type, NOT in `MULTI_LEG_TYPES`).
- When `betType === 'Player Prop'`, replace the free-text event/pick/odds rows with
  `<PropBuilder sport=... onSubmit=... submitLabel="+ LOG PROP" />`.
- `onSubmit(prop)` maps into the existing bet record: `{ sport, event: prop.event,
  pick: prop.pick, odds: prop.odds, betType: 'Player Prop', units/stake, result: 'Open', ... }`
  and flows through the existing `onAdd` path (no new persistence code).
- Stake/units, date, book remain the modal's existing fields.

### Mount 2 — Game Center → game Insights, above Line Shop (search → slip)

`LiveCenter.jsx`, inside the `GameDetail` **Insights** tab card stack — a new
**"+ build a prop"** section placed **directly above the Line Shop / Compare Books card**
(currently `<LineShop .../>` at ~line 2132). Rationale: the game is already open here, so:
- `game` is always known → `PropBuilder` **scopes the player search to that game's roster** and
  the **event is pre-resolved** (best case for live tracking — no match guesswork).
- The slip handler it needs, `onAddToSlip`, is **already in scope** in `GameDetail` (passed to
  `LineShop` on the same line), so no new plumbing.

Mounted as `<PropBuilder sport={event.sport} game={event} token={token} submitLabel="+ ADD TO
SLIP" onSubmit={...} />`. `onSubmit(prop)` calls the **existing** `onAddToSlip({ pick, odds,
sport, event, book: null, evPct: null, consensus: false })` — the same path the paid prop chips
use. The leg lands in the existing neon ticket; the user places / logs from there alongside
other legs. No direct logging here; the slip owns the place/log step.

It can render collapsed (a `LookSection`-style header that expands to the builder) to match the
other Insights cards, or open inline — implementer's call, consistent with the surrounding stack.

## Data flow (all free, 0 credits)

```
player-search (roster + event + id)  ─┐
player-stats  (season + last-5)       ├─ PropBuilder → prop{pick,event,odds,...}
user types line + odds               ─┘
        │  (onSubmit, wired per mount)
        ├─ Mount 1: → bet record → bets table
        └─ Mount 2: → onAddToSlip → existing slip → place/log
        │
        ▼
withLogos → statProgress.parseProp → resolveStat(box-score)   // live green bar
gradeBet / settle                                              // auto-grade at FINAL
```

`box-score`, `player-search`, `player-stats` are all free ESPN-backed endpoints already in
the app. No Odds-API call is added anywhere.

## Key constraints / invariants

- **Only live-trackable stats are offered** (the `PROP_MARKETS ∩ resolveStat` intersection).
  This is the rule that keeps "free prop = always tracks."
- **Event must resolve** for live tracking; if a picked player's game can't be matched to a
  slate event, the prop still logs (free-text) but shows no live bar — same as today's manual
  path. Surface a subtle "won't track live" hint when the event is unresolved.
- **No paid words / brand:** label the side toggle and stats per brand voice (operators, no
  "lock/pick/play"); the builder never claims an edge.

## Edge cases

- Player typed but none selected → submit disabled.
- Stat with no box-score reading → not in the dropdown at all (can't happen by construction).
- `player-stats` returns nothing (early season / no data) → context box shows "no recent data",
  builder still usable (line/odds are user-typed anyway).
- Two games for one player name (doubleheader) → use the same disambiguation as
  `findEventForBet` (ET date + closest start); if still ambiguous, let the user pick the game.
- Over/Under on a 0.5 line is fine; integer lines allowed (push handled by existing grading).

## Testing

- Unit: `PropBuilder` assembles the correct `pick` string from {player, side, line, stat}
  and the emitted `prop` shape; stat list = the `PROP_MARKETS ∩ resolveStat` intersection per
  sport; submit disabled until player+stat+line+odds are present.
- Unit: the assembled `pick` round-trips through `statProgress.parseProp` (the live-bar
  contract) for each offered stat — i.e. every stat the builder offers parses + resolves.
- Integration (light, jsdom): modal mount maps `prop → bet record`; Game Center mount calls
  `onAddToSlip` with the right leg.
- Manual live verify in Chrome (per project rule): build a real MLB prop, confirm the live bar
  fills off the box score and it auto-grades.

## Files touched

- New: `src/components/PropBuilder.jsx`, `tests/prop-builder.test.jsx`
- Edit: `src/App.jsx` (AddBetModal — new bet type + mount)
- Edit: `src/components/LiveCenter.jsx` (Game Center search → builder → slip)
- Reuse (no change): `api/player-search.js`, `api/player-stats.js`, `api/box-score.js`,
  `src/lib/statProgress.js`, `src/lib/propMarkets.js`, the slip's `onAddToSlip`.

## Out of scope / follow-ups

- Free EV proxy for props (would need a free fair-prob source) — explicitly later, if ever.
- NFL props (needs sport support in `player-search` + prop markets).
- Persisting a "recent players" list for faster re-entry.
