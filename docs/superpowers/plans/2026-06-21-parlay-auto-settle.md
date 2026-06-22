# Parlay Auto-Settle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Auto-settle parlays from their legs' final scores, with correct push-reduction and early-loss.

**Architecture:** New pure `gradeParlay(bet, events)` grades each leg via the existing strict per-leg grader, applies parlay rules (early L, drop pushes, recompute odds), and returns `{result, effectiveOdds}`. `App.jsx`'s auto-settle loop routes parlays to it; `settleBet` gains an effective-odds override so push-reduced payouts are correct.

**Tech Stack:** React + Vite, Vitest, existing `gradeBetResult.js` + `betMatch.js`.

---

## File Structure
- Create: `src/lib/gradeParlay.js` (pure; `combineAmericanOdds`, `gradeParlay`), `tests/grade-parlay.test.js`.
- Modify: `src/App.jsx` — `settleBet` (add `oddsOverride`), auto-settle loop (route parlays).

---

## Task 1: `gradeParlay.js` (pure grader)

**Files:** Create `src/lib/gradeParlay.js`, `tests/grade-parlay.test.js`

- [ ] **Step 1: Write the failing test** (`tests/grade-parlay.test.js`):

```js
import { describe, it, expect } from 'vitest'
import { gradeParlay, combineAmericanOdds } from '../src/lib/gradeParlay.js'

// Two same-game final events; gradeParlay matches each leg via findEventForBet.
const EV = {
  external_event_id: '401815842', sport: 'MLB', status: 'FT',
  start_time: '2026-06-21T23:20:00Z',
  away_team: 'New York Mets', home_team: 'Philadelphia Phillies',
  away_abbr: 'NYM', home_abbr: 'PHI', away_score: 2, home_score: 6,
  odds_total: 8,
}
const parlay = (legs) => ({ date: '2026-06-21', sport: 'MLB', legs })

describe('combineAmericanOdds', () => {
  it('combines two favorites into the right American number', () => {
    // -150 (1.6667) * -150 (1.6667) = 2.7778 dec -> +178
    expect(combineAmericanOdds([-150, -150])).toBe(178)
  })
  it('a single leg returns its own odds', () => {
    expect(combineAmericanOdds([-181])).toBe(-181)
  })
})

describe('gradeParlay', () => {
  it('push leg + win leg → W at the surviving leg odds (real NYM@PHI case)', () => {
    const r = gradeParlay(parlay([
      { pick: 'Over 8', odds: -115, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
      { pick: 'PHI ML',  odds: -181, event: 'New York Mets vs Philadelphia Phillies', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('W')
    expect(r.effectiveOdds).toBe(-181)   // Over 8 pushes (total=8), PHI ML survives
  })
  it('all legs win → W at combined odds', () => {
    const r = gradeParlay(parlay([
      { pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Under 9', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },   // total 8 < 9 → under wins
    ]), [EV])
    expect(r.result).toBe('W')
    expect(r.effectiveOdds).toBe(combineAmericanOdds([-181, -110]))
  })
  it('any leg loses → L early (other leg need not be final)', () => {
    const r = gradeParlay(parlay([
      { pick: 'NYM ML', odds: 149, event: 'NYM vs PHI', sport: 'MLB' },     // NYM lost
      { pick: 'Over 99', odds: -110, event: 'Some Other vs Game', sport: 'MLB' }, // unmatched → null
    ]), [EV])
    expect(r.result).toBe('L')
  })
  it('all legs push → P', () => {
    const r = gradeParlay(parlay([
      { pick: 'Over 8', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Under 8', odds: -110, event: 'NYM vs PHI', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBe('P')
  })
  it('an ungradeable leg with no loss → null (stay Open)', () => {
    const r = gradeParlay(parlay([
      { pick: 'PHI ML', odds: -181, event: 'NYM vs PHI', sport: 'MLB' },
      { pick: 'Over 5', odds: -110, event: 'Nonexistent vs Matchup', sport: 'MLB' },
    ]), [EV])
    expect(r.result).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL.** `npx vitest run tests/grade-parlay.test.js` (module missing).

- [ ] **Step 3: Implement** `src/lib/gradeParlay.js`:

```js
// Pure parlay grader. Grades each leg vs its OWN final game using the strict
// straight-bet grader, then applies standard parlay rules: any leg lost → L
// (early, even if others aren't final); push legs drop; surviving wins recompute
// the payout; all-push → P; any ungradeable leg (and no loss) → null (stay Open).
import { gradeBetResult } from './gradeBetResult.js'
import { findEventForBet } from './betMatch.js'

const decFromAm = (a) => (a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1)

export function combineAmericanOdds(americanList) {
  const dec = americanList.reduce((p, a) => p * decFromAm(Number(a)), 1)
  if (dec >= 2) return Math.round((dec - 1) * 100)
  return Math.round(-100 / (dec - 1))
}

