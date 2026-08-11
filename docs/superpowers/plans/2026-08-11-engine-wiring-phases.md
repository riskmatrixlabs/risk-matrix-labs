# Model Engine Wiring — Phased Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Phases run SEQUENTIALLY; each phase ends with full suite green + Chrome verification on prod + ship. Recon facts (file:line anchors) verified 2026-08-11.

**Goal:** Wire the ported engines (`src/lib/models/`) into the live product, same flow as the O/U model: shadow/BETA first, graded in public, honest about missing data.

**Architecture:** Phase 1 = Round-Robin quality score in the slip's RR mode (client-only, all inputs derivable today). Phase 2 = WNBA prop verdicts via a new server endpoint mirroring `api/phlt.js`, rendered by the existing (sport-agnostic) verdict UI. Phase 3 = NFL: game-info NFL branch computing `nflSideScore` from real sources (nflverse prior-season team stats + synced weather/injuries/odds), snapshotted through the existing lean pipeline as SHADOW.

**Tech Stack:** existing — React/Vite client, Vercel serverless api/, Supabase, vitest.

## Global Constraints

- MODELS.md formulas are canonical; `src/lib/models/qualityScores.js` etc. weights NEVER altered. The older unwired `ladderScore`/`roundRobinScore` in `src/lib/evBrain.js:120-125` are legacy — DO NOT touch or wire them.
- **Never fabricate an input.** A score renders only when every input has a real, documented derivation. Missing data → no score shown (like `NO VALID MATRIX`).
- Brand: no gambling words ("pick/lock/play/bet on") in user-facing strings. Tiers via `brandTier()` (`src/lib/models/tiers.js`): PRIME/STRONG/CAUTION/FADE. New surfaces carry the amber BETA tag (copy the `BetaTag` idiom, `src/components/LiveCenter.jsx:191-193`).
- Pure logic in `src/lib/` with vitest tests; App.jsx edits minimal and surgical.
- Deploy per phase: bump `public/sw.js` CACHE, `npm run ship`, verify in Chrome on `app.riskmatrixlabs.com` (never local preview).
- Known honest gaps (recorded, not hacked around): ladder rungs have no PHLT score (`bet.confidence` always 0) → **ladder rung scoring is OUT of scope** until a scored pick flows to rungs; RREngine-tab legs lack game identity → RR score lives in the SLIP's RR mode (legs there carry `sport`/`event`/`evPct`).

---

## PHASE 1 — Round-Robin quality score in the slip (client-only)

### Task 1.1: `rrQuality.js` — derive the four inputs honestly

**Files:** Create `src/lib/rrQuality.js`, Test `tests/rr-quality.test.js`

**Interfaces:** Produces `rrQuality(legs, { rrSize, stakePerCombo, totalCombos, bankroll }) -> { score, tier, legScores, independence, correlation, exposure } | null`
- Consumes `roundRobinScore` from `src/lib/models/qualityScores.js`, `evScoreFromPct` from `src/lib/evBrain.js:70`, `gameKey`/`groupByGame` from `src/lib/slipModes.js`.
- Derivations (all 0–100, documented in-file):
  - `legScores`: `evScoreFromPct(leg.evPct)` per leg. **Any leg with `evPct == null` → return null** (no fake leg quality).
  - `independenceScore`: `(distinctGames / legs.length) * 100` via `groupByGame`.
  - `correlationPenalty`: `100 * (legs.length − distinctGames) / legs.length` (same-game stacking share).
  - `exposurePenalty`: `min(100, (stakePerCombo * totalCombos / bankroll) * 100)`; bankroll ≤ 0 or non-finite → null.
- `tier` = `brandTier(score)`.

- [ ] Failing test (cases: 3 cross-game legs w/ evPct → hand-computed score; a leg missing evPct → null; same-game pair raises correlation; exposure caps at 100; bankroll 0 → null)
- [ ] Implement, run `npx vitest run tests/rr-quality.test.js` → PASS
- [ ] Commit `feat(rr): rr quality derivation lib`

