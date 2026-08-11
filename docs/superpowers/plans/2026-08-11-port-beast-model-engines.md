# Port Beast Model Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the owner's 5 model engines (NFL side, NBA props, NHL SOG, WNBA props, Ladder/RR quality scores) from `~/Desktop/beast-node/MODELS.md` into risk-matrix-labs as pure, tested libs — formulas verbatim, weights untouched.

**Architecture:** Each engine is a pure module in `src/lib/models/` with a vitest suite in `tests/`. No UI wiring in this phase — data plumbing per sport comes later. A shared `tiers.js` maps the internal 0–100 scale to the user-facing brand tiers. MODELS.md is copied into the repo (durability — it was only backed up outside git).

**Tech Stack:** Plain ES modules (match `src/lib/kelly.js` style), vitest.

## Global Constraints

- **Formulas and weights VERBATIM from MODELS.md.** CONFIRMED weights (NBA, NHL SOG, WNBA, Ladder, RR) must never be altered. NFL is a ⚠️ RECONSTRUCTION — say so in the file header comment.
- **Brand rule: no gambling words in any exported string** — never "pick", "lock", "play", "bet on". Internal tier names (Elite/Strong/Lean/Watch/Pass) stay internal; user-facing strings use PRIME/STRONG/CAUTION/FADE.
- Comment style: explain the WHY at the top like `kelly.js` does; cite CONFIRMED vs RECONSTRUCTION provenance.
- All inputs to score functions are normalized 0–1 unless stated. Guard bad input: any non-finite input → return `null` (never NaN into the UI).
- Tests: `import { describe, it, expect } from 'vitest'`, hand-computed expected values.
- Do NOT touch `public/sw.js`, App.jsx, or any api/ file in this plan.

---

### Task 1: MODELS.md into the repo + tiers module

**Files:**
- Create: `docs/models/MODELS.md` (verbatim copy of `~/Desktop/beast-node/MODELS.md`)
- Create: `src/lib/models/tiers.js`
- Test: `tests/models-tiers.test.js`

**Interfaces:**
- Produces: `internalTier(score) -> 'ELITE'|'STRONG'|'LEAN'|'WATCH'|'PASS'|null`, `brandTier(score) -> 'PRIME'|'STRONG'|'CAUTION'|'FADE'|null`

- [ ] **Step 1: Copy MODELS.md**

```bash
mkdir -p docs/models && cp ~/Desktop/beast-node/MODELS.md docs/models/MODELS.md
```

- [ ] **Step 2: Write failing test**

```js
import { describe, it, expect } from 'vitest'
import { internalTier, brandTier } from '../src/lib/models/tiers.js'

describe('internalTier', () => {
  it('maps the MODELS.md uniform scale', () => {
    expect(internalTier(92)).toBe('ELITE')
    expect(internalTier(80)).toBe('STRONG')
    expect(internalTier(70)).toBe('LEAN')
    expect(internalTier(63)).toBe('WATCH')
    expect(internalTier(40)).toBe('PASS')
  })
  it('rejects junk', () => { expect(internalTier(NaN)).toBe(null) })
})
describe('brandTier', () => {
  it('maps to user-facing tiers (no gambling words)', () => {
    expect(brandTier(92)).toBe('PRIME')
    expect(brandTier(80)).toBe('STRONG')
    expect(brandTier(65)).toBe('CAUTION')
    expect(brandTier(40)).toBe('FADE')
  })
})
```

- [ ] **Step 3: Implement**

```js
// Tier mapping — MODELS.md "Play thresholds (uniform scale)":
// 85–100 Elite · 75–84 Strong · 68–74 Lean · 60–67 Watch · <60 Pass.
// Brand rule: user-facing copy uses PRIME/STRONG/CAUTION/FADE (no gambling words);
// engineering mapping: ELITE→PRIME, STRONG→STRONG, LEAN+WATCH→CAUTION, PASS→FADE.
export function internalTier(score) {
  if (!Number.isFinite(score)) return null
  if (score >= 85) return 'ELITE'
  if (score >= 75) return 'STRONG'
  if (score >= 68) return 'LEAN'
  if (score >= 60) return 'WATCH'
  return 'PASS'
}
export function brandTier(score) {
  const t = internalTier(score)
  if (t == null) return null
  if (t === 'ELITE') return 'PRIME'
  if (t === 'STRONG') return 'STRONG'
  if (t === 'LEAN' || t === 'WATCH') return 'CAUTION'
  return 'FADE'
}
```

