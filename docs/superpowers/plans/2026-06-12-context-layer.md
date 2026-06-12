# RML Context Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "context layer" that sits between RML's existing Live Center (scores/standings — solved) and the betting-research apps the owner still opens (Linemate): Odds Snapshots → Trends → Line Movement → CLV → EV → Injuries → Weather.

**Architecture:** Reuse the existing ESPN-hidden-API → Supabase → React read path. New durable data (`odds_history`) is captured by the existing cron sync. Derived metrics (line movement, CLV, EV) are computed from data RML already pulls + the new snapshots. Injuries/weather come from free APIs (ESPN injuries endpoint, Open-Meteo — no key). All parsing helpers live in `api/cron-sync-live.js` (shared by live + heavy sync), pure and unit-tested.

**Tech Stack:** React 18 + Vite, Supabase (Postgres + JS client), Vercel serverless crons, Vitest. No new paid vendors — everything here is free (ESPN + Open-Meteo + math). EV/CLV accuracy can later be sharpened with a multi-book feed (The Odds API) but is NOT required for this plan.

**Phasing note:** Phase 0 is fully specified (urgent + self-contained — I know these files). Phases 1–6 give exact files, data sources, approach, and key code; their final test code / line numbers are confirmed when each phase is executed (each phase reads current code first). Build phases in order; each produces working, testable software on its own.

**⏰ URGENCY:** Phase 0 (odds snapshots) is the ONLY un-backfillable item. Every sync without it is closing-line data lost forever. Ship Phase 0 first regardless of which feature UI ships first — Line Movement (Phase 2) and CLV (Phase 3) are worthless without snapshots already accruing.

---

## Phase 0: Odds Snapshots (capture job) — DO FIRST

**Goal:** Every sync appends the current odds for each event to an append-only `odds_history` table, so line movement and CLV become computable later.

### Task 0.1: Create the `odds_history` table

**Files:**
- Create: `supabase/migrations/20260612_odds_history.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Append-only odds snapshots for line movement + CLV.
create table if not exists public.odds_history (
  id                bigserial primary key,
  external_event_id text not null,
  provider          text not null default 'espn',
  sport             text not null,
  market            text not null,         -- 'ml' | 'spread' | 'total'
  side              text,                  -- 'home' | 'away' | null (total)
  value             numeric not null,      -- american odds for ml, line for spread/total
  captured_at       timestamptz not null default now()
);

create index if not exists odds_history_event_idx
  on public.odds_history (external_event_id, captured_at);

alter table public.odds_history enable row level security;

-- Read-only to anon (frontend reads movement); writes happen via service-role cron.
create policy odds_history_read on public.odds_history
  for select to anon using (true);
```

- [ ] **Step 2: Apply via Supabase MCP** (`execute_sql` / `apply_migration`, project `ocsrwhjypawbeoeyhfnc`). Verify: `select count(*) from odds_history;` returns 0 with no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260612_odds_history.sql
git commit -m "feat: odds_history table for line movement + CLV"
```

### Task 0.2: Pure `buildOddsSnapshots()` helper

**Files:**
- Modify: `api/cron-sync-live.js` (add export near other parsers)
- Test: `tests/odds-snapshots.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildOddsSnapshots } from '../api/cron-sync-live.js'

const TS = '2026-06-12T20:00:00.000Z'

