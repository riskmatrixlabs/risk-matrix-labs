# Phase 3 FINISH — Surface + Grade Team Picks (ML / Run Line) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Ship each task behind the guarded deploy (`npm run ship` = tests + undef-check + build) and Chrome-verify before the next.

**Goal:** Take the per-side run engine that's already live (`ou.proj2`, built S65) and make its **team picks usable**: (1) market-anchor it so it stops drifting to league-average on sharp games, (2) surface the **Moneyline + Run-Line** picks in Spotlight + game cards, and (3) grade them so they build a track record like the totals do.

**Why:** The live model only does over/unders — the owner repeatedly flagged "no team picks." The per-side engine already projects each team's runs separately (→ Total / ML / RL from one engine) and is live in the data as `proj2`, just not surfaced or trustworthy yet. This is the model's biggest unrealized edge.

**Current state (read first):**
- `api/_lib/runModel.js` — pure, 24 tests: `projectTeamRuns`, `gameProjection` → `{awayRuns, homeRuns, total, margin}`, `winProbFromMargin`, `coverProb`, `deriveBets` → `{total, ml, rl}`. All LIVE.
- `api/game-info.js` emits `ou.proj2 = { awayRuns, homeRuns, total, margin, bets: {total, ml, rl} }` alongside the real `ou` lean (additive, BETA).
- **Known flaw (from S65 validation):** `proj2` is an ABSOLUTE projection, not anchored to the market — on sharp-pitching low totals it reverts toward league-average and disagrees with the line-anchored `ou` (e.g. it said OVER on a game `ou` correctly called UNDER). Fix that FIRST or the team picks aren't trustworthy.
- Lean grading: `lean_results` table + `cron-grade-leans` grade TOTALS only. ML/RL need their own columns + grading.

**Architecture:** Keep `runModel.js` as the pure engine. Task 1 anchors it. Tasks 2–3 add ML/RL persistence + grading (mirror the existing totals path). Tasks 4–5 surface the picks in the UI. Each task is independently shippable + verifiable.

**Tech Stack:** Node ESM, Vitest, Supabase (`lean_results` / a new `ml_rl_results`), React. No new external feeds, 0 Odds-API credits.

---

## File Structure
- **Modify** `api/_lib/runModel.js` — add market-anchoring to `gameProjection`/`deriveBets` (Task 1).
- **Modify** `tests/runModel.test.js` — anchoring tests (Task 1).
- **Migration** — add ML/RL graded columns/table (Task 2).
- **Create/Modify** `api/snapshot-lean.js` (or a sibling `snapshot-mlrl.js`) — persist the team pick (Task 2).
- **Modify** `api/cron-grade-leans.js` (or sibling) — grade ML/RL from final scores via `findEventForBet` (Task 3).
- **Modify** `src/components/SpotlightTicker.jsx` + the game card — show ML/RL picks (Tasks 4–5).

---

### Task 1: Market-anchor the per-side engine (the trust fix — DO FIRST)

**Files:** Modify `api/_lib/runModel.js`; Test `tests/runModel.test.js`.

**Problem:** `gameProjection` builds an absolute total from league baselines, so when the market prices a sharp 6.5 total, the engine reverts to ~8.6 and disagrees. The line-anchored `ou` model is right on those; the per-side engine must respect the market the same way.

