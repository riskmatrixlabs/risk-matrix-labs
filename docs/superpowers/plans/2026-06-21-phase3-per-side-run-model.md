# Phase 3 — Per-Side Run Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project each team's expected runs *separately*, then derive Total, Moneyline (ML), and Run Line (RL) leans from one engine — fixing the "average the two starters" flaw (an ace gets fully credited to suppressing the other side, not blended away) and counting park/weather exactly once per side.

**Architecture:** A new isolated pure-function module `api/_lib/runModel.js` (no I/O, fully unit-tested) that takes the inputs `game-info.js` already resolves (offense xwOBA, starter xERA, bullpen ERA, park factor, weather runs per side) and returns `{ awayRuns, homeRuns, total, margin }`, plus helpers to turn that projection into Total / ML / RL leans against the market. It is built and verified in isolation FIRST, then surfaced additively in `game-info.js` as a new `proj2` block ALONGSIDE the existing line-anchored `ou` lean (never replacing it) so the two can be compared on the live graded record before any switch.

**Tech Stack:** Node ESM, Vitest (`npm test`), existing `scanStore`/Savant/MLB-StatsAPI data already loaded in `api/game-info.js`. No new dependencies, no new external feeds, 0 Odds-API credits.

---

## Why this is safe to build now

The live model (line-anchored `ou`) is untouched by Tasks 1–6. The per-side engine is a parallel computation surfaced as a separate field. Only Task 7 wires it into `game-info.js`, and even then it is additive output, not a replacement. Grading/Spotlight keep reading the existing `ou` until we explicitly decide (a later session) to switch based on the comparative record.

## League constants (shared, defined once in runModel.js)

```js
export const LG = {
  TEAM_RUNS: 4.30,   // half of an 8.6-run league total = one team's avg runs
  XWOBA:     0.320,  // league avg lineup xwOBA
  XERA:      4.00,   // league avg starter xERA
  PEN_ERA:   4.10,   // league avg bullpen ERA
  STARTER_SHARE: 0.62, // fraction of a game's innings a starter throws (rest = pen)
  MARGIN_SD: 3.00,   // stdev of MLB final run margin (for win-prob + RL cover math)
}
```

All coefficients below are run ESTIMATES — a hypothesis, exactly like the existing model's. The accruing graded record validates/tunes them; do NOT present them as proven.

---

## File Structure

- **Create** `api/_lib/runModel.js` — all pure functions (Tasks 1–5).
- **Create** `tests/runModel.test.js` — full unit coverage (Tasks 1–5).
- **Modify** `api/game-info.js` — surface a `proj2` block additively (Task 7).
- **Modify** `tests/` — no existing test changes expected (new module only).

---

### Task 1: `projectTeamRuns` — one team's expected runs

**Files:**
- Create: `api/_lib/runModel.js`
- Test: `tests/runModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { LG, projectTeamRuns } from '../api/_lib/runModel.js'

describe('projectTeamRuns', () => {
  it('a perfectly average matchup at a neutral park returns league team runs', () => {
    const r = projectTeamRuns({
      offXwoba: LG.XWOBA, oppStarterXera: LG.XERA, oppBullpenEra: LG.PEN_ERA,
      parkMult: 1, weatherRunsPerSide: 0,
    })
    expect(r).toBeCloseTo(LG.TEAM_RUNS, 2)
  })

  it('an ace opposing starter (xERA 2.85) suppresses the team BELOW league runs', () => {
    const r = projectTeamRuns({
      offXwoba: LG.XWOBA, oppStarterXera: 2.85, oppBullpenEra: LG.PEN_ERA,
      parkMult: 1, weatherRunsPerSide: 0,
    })
    expect(r).toBeLessThan(LG.TEAM_RUNS)
  })

  it('a strong offense (.345 xwOBA) vs a weak staff scores ABOVE league runs', () => {
    const r = projectTeamRuns({
      offXwoba: 0.345, oppStarterXera: 4.8, oppBullpenEra: 4.7,
      parkMult: 1, weatherRunsPerSide: 0,
    })
    expect(r).toBeGreaterThan(LG.TEAM_RUNS)
  })

  it('park factor scales runs (Coors 1.13 > neutral)', () => {
    const base = { offXwoba: LG.XWOBA, oppStarterXera: LG.XERA, oppBullpenEra: LG.PEN_ERA, weatherRunsPerSide: 0 }
    expect(projectTeamRuns({ ...base, parkMult: 1.13 })).toBeGreaterThan(projectTeamRuns({ ...base, parkMult: 1 }))
  })

  it('missing inputs fall back to league neutral (never NaN)', () => {
    const r = projectTeamRuns({ offXwoba: null, oppStarterXera: null, oppBullpenEra: null, parkMult: 1, weatherRunsPerSide: 0 })
    expect(Number.isFinite(r)).toBe(true)
    expect(r).toBeCloseTo(LG.TEAM_RUNS, 2)
  })

  it('never returns a negative or absurd run total (clamped 0–15)', () => {
    const r = projectTeamRuns({ offXwoba: 0.500, oppStarterXera: 12, oppBullpenEra: 12, parkMult: 2, weatherRunsPerSide: 5 })
    expect(r).toBeLessThanOrEqual(15)
    expect(r).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runModel.test.js`
