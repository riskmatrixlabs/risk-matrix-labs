# Matrix EV Bot — Phase 2: Props + Bet-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-game **PROPS** tab to the Matrix EV Bot (CH2 LOOK) that surfaces sharp-anchored +EV player props with unit sizing, plus **"Bet at \<book\> →"** deep-links on every prop and game-line edge — all credit-disciplined and honest (no faked edges).

**Architecture:** A new pure engine `src/lib/propEdges.js` groups a game's prop outcomes by player+line, de-vigs the Pinnacle pair (reusing `src/lib/devig.js`), finds the best reputable-book price, and computes EV — reusing every Phase-1 math primitive; only the player-grouping is new. The provider adapter gains a free `/events` id-map call and a paid per-event odds call (with `includeLinks=true`); a new auth-gated `api/scan-props.js` ties them together. The Bot's `LookChannel` gets a PROPS tab; bet-links render from the API's per-outcome `link`.

**Tech Stack:** React 18 + Vite, Vitest, The Odds API per-event endpoint via the swappable adapter, brand inline-style design system.

---

## Spec reference (verified shapes — do not re-derive)

**Player-prop outcome shape** (The Odds API per-event odds): `{ name: 'Over'|'Under', description: 'Aaron Judge', point: 1.5, price: -120, link: 'https://...' }`. The **player is in `description`**, the line in `point`. (Game-line markets have no `description`; player is irrelevant there.)

**Reused primitives:**
- `devig.js`: `devigTwoWay(oddsA, oddsB)` → `{ fairA, fairB, fairAmericanA, fairAmericanB, holdPct }`; `americanToDecimal(odds)`.
- `oddsEdge.js`: `evPct(american, fairProb)` → `(fairProb*decimal - 1)*100`; `SHARP_BOOK = 'pinnacle'`.
- `edgeFilter.js`: `REPUTABLE_BOOKS` (Set), `DEFAULTS` (`{minEvPct:1, maxEvPct:15, maxStaleMin:10, preGameOnly:true}`), `isCredibleEdge(edge, opts)`.
- `api/_lib/auth.js`: `requireAuth(req, res)` → user or null (sends 401).
- `src/lib/scanCache.js`: `getScan/putScan(sport, date, payload)` (extend key with game — see Task 5).

**Normalized event shape** the engine consumes: `{ commence_time, home_team, away_team, bookmakers: [{ key, last_update, markets: [{ key, outcomes: [{ name, price, point, description, link }] }] }] }`.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src/lib/betLinks.js` | **Create** | Affiliate-ready link passthrough `decorate(book, url)`. TDD. |
| `src/lib/propEdges.js` | **Create** | Group props by player+line, sharp-anchor de-vig, EV, line-shop fallback. TDD. |
| `src/lib/propMarkets.js` | **Create** | `PROP_MARKETS` (sport→market keys) + `MARKET_LABELS` (key→plain English). |
| `api/_lib/oddsProviders/theOddsApi.js` | **Modify** | Keep `description`+`link` in normalize; add `fetchSportEvents`, `fetchEventOdds`; `includeLinks` on `fetchOdds`. |
| `api/_lib/edges.js` | (unchanged) | — |
| `api/scan-props.js` | **Create** | Auth-gated per-game prop scan endpoint. |
| `src/components/MatrixBot.jsx` | **Modify** | PROPS tab in `LookChannel`; `BetLink` button on feed rows + prop cards. |
| `tests/bet-links.test.js`, `tests/prop-edges.test.js` | **Create** | Unit tests. |
| `public/sw.js` | **Modify** | SW bump rml-v88 → rml-v89. |

---

## Task 1: `betLinks.js` — affiliate-ready link passthrough (TDD)

**Files:** Create `src/lib/betLinks.js`; Test `tests/bet-links.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { decorate } from '../src/lib/betLinks.js'

