# Connect PHLT to the System — Plan (self-grading loop → EV Brain)

> Goal: take the PHLT hitter-prop model from **display-only** to **fully connected** — give it a self-grading track record (Plan A), then wire its score into the EV Brain verdict (Plan B). Mirrors the O/U lean loop that already works. From the S66 investigation (agents `a4323743`, `a3fb310f`).

**Prereq DONE (S66, v484):** PHLT calibration fixed — tier cutoffs re-centered 85/75/65 → 72/62/52, streak floor 30→48. So the grades are now usable (avg hitter → Caution, not Fade). See `src/lib/phlt.js`, memory `rml-two-models`.

**Current state:** PHLT is computed in `api/phlt.js` (pure `src/lib/phlt.js` `scoreHit`), rendered only in the Matrix Bot board (`MatrixBot.jsx:1172-1336`). It is NOT in the EV Brain verdict (`evBrain.js:194` passes `phlt:null`), has NO self-grading, NO track record, NOT in Spotlight.

**Key enabler:** the box-score grader already exists — `resolveStat(players[norm(name)], 'hits')` (`src/lib/statProgress.js:61`) + `parseBox` (`api/box-score.js:31`) answer "did the hitter get a hit?" from the same ESPN summary `cron-grade-leans.js` already fetches. So grading a PHLT pick is a near-trivial extension.

**Naming trap (don't conflate):** `evBrain.js`'s `phltScore` is the *universal* grader (Player/Price/Probability/Line/Tempo), NOT the MLB hitter model. The hitter model's 0–100 score feeds the `phlt` slot of `finalBetScore` — they share a name only.

---

## PLAN A — PHLT self-grading loop (do FIRST; produces the data Plan B needs)

Mirror the O/U loop: snapshot pre-game → grade from final box score → tally a record. Reuse `lean_results` with a `market='prop'` row type.

### Task A1 — Migration: prop columns + composite unique key
**Files:** Supabase migration (apply_migration).
- Add nullable cols to `lean_results`: `player text`, `prop_market text` (e.g. `'hits'`), `prop_line numeric` (0.5 = "to record a hit"), `phlt_score int`, `phlt_tier text`. (`lean`/`pick_side` reuse: store `OVER`/`UNDER`.)
- **Widen the unique key** so multiple hitters per game each lock a row: drop `lean_results_event_date_market_key`, add `UNIQUE (external_event_id, game_date, market, player, prop_market)` (player/prop_market are NULL for total/ml/rl → Postgres treats NULLs as distinct, which is fine; verify the total/ml/rl insert-if-absent still behaves — may need `COALESCE` or a partial index if NULL-dup is a problem; test on staging values first).
- Columns inherit table grants (no new GRANT).

### Task A2 — Pure `gradeProp` in `api/_lib/gradeLean.js`
**Files:** `api/_lib/gradeLean.js`, `tests/gradeLean.test.js`.
- Add a branch to (or sibling of) `gradeLeanResult`: `gradeProp({ statValue, prop_line, lean })` → `statValue >= prop_line ? (lean==='OVER'?'W':'L') : (lean==='OVER'?'L':'W')`. `statValue == null` (DNP) → `null` (leave ungraded, never guess — same discipline as totals).
- TDD: hit ≥ line → W for OVER; miss → L; DNP/null → null.

### Task A3 — `prop` branch in `cron-grade-leans.js`
**Files:** `api/cron-grade-leans.js`.
- Extend the `.select(...)` with `player, prop_market, prop_line`.
- For `market==='prop'` rows: fetch the event's box score (`/api/box-score` or the same ESPN summary already used), `resolveStat(players[norm(player)], prop_market)` → `gradeProp(...)`. Skip if game not final or player not in box. CLV stays total-only (already gated).
- Test the routing; verify a graded prop row in the DB after a final game.

### Task A4 — Server cron to snapshot PHLT picks pre-game
**Files:** new `api/cron-snapshot-phlt.js` (mirror `api/cron-warm-props.js` cadence/guards) + extend `buildLeanRows`-style logic or insert directly.
- For each pre-game MLB game: run `api/phlt` (server-side, free), and for each hitter whose verdict clears a confidence floor (e.g. tier ≥ Caution AND `!faded`, plus a volume cap), insert a `market='prop'` row (insert-if-absent, ET-date keyed). Store `phlt_score`, `phlt_tier`, `player`, `prop_market='hits'`, `prop_line=0.5`, `lean='OVER'`.
- Server-side (not client) so it doesn't depend on someone opening the bot. Register in `vercel.json`.
- **Volume discipline:** cap rows/game (e.g. top N by score) so the table doesn't explode.

### Task A5 — Record surface
**Files:** `api/lean-record.js`, the Matrix Bot top bar (`MatrixBot.jsx`).
- Tally `market='prop'` rows separately, by tier (Prime/Strong/Caution win-rates). Surface a "PHLT record" line in the bot (matches memory `rml-phlt-tracking-idea`).

**Plan A output:** a graded PHLT track record — and the data needed to (a) trust the tiers and (b) tune the thresholds empirically (replacing the S66 eyeball re-center).

---

## PLAN B — Wire PHLT into the EV Brain verdict (after A)

### Task B1 — Capture the PHLT score at log time
**Files:** `src/components/PropBuilder.jsx`, the bet-create path in `App.jsx`, `bets` table.
- When a prop is logged from the builder/scan (where the bot already has `phlt[player]` in state, `MatrixBot.jsx:1205`), stamp `phltScore` + `phltTier` onto the bet. Store in the existing `legs`/metadata jsonb (no migration) or a new `bets.phlt_score` column.

### Task B2 — Thread it into the verdict
**Files:** `src/lib/gradeBet.js`, `src/lib/evBrain.js` (`verdictFromBetGrade:187`), `src/components/BetCard.jsx`.
- Carry `phltScore` through `gradeBet` (additive, like `modelEvPct`) → `verdictFromBetGrade(grade, odds)` passes `finalBetScore({ phlt: phltScore, ... })`. A `faded` verdict → low/zero PHLT component (not its raw score).

### Task B3 — Set the `phlt` weight (CALIBRATION-GATED)
**Files:** `src/lib/evBrain.js` `WEIGHTS.final`.
- ⚠️ **BLOCKED on Plan A's graded record.** Keep the `phlt` weight near-zero / behind a flag until A validates the tiers. Raising it to its spec weight (0.30) before calibration would degrade the verdict. Same discipline the O/U edge followed before feeding `modelEvPct`.

---

## Sequencing & effort
| Step | Size | Buildable now? |
|---|---|---|
| A1 migration | S | yes |
| A2 gradeProp (pure) | S | yes |
| A3 cron grade branch | M | yes |
| A4 snapshot cron | M | yes |
| A5 record surface | S | yes (after A3) |
| B1 capture at log time | S/M | yes |
| B2 thread to verdict | S | yes |
| B3 weight | S | **blocked on A's record** |

**Do Plan A first** — self-contained, reuses the proven O/U loop + the existing box-score grader, and produces the calibration data Plan B needs. Plan A ≈ M overall; Plan B plumbing (B1/B2) is buildable now, but B3 stays dark until the record validates. Whole thing is small because the O/U loop laid every rail and the prop grader already exists.

## Open question for the owner
- **Which prop market(s) to track?** v1 = "to record a hit" (`hits ≥ 0.5`) since that's what PHLT scores. Later: total bases, etc.
- **Volume cap** per game (how many hitters to snapshot/grade).