describe('buildOddsSnapshots', () => {
  it('emits one row per non-null odds field', () => {
    const rows = [{
      external_event_id: '401', sport: 'MLB',
      odds_ml_home: -135, odds_ml_away: 115,
      odds_spread_home: -1.5, odds_spread_away: 1.5, odds_total: 8.5,
    }]
    const out = buildOddsSnapshots(rows, TS)
    expect(out).toEqual([
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'ml',     side: 'home', value: -135, captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'ml',     side: 'away', value: 115,  captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'spread', side: 'home', value: -1.5, captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'spread', side: 'away', value: 1.5,  captured_at: TS },
      { external_event_id: '401', provider: 'espn', sport: 'MLB', market: 'total',  side: null,   value: 8.5,  captured_at: TS },
    ])
  })

  it('skips null/undefined odds and rows with no odds', () => {
    const rows = [
      { external_event_id: '402', sport: 'NBA', odds_ml_home: null, odds_ml_away: null, odds_spread_home: null, odds_total: null },
      { external_event_id: '403', sport: 'NBA', odds_ml_home: -110 },
    ]
    const out = buildOddsSnapshots(rows, TS)
    expect(out).toEqual([
      { external_event_id: '403', provider: 'espn', sport: 'NBA', market: 'ml', side: 'home', value: -110, captured_at: TS },
    ])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/odds-snapshots.test.js`
Expected: FAIL — `buildOddsSnapshots is not a function`.

- [ ] **Step 3: Implement the helper** (add to `api/cron-sync-live.js`)

```js
// Flatten an events row's current odds into append-only odds_history snapshot rows.
// captured_at is passed in (Date.now()/new Date() are unavailable in some contexts; the
// caller stamps it once per run).
export function buildOddsSnapshots(rows, capturedAt) {
  const out = []
  for (const r of rows) {
    const eid = r.external_event_id
    const base = { external_event_id: eid, provider: 'espn', sport: r.sport, captured_at: capturedAt }
    const push = (market, side, value) => {
      if (value === null || value === undefined) return
      out.push({ ...base, market, side, value })
    }
    push('ml', 'home', r.odds_ml_home)
    push('ml', 'away', r.odds_ml_away)
    push('spread', 'home', r.odds_spread_home)
    push('spread', 'away', r.odds_spread_away)
    push('total', null, r.odds_total)
  }
  return out
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/odds-snapshots.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/cron-sync-live.js tests/odds-snapshots.test.js
git commit -m "feat: buildOddsSnapshots pure helper"
```

### Task 0.3: Write snapshots from the heavy sync

**Files:**
- Modify: `api/cron-sync-events.js` (handler, after the successful `events` upsert near the end; import `buildOddsSnapshots`)

- [ ] **Step 1: Add `buildOddsSnapshots` to the existing import**

```js
import { parseTeamStats, parseNHLSkaters, parseNHLGoalie, parseStandings, parseHoopsPlayers, parsePeriodLinescore, eventNote, parseNHLGoals, parseSimplePlays, buildOddsSnapshots } from './cron-sync-live.js'
```

- [ ] **Step 2: After the events upsert succeeds (right before the final `return res.status(200).json(...)`), append snapshots (best-effort, never fail the sync):**

```js
  // Append odds snapshots for line movement + CLV (append-only; never blocks the sync).
  try {
    const snaps = buildOddsSnapshots(allRows, new Date().toISOString())
    if (snaps.length) await supabase.from('odds_history').insert(snaps)
  } catch (e) {
    console.warn('odds_history snapshot failed:', e.message)
  }
```

- [ ] **Step 3: Verify locally** — `node --check api/cron-sync-events.js` (OK), then `npx vitest run` (all green).

- [ ] **Step 4: Deploy + confirm capture**

Run: `npm run build && npx vercel deploy --prod --force`
After the next :00/:30 cron, via Supabase MCP: `select count(*), max(captured_at) from odds_history;` Expected: count > 0, recent timestamp.

- [ ] **Step 5: Commit**

```bash
git add api/cron-sync-events.js
git commit -m "feat: capture odds_history snapshots each heavy sync"
```

---

## Phase 1: Trends (owner's #1 — the "I still open Linemate" layer)

**Goal:** Show the few trends that matter per game/team: recent form (Won 4 of 5), last-10 record (7-3 L10), home/away splits (Home 22-11 / Away 14-19). Player-level streaks (e.g. "hit in 16 of 20") are a stretch goal at the end.

**Data sources (all free):**
- Team last-10 + home/away splits: ESPN standings entries already carry `stats` (look for `pointsFor`/record splits) — but home/away W-L is most reliable from the **team record endpoint** `https://site.api.espn.com/apis/v2/sports/{sport}/{league}/teams/{teamId}` → `record.items[]` has `Total`, `Home`, `Road`, `vs. Conf` summaries. RML already stores `home_record`/`away_record` (overall) — extend to splits.
- Recent form (last N results): RML already pulls `away_last5`/`home_last5` (`s.lastFiveGames`). Extend the window: `s.lastFiveGames` is capped at 5; for L10, fetch the team schedule endpoint `.../teams/{teamId}/schedule` and take the last 10 completed games.
- Player streaks (stretch): `https://site.api.espn.com/apis/common/v3/sports/{sport}/{league}/athletes/{athleteId}/gamelog`.

**Files:**
- Modify: `api/cron-sync-live.js` — add `parseTrends(s, away, home, key)` returning `{ away: {l10, homeRec, awayRec, form:[W,L,...]}, home: {...} }`. Add to `buildLiveMeta` + heavy sync into `meta.trends`.
- Modify: `src/components/LiveCenter.jsx` — render a **Trends** section in the game detail (collapsible, like Team Stats) and/or a compact form line on the card.
- Test: `tests/trends.test.js` — feed a captured ESPN summary fixture, assert `parseTrends` shape.

**Tasks (TDD per the Phase-0 pattern):**
- [ ] **1.1** Capture a real ESPN summary JSON for one MLB + one NBA game into `tests/fixtures/` (run a `node -e fetch` once, save output). Confirm where L10 / home-away / form actually live in the payload BEFORE writing the parser.
- [ ] **1.2** Write failing test for `parseTrends` against the fixture (assert `l10 === '7-3'`, `homeRec`, `form` array).
- [ ] **1.3** Implement `parseTrends`; pass test; commit.
- [ ] **1.4** Wire `meta.trends` into `buildLiveMeta` (NHL/NBA/MLB branches) + heavy sync; deploy; verify a real game has `metadata.trends` via Supabase MCP.
- [ ] **1.5** Frontend: `<Trends>` collapsible component (reuse `TeamStats` visual tokens — neon section header, 12px rows). Render in detail. Build + deploy.
- [ ] **1.6 (stretch)** Player streak line for an imported prop (depends on the prop→box-score work in `rml-bet-sync-strategy`).

---

## Phase 2: Line Movement (open → current)

**Goal:** On a game/odds view, show how a line moved: `Open -135 → Current -155`.

**Depends on:** Phase 0 snapshots having accrued (the earliest snapshot per event/market = "open").

**Data source:** `odds_history` (free, your own table).

**Files:**
- Create: `src/lib/oddsHistory.js` — `fetchLineMovement(externalEventId)` → for each `{market, side}`, the first (open) and latest (current) snapshot + a sparkline series. Pure-ish wrapper over a Supabase query.
- Modify: `src/components/LiveCenter.jsx` — in the **Odds** tab, under each line show `open → current` with a colored delta (neon if moved your way, red against).
- Test: `tests/odds-history.test.js` — mock Supabase (same `vi.mock` pattern as `tests/events.test.js`), assert open/current extraction from a fake snapshot set.

**Tasks:**
- [ ] **2.1** Failing test: `computeMovement(snapshots)` pure fn (input ordered snapshots for one market/side → `{open, current, delta}`). Implement; pass; commit.
- [ ] **2.2** `fetchLineMovement(eventId)` querying `odds_history` ordered by `captured_at`; group by `market+side`; run through `computeMovement`.
- [ ] **2.3** Frontend: render open→current + delta in Odds tab. Build + deploy.

---

## Phase 3: CLV (Closing Line Value) — RML signature metric

**Goal:** For a logged bet, compare the odds the user got to the closing line: `You: -135 · Close: -155 · +20¢ CLV`.

**Depends on:** Phase 0 (snapshots, for the closing line = last snapshot before game start) + bet logging that stores the odds taken (the `rml-bet-sync-strategy` import work, or manual `bets.odds`).

**Data source:** `odds_history` (closing line) + `bets` (odds taken).

**Files:**
- Create: `src/lib/clv.js` — `computeClv({ takenOdds, closingOdds, market })` returning cents/percent CLV. American-odds → implied prob → CLV in both cents and probability terms.
- Modify: bet detail / position card in `src/App.jsx` or `LiveCenter.jsx` to show CLV once the game has a closing line.
- Test: `tests/clv.test.js` — known cases (e.g. -135 taken, -155 close → positive CLV; +120 taken, +100 close → positive).

**Tasks:**
- [ ] **3.1** Failing test for `computeClv` with 3 known american-odds cases (favorite, dog, pick'em). Implement the implied-prob math; pass; commit.
- [ ] **3.2** `closingLine(eventId, market, side)` = last `odds_history` row with `captured_at <= start_time`.
- [ ] **3.3** Render CLV on settled/closed positions. Build + deploy.

---

## Phase 4: EV (Expected Value)

**Goal:** Show EV% on a line using the market itself (de-vig) as the fair-line proxy: `EV +3.2%`.

**Data source:** the two sides of a market you already store (`odds_ml_home`/`odds_ml_away`, etc.) → de-vig → fair prob → EV vs the price offered. Free. (Accuracy improves later with a sharp multi-book reference — out of scope here.)

**Files:**
- Create: `src/lib/ev.js` — `devig(americanHome, americanAway)` → fair probs; `evPercent(priceTaken, fairProb)`.
- Modify: Odds tab / prop card to show EV badge (neon if +EV).
- Test: `tests/ev.test.js` — de-vig a -110/-110 market → ~50/50; EV of a +EV and a -EV price.

**Tasks:**
- [ ] **4.1** Failing test for `devig` and `evPercent` (known cases). Implement; pass; commit.
- [ ] **4.2** Render EV badge where both sides of a market exist. Build + deploy.

---

## Phase 5: Injuries / Lineups

**Goal:** Show key injuries/inactives for each team on the game detail (MLB/NBA/NFL especially).

**Data source (free):** ESPN injuries — `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/injuries` OR the `injuries` block already present in some `summary` responses. Verify shape against a fixture at execution.

**Files:**
- Modify: `api/cron-sync-live.js` — `parseInjuries(s, away, home)` → `meta.injuries = { away:[{name,pos,status}], home:[...] }`. Wire into heavy sync (injuries change slowly — heavy sync, not the 2-min live sync).
- Modify: `src/components/LiveCenter.jsx` — Injuries section/card in detail.
- Test: `tests/injuries.test.js` against a fixture.

**Tasks:**
- [ ] **5.1** Capture an ESPN injuries fixture; confirm path. Failing test for `parseInjuries`; implement; commit.
- [ ] **5.2** Wire into heavy sync → `metadata.injuries`; deploy; verify.
- [ ] **5.3** Frontend Injuries section. Build + deploy.

---

## Phase 6: Weather (MLB / NFL outdoor)

**Goal:** Show wind/temp/precip for outdoor MLB & NFL games.

**Data source (free, no key):** Open-Meteo `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,precipitation,wind_speed_10m`. Venue lat/long: from ESPN `gameInfo.venue.address` (geocode once to a static `venues.json` lat/long map, or use ESPN venue coordinates when present). Skip indoor/domed venues.

**Files:**
- Create: `api/lib/weather.js` — `fetchWeather(lat, lon, gameStartIso)` → `{ tempF, windMph, windDir, precipPct }` for the game hour.
- Create: `api/lib/venues.json` — venue → `{lat, lon, dome:boolean}` for MLB + NFL stadiums.
- Modify: `api/cron-sync-events.js` — for MLB/NFL non-dome venues, attach `meta.weather` (heavy sync only).
- Modify: `src/components/LiveCenter.jsx` — small weather chip in the hero/Game Info for MLB/NFL.
- Test: `tests/weather.test.js` — mock fetch, assert the game-hour extraction + dome skip.

**Tasks:**
- [ ] **6.1** Build `venues.json` for MLB parks (+ NFL when in season) with dome flags.
- [ ] **6.2** Failing test for `fetchWeather` (mock Open-Meteo response → correct hour pick). Implement; commit.
- [ ] **6.3** Wire into heavy sync for non-dome MLB/NFL → `metadata.weather`; deploy; verify.
- [ ] **6.4** Frontend weather chip. Build + deploy.

---

## After Phase 6

**STOP adding features.** Instrument which of these users actually open (you have GA4/GTM). Build #7 only after data says so. Bet-import + live prop tracking is tracked separately in `memory/rml-bet-sync-strategy.md` and shares the `bet↔game link` keystone with Phase 3.

## Cross-cutting reminders
- Every frontend deploy: bump `public/sw.js` cache version (currently rml-v46) — was skipped in session 44.
- Test with `npx vite build && npx vite preview` (prod build), never the dev server.
- Pure parsers go in `api/cron-sync-live.js` (shared, unit-tested); heavy sync imports them; never duplicate.
- All new metadata fields are additive to the `events.metadata` JSONB — no schema change except the new `odds_history` table.