describe('decorate', () => {
  it('returns the url unchanged when no affiliate config (passthrough)', () => {
    expect(decorate('draftkings', 'https://sportsbook.draftkings.com/event/123')).toBe('https://sportsbook.draftkings.com/event/123')
  })
  it('returns null/empty safely', () => {
    expect(decorate('fanduel', null)).toBeNull()
    expect(decorate('fanduel', '')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/bet-links.test.js` → FAIL ("no export named 'decorate'").

- [ ] **Step 3: Implement**

```js
// Affiliate-ready bet-link wrapper. Today it's a passthrough so we ship deep-links now;
// when affiliate deals exist, add per-book params here in ONE place (no UI rework).
const AFFILIATE = {}   // e.g. { draftkings: (url) => `${url}?wpcid=RML` }

export function decorate(book, url) {
  if (!url) return null
  const fn = AFFILIATE[book]
  return fn ? fn(url) : url
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run tests/bet-links.test.js` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betLinks.js tests/bet-links.test.js
git commit -m "feat(props): affiliate-ready bet-link passthrough"
```

---

## Task 2: `propMarkets.js` — sport→prop-market config

**Files:** Create `src/lib/propMarkets.js`

- [ ] **Step 1: Create the config** (no test needed — pure data; consumed by tests in Task 5/6)

```js
// Curated, liquid player-prop markets per sport ("all props" = this set, extendable).
export const PROP_MARKETS = {
  MLB:  ['pitcher_strikeouts', 'batter_hits', 'batter_total_bases', 'batter_home_runs', 'batter_rbis', 'batter_walks'],
  NBA:  ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  WNBA: ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'],
  NHL:  ['player_shots_on_goal', 'player_points', 'player_goals', 'player_total_saves'],
}

export const MARKET_LABELS = {
  pitcher_strikeouts: 'Strikeouts', batter_hits: 'Hits', batter_total_bases: 'Total Bases',
  batter_home_runs: 'Home Runs', batter_rbis: 'RBIs', batter_walks: 'Walks',
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
  player_threes: 'Threes', player_points_rebounds_assists: 'Pts+Reb+Ast',
  player_shots_on_goal: 'Shots on Goal', player_goals: 'Goals', player_total_saves: 'Saves',
}

export const labelFor = (key) => MARKET_LABELS[key] || key
```

- [ ] **Step 2: Build-check** — `npx vite build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/propMarkets.js
git commit -m "feat(props): prop market config + labels per sport"
```

---

## Task 3: `propEdges.js` — group + sharp-anchor + EV (TDD)

**Files:** Create `src/lib/propEdges.js`; Test `tests/prop-edges.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { propEdges } from '../src/lib/propEdges.js'

// Build a normalized event with one prop market (player_strikeouts) across books.
const evt = (over) => ({
  commence_time: '2999-01-01T00:00:00Z',   // far future → passes pre-game gate
  home_team: 'A', away_team: 'B',
  bookmakers: [
    { key: 'pinnacle', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'player_strikeouts', outcomes: [
      { name: 'Over',  description: 'Tarik Skubal', point: 6.5, price: -110 },
      { name: 'Under', description: 'Tarik Skubal', point: 6.5, price: -110 },
    ] }] },
    { key: 'draftkings', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'player_strikeouts', outcomes: [
      { name: 'Over',  description: 'Tarik Skubal', point: 6.5, price: 120, link: 'https://dk/over' },  // generous Over
      { name: 'Under', description: 'Tarik Skubal', point: 6.5, price: -140 },
    ] }] },
    ...over,
  ],
})

describe('propEdges', () => {
  it('finds a +EV prop: Pinnacle 50/50 fair, DK Over +120 = real edge', () => {
    const { edges } = propEdges(evt([]), ['player_strikeouts'], Date.parse('2024-01-01'), {})
    const e = edges.find(x => x.side === 'Over')
    expect(e).toBeTruthy()
    expect(e.player).toBe('Tarik Skubal')
    expect(e.point).toBe(6.5)
    expect(e.market).toBe('player_strikeouts')
    expect(e.best.book).toBe('draftkings')
    expect(e.best.price).toBe(120)
    expect(e.best.link).toBe('https://dk/over')
    expect(e.evPct).toBeGreaterThan(1)          // fair ~50%, +120 decimal 2.2 → ~+10% EV
    expect(e.fairProb).toBeCloseTo(0.5, 2)
  })

  it('no Pinnacle line for a player → line-shop only, no EV claim', () => {
    const noSharp = {
      commence_time: '2999-01-01T00:00:00Z', home_team: 'A', away_team: 'B',
      bookmakers: [
        { key: 'draftkings', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'batter_hits', outcomes: [
          { name: 'Over', description: 'Aaron Judge', point: 1.5, price: 150, link: 'https://dk/j' },
          { name: 'Under', description: 'Aaron Judge', point: 1.5, price: -180 },
        ] }] },
        { key: 'fanduel', last_update: '2999-01-01T00:00:00Z', markets: [{ key: 'batter_hits', outcomes: [
          { name: 'Over', description: 'Aaron Judge', point: 1.5, price: 145 },
          { name: 'Under', description: 'Aaron Judge', point: 1.5, price: -175 },
        ] }] },
      ],
    }
    const { edges, lineShopOnly } = propEdges(noSharp, ['batter_hits'], Date.parse('2024-01-01'), {})
    expect(edges.length).toBe(0)
    const ls = lineShopOnly.find(x => x.side === 'Over')
    expect(ls.best.book).toBe('draftkings')   // +150 beats +145
    expect(ls.best.price).toBe(150)
    expect(ls.evPct).toBeUndefined()
  })

  it('skips live games (pre-game gate)', () => {
    const live = { ...evt([]), commence_time: '2000-01-01T00:00:00Z' }
    const { edges, lineShopOnly } = propEdges(live, ['player_strikeouts'], Date.parse('2024-01-01'), {})
    expect(edges.length).toBe(0)
    expect(lineShopOnly.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/prop-edges.test.js` → FAIL ("no export named 'propEdges'").

- [ ] **Step 3: Implement**

```js
// Sharp-anchored player-prop edges for ONE game. Props are 2-way (Over/Under a line);
// we group by player+line, de-vig the Pinnacle pair for true probs, then find the best
// reputable-book price and its EV. No Pinnacle pair → line-shop only (no EV claim).
import { devigTwoWay, americanToDecimal } from './devig.js'
import { evPct, SHARP_BOOK } from './oddsEdge.js'
import { REPUTABLE_BOOKS, DEFAULTS, isCredibleEdge } from './edgeFilter.js'
import { labelFor } from './propMarkets.js'

const groupKey = (player, point) => `${player}__${point}`

// Collect every (player, point, side) quote across reputable books for one market.
// → Map key → { player, point, sides: { Over: [{book,price,link}], Under: [...] } }
function collect(bookmakers, marketKey, nowMs, opts) {
  const { maxStaleMin } = { ...DEFAULTS, ...opts }
  const cutoff = nowMs - maxStaleMin * 60_000
  const groups = new Map()
  for (const b of bookmakers || []) {
    if (!REPUTABLE_BOOKS.has(b.key)) continue
    if (b.last_update != null) { const t = Date.parse(b.last_update); if (!Number.isNaN(t) && t < cutoff) continue }
    const m = (b.markets || []).find(x => x.key === marketKey)
    if (!m) continue
    for (const o of m.outcomes || []) {
      const player = o.description, side = o.name, point = o.point
      if (!player || (side !== 'Over' && side !== 'Under') || point == null) continue
      const key = groupKey(player, point)
      if (!groups.has(key)) groups.set(key, { player, point, sides: { Over: [], Under: [] } })
      groups.get(key).sides[side].push({ book: b.key, price: o.price, link: o.link ?? null })
    }
  }
  return groups
}

// Best (highest decimal) quote for a side across books.
function bestOf(quotes) {
  let best = null
  for (const q of quotes || []) {
    const d = americanToDecimal(q.price)
    if (d == null) continue
    if (!best || d > best.decimal) best = { book: q.book, price: q.price, link: q.link, decimal: d }
  }
  return best
}

export function propEdges(event, marketKeys, nowMs, opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  if (o.preGameOnly && event?.commence_time != null) {
    const start = Date.parse(event.commence_time)
    if (!Number.isNaN(start) && start <= nowMs) return { edges: [], lineShopOnly: [] }
  }
  const edges = [], lineShopOnly = []
  for (const marketKey of marketKeys || []) {
    const groups = collect(event?.bookmakers, marketKey, nowMs, o)
    for (const { player, point, sides } of groups.values()) {
      const bestOver = bestOf(sides.Over), bestUnder = bestOf(sides.Under)
      // Sharp anchor: Pinnacle's own Over+Under for this player+line.
      const pinOver  = sides.Over.find(q => q.book === SHARP_BOOK)
      const pinUnder = sides.Under.find(q => q.book === SHARP_BOOK)
      const dv = (pinOver && pinUnder) ? devigTwoWay(pinOver.price, pinUnder.price) : null
      const base = { player, market: marketKey, marketLabel: labelFor(marketKey), point }
      if (dv) {
        const sharpHoldPct = dv.holdPct
        for (const [side, best, fairProb] of [['Over', bestOver, dv.fairA], ['Under', bestUnder, dv.fairB]]) {
          if (!best) continue
          const ev = evPct(best.price, fairProb)
          const edge = { ...base, side, best: { book: best.book, price: best.price, link: best.link }, fairProb, sharpHoldPct, evPct: ev }
          if (isCredibleEdge({ evPct: ev }, o)) edges.push(edge)
        }
      } else {
        for (const [side, best] of [['Over', bestOver], ['Under', bestUnder]]) {
          if (!best) continue
          lineShopOnly.push({ ...base, side, best: { book: best.book, price: best.price, link: best.link } })
        }
      }
    }
  }
  edges.sort((a, b) => b.evPct - a.evPct)
  return { edges, lineShopOnly }
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run tests/prop-edges.test.js` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/propEdges.js tests/prop-edges.test.js
git commit -m "feat(props): sharp-anchored prop edge engine"
```

---

## Task 4: Provider adapter — keep `description`/`link`, add per-event methods

**Files:** Modify `api/_lib/oddsProviders/theOddsApi.js`

- [ ] **Step 1: Keep `description` + `link` in `normalizeGame`** — replace the outcome map line:

```js
        outcomes: (m.outcomes || []).map(o => ({ name: o.name, price: o.price, point: o.point, description: o.description, link: o.link })),
```

- [ ] **Step 2: Add `includeLinks` to the existing `fetchOdds` URL** — change the URL template to append `&includeLinks=true`:

```js
  const url = `${BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}`
    + `&regions=${regions.join(',')}&markets=${markets.join(',')}&oddsFormat=american&includeLinks=true`
```

- [ ] **Step 3: Add `fetchSportEvents` (free id map) + `fetchEventOdds` (paid per-event)** at the end of the file:

```js
// Free events list (0 credits) → map our game to The Odds API's event id by team names.
export async function fetchSportEvents({ sport, apiKey = process.env.ODDS_API_KEY }) {
  if (!apiKey) throw new Error('ODDS_API_KEY missing')
  const sportKey = SPORT_KEYS[sport] || sport
  const res = await fetch(`${BASE}/sports/${sportKey}/events/?apiKey=${apiKey}`)
  if (!res.ok) throw new Error(`theOddsApi events ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = await res.json()
  return {
    events: (Array.isArray(data) ? data : []).map(e => ({ id: e.id, home_team: e.home_team, away_team: e.away_team, commence_time: e.commence_time })),
    credits: { remaining: Number(res.headers.get('x-requests-remaining')), used: Number(res.headers.get('x-requests-used')), last: Number(res.headers.get('x-requests-last')) },
  }
}

// Paid per-event odds (props live here). Returns one normalized game + credits.
export async function fetchEventOdds({ sport, eventId, markets, regions = ['us', 'eu'], apiKey = process.env.ODDS_API_KEY }) {
  if (!apiKey) throw new Error('ODDS_API_KEY missing')
  const sportKey = SPORT_KEYS[sport] || sport
  const url = `${BASE}/sports/${sportKey}/events/${eventId}/odds/?apiKey=${apiKey}`
    + `&regions=${regions.join(',')}&markets=${markets.join(',')}&oddsFormat=american&includeLinks=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`theOddsApi event-odds ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = await res.json()
  return {
    game: data && data.id ? normalizeGame(data) : null,
    credits: { remaining: Number(res.headers.get('x-requests-remaining')), used: Number(res.headers.get('x-requests-used')), last: Number(res.headers.get('x-requests-last')) },
  }
}
```

- [ ] **Step 4: Build-check** — `npx vite build` → succeeds (adapter is server code but build catches syntax).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/oddsProviders/theOddsApi.js
git commit -m "feat(props): provider keeps description/link, adds per-event prop fetch + includeLinks"
```

---

## Task 5: `api/scan-props.js` — auth-gated per-game prop scan

**Files:** Create `api/scan-props.js`

- [ ] **Step 1: Create the endpoint**

```js
// On-demand per-game player-prop scan. Free /events call maps our game → Odds API event id,
// then one paid per-event odds call fetches the sport's prop markets; propEdges ranks them.
// Auth-gated — each scan spends credits. Pre-game only (the engine enforces the gate).
import { requireAuth } from './_lib/auth.js'
import { fetchSportEvents, fetchEventOdds } from './_lib/oddsProviders/theOddsApi.js'
import { SPORT_KEYS } from './_lib/oddsProviders/theOddsApi.js'
import { propEdges } from '../src/lib/propEdges.js'
import { PROP_MARKETS } from '../src/lib/propMarkets.js'

export const config = { maxDuration: 20 }

const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const sport = String(req.query.sport ?? 'MLB').toUpperCase()
  const away = String(req.query.away ?? '')
  const home = String(req.query.home ?? '')
  if (!SPORT_KEYS[sport]) return res.status(400).json({ error: `unsupported sport "${sport}"` })
  if (!away || !home) return res.status(400).json({ error: 'missing away/home team' })
  const markets = PROP_MARKETS[sport]
  if (!markets?.length) return res.status(200).json({ found: false, reason: 'no prop markets for sport' })

  res.setHeader('Cache-Control', 'no-store')
  try {
    const { events } = await fetchSportEvents({ sport })
    const match = events.find(e => lastWord(e.home_team) === lastWord(home) && lastWord(e.away_team) === lastWord(away))
    if (!match) return res.status(200).json({ found: false })

    const { game, credits } = await fetchEventOdds({ sport, eventId: match.id, markets })
    if (!game) return res.status(200).json({ found: false, creditsRemaining: credits.remaining })

    const { edges, lineShopOnly } = propEdges(game, markets, Date.now())
    return res.status(200).json({
      found: true, away: game.away_team, home: game.home_team,
      edges, lineShopOnly,
      creditsRemaining: credits.remaining,
      scannedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('scan-props failed:', e.message)
    return res.status(502).json({ error: 'prop scan failed', detail: e.message })
  }
}
```

- [ ] **Step 2: Build-check** — `npx vite build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add api/scan-props.js
git commit -m "feat(props): auth-gated per-game prop scan endpoint"
```

---

## Task 6: `MatrixBot.jsx` — PROPS tab + bet-links

**Files:** Modify `src/components/MatrixBot.jsx`

- [ ] **Step 1: Add imports** at the top of the file (after the existing imports):

```jsx
import { decorate } from '../lib/betLinks.js'
import { labelFor } from '../lib/propMarkets.js'
```

- [ ] **Step 2: Add a reusable `BetLink` button component** (place near the other small helpers like `Empty`/`Stat`):

```jsx
function BetLink({ book, link }) {
  const url = decorate(book, link)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      style={{ flexShrink: 0, padding: '6px 10px', borderRadius: '6px', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'none', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      Bet at {BOOK_NAMES[book] || book} →
    </a>
  )
}
```

- [ ] **Step 3: Add the bet-link to the game-line `FeedRow`** — change the right-hand block so the link sits under the price. Replace the closing of `FeedRow`'s right column:

```jsx
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(edge.best.price)}</div>
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>+{edge.evPct.toFixed(1)}% EV</div>
        {edge.best.link && <BetLink book={edge.best.book} link={edge.best.link} />}
      </div>
```

- [ ] **Step 4: Add `PROPS` to the LookChannel market tabs and render the props panel.** In `LookChannel`, extend `tabDefs` to always include props, and when `activeKey === 'props'` render the props scanner instead of the book table.

Change the `tabDefs` line:

```jsx
  const tabDefs = [['h2h', 'ML'], ['spreads', SPREAD_LABEL[sport] || 'Spread'], ['totals', 'Total']].filter(([k]) => M[k])
  tabDefs.push(['props', 'PROPS'])
```

Then, right after the market tab-bar `<div>` that maps `tabDefs`, branch on props before the `{cmp && (<table>...)}` block:

```jsx
      {activeKey === 'props'
        ? <PropsPanel game={game} sport={sport} token={token} onLogPosition={onLogPosition} />
        : null}
      {activeKey !== 'props' && cmp && (
        // ... existing <table> ...
      )}
```

(Adjust the existing `cmp` table guard to `activeKey !== 'props' && cmp && (...)` and the movement block to also hide when `activeKey === 'props'`.)

- [ ] **Step 5: Add the `PropsPanel` component** (after `LookChannel`):

```jsx
function PropsPanel({ game, sport, token, onLogPosition }) {
  const [status, setStatus] = useState('idle')   // idle | scanning | done | error
  const [data, setData]     = useState(null)     // { edges, lineShopOnly, creditsRemaining }
  const [err, setErr]       = useState('')

  async function scan() {
    if (!token || status === 'scanning') return
    setStatus('scanning'); setErr('')
    try {
      const res = await fetch(`/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `props ${res.status}`)
      const j = await res.json()
      setData(j.found ? j : { edges: [], lineShopOnly: [], creditsRemaining: j.creditsRemaining })
      setStatus('done')
    } catch (e) { setErr(e.message); setStatus('error') }
  }

  const logProp = (p) => onLogPosition && onLogPosition(
    { sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime },
    { pick: `${p.player} ${p.side} ${p.point} ${p.marketLabel}`, odds: p.best.price })

  if (!token) return <Empty text="Log in to scan props — scans use credits." />
  if (status === 'idle') return (
    <button onClick={scan} style={{ width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T }}>SCAN PROPS</button>
  )
  if (status === 'scanning') return <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: NEON_T, letterSpacing: '0.1em' }}>SCANNING PROPS…</div>
  if (status === 'error') return <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err} <button onClick={scan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button></div>

  const edges = data?.edges || [], ls = data?.lineShopOnly || []
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 10px' }}>
        <span style={{ fontFamily: R, fontSize: '10px', color: edges.length ? NEON_T : MUTED, letterSpacing: '0.12em' }}>{edges.length ? `${edges.length} VALID PROP MATRIX${edges.length > 1 ? 'ES' : ''}` : 'NO VALID PROP MATRIX'}</span>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{data?.creditsRemaining != null ? `${data.creditsRemaining} left · ` : ''}<button onClick={scan} style={{ background: 'none', border: 'none', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px', padding: 0 }}>RE-SCAN</button></span>
      </div>
      {edges.length === 0 && <Empty text="No +EV props right now — we won't fake an edge." />}
      {edges.map((p, i) => (
        <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${NEON}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{p.player} {p.side} {p.point}</div>
            <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{p.marketLabel} · {BOOK_NAMES[p.best.book] || p.best.book} · +{p.evPct.toFixed(1)}% EV</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(p.best.price)}</div>
            {p.best.link && <BetLink book={p.best.book} link={p.best.link} />}
          </div>
        </div>
      ))}
      {ls.length > 0 && (
        <>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.12em', margin: '12px 0 6px' }}>LINE SHOP · NO SHARP ANCHOR</div>
          {ls.map((p, i) => (
            <div key={i} onClick={() => logProp(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 12px', marginBottom: '6px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontFamily: R, fontSize: '12px', color: TEXT }}>{p.player} {p.side} {p.point} <span style={{ color: MUTED, fontSize: '10px' }}>· {p.marketLabel}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{fmtAm(p.best.price)}</span>
                {p.best.link && <BetLink book={p.best.book} link={p.best.link} />}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Build-check** — `npx vite build` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/MatrixBot.jsx
git commit -m "feat(props): PROPS tab in LookChannel + Bet-at-book links on edges"
```

---

## Task 7: SW bump + verify + deploy

**Files:** Modify `public/sw.js`

- [ ] **Step 1: Bump** `const CACHE = 'rml-v88'` → `'rml-v89'`.

- [ ] **Step 2: Full build + test** — `npx vite build && npx vitest run` → build succeeds; all green (137 + ~6 new).

- [ ] **Step 3: Commit + push + deploy**

```bash
git add public/sw.js && git commit -m "chore(props): SW rml-v89 for props release"
git push origin main
npx vercel deploy --prod --force
```

- [ ] **Step 4: Verify prod SW** — `curl -s "https://app.riskmatrixlabs.com/sw.js?cb=$(date +%s)" | grep -m1 "const CACHE"` → `rml-v89`.

- [ ] **Step 5: On-device** (owner): open a pre-game game in the Bot → CH2 LOOK → PROPS → SCAN PROPS → confirm +EV props + line-shop group + "Bet at \<book\>" buttons.

---

## Self-Review (against the spec)

- **§3 per-event flow (free /events → paid event-odds):** Task 4 (`fetchSportEvents`, `fetchEventOdds`) + Task 5 endpoint. ✅
- **§4 engine (group player+line, Pinnacle de-vig, best price, EV; no-sharp → line-shop only):** Task 3 `propEdges` + tests. ✅
- **§5 adapter keeps description/link, includeLinks on fetchOdds:** Task 4 Steps 1–2. ✅
- **§6 scan-props endpoint, auth, pre-game:** Task 5. ✅
- **§7 PROPS tab in LookChannel, scan button, ranked cards, honest empty, tap-to-log:** Task 6 Steps 4–5. ✅
- **§8 prop market map + labels:** Task 2. ✅
- **§9 gating (one flag):** access already gated by login/paywall + `token` (PropsPanel returns null without token); a dedicated `propsEnabled` flag is a one-line future gate — noted, not built (YAGNI for "included now"). ✅
- **§10 bet-links + affiliate passthrough:** Task 1 `betLinks.decorate` + Task 6 `BetLink` on feed + props. ✅
- **§11 credit discipline (per-event, on-demand):** Task 5 (no slate-wide props) + scan-on-tap UI. *(Per-game cache deferred — each scan is one explicit tap; add scanCache keyed by game if owner sees re-charge friction.)* ✅
- **§13 success path:** Task 7 Step 5. ✅

**Type consistency:** `propEdges` edge shape `{player, market, marketLabel, side, point, best:{book,price,link}, evPct, fairProb, sharpHoldPct}` is consumed identically in `scan-props.js` and `PropsPanel`. `decorate(book, url)` and `BetLink({book, link})` match. ✅

**Note on §9/§11 deviations:** dedicated `propsEnabled` flag and per-game prop cache were intentionally trimmed (YAGNI) — login+token already gates access, and prop scans are explicit single taps. Both are one-small-change additions if needed later.