- [ ] **Step 4: Run** `npx vitest run tests/models-tiers.test.js` → PASS
- [ ] **Step 5: Commit** `git add docs/models src/lib/models/tiers.js tests/models-tiers.test.js && git commit -m "feat(models): MODELS.md into repo + tier mapping"`

---

### Task 2: NFL side engine

**Files:**
- Create: `src/lib/models/nflSide.js`
- Test: `tests/models-nfl.test.js`

**Interfaces:**
- Produces: `nflSideScore({qbEdge, offensiveLine, defensiveMatchup, explosivePlay, turnoverRegression, injuryEdge, restTravel, weather, lineValue}) -> number|null` (0–100); `nflExpectedPoints({epaPerPlay, expectedPlays, oppAdj=1, rzAdj=1, weatherAdj=1}) -> number|null`; `nflProjectedTotal(homePts, awayPts) -> number|null`

- [ ] **Step 1: Failing test** (hand-compute: all inputs 1 → 100; all 0.5 → 50; the exact weight vector below)

```js
import { describe, it, expect } from 'vitest'
import { nflSideScore, nflExpectedPoints, nflProjectedTotal } from '../src/lib/models/nflSide.js'

describe('nflSideScore', () => {
  it('applies the reconstruction weights exactly', () => {
    // 0.8*20 + 0.5*10 + 0.6*15 + 0.4*10 + 0.5*10 + 0.7*10 + 0.5*5 + 0.5*5 + 0.9*15 = 63.5
    expect(nflSideScore({ qbEdge:0.8, offensiveLine:0.5, defensiveMatchup:0.6, explosivePlay:0.4,
      turnoverRegression:0.5, injuryEdge:0.7, restTravel:0.5, weather:0.5, lineValue:0.9 })).toBeCloseTo(63.5, 2)
  })
  it('null on non-finite input', () => {
    expect(nflSideScore({ qbEdge:NaN, offensiveLine:0, defensiveMatchup:0, explosivePlay:0,
      turnoverRegression:0, injuryEdge:0, restTravel:0, weather:0, lineValue:0 })).toBe(null)
  })
})
describe('nflExpectedPoints', () => {
  it('EPA/play × plays × adjustments', () => {
    expect(nflExpectedPoints({ epaPerPlay:0.05, expectedPlays:63, oppAdj:1.1, rzAdj:0.95, weatherAdj:1 }))
      .toBeCloseTo(0.05*63*1.1*0.95, 4)
  })
})
describe('nflProjectedTotal', () => {
  it('home + away', () => { expect(nflProjectedTotal(24.5, 20.25)).toBeCloseTo(44.75, 2) })
})
```

- [ ] **Step 2: Implement** — header comment MUST state: `⚠️ RECONSTRUCTION (MODELS.md §5) — matches the system's shape, NOT the exact recovered original; open to calibration.` Weights verbatim: `qb×20 + ol×10 + defMatchup×15 + explosive×10 + turnoverReg×10 + injury×10 + restTravel×5 + weather×5 + lineValue×15`. Round score to 2 decimals. Every function returns null if any required input is non-finite.
- [ ] **Step 3: Run** `npx vitest run tests/models-nfl.test.js` → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(models): NFL side engine (reconstruction, verbatim from MODELS.md)"`

---

### Task 3: NBA props engine

**Files:**
- Create: `src/lib/models/nbaProps.js`
- Test: `tests/models-nba.test.js`

**Interfaces:**
- Produces: `nbaPropScore({minutes, usage, matchup, pace, recentForm, injuryRole, lineValue}) -> number|null`; `nbaProjection({statPerMinute, expectedMinutes, usageMult=1, paceMult=1, opponentMult=1}) -> number|null`; `adjustedMinutes(baseMinutes, blowoutProbability, blowoutPenalty=0.18) -> number|null`

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest'
import { nbaPropScore, nbaProjection, adjustedMinutes } from '../src/lib/models/nbaProps.js'