### Task 1.2: Surface in the slip RR mode

**Files:** Modify `src/App.jsx` (slip RR mode UI near `src/App.jsx:3440-3459` / RR tab render; find the RR mode panel that shows `totalCombos`/`rrStake`)

- In the slip's Round Robin mode panel, when `rrQuality(...)` returns non-null, render one compact row: `MATRIX QUALITY <score> · <tier>` + BETA tag; tier color: PRIME/STRONG→neon `#BDFF00`, CAUTION→amber `#FFAE2B`, FADE→red `#FF3B3B`. Non-null only — render nothing when null.
- Inputs from scope: `enabledLegs()`, `rrSize`, `rrStake` (per-combo stake), `validRoundRobinCombos(...).length`, `masterBankroll` (or the bankroll value already in App scope — locate what the slip uses; recon says `masterBankroll` default 1000 exists in App state).
- [ ] Implement (surgical diff), `npx vitest run` full suite green, `npm run build` clean
- [ ] Commit `feat(rr): quality score row in slip RR mode (BETA)`

### Task 1.3: Phase-1 ship

- [ ] Bump SW → `rml-v543`, `npm run ship`, verify SW live
- [ ] Chrome on prod: log in as owner flow not required — verify via building a slip with 3 picks (use free consensus odds picks) → RR mode → quality row renders (or verify honest-null when legs lack evPct). Screenshot.

---

## PHASE 2 — WNBA prop verdicts (server + client)

### Task 2.1: `api/wnba-props.js` — verdicts endpoint mirroring `api/phlt.js`

**Files:** Create `api/wnba-props.js`, Create `src/lib/wnbaVerdict.js` (pure scoring, testable), Test `tests/wnba-verdict.test.js`

**Interfaces:**
- `GET /api/wnba-props?away=&home=&iso=&names=a|b|c` (auth via same `requireAuth` pattern as `api/phlt.js`) → `{ ok, verdicts: { [playerName]: { score, tier, label, color, faded, breakdown, projection, edge } } }` — SAME verdict shape as `src/lib/phlt.js:143-162` (`tier` must be 'A'|'B'|'C'|'AVOID' so the existing render path at `MatrixBot.jsx:1310-1323` works unchanged; map internal score → tier: ≥75 A, ≥62 B, ≥50 C, else AVOID; `faded: tier==='AVOID'`).
- Pure fn `wnbaVerdict({ perMinRate, last5Minutes, seasonMinutes, recentMaxMinutes, last5Rate, seasonRate, oppSpread, evPct, line }) -> verdict|null` in `src/lib/wnbaVerdict.js`, built ON `wnbaPropScore`/`wnbaProjection`/`minutesStability`/`propEdge` from `src/lib/models/wnbaProps.js`.
- Input derivations (0–1, documented; ANY underivable → that player gets no verdict):
  - `minutes` = clamp01(last5AvgMinutes / 36) × minutesStability guard (stability < 0.6 → cap at 0.5)
  - `usage` = clamp01(perMinRate / leagueRefPerMin) where leagueRefPerMin is a per-market const table in the file (e.g. points 0.55/min) — a documented reference scale, not a fabricated player stat
  - `matchup` = 0.5 baseline **only if** opponent data absent is NOT allowed — instead derive from game total+spread: expected pace proxy `clamp01(oddsTotal / 170)`; if `odds_total` missing → no verdict
  - `recentForm` = clamp01(0.5 + (last5Rate − seasonRate) / (2×seasonRate))
  - `gameScript` = 1 − clamp01(|spread| / 16) (blowout risk from synced `odds_spread_home`)
  - `lineValue` = clamp01(0.5 + evPct/20) from the prop's `evPct`
- Server assembles inputs: roster via `buildIndex('WNBA')` pattern from `api/player-search.js`; per-player ESPN gamelog fetch parallel to `hitterForm()` (`api/phlt.js:70-110`) keeping MIN + the stat per game; event row (odds_total, odds_spread_home) from Supabase events. 5-min cache like phlt.

