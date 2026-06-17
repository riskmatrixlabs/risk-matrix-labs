# O/U Offense Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the MLB O/U model an offense read (lineup xwOBA + recent scoring form) so it can lean UNDER, not just OVER, fixing its structural over-bias.

**Architecture:** New `api/_lib/offense.js` with pure, unit-tested scoring functions + a thin data orchestrator. `game-info.js` calls it once and adds two factors to the existing O/U `score`. `SpotlightTicker.jsx` panel lists all leans. Effectiveness measured by the existing `lean_results` tracking.

**Tech Stack:** Node serverless (Vercel), vitest, MLB Stats API + Baseball Savant + ESPN (all free), Supabase `scan_cache` for caching.

---

## File structure
- **Create** `api/_lib/offense.js` — pure scoring fns + `getOffense()` orchestrator.
- **Create** `tests/offense.test.js` — vitest unit tests for the pure fns.
- **Modify** `api/game-info.js` — add offense fetch to the O/U `Promise.all` + two factors to `score`/`why` + `ou.source`.
- **Modify** `src/components/SpotlightTicker.jsx` — panel shows all directional leans (ticker stays strong).

---

## Task 1: Pure scoring functions in offense.js

**Files:**
- Create: `api/_lib/offense.js`
- Test: `tests/offense.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/offense.test.js
import { describe, it, expect } from 'vitest'
import { OFF, platoonMult, lineupXwoba, offenseFactor, formFactor } from '../api/_lib/offense.js'

const norm = (s) => String(s || '').toLowerCase().trim()

describe('offense scoring', () => {
  it('platoonMult: advantage when opposite hands, penalty when same, switch neutral-plus', () => {
    expect(platoonMult('L', 'R')).toBeGreaterThan(1)
    expect(platoonMult('R', 'R')).toBeLessThan(1)
    expect(platoonMult('S', 'L')).toBeGreaterThan(1)
    expect(platoonMult(null, 'R')).toBe(1)     // unknown hand → no adjustment
  })

  it('lineupXwoba: averages matched batters, null when too few match', () => {
    const sav = { 'a': { xwoba: 0.340 }, 'b': { xwoba: 0.360 } }
    const few = lineupXwoba([{ name: 'A' }, { name: 'B' }], sav, 'R', norm)
    expect(few).toBeNull() // only 2 < minBatters
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: 'p' + i }))
    const sav9 = Object.fromEntries(nine.map((b, i) => [norm(b.name), { xwoba: 0.330 }]))
    const r = lineupXwoba(nine, sav9, 'R', norm)
    expect(r.n).toBe(9)
    expect(r.xwoba).toBeCloseTo(0.330, 3)
  })

  it('offenseFactor: both strong → +1, both weak → -1, mixed → 0', () => {
    expect(offenseFactor(0.345, 0.340).score).toBe(1)
    expect(offenseFactor(0.300, 0.295).score).toBe(-1)
    expect(offenseFactor(0.345, 0.295).score).toBe(0)
    expect(offenseFactor(null, 0.300).score).toBe(0)  // missing data sits out
  })

  it('formFactor: high combined R/G → +1, low → -1, mid → 0', () => {
    expect(formFactor(10.2).score).toBe(1)
    expect(formFactor(7.5).score).toBe(-1)
    expect(formFactor(9.0).score).toBe(0)
    expect(formFactor(null).score).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/offense.test.js`
Expected: FAIL — "Failed to resolve import '../api/_lib/offense.js'".

- [ ] **Step 3: Write the pure functions**

