# EV Brain Phase 2 — Wire Real Feeds + Operator UI · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task ships independently behind the project's guarded deploy (`npm run ship` = tests + undef-check + build) and is Chrome-verified before the next.

**Goal:** Turn the EV Brain from a tested-but-unfed calculator into a live bet-quality + operator-discipline grader: feed it real model probability, CLV, and bet-log behavior, and surface it in the app (verdict on each bet + the empty OPERATOR tile).

**Architecture:** Phase 1 already shipped the pure scoring math in `src/lib/evBrain.js` (EV/CLV/PHLT/discipline/operator/final + `gradeBetQuality` + `verdictFromBetGrade`), and `BetCard.jsx` already renders a verdict pill from EV+CLV. Phase 2 adds **pure resolver functions** that compute the still-missing inputs from data we already have (de-vig consensus odds via `devig.js`, closing lines via `odds_history`, and the user's `bets` rows), then wires them into `gradeBetQuality` and two UI surfaces. Everything new is a pure, unit-tested function first; UI consumes it last. No new external data sources, no paid Odds-API calls.

**Tech Stack:** React + Vite, Vitest (`npm test`), Supabase (`bets`, `odds_history`), existing `src/lib/devig.js`, `src/lib/gradeBet.js`, `src/lib/evBrain.js`. Brand rules: operators-not-gamblers; **labels are Green / Small / Lean / Pass** (no "play/pick/lock"); worst operator tier "Degen Mode" stays.

**Decisions locked (2026-06-21):**
- Verdict tiers = **Green / Small / Lean / Pass** (was Prime/Strong/Lean/Pass in code).
- The universal grader is **"EV Brain"**; the shipped MLB hitter model **keeps the name PHLT** (no rename).

---

## File Structure
- **Modify** `src/lib/evBrain.js` — rename verdict labels; export a top-level `gradeLoggedBet()` orchestrator (Task 1, 5).
- **Create** `src/lib/evBrainFeeds.js` — pure resolvers: `modelProbForBet`, `clvForBet`, `disciplineFromBetLog`, `operatorFromBetLog` (Tasks 2–4).
- **Create** `tests/evBrainFeeds.test.js` — unit tests for the resolvers (Tasks 2–4).
- **Modify** `tests/ev-brain.test.js` — update verdict-label expectations (Task 1).
- **Modify** `src/components/BetCard.jsx` — verdict pill already exists; enrich with the component breakdown/tooltip (Task 6).
- **Modify** `src/App.jsx` — fill the OPERATOR tile from `operatorFromBetLog` (Task 5).

Pure resolvers live together in `evBrainFeeds.js` because they share the bet-log shape and are all "data → score-input." UI stays in its existing components.

---

### Task 1: Brand-safe verdict labels (Green / Small / Lean / Pass)

**Files:**
- Modify: `src/lib/evBrain.js:124-128` (the `VERDICTS` array)
- Test: `tests/ev-brain.test.js`

- [ ] **Step 1: Update the failing test first** — change the label expectations in `tests/ev-brain.test.js` (search for `Prime`/`Strong` in verdict assertions) to the new labels:

```js
// verdictFor thresholds unchanged (85 / 75 / 65), labels rebranded
expect(verdictFor(90).label).toBe('Green')
expect(verdictFor(80).label).toBe('Small')
expect(verdictFor(70).label).toBe('Lean')
expect(verdictFor(50).label).toBe('Pass')
```

- [ ] **Step 2: Run it, watch it fail**

Run: `npx vitest run tests/ev-brain.test.js`
Expected: FAIL — current labels are `Prime`/`Strong`.

- [ ] **Step 3: Rename the labels** in `src/lib/evBrain.js` (keep thresholds + keys; only `label` text changes, and key for clarity):

```js
const VERDICTS = [
  { min: 85, key: 'GREEN', label: 'Green', tone: 'neon'  },
  { min: 75, key: 'SMALL', label: 'Small', tone: 'green' },
  { min: 65, key: 'LEAN',  label: 'Lean',  tone: 'amber' },
  { min: -Infinity, key: 'PASS', label: 'Pass', tone: 'muted' },
]
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/ev-brain.test.js` → PASS. Then grep the codebase for any UI string referencing the old verdict keys/labels (`grep -rn "Prime\|'STRONG'" src/components/BetCard.jsx`) and update if the pill renders the key.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(evBrain): brand-safe verdict labels (Green/Small/Lean/Pass)"`

---

### Task 2: `modelProbForBet` — real model probability from de-vig consensus + our model

**Why:** EV needs a `modelProb`. Today `verdictFromBetGrade` uses whatever EV% `gradeBet.js` computed. Phase 2 grounds it: baseline = de-vig consensus fair prob (what the market really thinks), then nudge by our live model's edge when the bet is on a market our model covers (MLB total).

**Files:**
- Create: `src/lib/evBrainFeeds.js`
- Test: `tests/evBrainFeeds.test.js`

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest'
import { modelProbForBet } from '../src/lib/evBrainFeeds.js'

describe('modelProbForBet', () => {
  it('returns the de-vig consensus fair prob when we have no model edge', () => {
    // -110 / -110 two-way → ~50% fair after removing vig
    const p = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true } })
    expect(p).toBeGreaterThan(0.49); expect(p).toBeLessThan(0.51)
  })
  it('nudges toward our model when a model edge is supplied (MLB total over with +edge)', () => {
    const base = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true } })
    const withEdge = modelProbForBet({ americanOdds: -110, consensus: { oddsA: -110, oddsB: -110, sideA: true }, modelEdgeRuns: 1.5, betSide: 'OVER' })
    expect(withEdge).toBeGreaterThan(base)   // model likes the over → higher prob than market-only
  })
  it('clamps to (0.01, 0.99) and never NaN on missing data', () => {
    const p = modelProbForBet({ americanOdds: null, consensus: null })
    expect(p == null || (p > 0 && p < 1)).toBe(true)
  })
})
```

- [ ] **Step 2: Run → fail** (`modelProbForBet is not a function`).

- [ ] **Step 3: Implement** in `src/lib/evBrainFeeds.js`:

```js
import { devigTwoWay, americanToImplied } from './devig.js'