- [ ] Failing tests for `wnbaVerdict` (hand-computed score/projection/edge; each missing input → null; tier mapping bounds)
- [ ] Implement lib → tests PASS; implement endpoint
- [ ] Commit `feat(wnba): verdict lib + /api/wnba-props endpoint (BETA)`

### Task 2.2: Client dispatch in PropsPanel

**Files:** Modify `src/components/MatrixBot.jsx:1261-1275` (the `sport !== 'MLB'` guard)

- Replace guard with dispatch: MLB → `/api/phlt`, WNBA → `/api/wnba-props` (same `names` batching, max 30). `setPhlt(j.verdicts)` unchanged — render path is sport-agnostic. Add BETA tag next to the WNBA verdict badge (reuse existing BETA idiom).
- [ ] Implement, full suite green, build clean
- [ ] Commit `feat(wnba): PropsPanel verdict dispatch for WNBA (BETA)`

### Task 2.3: Phase-2 ship + verify

- [ ] SW → `rml-v544`, ship, verify SW
- [ ] Chrome on prod: open a WNBA game (8 games synced this week) → Props → confirm WNBA player cards show verdict badges + breakdown bars + BETA, or honest no-verdict when inputs missing. NOTE: props scans need paid credits — breaker is tripped (929 < 1000 floor), so cached props may be the only data; verify against cache-only response. If zero cached WNBA props exist, verify endpoint directly (authed curl via deployed API) and record that UI verification waits on credit top-up. Screenshot what's verifiable.
- [ ] Snapshot/grading for WNBA verdicts: DEFERRED to backlog (needs `cron-snapshot-phlt.js` sibling + `cron-grade-props.js` WNBA support — verify `matchBoxPlayer` handles WNBA box scores before building).

---

## PHASE 3 — NFL side model, SHADOW, through the lean pipeline

### Task 3.1: nflverse team-stats source

**Files:** Create `api/_lib/nflTeamStats.js`, Test `tests/nfl-team-stats.test.js` (pure parsing only)

- Fetch nflverse team-level stats (prior season = early-season prior; URL: the nflverse-data GitHub release CSV for team stats regular season). Parse to per-team `{ offEpaPerPlay, defEpaPerPlayAllowed, sackRateAllowed, explosiveRate, turnoverMargin, playsPerGame }`. Cache in `scan_cache` (existing table/pattern from `api/_lib/scanStore.js`) for 24h, keyed `NFLSTATS:<season>`. Pure parser exported separately for tests; network fn documented + fail-soft (null → callers emit no lean).
- [ ] Tests on a fixture CSV snippet → PASS; commit `feat(nfl): nflverse team stats source`
- *(Phase 3b note: the season file has no opponent-EPA column, so `defEpaPerPlayAllowed` is derived from the WEEKLY file `stats_team_week_<season>.csv` (has `opponent_team`): mean over T's games of the opponent's off EPA/play; cached separately as `NFLDEF:<season>`.)*

### Task 3.2: `src/lib/nflLean.js` — factor derivation + lean builder

**Files:** Create `src/lib/nflLean.js`, Test `tests/nfl-lean.test.js`