```js
// api/_lib/offense.js
// Offense-side O/U signals — lineup xwOBA (platoon-adjusted) + recent scoring form.
// Pure scoring fns below are I/O-free and unit-tested; getOffense() (Task 2) does the fetching.

export const OFF = {
  xwobaStrong: 0.335,  // team avg xwOBA at/above this = strong bats (over)
  xwobaWeak:   0.305,  // at/below = weak/cold bats (under)
  formHigh:    9.8,    // both teams' avg per-game total runs (last N) at/above = high-scoring (over)
  formLow:     8.0,    // at/below = low-scoring (under)
  minBatters:  6,      // need this many matched batters to trust a lineup read
}

// Platoon multiplier on a batter's xwOBA vs the opposing starter's throwing hand.
// batSide 'L'|'R'|'S'(switch); starterHand 'L'|'R'. Opposite hands = advantage. Unknown = no change.
export function platoonMult(batSide, starterHand) {
  if (!batSide || !starterHand) return 1
  if (batSide === 'S') return 1.03
  return batSide !== starterHand ? 1.05 : 0.95
}

// Average xwOBA of a posted lineup, platoon-adjusted. batters: [{name, batSide?}].
// savantBatters: { normName: { xwoba } }. norm: name-normalizer fn. Null if <minBatters matched.
export function lineupXwoba(batters, savantBatters, starterHand, norm) {
  if (!Array.isArray(batters) || !batters.length) return null
  let sum = 0, n = 0
  for (const b of batters) {
    const s = savantBatters?.[norm(b.name)]
    if (!s || s.xwoba == null) continue
    sum += s.xwoba * platoonMult(b.batSide, starterHand)
    n++
  }
  if (n < OFF.minBatters) return null
  return { xwoba: +(sum / n).toFixed(3), n }
}

// +1 (over) when BOTH lineups are strong, -1 (under) when BOTH are weak, else 0. Missing → 0.
export function offenseFactor(awayXwoba, homeXwoba) {
  if (awayXwoba == null || homeXwoba == null) return { score: 0, reason: null }
  const both = (cmp) => cmp(awayXwoba) && cmp(homeXwoba)
  if (both((x) => x >= OFF.xwobaStrong)) return { score: 1, reason: 'hot bats' }
  if (both((x) => x <= OFF.xwobaWeak))   return { score: -1, reason: 'cold lineups' }
  return { score: 0, reason: null }
}

// Recent scoring form factor. combinedRpg = avg of both teams' recent per-game total runs.
export function formFactor(combinedRpg) {
  if (combinedRpg == null) return { score: 0, reason: null }
  if (combinedRpg >= OFF.formHigh) return { score: 1, reason: `high-scoring form (${combinedRpg.toFixed(1)})` }
  if (combinedRpg <= OFF.formLow)  return { score: -1, reason: `low-scoring form (${combinedRpg.toFixed(1)})` }
  return { score: 0, reason: null }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/offense.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/offense.js tests/offense.test.js
git commit -m "feat(offense): pure O/U offense scoring fns + tests"
```

---

## Task 2: Data orchestration — getOffense()

**Files:**
- Modify: `api/_lib/offense.js` (append `getOffense` + helpers)

Reference patterns to follow in `api/game-info.js`: `getJson(url, ms)` (timeboxed fetch), `readScan`/`writeScan` from `./scanStore.js`, `ESPN_TEAM_ID`/abbr→MLB-id map (line ~85), `getSavantMaps()` + `normName` from `./savant.js`.

- [ ] **Step 1: Append the orchestrator (no test — it's network I/O; logic is covered by Task 1)**

```js
// --- appended to api/_lib/offense.js ---
import { readScan, writeScan } from './scanStore.js'
import { getSavantMaps, normName } from './savant.js'

const ymd = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10) // ET day
async function gj(url, ms = 6000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}
const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

// Map our away/home team names → today's MLB gamePk + posted lineups + probable-pitcher hands.
// Uses the free MLB Stats schedule with lineups + probablePitcher hydrated. Cached per ET day.
async function mlbGame(away, home) {
  const date = ymd()
  const cacheKey = `MLBSCHED:${date}`
  let sched = (await readScan(cacheKey, date))?.payload
  if (!sched) {
    sched = await gj(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,lineups`, 8000)
    if (sched) await writeScan(cacheKey, date, sched, null)
  }
  const games = sched?.dates?.[0]?.games || []
  const g = games.find((x) =>
    lastWord(x.teams?.away?.team?.name) === lastWord(away) &&
    lastWord(x.teams?.home?.team?.name) === lastWord(home))
  if (!g) return null
  // lineups hydration → { away:[{name,batSide}], home:[...] }; pitcher hands from probablePitcher.
  const mapPlayers = (arr) => (arr || []).map((p) => ({ name: p.fullName, batSide: p.batSide?.code || null }))
  return {
    gamePk: g.gamePk,
    away: mapPlayers(g.lineups?.awayPlayers),
    home: mapPlayers(g.lineups?.homePlayers),
    awayStarterHand: g.teams?.away?.probablePitcher?.pitchHand?.code || null,
    homeStarterHand: g.teams?.home?.probablePitcher?.pitchHand?.code || null,
  }
}

