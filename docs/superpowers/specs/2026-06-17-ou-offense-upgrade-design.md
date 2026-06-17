# O/U Totals Model — Offense Upgrade (fix the structural OVER-bias)

**Date:** 2026-06-17 · **Session:** 60 · **Status:** approved, pre-implementation

## Problem

The MLB O/U totals model (`api/game-info.js`, the `ou` block) scores only **pitching-side** signals: park factor, the starters' Statcast (xERA/xBA/K%), bullpen ERA, and weather. Almost every factor pushes the score **OVER**; only "shutdown pens" and "cold weather" push UNDER. The model is therefore **structurally tilted to call OVER** and is blind to how good the actual offenses are.

Tracking (built session 60: `lean_results` + grading) showed this live on the 2026-06-16 ET slate: 7 of 12 games went UNDER, but the model called OVER 7× / UNDER 3×, going **3–7 overall, 1–5 on strong (Spotlight) leans**. The misses (COL, MIN, LAA, NYM, CLE all UNDER) were low-offense games the model couldn't read.

## Goal

Give the model an **offense read** so it can lean UNDER when the bats are weak/cold — not just OVER when the arms are hittable. Keep everything else. Measure the result with the existing tracking. Scope: offense core + recent scoring form (handedness folded into the offense read). All data free, on APIs already in use.

## Non-goals

- No full re-tune of existing thresholds/weights (revisit after a week of data).
- No raw batter-vs-pitcher (BvP) history (too small a sample; lineup xwOBA is the stable version).
- No new UI — the existing Spotlight record + card grade chips already surface results.
- No paid data (umpire, etc. stay out).

## Architecture

New isolated module **`api/_lib/offense.js`** owns "how good are the bats today." `game-info.js` calls it once and adds the result to the existing `score`/`why` accumulator. This keeps the O/U block readable and makes the offense logic unit-testable (mirrors `src/lib/phlt.js`).

### `api/_lib/offense.js`

**Pure scoring functions (unit-tested, no I/O):**
- `lineupXwoba(batters, savantMap, starterHand)` → average xwOBA of the posted 9, each platoon-adjusted vs the opposing starter's hand. Returns `{ xwoba, n, platoonAdj }` or null if too few matched.
- `offenseFactor(awayXwoba, homeXwoba)` → `-1 | 0 | +1` + reason. Both strong → +1 ("hot bats"); both weak/cold → −1 ("cold lineups"); mixed → 0.
- `formFactor(combinedRunsPerGame)` → `-1 | 0 | +1` + reason vs league baseline (~9.0 combined R/G).
- Constants block (thresholds) at top for easy tuning.

**Data orchestration (I/O, thin):**
- `getOffense({ away, home, gamePk, starters, savantMap })` → fetches posted lineups, computes both factors, returns `{ offense: {score, reason}, form: {score, reason}, source }` where `source` ∈ `lineup | team | none`.

**Fallback chain (never guesses):**
1. **Posted lineup** (MLB Stats API) → batter xwOBA (Savant map).
2. **Team-season wOBA** (MLB Stats API team hitting) if lineups not posted yet.
3. **null** → factor sits out (no score change), reason omitted.

### Data sources (all free)
- **Lineups + handedness + team hitting:** MLB Stats API. Map our ESPN `external_event_id` → MLB `gamePk` via `schedule?sportId=1&date=<ET date>` matching team names; hydrate lineups (`hydrate=lineups,probablePitcher`). Cache per game/day in `scan_cache` (like bullpens).
- **Batter xwOBA:** reuse `getSavantMaps()` (already loaded for PHLT) — no new fetch.
- **Recent scoring form:** ESPN team schedule/results, last ~7 games runs scored + allowed. Cached per team/day.

### Scoring integration (`game-info.js`)
After the existing factors, add:
```
const off = await getOffense({...})
if (off.offense.score) { score += off.offense.score; why.push(off.offense.reason) }
if (off.form.score)    { score += off.form.score;    why.push(off.form.reason) }
```
`lean`/`strong`/`edge` logic unchanged. Offense can now push `score` negative → a real UNDER path. Expose `off.source` in the `ou` payload for debugging ("lineup" vs "team" vs "none").

## Data flow
ESPN game → map to gamePk → MLB Stats lineups (or team-wOBA fallback) → Savant xwOBA per batter (platoon-adjusted) → offenseFactor + formFactor → added to game-info `score` → lean → snapshotted by SpotlightTicker → graded by `cron-grade-leans` → record in Spotlight panel + card chips.

## Error handling
- Every fetch timeboxed + try/catch; any failure drops to the next fallback, finally to `none` (factor omitted). The O/U lean still renders from the existing factors — offense is additive, never required.
- Lineup/gamePk mismatch (doubleheaders, name variations) → log + fall back to team wOBA.
- Credit cost: **$0** (MLB Stats + ESPN + cached Savant are all free).

## Testing
- TDD on the pure functions in `offense.js`: `lineupXwoba`, `offenseFactor`, `formFactor`, platoon adjustment, and the fallback selection logic (new `tests/offense.test.js`).
- Manual: verify on a live slate that `ou.source` resolves to `lineup` once lineups post, and that at least some games now read UNDER.

## Measurement (how we know it worked)
The `lean_results` tracking already records + grades every lean. After ~1 week:
- Compare overall and strong-lean win% before vs after the upgrade (by `game_date`).
- Check the OVER/UNDER call balance shifts from ~7:3 toward the actual ~50/50 distribution.
- If no improvement, tune the `offense.js` constants (thresholds) — isolated, low-risk.

## Rollout
Single deploy. Lineups post 1–3h pre-game, aligning with the pre-game snapshot window, so captured leans will include the offense read from day one.
