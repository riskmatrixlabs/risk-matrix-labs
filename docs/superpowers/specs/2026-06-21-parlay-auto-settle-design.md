# Parlay Auto-Settle — Design Spec

Date: 2026-06-21
Branch: `feat/parlay-auto-settle`
Status: Approved design

## Problem

Auto-settle (S65) grades only **straight** bets. A parlay's `event` is `"N-Leg Parlay"`, so
`findEventForBet` returns null and the auto-settle loop skips it before grading. Result:
parlays stay `Open` forever and must be settled by hand — and manual settle pays the **full
ticket odds**, which is wrong when a leg pushes. Live example: a 2-leg parlay (Over 8 @ -115 +
PHI ML @ -181) on a final game (PHI 6, NYM 2 = 8 total) is stuck Open. Correct result: Over 8
is a **push** (total = line), PHI ML **wins**, so the parlay collapses to PHI ML alone → **W at
-181 (~+$55)**, not the +190 ticket (+$90).

## Goals

- Auto-settle parlays from their legs' final scores, reusing the strict existing per-leg grader.
- Correct **push handling**: drop pushed legs, recompute the payout from surviving legs.
- **Early loss**: settle `L` the moment any leg's game finishes a loss, even if other legs are
  still live (a parlay is dead once any leg loses).
- Stay as strict as straight auto-settle: if any leg can't be confidently graded (game not
  final, unmatched, unparseable), leave the parlay `Open`.

## Non-goals

- Manual parlay settle with push-reduction (auto-settle covers the real cases; manual stays as-is).
- Round-robin / SGP-specific correlation pricing — treat legs as independent (standard parlay math).
- Grading leagues/markets the per-leg grader already can't handle.

## Architecture

### New pure module: `src/lib/gradeParlay.js`

```
gradeParlay(bet, events) -> { result: 'W'|'L'|'P'|null, effectiveOdds: number|null }
```

Logic:
1. `legs = bet.legs` (each `{ pick, odds, event, sport, book }`). If fewer than 2 legs → return
   `{ result: null }` (not a parlay; the straight path handles it).
2. Grade each leg: build `legBet = { pick: leg.pick, odds: leg.odds, sport: leg.sport || bet.sport,
   event: leg.event, date: bet.date }`, match it to its OWN game via
   `findEventForBet(legBet, events)`, then `gradeBetResult(legBet, ev)` → `'W'|'L'|'P'|null`
   (null when no event match).
3. **Early loss:** if any leg graded `'L'` → return `{ result: 'L', effectiveOdds: null }`
   immediately (pnl will be −stake; odds irrelevant).
4. Otherwise, if any leg is still `null` (ungradeable / not final) → return `{ result: null }`
   (leave Open).
5. All legs are now `'W'` or `'P'`. Drop the pushes. `survivors = legs graded 'W'`.
   - `survivors.length === 0` (all pushed) → `{ result: 'P', effectiveOdds: null }`.
   - else → `{ result: 'W', effectiveOdds: combineAmericanOdds(survivors.map(odds)) }`.

`combineAmericanOdds(americanList)`:
- decimal of each: `am > 0 ? am/100 + 1 : 100/|am| + 1`.
- `comboDec = product(decimals)`.
- back to American: `comboDec >= 2 ? round((comboDec - 1) * 100) : round(-100 / (comboDec - 1))`.
- A single surviving leg returns that leg's own American odds (within rounding).

### Wire-up in `src/App.jsx`

- **`settleBet(id, result, oddsOverride = null)`** — in the pnl calc, use `oddsOverride ?? b.odds`
  for the win-profit computation (non-ladder branch). Straight callers pass no override →
  unchanged behavior. Parlay wins pass the reduced `effectiveOdds`.
- **Auto-settle loop** — route parlays:
  ```
  if (b.legs && b.legs.length >= 2) {
    const { result, effectiveOdds } = gradeParlay(b, betEvents)
    if (result) { autoSettleTried.current.add(b.id); settleBet(b.id, result, effectiveOdds) }
  } else {
    const ev = findEventForBet(b, betEvents); if (!ev) continue
    const r = gradeBetResult(b, ev)
    if (r === 'W' || r === 'L' || r === 'P') { autoSettleTried.current.add(b.id); settleBet(b.id, r) }
  }
  ```

## Data flow

Final scores live on the `events` row (`away_score` / `home_score` columns — already populated
for FT games; that's what straight auto-settle uses). The dashboard's `betEvents` poll (60s)
feeds both the loop and `gradeParlay`. No new fetches, no paid data.

## Edge cases

- Leg on a different game than the others → matched independently via its own `leg.event`.
- One leg final-WON but another leg's game not final → `null` → stays Open (correct; wait).
- One leg final-LOST + another not final → `L` early (parlay dead).
- All legs push → `P` (refund; pnl 0).
- A leg unparseable / unmatched and no leg lost → `null` (stay Open; never guess money).
- Ladder parlays: out of scope (ladder rungs are straights); guard on `b.legs`.
- Idempotent: `autoSettleTried` + result no longer `Open` prevents re-grading.

## Testing

- `gradeParlay` unit (`tests/grade-parlay.test.js`):
  - all-win → `W` + combined odds.
  - push + win → `W` at the surviving leg's odds (the real NYM@PHI case: Over 8 push + PHI ML
    -181 → `W`, effectiveOdds ≈ -181).
  - any leg lost (others win/ungradeable) → `L` early.
  - all push → `P`.
  - a leg ungradeable + no loss → `null`.
  - `combineAmericanOdds`: two favorites/dogs combine to the right American number; single leg
    returns itself.
- `settleBet` override: a parlay W with `oddsOverride` computes pnl from the override, not the
  ticket odds (covered via a small pure-calc assertion or the loop integration).
- Manual live verify (project rule): the stuck NYM@PHI parlay auto-settles to **W ≈ +$55** after
  deploy.

## Files

- New: `src/lib/gradeParlay.js`, `tests/grade-parlay.test.js`
- Edit: `src/App.jsx` (`settleBet` override + auto-settle loop parlay routing)
- Reuse: `src/lib/gradeBetResult.js`, `src/lib/betMatch.js` (`findEventForBet`).