// Team-season wOBA fallback (MLB Stats team hitting). abbrToId: abbr→MLB team id (from game-info).
async function teamWoba(teamId) {
  if (!teamId) return null
  const date = ymd()
  const c = await readScan(`TEAMWOBA-${teamId}`, date); if (c?.payload?.woba != null) return c.payload.woba
  const j = await gj(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${new Date().getUTCFullYear()}`, 7000)
  const woba = Number(j?.stats?.[0]?.splits?.[0]?.stat?.ops) // OPS as a wOBA proxy; ~.720 league avg
  if (Number.isFinite(woba)) { await writeScan(`TEAMWOBA-${teamId}`, date, { woba }, null); return woba }
  return null
}

// Recent per-game total runs (last ~7) for a team, free via MLB Stats schedule (finished games).
async function recentRpg(teamId) {
  if (!teamId) return null
  const date = ymd()
  const c = await readScan(`RECENTRPG-${teamId}`, date); if (c?.payload?.rpg != null) return c.payload.rpg
  const start = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10)
  const j = await gj(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${date}`, 7000)
  const totals = []
  for (const d of j?.dates || []) for (const g of d.games || []) {
    if (g.status?.abstractGameState !== 'Final') continue
    const a = g.teams?.away?.score, h = g.teams?.home?.score
    if (a != null && h != null) totals.push(a + h)
  }
  const last = totals.slice(-7)
  if (!last.length) return null
  const rpg = last.reduce((s, x) => s + x, 0) / last.length
  await writeScan(`RECENTRPG-${teamId}`, date, { rpg }, null)
  return rpg
}