- `nflLean({ homeStats, awayStats, weather, injuries, oddsSpreadHome, oddsTotal, restDaysHome, restDaysAway }) -> { side:'HOME'|'AWAY', score, tier, factors } | null`
- Nine factors 0–1, each documented; **all-or-nothing** (any underivable → null):
  - `qbEdge` = clamp01(0.5 + ((own offEpaPerPlay − LEAGUE_AVG_EPA) + (opp defEpaPerPlayAllowed − LEAGUE_AVG_EPA)) × 2.5) — EPA differential as the QB/passing proxy until player-level data lands (documented as proxy). LEAGUE_AVG_EPA ≈ 0.01 documented const, replaced by the computed league mean from the fetched stats when available. *(Corrected during Phase 3b: the original `own.off − opp.defAllowed` form was backwards — it penalized facing a BAD defense. Session-authored derivation, not an owner-confirmed weight; `nflSideScore` weights untouched.)*
  - `offensiveLine` = clamp01(1 − sackRateAllowed / 0.12)
  - `defensiveMatchup` = clamp01(0.5 − ((opp offEpaPerPlay − LEAGUE_AVG_EPA) + (own defEpaPerPlayAllowed − LEAGUE_AVG_EPA)) × 2.5) — inverted mirror of qbEdge (hot opp offense + leaky own defense drag it down); same Phase-3b sign correction
  - `explosivePlay` = clamp01(explosiveRate / 0.14)
  - `turnoverRegression` = clamp01(0.5 − turnoverMargin × 0.05) (extreme margins regress)
  - `injuryEdge` = from synced `metadata.injuries` counts weighted by status (Out=1, Doubtful=0.6, Questionable=0.3): clamp01(0.5 + (oppWeighted − ownWeighted) × 0.08)
  - `restTravel` = clamp01(0.5 + (restDaysOwn − restDaysOpp) × 0.07)
  - `weather` = 1 − clamp01((windMph/25 + precipPct/100) / 2) for the side favored by conditions… simplify: same value both sides at v0 → 0.5 + documented note (conditions are symmetric at team level) — this IS derivable (real synced weather), indoor → 0.75
  - `lineValue` = clamp01(0.5 + (modelMargin − marketSpread) / 14) where modelMargin = (own score − opp score computed both directions) — circular guard: use EPA differential × 25 as modelMargin
- Compute `nflSideScore` for BOTH sides; lean = higher side; emit only when `score ≥ 68` (internal LEAN threshold) → SHADOW lean. `tier` via `brandTier`.
- [ ] Hand-computed tests incl. all-null propagation → PASS; commit `feat(nfl): lean factor derivation (SHADOW)`

### Task 3.3: Plumb game-info + grading + Spotlight

**Files:** Modify `api/game-info.js:73-79` (add `NFL: { sport:'football', league:'nfl' }`), `api/game-info.js:224` area (add `else if (sport === 'NFL')` branch → assemble nflLean inputs: nflTeamStats, event row weather/injuries/odds, rest days from events table prior games; respond `ou: null, nfl: { lean, score, tier, factors, modelVersion:'nfl-shadow-v0', shadow: true }`), `api/cron-grade-leans.js:17` (add `NFL: ['football','nfl']` to ESPN_PATH), `src/components/SpotlightTicker.jsx` (second loop for NFL: `fetchEvents('nfl','today')`, fetch game-info, POST `/api/snapshot-lean` with `market:'rl'` + `pick_side` + `model_version:'nfl-shadow-v0'`, render an `NFL · SHADOW` collapsed section labeled BETA — mirror the KBO collapsed-section pattern)
- Verify `api/_lib/gradeLean.js` `market:'rl'` semantics handle NFL spreads incl. pushes — read it; if MLB-assumptions exist, fix with tests.
- `snapshot-lean.js` needs no schema change (reuse rl market; edge_runs carries points — add code comment).
- [ ] Full suite green, build clean; commit `feat(nfl): game-info NFL branch + lean pipeline plumbing (SHADOW)`

### Task 3.4: Phase-3 ship + verify

- [ ] SW → `rml-v545`, ship
- [ ] Verify live: authed request to deployed `/api/game-info?sport=NFL&away=...&home=...&iso=2026-08-13` for a real Thu game (ESPN slate exists) → returns `nfl` block or honest null; cron-grade-leans dry: no NFL rows yet (games land in events at next sync). Chrome: Spotlight NFL section renders (empty state OK until events sync). Screenshot.
- [ ] Backlog: record follow-ups (player-level QB data, snap counts; WNBA snapshot/grading; NBA/NHL wiring at season start reusing this exact pattern).