Expected: FAIL — "projectTeamRuns is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// api/_lib/runModel.js
// Per-side run projection for the MLB O/U/ML/RL model (Phase 3). Pure, no I/O, fully unit-tested.
// Projects ONE team's expected runs from its own offense vs the OPPOSING staff + venue. Doing this
// per side (instead of averaging the two starters into one combined total) means an ace fully
// suppresses the side he faces, and park/weather are applied once per side. Coefficients are run
// ESTIMATES (a hypothesis); the graded record tunes them. See memory rml-ou-model Phase 3.

export const LG = {
  TEAM_RUNS: 4.30,
  XWOBA:     0.320,
  XERA:      4.00,
  PEN_ERA:   4.10,
  STARTER_SHARE: 0.62,
  MARGIN_SD: 3.00,
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Blended opposing-staff ERA: starter for ~62% of innings, bullpen for the rest.
function staffEra(oppStarterXera, oppBullpenEra) {
  const s = Number.isFinite(oppStarterXera) ? oppStarterXera : LG.XERA
  const b = Number.isFinite(oppBullpenEra) ? oppBullpenEra : LG.PEN_ERA
  return s * LG.STARTER_SHARE + b * (1 - LG.STARTER_SHARE)
}

// projectTeamRuns({ offXwoba, oppStarterXera, oppBullpenEra, parkMult, weatherRunsPerSide }) → runs.
// Multiplicative in offense × opposing-staff × park (so park is a single clean scalar per side),
// plus an additive weather term. Falls back to league-neutral on any missing input.
export function projectTeamRuns({ offXwoba, oppStarterXera, oppBullpenEra, parkMult = 1, weatherRunsPerSide = 0 } = {}) {
  const LG_STAFF = LG.XERA * LG.STARTER_SHARE + LG.PEN_ERA * (1 - LG.STARTER_SHARE)
  const offFactor   = Number.isFinite(offXwoba) ? offXwoba / LG.XWOBA : 1   // 1.06 = 6% above-avg bats
  const pitchFactor = staffEra(oppStarterXera, oppBullpenEra) / LG_STAFF    // >1 = weak staff → more runs
  const park        = Number.isFinite(parkMult) ? parkMult : 1
  const wx          = Number.isFinite(weatherRunsPerSide) ? weatherRunsPerSide : 0
  const runs = LG.TEAM_RUNS * offFactor * pitchFactor * park + wx
  return clamp(Math.round(runs * 100) / 100, 0, 15)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runModel.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/runModel.js tests/runModel.test.js
git commit -m "feat(runModel): per-side team run projection (Phase 3 core)"
```

---

### Task 2: `gameProjection` — both sides → score, total, margin

**Files:**
- Modify: `api/_lib/runModel.js`
- Test: `tests/runModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { gameProjection } from '../api/_lib/runModel.js'

describe('gameProjection', () => {
  const neutral = {
    away: { offXwoba: LG.XWOBA, starterXera: LG.XERA, bullpenEra: LG.PEN_ERA },
    home: { offXwoba: LG.XWOBA, starterXera: LG.XERA, bullpenEra: LG.PEN_ERA },
    parkMult: 1, weatherRunsPerSide: 0,
  }

  it('a fully neutral game projects ~league total, ~0 margin', () => {
    const p = gameProjection(neutral)
    expect(p.total).toBeCloseTo(LG.TEAM_RUNS * 2, 1)
    expect(Math.abs(p.margin)).toBeLessThan(0.2)
  })

  it('the ACE is credited to the side he faces, not averaged away (Skenes case)', () => {
    // PIT ace (Skenes 2.85) pitches for AWAY → suppresses the HOME (COL) offense.
    // COL has a weak arm (Sugano 4.54) → AWAY (PIT) offense is barely suppressed.
    const p = gameProjection({
      away: { offXwoba: 0.325, starterXera: 2.85, bullpenEra: 3.8 },  // PIT: ace starting
      home: { offXwoba: 0.330, starterXera: 4.54, bullpenEra: 4.6 },  // COL: weak arm
      parkMult: 1.13, weatherRunsPerSide: 0.3,
    })
    // Home (COL) faces the ace → scores fewer than Away (PIT) who faces the weak arm.
    expect(p.homeRuns).toBeLessThan(p.awayRuns)
    // Margin is from the HOME perspective → negative (home loses the run battle).
    expect(p.margin).toBeLessThan(0)
  })

  it('total = awayRuns + homeRuns and margin = homeRuns - awayRuns exactly', () => {
    const p = gameProjection(neutral)
    expect(p.total).toBeCloseTo(p.awayRuns + p.homeRuns, 5)
    expect(p.margin).toBeCloseTo(p.homeRuns - p.awayRuns, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runModel.test.js`
Expected: FAIL — "gameProjection is not a function".

- [ ] **Step 3: Write minimal implementation** (append to `api/_lib/runModel.js`)

```js
// gameProjection({ away, home, parkMult, weatherRunsPerSide }) → { awayRuns, homeRuns, total, margin }.
// Each side's runs are projected from ITS OWN offense vs the OTHER side's staff. Park + weather apply
// equally to both sides (same venue/air), so they cancel in the margin but stack in the total — which
// is exactly right (a hitter park inflates the total but not who wins).
//   away/home = { offXwoba, starterXera, bullpenEra }
//   margin is HOME-perspective: homeRuns - awayRuns (positive = home favored on the field).
export function gameProjection({ away = {}, home = {}, parkMult = 1, weatherRunsPerSide = 0 } = {}) {
  const awayRuns = projectTeamRuns({
    offXwoba: away.offXwoba, oppStarterXera: home.starterXera, oppBullpenEra: home.bullpenEra,
    parkMult, weatherRunsPerSide,
  })
  const homeRuns = projectTeamRuns({
    offXwoba: home.offXwoba, oppStarterXera: away.starterXera, oppBullpenEra: away.bullpenEra,
    parkMult, weatherRunsPerSide,
  })
  const total = Math.round((awayRuns + homeRuns) * 100) / 100
  const margin = Math.round((homeRuns - awayRuns) * 100) / 100
  return { awayRuns, homeRuns, total, margin }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runModel.test.js`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/runModel.js tests/runModel.test.js
git commit -m "feat(runModel): gameProjection combines both sides into score/total/margin"
```

---

### Task 3: `winProbFromMargin` — margin → home win probability

**Files:**
- Modify: `api/_lib/runModel.js`
- Test: `tests/runModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { winProbFromMargin } from '../api/_lib/runModel.js'

describe('winProbFromMargin', () => {
  it('a 0 margin is a coin flip', () => {
    expect(winProbFromMargin(0)).toBeCloseTo(0.5, 2)
  })
  it('positive margin → home favored (>0.5), negative → underdog (<0.5)', () => {
    expect(winProbFromMargin(1.5)).toBeGreaterThan(0.5)
    expect(winProbFromMargin(-1.5)).toBeLessThan(0.5)
  })
  it('is symmetric around 0.5', () => {
    expect(winProbFromMargin(2) + winProbFromMargin(-2)).toBeCloseTo(1.0, 5)
  })
  it('stays in (0,1) for extreme margins', () => {
    expect(winProbFromMargin(10)).toBeLessThan(1)
    expect(winProbFromMargin(10)).toBeGreaterThan(0.9)
    expect(winProbFromMargin(-10)).toBeGreaterThan(0)
  })
  it('a ~1.5 run edge maps to roughly a 62-68% favorite (sanity band)', () => {
    const p = winProbFromMargin(1.5)
    expect(p).toBeGreaterThan(0.60)
    expect(p).toBeLessThan(0.70)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runModel.test.js`
Expected: FAIL — "winProbFromMargin is not a function".

- [ ] **Step 3: Write minimal implementation** (append to `api/_lib/runModel.js`)

```js
// Normal CDF (Abramowitz-Stegun 7.1.26 approximation) — no dependency.
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return p
}

// winProbFromMargin(margin) → home win probability. Treats the final margin as Normal(mean=margin,
// sd=MARGIN_SD); P(home wins) = P(margin > 0) = Φ(margin / sd). Symmetric, bounded (0,1).
export function winProbFromMargin(margin) {
  const m = Number.isFinite(margin) ? margin : 0
  return Math.round(normCdf(m / LG.MARGIN_SD) * 1000) / 1000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runModel.test.js`
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/runModel.js tests/runModel.test.js
git commit -m "feat(runModel): winProbFromMargin via normal CDF"
```

---

### Task 4: `coverProb` — run-line (-1.5) cover probability

**Files:**
- Modify: `api/_lib/runModel.js`
- Test: `tests/runModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { coverProb } from '../api/_lib/runModel.js'

describe('coverProb (-1.5 run line)', () => {
  it('a pick-em game: favorite rarely covers -1.5 (<0.5)', () => {
    expect(coverProb(0)).toBeLessThan(0.5)
  })
  it('a big home margin: home covers -1.5 more often than not', () => {
    expect(coverProb(2.5)).toBeGreaterThan(0.5)
  })
  it('cover prob increases with margin', () => {
    expect(coverProb(3)).toBeGreaterThan(coverProb(1))
  })
  it('home favored by exactly 1.5 → ~50% to cover -1.5', () => {
    expect(coverProb(1.5)).toBeCloseTo(0.5, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runModel.test.js`
Expected: FAIL — "coverProb is not a function".

- [ ] **Step 3: Write minimal implementation** (append to `api/_lib/runModel.js`)

```js
// coverProb(margin, line=1.5) → P(home margin > line) = P(home covers -1.5). Same Normal model as
// winProbFromMargin. For the AWAY +1.5 dog, use 1 - coverProb(margin) at the same line.
export function coverProb(margin, line = 1.5) {
  const m = Number.isFinite(margin) ? margin : 0
  return Math.round(normCdf((m - line) / LG.MARGIN_SD) * 1000) / 1000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runModel.test.js`
Expected: PASS (18 tests total).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/runModel.js tests/runModel.test.js
git commit -m "feat(runModel): coverProb for run-line (-1.5)"
```

---

### Task 5: `deriveBets` — projection + market → Total/ML/RL leans

**Files:**
- Modify: `api/_lib/runModel.js`
- Test: `tests/runModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { deriveBets } from '../api/_lib/runModel.js'

describe('deriveBets', () => {
  const proj = { awayRuns: 5.4, homeRuns: 4.1, total: 9.5, margin: -1.3 } // away favored

  it('Total: projected above the line → OVER with the run edge', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.total.lean).toBe('OVER')
    expect(b.total.edge).toBeCloseTo(1.0, 5)
  })
  it('Total: projected below the line → UNDER', () => {
    const b = deriveBets({ proj, marketTotal: 11.0 })
    expect(b.total.lean).toBe('UNDER')
  })
  it('Total: within the 1-run deadband → LEAN (no pick)', () => {
    const b = deriveBets({ proj, marketTotal: 9.0 })
    expect(b.total.lean).toBe('LEAN')
  })
  it('ML: names the side projected to score more + its win prob', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.ml.pick).toBe('AWAY')          // away outscores home here
    expect(b.ml.winProb).toBeGreaterThan(0.5)
  })
  it('RL: favorite is the ML side; coverProb is reported for -1.5', () => {
    const b = deriveBets({ proj, marketTotal: 8.5 })
    expect(b.rl.pick).toBe('AWAY -1.5')
    expect(b.rl.coverProb).toBeGreaterThan(0)
    expect(b.rl.coverProb).toBeLessThan(1)
  })
  it('a true pick-em (margin 0) yields no ML edge side (null pick)', () => {
    const b = deriveBets({ proj: { awayRuns: 4.3, homeRuns: 4.3, total: 8.6, margin: 0 }, marketTotal: 8.5 })
    expect(b.ml.pick).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runModel.test.js`
Expected: FAIL — "deriveBets is not a function".

- [ ] **Step 3: Write minimal implementation** (append to `api/_lib/runModel.js`)

```js
// deriveBets({ proj, marketTotal, totalDeadband }) → { total, ml, rl }. Turns one per-side projection
// into all three bet leans. Total uses the same 1-run deadband + edge convention as the live ou model
// so they're comparable. ML/RL come from the projected margin via the Normal win/cover model.
export function deriveBets({ proj, marketTotal = null, totalDeadband = 1.0 } = {}) {
  const { awayRuns, homeRuns, total, margin } = proj || {}

  // ── Total ──
  let totalLean = 'LEAN', edge = null
  if (Number.isFinite(marketTotal) && Number.isFinite(total)) {
    edge = Math.round((total - marketTotal) * 10) / 10
    totalLean = edge >= totalDeadband ? 'OVER' : edge <= -totalDeadband ? 'UNDER' : 'LEAN'
  }

  // ── Moneyline ── side projected to score more; null when essentially a pick-em.
  let mlPick = null, winProb = null
  if (Number.isFinite(margin) && Math.abs(margin) >= 0.15) {
    const homeWins = margin > 0
    mlPick = homeWins ? 'HOME' : 'AWAY'
    const p = winProbFromMargin(margin)          // home win prob
    winProb = homeWins ? p : Math.round((1 - p) * 1000) / 1000
  }

  // ── Run line (-1.5 on the favorite) ──
  let rl = { pick: null, coverProb: null }
  if (mlPick) {
    const favCover = mlPick === 'HOME' ? coverProb(margin) : coverProb(-margin)
    rl = { pick: `${mlPick} -1.5`, coverProb: favCover }
  }

  return {
    total: { lean: totalLean, edge, projected: total ?? null },
    ml: { pick: mlPick, winProb, awayRuns: awayRuns ?? null, homeRuns: homeRuns ?? null },
    rl,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/runModel.test.js`
Expected: PASS (24 tests total).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/runModel.js tests/runModel.test.js
git commit -m "feat(runModel): deriveBets → Total/ML/RL leans from one projection"
```

---

### Task 6: Full suite green + lint guard

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS — all prior tests + the 24 new runModel tests (342 total).

- [ ] **Step 2: Run the undefined-variable guard**

Run: `npm run check:undef`
Expected: "✓ no undefined variables in src/".

- [ ] **Step 3: Commit (no-op if clean)** — nothing to commit; proceed.

---

### Task 7: Surface `proj2` in game-info.js (additive, non-breaking)

**Files:**
- Modify: `api/game-info.js` (the MLB `ou` block — add a sibling `proj2` field on the returned object; reuse the already-resolved `pf`, `wx`, `ap`/`hp` eff, `aBp`/`hBp`, and `off` offense xwOBA)

- [ ] **Step 1: Import the engine** — add near the other `_lib` imports:

```js
import { gameProjection, deriveBets } from './_lib/runModel.js'
```

- [ ] **Step 2: Expose per-side offense xwOBA from getOffense**

`deriveBets` needs each side's xwOBA, but `getOffense` currently returns a combined `offense.score`. Add the raw values to its return.

Modify `api/_lib/offense.js` `getOffense` return (the success path) to include `awayXwoba`/`homeXwoba`:

```js
    return { offense: offenseFactor(awayX, homeX), form: formFactor(combinedRpg), source, gamePk: g?.gamePk ?? null, awayXwoba: awayX ?? null, homeXwoba: homeX ?? null }
```

And the `empty` fallback at the top of the function:

```js
  const empty = { offense: { score: 0, reason: null }, form: { score: 0, reason: null }, source: 'none', gamePk: null, awayXwoba: null, homeXwoba: null }
```

- [ ] **Step 3: Build proj2 next to the existing ou.** After the existing `ou = { ... }` assignment in `api/game-info.js`, add:

```js
      // Phase 3 (BETA, additive — does NOT replace the line-anchored `ou` lean above). Projects each
      // team's runs separately so an ace fully suppresses the side he faces (no starter-averaging) and
      // park/weather count once per side, then derives Total + ML + RL from one engine. Shown alongside
      // `ou` so the two can be compared on the graded record before any switch.
      const weatherPerSide = (wx && !wx.dome && wx.boost) ? parkAdjustedWeather(wx.boost, pf, wx.dome) / 2 : 0
      const gp = gameProjection({
        away: { offXwoba: off?.awayXwoba ?? null, starterXera: ap.eff, bullpenEra: aBp ?? null },
        home: { offXwoba: off?.homeXwoba ?? null, starterXera: hp.eff, bullpenEra: hBp ?? null },
        parkMult: pf, weatherRunsPerSide: weatherPerSide,
      })
      const marketTotal = (anchor?.current != null && anchor.current >= 5 && anchor.current <= 15) ? anchor.current : null
      ou.proj2 = { ...gp, bets: deriveBets({ proj: gp, marketTotal }) }
```

- [ ] **Step 4: Bump the SW cache and ship (guarded)**

```bash
# edit public/sw.js: const CACHE = 'rml-v444';
npm run ship
```
Expected: tests pass, `✓ no undefined variables`, build, `▲ Aliased https://app.riskmatrixlabs.com`.

- [ ] **Step 5: Verify live in Chrome (per project rule — never claim done without it).** From the app (authed), fetch `/api/game-info` for PIT@COL and confirm `ou.proj2` is present with `awayRuns`, `homeRuns`, `total`, `margin`, and a `bets` block (total/ml/rl), AND the app still renders with no error boundary. Compare `proj2.bets.total.lean` vs the existing `ou.lean` on a few games — sanity, not a switch.

- [ ] **Step 6: Commit**

```bash
git add api/game-info.js api/_lib/offense.js public/sw.js
git commit -m "feat(game-info): surface Phase 3 per-side proj2 (Total/ML/RL) alongside the live ou lean"
```

---

## Self-Review

**1. Spec coverage (vs memory rml-ou-model Phase 3):**
- "project each team's runs SEPARATELY" → Task 1 `projectTeamRuns`, Task 2 `gameProjection`. ✅
- "ace suppresses his side, not averaged" → Task 2 test "ace is credited to the side he faces". ✅
- "park applied once per side" → `parkMult` is a per-side scalar in Task 1; cancels in margin, stacks in total (Task 2 test). ✅
- "derive Total / ML / RL from one engine" → Task 5 `deriveBets`. ✅
- ML = "who scores more (win prob)" → Task 3 `winProbFromMargin` + Task 5. ✅
- RL = "margin (cover -1.5)" → Task 4 `coverProb` + Task 5. ✅
- "additive, compare before switching" → Task 7 surfaces `proj2` alongside `ou`, never replaces it. ✅

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✅

**3. Type consistency:** `projectTeamRuns` arg `weatherRunsPerSide` used identically in Tasks 1, 2, 7. `gameProjection` returns `{awayRuns,homeRuns,total,margin}` consumed unchanged by `deriveBets`/Task 7. `margin` is HOME-perspective everywhere (Tasks 2, 3, 4, 5). `deriveBets` returns `{total:{lean,edge,projected}, ml:{pick,winProb,...}, rl:{pick,coverProb}}` — matches Task 7 usage. ✅

**Open follow-ups (NOT in this plan, logged for later):**
- Wiring `proj2.bets.ml`/`rl` into the UI (Spotlight/Game Center) and the grader (`lean_results` currently grades totals only — ML/RL need their own graded columns).
- Backtesting the run-model coefficients once a live record accrues.
- Deciding when `proj2` *replaces* `ou` as the surfaced lean.