// Orchestrate: returns { offense:{score,reason}, form:{score,reason}, source }.
// abbrToId maps an ESPN abbr → MLB team id (passed in from game-info's existing map).
export async function getOffense({ away, home, awayId, homeId }) {
  const empty = { offense: { score: 0, reason: null }, form: { score: 0, reason: null }, source: 'none' }
  try {
    const sav = await getSavantMaps().catch(() => null)
    const batters = sav?.batters || {}
    const g = await mlbGame(away, home).catch(() => null)
    let awayX = null, homeX = null, source = 'none'
    if (g) {
      awayX = lineupXwoba(g.away, batters, g.homeStarterHand, normName)?.xwoba ?? null
      homeX = lineupXwoba(g.home, batters, g.awayStarterHand, normName)?.xwoba ?? null
      if (awayX != null && homeX != null) source = 'lineup'
    }
    if (source !== 'lineup') {
      // Fallback: team-season OPS as a strength proxy (rescaled into xwOBA-ish range).
      const [ao, ho] = await Promise.all([teamWoba(awayId).catch(() => null), teamWoba(homeId).catch(() => null)])
      if (ao != null && ho != null) {
        // OPS ~.700 → xwOBA ~.315; rough linear map opsToX = ops*0.45.
        awayX = +(ao * 0.45).toFixed(3); homeX = +(ho * 0.45).toFixed(3); source = 'team'
      }
    }
    const [ar, hr] = await Promise.all([recentRpg(awayId).catch(() => null), recentRpg(homeId).catch(() => null)])
    const combinedRpg = (ar != null && hr != null) ? (ar + hr) / 2 : null
    return { offense: offenseFactor(awayX, homeX), form: formFactor(combinedRpg), source }
  } catch { return empty }
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `node --check api/_lib/offense.js && npx vitest run tests/offense.test.js`
Expected: no syntax error; the 4 Task-1 tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/offense.js
git commit -m "feat(offense): getOffense orchestrator (MLB lineups + team/form fallback)"
```

---

## Task 3: Wire offense into game-info.js O/U scoring

**Files:**
- Modify: `api/game-info.js` (import; add to `Promise.all` ~line 200; add factors after the weather block ~line 254; add `source` to the `ou` object ~line 264)

- [ ] **Step 1: Add the import (top, near the other `_lib` imports ~line 7-8)**

```js
import { getOffense } from './_lib/offense.js'
```

- [ ] **Step 2: Add offense to the parallel fetch**

Find (`api/game-info.js` ~line 200):
```js
      const [ae, he, sav, anchor, wx, aBp, hBp] = await Promise.all([
```
Add `off` as the last destructured value and a matching call. The away/home MLB team ids come from the existing abbr→id map used by `bullpenEra` (locate it — variable like `TEAM_ID[aSide.abbr]`). Result:
```js
      const [ae, he, sav, anchor, wx, aBp, hBp, off] = await Promise.all([
        // ...existing entries unchanged...
        getOffense({ away, home, awayId: TEAM_ID[aSide.abbr], homeId: TEAM_ID[hSide.abbr] }).catch(() => null),
      ])
```
(Use the exact name of the existing abbr→MLB-id map; `bullpenEra(aSide.abbr)` resolves it internally, so read that fn to get the map name and reuse it here.)

- [ ] **Step 3: Add the two factors after the weather block**

Find the weather block ending (~line 254, just before `if (why.length || anchor?.current != null) {`). Insert:
```js
      // Offense (lineup xwOBA) + recent scoring form — the under/over balancer. Additive; sits out
      // (score 0) when lineups/data are unavailable, so the lean never regresses below today's model.
      if (off?.offense?.score) { score += off.offense.score; why.push(off.offense.reason) }
      if (off?.form?.score)    { score += off.form.score;    why.push(off.form.reason) }
```

- [ ] **Step 4: Expose the source for debugging in the `ou` object**

Find (~line 264) the `ou = { lean, score, confidence, ... }` assignment and add `offenseSource: off?.source || 'none',` to the object literal.

- [ ] **Step 5: Verify build/syntax**

Run: `node --check api/game-info.js && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add api/game-info.js
git commit -m "feat(ou): add offense + recent-form factors to the O/U lean"
```

---

## Task 4: Spotlight panel shows all leans

**Files:**
- Modify: `src/components/SpotlightTicker.jsx`

- [ ] **Step 1: Keep all directional leans in the load loop**

Find (in the load `Promise.all` map, ~line 89, after the snapshot fire-and-forget added in session 60):
```js
          return (j?.ou?.lean && j.ou.strong) ? { ev, ou: j.ou } : null
```
Replace with (keep every OVER/UNDER lean; mark strong):
```js
          return (j?.ou?.lean === 'OVER' || j?.ou?.lean === 'UNDER') ? { ev, ou: j.ou } : null
```

- [ ] **Step 2: Derive ticker (strong) vs panel (all) lists**

Find where `signals` is consumed to build `ranked`/`loop` (the ticker) and the panel. Currently `ranked = signals.map(...)`. Change so:
- The **ticker** uses only strong: `const strongSignals = signals.filter(s => s.ou.strong)`. Build `ranked`/`loop` from `strongSignals`.
- The header count stays strong: `⬡ Spotlight ({strongSignals.length})`.
- The **panel** maps over ALL `signals` (already sorted by confidence desc from the existing `setSignals` sort), each row showing the existing lean + the strong highlight when `ou.strong` (the row border/NEON styling already keys off `ou.strong`).
- If `strongSignals.length === 0` but `signals.length > 0`, still render the component (so the panel is reachable). Adjust the early return `if (!signals.length) return null` stays; add: the ticker section renders only when `strongSignals.length` > 0, otherwise show a compact "no strong leans — tap for all" affordance.

- [ ] **Step 3: Verify build + visual**

Run: `npm run build`
Then load prod after deploy: open the Spotlight panel and confirm it lists every game's lean (strong ones highlighted), while the scrolling ticker shows only strong.

- [ ] **Step 4: Commit**

```bash
git add src/components/SpotlightTicker.jsx
git commit -m "feat(spotlight): panel lists all leans; ticker stays strong-only"
```

---

## Task 5: Deploy + verify live

- [ ] **Step 1: Bump SW + build**

```bash
sed -i '' "s/rml-v338/rml-v339/" public/sw.js && npm run build
```

- [ ] **Step 2: Deploy to prod + sync main**

```bash
npx vercel deploy --prod --force
git add -A && git commit -m "chore: SW v339 (offense upgrade + all-leans Spotlight)"
git push origin feat/game-browser-lab
git checkout main && git merge feat/game-browser-lab --ff-only && git push origin main && git checkout feat/game-browser-lab
```

- [ ] **Step 3: Live verify (Chrome MCP, app.riskmatrixlabs.com)**

- Open a game's detail; confirm the O/U lean still renders.
- For a game with posted lineups, confirm `ou.offenseSource` resolves to `lineup` (check via a `/api/game-info` fetch in the page console).
- Confirm at least one game now reads UNDER from a cold-lineup/low-form read.
- Open the Spotlight panel; confirm ALL leans list, strong ones highlighted; ticker shows only strong.

- [ ] **Step 4: Measure (after ~1 week)**

Query `lean_results` win% by `game_date`, before vs after this deploy; confirm the OVER/UNDER call balance moved toward ~50/50 and the record improved. If not, tune `OFF` constants in `offense.js`.

---

## Self-review notes
- **Spec coverage:** offense.js pure fns (Task 1) ✓, orchestration + fallbacks + free data (Task 2) ✓, game-info wiring + ou.source + additive/never-required (Task 3) ✓, Spotlight all-leans (Task 4) ✓, measurement via lean_results (Task 5) ✓.
- **Known execution-time verification:** exact MLB Stats JSON field paths (`g.lineups.awayPlayers`, `probablePitcher.pitchHand.code`, team OPS path) are based on the documented MLB Stats API shape; confirm against a live response in Task 2/Task 3 and adjust the parse if a path differs (the pure scoring logic is unaffected). The existing abbr→MLB-id map name in game-info.js must be read and reused in Task 3 Step 2.
- **Regression safety:** every offense path is wrapped so a failure yields score 0 / source 'none' → identical to today's model.