describe('nbaPropScore', () => {
  it('CONFIRMED weights: min20 usage20 matchup20 pace10 form10 injury10 line10', () => {
    // 0.9*20+0.8*20+0.7*20+0.6*10+0.5*10+1*10+0.4*10 = 73
    expect(nbaPropScore({ minutes:0.9, usage:0.8, matchup:0.7, pace:0.6, recentForm:0.5, injuryRole:1, lineValue:0.4 }))
      .toBeCloseTo(73, 2)
  })
  it('null on junk', () => {
    expect(nbaPropScore({ minutes:undefined, usage:0, matchup:0, pace:0, recentForm:0, injuryRole:0, lineValue:0 })).toBe(null)
  })
})
describe('nbaProjection', () => {
  it('per-minute × minutes × multipliers', () => {
    expect(nbaProjection({ statPerMinute:0.62, expectedMinutes:34, usageMult:1.05, paceMult:1.02, opponentMult:0.97 }))
      .toBeCloseTo(0.62*34*1.05*1.02*0.97, 2)
  })
})
describe('adjustedMinutes', () => {
  it('MODELS.md blowout formula, default penalty 0.18', () => {
    expect(adjustedMinutes(34, 0.5)).toBeCloseTo(34*(1-0.5*0.18), 2)  // 30.94
  })
  it('zero blowout prob = base minutes', () => { expect(adjustedMinutes(34, 0)).toBe(34) })
})
```

- [ ] **Step 2: Implement** — header: `CONFIRMED ORIGINAL (MODELS.md §2) — do not alter weights.` Round to 2 decimals; null-guard non-finite.
- [ ] **Step 3: Run** `npx vitest run tests/models-nba.test.js` → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(models): NBA props engine (CONFIRMED weights verbatim)"`

---

### Task 4: NHL SOG engine

**Files:**
- Create: `src/lib/models/nhlSog.js`
- Test: `tests/models-nhl.test.js`

**Interfaces:**
- Produces: `nhlSogScore({shotVolume, timeOnIce, powerPlayRole, opponentSogAllowed, recentAttempts, lineValue}) -> number|null`; `nhlSogProjection({shotsPerMinute, projectedToi, opponentMult=1, powerPlayMult=1, gameScriptMult=1}) -> number|null`; `nhlExpectedGoals({teamXgf, oppDefAdj=1, goalieAdj=1, specialTeamsAdj=1, restAdj=1}) -> number|null`

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest'
import { nhlSogScore, nhlSogProjection, nhlExpectedGoals } from '../src/lib/models/nhlSog.js'

describe('nhlSogScore', () => {
  it('CONFIRMED weights: vol25 toi20 pp15 oppAllowed15 recent15 line10', () => {
    // 0.8*25+0.7*20+0.5*15+0.6*15+0.9*15+0.3*10 = 67
    expect(nhlSogScore({ shotVolume:0.8, timeOnIce:0.7, powerPlayRole:0.5, opponentSogAllowed:0.6, recentAttempts:0.9, lineValue:0.3 }))
      .toBeCloseTo(67, 2)
  })
})
describe('nhlSogProjection', () => {
  it('shots/min × TOI × multipliers', () => {
    expect(nhlSogProjection({ shotsPerMinute:0.18, projectedToi:19.5, opponentMult:1.06, powerPlayMult:1.1, gameScriptMult:0.98 }))
      .toBeCloseTo(0.18*19.5*1.06*1.1*0.98, 2)
  })
})
describe('nhlExpectedGoals', () => {
  it('xGF × adjustments', () => {
    expect(nhlExpectedGoals({ teamXgf:3.1, oppDefAdj:0.95, goalieAdj:1.04, specialTeamsAdj:1.02, restAdj:0.99 }))
      .toBeCloseTo(3.1*0.95*1.04*1.02*0.99, 3)
  })
})
```

- [ ] **Step 2: Implement** — header: `CONFIRMED ORIGINAL (MODELS.md §3) — do not alter weights.` Round score 2dp, projections 2dp, xG 3dp; null-guard.
- [ ] **Step 3: Run** `npx vitest run tests/models-nhl.test.js` → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(models): NHL SOG engine (CONFIRMED weights verbatim)"`

---

### Task 5: WNBA props engine

**Files:**
- Create: `src/lib/models/wnbaProps.js`
- Test: `tests/models-wnba.test.js`

**Interfaces:**
- Produces: `wnbaPropScore({minutes, usage, matchup, recentForm, gameScript, lineValue}) -> number|null`; `wnbaProjection({statPerMinute, projectedMinutes, usageMult=1, matchupMult=1, paceMult=1}) -> number|null`; `minutesStability(projectedMinutes, recentMaxMinutes) -> number|null`; `propEdge(projected, line) -> number|null`

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest'
import { wnbaPropScore, wnbaProjection, minutesStability, propEdge } from '../src/lib/models/wnbaProps.js'