**Approach:** Blend the per-side projected total toward the market total, then re-derive the per-side scores from the blended total while preserving the projected MARGIN (the margin is the engine's real signal; the total should defer to the market).

- [ ] **Step 1: Failing test**
```js
import { anchorProjection } from '../api/_lib/runModel.js'
describe('anchorProjection', () => {
  it('pulls the total toward the market but KEEPS the margin', () => {
    const raw = { awayRuns: 5.0, homeRuns: 3.0, total: 8.0, margin: -2.0 } // engine: away by 2
    const a = anchorProjection(raw, 6.5)   // market says 6.5, much lower
    expect(a.total).toBeGreaterThan(6.5)        // blended, not fully market
    expect(a.total).toBeLessThan(8.0)           // pulled down toward market
    expect(a.margin).toBeCloseTo(-2.0, 1)       // margin (the ML/RL signal) preserved
    expect(a.awayRuns + a.homeRuns).toBeCloseTo(a.total, 5)
    expect(a.awayRuns - a.homeRuns).toBeCloseTo(a.margin, 1) // wait: margin = home-away; keep sign convention
  })
  it('no market total → returns the raw projection unchanged', () => {
    const raw = { awayRuns: 4.3, homeRuns: 4.3, total: 8.6, margin: 0 }
    expect(anchorProjection(raw, null)).toEqual(raw)
  })
})
```
(NOTE for implementer: margin sign is HOME-perspective `homeRuns - awayRuns` per runModel.js — keep that convention; fix the test's away/home arithmetic to match before running.)

- [ ] **Step 2:** Run → fail (`anchorProjection` not a function).
- [ ] **Step 3:** Implement `anchorProjection(proj, marketTotal, weight = 0.6)`:
  - If `marketTotal` not finite → return `proj` unchanged.
  - `blendedTotal = proj.total * (1 - weight) + marketTotal * weight` (weight = how much to trust the market; 0.6 = market-leaning, a hypothesis to tune).
  - Keep `margin = proj.margin`. Re-split: `homeRuns = (blendedTotal + margin) / 2`, `awayRuns = (blendedTotal - margin) / 2`. Round. Return `{ awayRuns, homeRuns, total: blendedTotal, margin }`.
  - Wire it into the `game-info.js` proj2 build: anchor `gp` to the market total BEFORE `deriveBets` (so Total defers to market, ML/RL come from the preserved margin).
- [ ] **Step 4:** Run → pass. Full `npm test` green. `check:undef` clean.
- [ ] **Step 5:** Ship (bump SW) + Chrome-verify a few games: `proj2.bets.total.lean` should now AGREE with `ou.lean` far more often (the S65 conflict cases should resolve). Spot-check via the authed `/api/game-info` console fetch.

---

### Task 2: Persist ML/RL picks for grading

**Files:** DB migration; `api/snapshot-lean.js` (extend) or new `api/snapshot-mlrl.js`; `src/components/SpotlightTicker.jsx` (POST the pick).

- [ ] **Step 1:** Migration — add to `lean_results` (or a new `ml_rl_results` table; prefer extending with a `market` column to keep one grader): `market text default 'total'`, `pick_side text` (e.g. 'AWAY'/'HOME' for ML, 'AWAY -1.5' for RL), `win_prob numeric`, `cover_prob numeric`. Apply via `apply_migration`. Add service_role GRANTs (see memory `rml-supabase-grants-gotcha`).
- [ ] **Step 2:** On snapshot, when `proj2.bets.ml.pick` is non-null and confident (set a threshold, e.g. `winProb >= 0.55`), insert an ML row (and RL when `coverProb` clears a threshold), `market='ml'/'rl'`, locked pre-game like totals (insert-if-absent, ET date keyed). Reuse the existing snapshot guards (pre-game only, plausible values).
- [ ] **Step 3:** Tests for the snapshot payload shape; verify the row inserts (DB check). Ship.

---

### Task 3: Grade ML/RL from final scores

**Files:** `api/cron-grade-leans.js` (extend) or sibling cron.

- [ ] **Step 1:** In the grader, for `market='ml'` rows: resolve the event via the SAME logic the totals grader uses (must use `findEventForBet`-equivalent or match on the locked event id — see memory `rml-event-matching-utc-bug`; do NOT regress the timezone fix). ML result: picked side's final score > opponent → W, < → L, = → P (rare).
- [ ] **Step 2:** For `market='rl'`: favorite covers -1.5 if margin ≥ 2 → W; push handling; else L.
- [ ] **Step 3:** Backfill `final_total`/`result`/`graded_at`. Tests for the pure grade logic (reuse `gradeBetResult.js` patterns — it already grades ml/spread/total from a final score; consider routing ML/RL grading THROUGH `gradeBetResult` for consistency). Ship + verify a graded ML row in the DB.

---

### Task 4: Surface ML/RL in the game card

**Files:** the game card component (`src/components/MatrixBot.jsx` GameCard / `src/components/LiveCenter.jsx`).

- [ ] **Step 1:** Where the O/U lean flag renders, add a compact **team pick** line from `ou.proj2.bets`: e.g. `🏆 PHI ML (61%)` and `📐 PHI -1.5 (48%)` when present + above threshold. BETA-tagged, brand-safe (no "lock/pick/play" — say "model leans PHI", "edge", etc.).
- [ ] **Step 2:** Gate: only show when the per-side engine is confident (winProb/coverProb past threshold) AND anchored (Task 1 done). Missing → show nothing (don't clutter).
- [ ] **Step 3:** Ship + Chrome-verify on a live slate.

---

### Task 5: Surface ML/RL in Spotlight (ranked alongside totals)

**Files:** `src/components/SpotlightTicker.jsx`.

- [ ] **Step 1:** Extend the Spotlight feed so a game can contribute up to 3 signals (Total / ML / RL) when each clears its threshold. Rank by edge/confidence across all markets. Keep the existing "feature top leans even if none are strong" behavior (see memory `feedback-rml-verify-render` S65 note).
- [ ] **Step 2:** Make sure the snapshot/grading (Tasks 2–3) records what Spotlight shows so the record stays honest.
- [ ] **Step 3:** Ship + Chrome-verify Spotlight shows team picks; confirm no error boundary, the ticker still renders, and totals still work.

---

## Self-Review
- "Surface team picks (ML/RL)" → Tasks 4, 5. ✅
- "Grade them / track record" → Tasks 2, 3. ✅
- "Market-anchor so trustworthy" (the S65-flagged blocker) → Task 1, done FIRST. ✅
- Reuses existing infra: snapshot/grade pattern (totals), `findEventForBet` (no timezone regression), `gradeBetResult` for grading, Spotlight's feature-top-leans behavior. ✅

**Out of scope (later):** tuning the anchor `weight` + run-model coefficients via backtest (needs accrued data); correlation handling between Total/ML/RL on the same game; NBA/NHL per-side models.

**Honest note for next session:** Task 1 (anchoring) is the gate — if the per-side total still disagrees with the market after anchoring, the ML/RL picks aren't trustworthy and shouldn't be surfaced. Verify Task 1 resolves the S65 conflict cases before building Tasks 4–5.