export function gradeParlay(bet, events) {
  const legs = Array.isArray(bet?.legs) ? bet.legs : null
  if (!legs || legs.length < 2) return { result: null, effectiveOdds: null }

  const graded = legs.map((leg) => {
    const legBet = { pick: leg.pick, odds: leg.odds, sport: leg.sport || bet.sport, event: leg.event, date: bet.date }
    const ev = findEventForBet(legBet, events)
    return ev ? gradeBetResult(legBet, ev) : null
  })

  // Early loss — a parlay is dead the moment any leg loses.
  if (graded.some((r) => r === 'L')) return { result: 'L', effectiveOdds: null }
  // Any leg we can't grade yet (and nothing lost) → leave Open.
  if (graded.some((r) => r == null)) return { result: null, effectiveOdds: null }

  // All legs are W or P now. Drop pushes; recompute from survivors.
  const survivorOdds = legs.filter((_, i) => graded[i] === 'W').map((l) => Number(l.odds))
  if (survivorOdds.length === 0) return { result: 'P', effectiveOdds: null }
  return { result: 'W', effectiveOdds: combineAmericanOdds(survivorOdds) }
}
```

- [ ] **Step 4: Run → PASS.** `npx vitest run tests/grade-parlay.test.js`. Fix impl (not tests) if red.

- [ ] **Step 5: Commit:**
```bash
git add src/lib/gradeParlay.js tests/grade-parlay.test.js
git commit -m "feat(settle): pure parlay grader — early-loss, push-reduction, recomputed odds"
```

---

## Task 2: Wire into App.jsx (settleBet override + loop routing)

**Files:** Modify `src/App.jsx` — import, `settleBet` (~line 3040 region), auto-settle loop (~3080).

- [ ] **Step 1: Read** the current `settleBet` function (search `const settleBet =` / `function settleBet`) and the auto-settle `useEffect` (search `autoSettleTried`). Note the exact non-ladder pnl line that uses `b.odds`.

- [ ] **Step 2: Add import** near the other lib imports (by `import { gradeBetResult }`):
```jsx
import { gradeParlay } from './lib/gradeParlay.js'
```

- [ ] **Step 3: Add `oddsOverride` to `settleBet`.** Change its signature to accept a third arg and use it in the non-ladder win-profit calc. The current non-ladder branch computes pnl like:
```jsx
          pnl = result === 'W'
            ? (b.odds > 0 ? b.units * b.odds / 100 : b.units * 100 / Math.abs(b.odds))
            : result === 'L' ? -b.units : 0
```
Change the signature `settleBet(id, result)` → `settleBet(id, result, oddsOverride = null)` and replace the two `b.odds` references in that win-branch with a local `const od = oddsOverride ?? b.odds` used in place of `b.odds`:
```jsx
          const od = oddsOverride ?? b.odds
          pnl = result === 'W'
            ? (od > 0 ? b.units * od / 100 : b.units * 100 / Math.abs(od))
            : result === 'L' ? -b.units : 0
```
(Leave the ladder branch untouched — ladder bets are straights, never parlays.)

- [ ] **Step 4: Route parlays in the auto-settle loop.** Replace the loop body:
```jsx
    for (const b of bets) {
      if (b.result !== 'Open' || autoSettleTried.current.has(b.id)) continue
      if (b.legs && b.legs.length >= 2) {
        const { result, effectiveOdds } = gradeParlay(b, betEvents)
        if (result === 'W' || result === 'L' || result === 'P') {
          autoSettleTried.current.add(b.id)
          settleBet(b.id, result, effectiveOdds)
        }
        continue
      }
      const ev = findEventForBet(b, betEvents)
      if (!ev) continue
      const r = gradeBetResult(b, ev)
      if (r === 'W' || r === 'L' || r === 'P') {
        autoSettleTried.current.add(b.id)
        settleBet(b.id, r)
      }
    }
```

- [ ] **Step 5: Verify:** `npm test` (all pass), `npm run check:undef` (clean), `npx vite build` (succeeds).

- [ ] **Step 6: Commit:**
```bash
git add src/App.jsx
git commit -m "feat(settle): auto-settle parlays via gradeParlay with reduced-odds payout"
```

---

## Task 3: Ship + live verify

- [ ] **Step 1:** Bump `public/sw.js` CACHE (`rml-v474` → next).
- [ ] **Step 2:** `npm run ship` (guarded; deploys).
- [ ] **Step 3: Live verify in Chrome** on app.riskmatrixlabs.com: the stuck NYM@PHI 2-leg parlay (Over 8 + PHI ML) auto-settles to **W ≈ +$55** (reduced -181 payout, NOT +$90), the OPEN count drops, and no error boundary. Note: auto-settle only fires for the signed-in owner whose bets these are.
- [ ] **Step 4:** Commit the SW bump if not already in ship's commit.
- [ ] **Step 5:** Merge to main:
```bash
git checkout main && git merge --no-ff feat/parlay-auto-settle -m "feat: parlay auto-settle with push-reduction"
git push origin main
```

---

## Notes
- Strictness mirrors straight auto-settle: never guess money — any ungradeable leg (no loss) leaves the parlay Open.
- `effectiveOdds` is only used for W; L/P pass null and the existing −stake / 0 pnl applies.