describe('wnbaPropScore', () => {
  it('CONFIRMED weights: min25 usage20 matchup20 form15 script10 line10', () => {
    // 0.9*25+0.7*20+0.6*20+0.8*15+0.5*10+0.4*10 = 69.5
    expect(wnbaPropScore({ minutes:0.9, usage:0.7, matchup:0.6, recentForm:0.8, gameScript:0.5, lineValue:0.4 }))
      .toBeCloseTo(69.5, 2)
  })
})
describe('wnbaProjection', () => {
  it('per-minute × minutes × multipliers', () => {
    expect(wnbaProjection({ statPerMinute:0.45, projectedMinutes:31, usageMult:1.08, matchupMult:0.96, paceMult:1.03 }))
      .toBeCloseTo(0.45*31*1.08*0.96*1.03, 2)
  })
})
describe('filters', () => {
  it('minutes stability = projected / recent max', () => { expect(minutesStability(28, 32)).toBeCloseTo(0.875, 3) })
  it('stability null when recent max is 0', () => { expect(minutesStability(28, 0)).toBe(null) })
  it('edge = projected − line', () => { expect(propEdge(14.8, 13.5)).toBeCloseTo(1.3, 2) })
})
```

- [ ] **Step 2: Implement** — header: `CONFIRMED ORIGINAL (MODELS.md §1) — minutes/role first; do not alter weights.` Core order comment: Minutes → Usage → Matchup → Recent Form → Blowout Risk → Line Value. Round 2dp (stability 3dp); null-guard incl. divide-by-zero.
- [ ] **Step 3: Run** `npx vitest run tests/models-wnba.test.js` → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(models): WNBA props engine (CONFIRMED weights verbatim)"`

---

### Task 6: Ladder + Round Robin quality scores

**Files:**
- Create: `src/lib/models/qualityScores.js`
- Test: `tests/models-quality.test.js`

**Interfaces:**
- Produces: `ladderScore({phlt, ev, lineSafety, bankrollFit, discipline}) -> number|null` (inputs on the SAME 0–100 scale, per MODELS.md: `PHLT×0.35 + EV×0.25 + LineSafety×0.15 + BankrollFit×0.15 + Discipline×0.10`); `roundRobinScore({legScores, independenceScore, correlationPenalty, exposurePenalty}) -> number|null` (`mean(legs)×0.70 + independence×0.20 − correlation×0.05 − exposure×0.05`)

- [ ] **Step 1: Failing test**

```js
import { describe, it, expect } from 'vitest'
import { ladderScore, roundRobinScore } from '../src/lib/models/qualityScores.js'

describe('ladderScore', () => {
  it('CONFIRMED weights 35/25/15/15/10', () => {
    // 80*.35+70*.25+90*.15+60*.15+100*.10 = 28+17.5+13.5+9+10 = 78
    expect(ladderScore({ phlt:80, ev:70, lineSafety:90, bankrollFit:60, discipline:100 })).toBeCloseTo(78, 2)
  })
  it('null on junk', () => { expect(ladderScore({ phlt:NaN, ev:0, lineSafety:0, bankrollFit:0, discipline:0 })).toBe(null) })
})
describe('roundRobinScore', () => {
  it('CONFIRMED formula: mean×0.70 + indep×0.20 − corr×0.05 − expo×0.05', () => {
    // mean([80,70,90])=80 → 80*.7+75*.2-40*.05-20*.05 = 56+15-2-1 = 68
    expect(roundRobinScore({ legScores:[80,70,90], independenceScore:75, correlationPenalty:40, exposurePenalty:20 }))
      .toBeCloseTo(68, 2)
  })
  it('null on empty legs', () => {
    expect(roundRobinScore({ legScores:[], independenceScore:0, correlationPenalty:0, exposurePenalty:0 })).toBe(null)
  })
})
```

- [ ] **Step 2: Implement** — header: `CONFIRMED ORIGINAL (MODELS.md §Ladder/§RR) — do not alter weights.` Round 2dp; null-guard non-finite + empty legScores.
- [ ] **Step 3: Run** `npx vitest run tests/models-quality.test.js` → PASS
- [ ] **Step 4: Commit** `git commit -m "feat(models): ladder + round-robin quality scores (CONFIRMED verbatim)"`

---

### Task 7: Full suite + ship

- [ ] Run `npx vitest run` — full suite green (was 401+ tests; expect +~25 new)
- [ ] Bump `public/sw.js` CACHE to `rml-v542`
- [ ] `npm run ship`, verify `curl -s https://app.riskmatrixlabs.com/sw.js` shows v542
- [ ] Push to GitHub
- [ ] Add wiring next-steps to `docs/superpowers/specs/2026-06-13-rml-backlog.md`: NFL shadow lean in Spotlight (needs EPA/QB/injury data plumbing), WNBA scoring into existing props flow, NBA/NHL wiring at season start (Oct), ladder/RR score surfacing in CH3.