const clampP = (p) => Math.max(0.01, Math.min(0.99, p))

// modelProbForBet({ americanOdds, consensus, modelEdgeRuns, betSide }) → fair win prob (0..1) or null.
// Baseline = de-vig consensus fair prob for the side bet. If a model edge is supplied (MLB total: the
// O/U model's edgeRuns and the bet's OVER/UNDER side), nudge the prob by a small, capped amount in the
// direction the model agrees with. Coefficient is a hypothesis; the graded record tunes it.
const EDGE_TO_PROB = 0.03   // per run of model edge, capped at ±0.09 (~3 runs)
export function modelProbForBet({ americanOdds, consensus, modelEdgeRuns = null, betSide = null } = {}) {
  let base = null
  if (consensus && Number.isFinite(consensus.oddsA) && Number.isFinite(consensus.oddsB)) {
    const fair = devigTwoWay(consensus.oddsA, consensus.oddsB)   // { probA, probB }
    base = consensus.sideA ? fair.probA : fair.probB
  } else if (Number.isFinite(americanOdds)) {
    base = americanToImplied(americanOdds)   // fall back to vig-inclusive implied (better than nothing)
  }
  if (base == null) return null
  if (Number.isFinite(modelEdgeRuns) && (betSide === 'OVER' || betSide === 'UNDER')) {
    const agree = betSide === 'OVER' ? Math.sign(modelEdgeRuns) > 0 : Math.sign(modelEdgeRuns) < 0
    const mag = Math.min(Math.abs(modelEdgeRuns), 3) * EDGE_TO_PROB
    base += agree ? mag : -mag
  }
  return clampP(base)
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** — `feat(evBrainFeeds): modelProbForBet from de-vig consensus + model edge`.

---

### Task 3: `clvForBet` — closing-line value from odds_history

**Why:** `clvScore` exists but needs entry vs close. Pull the bet's market close from `odds_history` (the same table the By-Sportsbook chart uses).

**Files:** Modify `src/lib/evBrainFeeds.js`; Test `tests/evBrainFeeds.test.js`.

- [ ] **Step 1: Failing test** — `clvForBet` is a PURE reducer over already-fetched snapshots (the network fetch is done by the caller, keeping this testable):

```js
import { clvForBet } from '../src/lib/evBrainFeeds.js'
describe('clvForBet', () => {
  it('returns the closing american for the bet market/side from snapshots (latest before start)', () => {
    const snaps = [
      { market: 'totals', side: 'over', price: -110, captured_at: '2026-06-21T10:00:00Z' },
      { market: 'totals', side: 'over', price: -130, captured_at: '2026-06-21T16:00:00Z' },
      { market: 'h2h', side: 'home', price: 120, captured_at: '2026-06-21T16:00:00Z' },
    ]
    expect(clvForBet({ market: 'totals', side: 'over' }, snaps)).toBe(-130) // latest matching
  })
  it('returns null when no snapshot matches', () => {
    expect(clvForBet({ market: 'spreads', side: 'home' }, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `clvForBet({ market, side }, snapshots)` — filter snapshots to the bet's market+side, sort by `captured_at`, return the latest `price` (the close), else null. (Caller fetches snapshots from `odds_history` by `external_event_id`; reuse the cached `fetchLineMovement` path from `oddsHistory.js`.)
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** — `feat(evBrainFeeds): clvForBet close lookup from odds_history snapshots`.

---

### Task 4: `disciplineFromBetLog` + `operatorFromBetLog` — grade behavior from the user's bets

**Why:** The discipline + operator scores need real behavior. Derive them from the `bets` rows (sizes, sequencing, structure) using the penalty rules already in `DISCIPLINE_PENALTIES`.

**Files:** Modify `src/lib/evBrainFeeds.js`; Test `tests/evBrainFeeds.test.js`.

- [ ] **Step 1: Failing tests** — pure functions over an array of bet rows:

```js
import { disciplineFromBetLog, operatorFromBetLog } from '../src/lib/evBrainFeeds.js'
const bets = [
  { stake: 20, created_at: '2026-06-21T18:00:00Z', result: 'L', legs: null },
  { stake: 60, created_at: '2026-06-21T18:20:00Z', result: null, legs: null }, // 3x size jump right after a loss = chase
]
describe('disciplineFromBetLog', () => {
  it('flags a size spike right after a loss (chase) → penalty applied, score < 100', () => {
    const r = disciplineFromBetLog(bets, { unit: 20 })
    expect(r.score).toBeLessThan(100)
    expect(r.penalties).toContain('liveChase')   // or 'sizeJump' — whichever the rule maps to
  })
  it('clean, flat-staked log → high score, no penalties', () => {
    const clean = [{ stake: 20, result: 'W' }, { stake: 20, result: 'L' }, { stake: 20, result: 'W' }]
    const r = disciplineFromBetLog(clean, { unit: 20 })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.penalties).toHaveLength(0)
  })
})
describe('operatorFromBetLog', () => {
  it('returns a 0-100 score + a label from operatorLabelFor', () => {
    const r = operatorFromBetLog(bets, { unit: 20 })
    expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100)
    expect(typeof r.label).toBe('string')
  })
})
```

- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** both:
  - `disciplineFromBetLog(bets, { unit })` → detect: size jumps vs `unit` (esp. right after a loss → chase/size-jump penalty), over-long parlays (`legs.length` large), too many bets in a short window (boredom/tilt). Start from 100, apply `DISCIPLINE_PENALTIES`, return `{ score, penalties }`. Keep detection conservative (only flag clear violations).
  - `operatorFromBetLog(bets, { unit })` → compose `operatorRating({ discipline, clv, bankrollGrowth, ticketStructure, riskControl })` using discipline from above, average CLV if available (else neutral), and bankroll growth from W/L · stake. Return `{ score, label: operatorLabelFor(score) }`. Renormalize over present components (reuse `weightedScore`).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit** — `feat(evBrainFeeds): discipline + operator scores from bet-log behavior`.

---

### Task 5: Fill the OPERATOR tile (the empty dashboard slot)

**Files:** Modify `src/App.jsx` (search `OPERATOR` / `SOON` — the CH3/dashboard tile that currently shows a placeholder).

- [ ] **Step 1:** Locate the OPERATOR tile placeholder. Confirm the component has access to the user's `bets` array and the bankroll unit (it's in the same App state as the bet log).
- [ ] **Step 2:** Compute `const op = operatorFromBetLog(bets, { unit })` (memoize with `useMemo` keyed on `bets`). Render the score + `op.label` (Sharp/Clean/Developing/Risky/Degen Mode) with the existing tile styling and brand colors (#BDFF00 / #FF3B3B for the Degen tier). Empty-state when there are < 3 graded bets ("log a few bets to rate your discipline").
- [ ] **Step 3:** Do NOT change any other tile. Mobile-first; match the existing SCOREBOARD tile look.
- [ ] **Step 4: Verify** — `npm run check:undef` + `npm test` green. Ship + Chrome-verify the tile renders (log a test bet first — owner account has none).
- [ ] **Step 5: Commit** — `feat(dashboard): fill OPERATOR tile from EV Brain operator rating`.

---

### Task 6: Bet-grade breakdown + tooltips on the bet card

**Files:** Modify `src/components/BetCard.jsx` (the verdict pill already renders via `verdictFromBetGrade`).

- [ ] **Step 1:** Where the verdict pill renders, also expose the component scores (EV, CLV, and — when available for an MLB game bet — PHLT/model) behind a tap/tooltip: "Green 86 · EV +5.1% · beat close +1.0". Use `gradeBetQuality`/`verdictFromBetGrade` output already computed; just surface the sub-scores.
- [ ] **Step 2:** When the bet is on an MLB game our O/U model covers, pass `modelProbForBet(...)` (Task 2) into the grade so the pill reflects our model, not just market EV. Gate: only when we have the model's `edgeRuns` for that event; else current behavior.
- [ ] **Step 3:** Brand-safe copy only; tooltip explains each score in one plain sentence (operators-not-gamblers tone).
- [ ] **Step 4: Verify** `npm test` + Chrome (log a test bet, confirm pill + tooltip render, no error boundary).
- [ ] **Step 5: Commit** — `feat(BetCard): EV Brain component breakdown + tooltips`.

---

### Task 7: End-to-end live verification (needs a real logged bet)

**Files:** none (verification).

- [ ] **Step 1:** Log a test bet on the owner/whitelisted account (a single MLB total, e.g. on a game our model has a lean for) — the owner account historically has 0 bets, which is why the pill/tile were never confirmed live.
- [ ] **Step 2:** Confirm in Chrome (Chrome MCP, mobile width): the bet card shows a verdict (Green/Small/Lean/Pass) + breakdown; the OPERATOR tile shows a score+label; no error boundary; no console errors.
- [ ] **Step 3:** Sanity-check the numbers: a clearly +EV bet on a market the model likes should read higher than a -EV market bet; a 3×-unit chase bet should drag the operator score down.
- [ ] **Step 4:** Clean up the test bet if desired (bets-only reset). Update memory `rml-evbrain-spec` → mark Phase 2 live; note remaining (NBA/NHL sport models = Phase 3).

---

## Self-Review

**1. Spec coverage (vs memory `rml-evbrain-spec` Phase 2 = "wire real feeds + UI"):**
- ModelProb ← de-vig consensus + live model → Task 2. ✅
- CLV ← odds_history → Task 3. ✅
- Discipline/Operator ← bet-log behavior → Task 4. ✅
- Bet-grade card + operator tile + tooltips → Tasks 5, 6. ✅
- Brand-safe labels + PHLT-name decision → Task 1 + locked decisions. ✅
- "Play" label removed (brand rule) → Green/Small/Lean/Pass. ✅

**2. Placeholder scan:** Pure-function tasks (1–4) have complete code + tests. UI tasks (5–6) specify exact behavior, file, gating, and verification rather than full JSX — acceptable for integration into large existing components; the implementer follows the established BetCard/tile patterns.

**3. Type consistency:** `modelProbForBet` returns a 0–1 prob consumed by `evScore` (which expects `modelProb` 0–1 ✓). `clvForBet` returns an american number consumed by `clvScore(entryAmerican, closeAmerican)` ✓. `disciplineFromBetLog`/`operatorFromBetLog` return `{ score, ... }`; `operatorFromBetLog` uses `operatorLabelFor(score)` (exists ✓). Verdict labels Green/Small/Lean/Pass thread from `VERDICTS` → `verdictFor` → BetCard pill ✓.

**Out of scope (logged for later, NOT this plan):**
- NBA/WNBA prop, NHL SOG, MLB team-total sport models (need new free-data sourcing) — Phase 3.
- Ladder/RR fit scoring from real ladder sessions (functions exist; wiring deferred — passed as null for now).
- Backtesting the EV-Brain coefficients (EDGE_TO_PROB, penalty sizes) once a graded record accrues.
