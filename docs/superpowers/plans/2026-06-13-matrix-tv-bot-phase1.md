# Matrix TV Bot — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone retro-broadcast-TV **"Bot" tab** that scans every sportsbook for best prices + real +EV game-line edges (FREE), lets the operator swipe games + filter, drills into a multi-book line view, and flows picks into RML's existing discipline/bankroll/CLV tracking — without wasting API credits.

**Architecture:** One new top-level tab component `src/components/MatrixBot.jsx` rendered from `App.jsx` exactly like `LiveCenter` is. It is a 3-channel state machine over one retro-TV skin: **CH1 FIND** (slate scan → filtered edge feed), **CH2 LOOK** (tap a play → multi-book line table + ML movement chart), **CH3 TRACK** (logged bets graded for EV/CLV). All heavy lifting reuses already-built, already-tested engine code (`src/lib/oddsEdge.js`, `src/lib/edgeFilter.js`), endpoints (`api/scan-edges.js`, `api/game-lines.js`), and discipline libs (`src/lib/betMatch.js`, `src/lib/clv.js`, `src/lib/oddsHistory.js`). New pure logic (cache, grouping, feed filters) is TDD'd; the React shell follows the repo convention of inline styles + lib-level tests.

**Tech Stack:** React 18 + Vite, inline-style design system (brand `#BDFF00` / `#0A0A0A` / `#FF3B3B`, Rajdhani), Vitest, The Odds API via the swappable provider adapter, Supabase `events` + `odds_history` reads.

---

## Design decisions locked (from spec `docs/superpowers/specs/2026-06-13-matrix-tv-bot-design.md`)

- **Credits:** tap-to-scan only (no polling). Pre-game gate already enforced server-side in `edgeFilter.gameEdges`. Client caches each scan by `sport+date` so re-selecting a sport never re-charges. Always surface "scans left".
- **Markets:** Phase 1 = game lines, `h2h` (moneyline) edges — that is what `api/scan-edges.js` returns today. Spread/total comparison still appears in CH2 (the `game-lines` endpoint already returns h2h/spreads/totals). Props = Phase 2 (pill shown but disabled with a `PRO` badge).
- **Game slider source:** Supabase `events` (FREE — `fetchEvents`), NOT the paid odds feed. Credits are spent only on scan/compare.
- **Line-movement chart (CH2):** launch = whatever ML history exists in `odds_history` (`fetchLineMovement`), rendered with the existing `Sparkline`. Full multi-book history is out of scope for Phase 1 (spec §9).
- **DRY:** extract the small shared UI primitives currently trapped inside `LiveCenter.jsx` (`fmtAm`, `BOOK_NAMES`, `SPREAD_LABEL`, `Sparkline`, `InfoLabel`) into a new shared module and import them from both files.

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/components/botShared.jsx` | **Create** | Shared UI primitives: `fmtAm`, `BOOK_NAMES`, `SPREAD_LABEL`, `Sparkline`, `InfoLabel`, color tokens. Imported by both `LiveCenter.jsx` and `MatrixBot.jsx`. |
| `src/lib/botFeed.js` | **Create** | Pure logic: `groupEdgesByGame(edges)`, `applyFeedFilters(edges, opts)`, `gameKey(awayOrEdge, home?)`. TDD'd. |
| `src/lib/scanCache.js` | **Create** | In-memory scan-result cache keyed by `sport:date` (credit guard). TDD'd. |
| `src/components/MatrixBot.css` | **Create** | Retro-TV skin: scanline overlay, CRT bezel, `ON AIR`/channel-tune keyframes (things inline styles can't express). |
| `src/components/MatrixBot.jsx` | **Create** | The Bot tab: 3-channel retro-TV shell wiring engine + endpoints + discipline. |
| `tests/bot-feed.test.js` | **Create** | Unit tests for `botFeed.js`. |
| `tests/scan-cache.test.js` | **Create** | Unit tests for `scanCache.js`. |
| `src/App.jsx` | **Modify** | Register the `bot` tab: `TAB_ORDER` (~2371), desktop tab bar (~3746), mobile bottom nav (~4704), content switch (~4656). |
| `src/components/LiveCenter.jsx` | **Modify** | Replace local copies of the extracted primitives with imports from `botShared.jsx` (DRY cleanup; last, optional-to-defer). |
| `public/sw.js` | **Modify** | Bump `CACHE` const `rml-v85` → `rml-v86`. |

---

## Reference: shapes this plan depends on (verified in code, do not re-derive)

**Edge object** (from `edgeFilter.gameEdges` → `scan-edges.js` `edges[]`):
```js
{
  outcome: 'Chicago Cubs',     // team name (h2h) — the side to bet
  best: { book: 'betfair_ex_uk', price: 126, decimal: 2.26 },
  evPct: 6.2,                  // true EV % vs sharp fair
  sharpHoldPct: 2.1,          // sharp book's hold on this market
  fairProb: 0.47,
  sport: 'baseball_mlb',      // provider sport_key (NOT 'MLB')
  away: 'Chicago Cubs',
  home: 'San Francisco Giants',
  commenceTime: '2026-06-13T...Z',
  market: 'h2h',
}
```

**`/api/scan-edges?sport=MLB`** (auth: `Authorization: Bearer <token>`) → `{ sport, provider, gameCount, creditsRemaining, edges:[...], scannedAt }`. `edges:[]` is the honest "NO VALID MATRIX" answer.

**`/api/game-lines?sport=MLB&away=<name>&home=<name>`** → `{ found, away, home, markets:{ h2h, spreads, totals }, creditsRemaining }` where each market = `{ outcomes, rows:[{book,sharp,prices,points}], modalPoint, best } | null`.

**`fetchEvents(sport, date='today')`** from `src/lib/events.js` → array of event rows: `{ external_event_id, sport, league, start_time, status, home_team, away_team, home_abbr, away_abbr, home_score, away_score, ... }`. `status` `'NS'` = pre-game; `'IP'/'LIVE'` = live; `'FT'` = final.

**`fetchLineMovement(externalEventId)`** from `src/lib/oddsHistory.js` → grouped-by-market+side movement objects, each with a numeric `series` for `Sparkline`.

**`matchBetToEvent(bet, event)`** and **`evaluateBet(bet, event, dvs)`** from `src/lib/betMatch.js` → CLV/EV grading for a logged bet against an event.

**App.jsx wiring facts:** `unitSize` to pass = `stats.unitSize`. `onLogPosition` = `handleLogPosition` (signature `(event, { pick, odds })`). `token` and `bets` are already in scope where `LiveCenter` is rendered (line ~4656).

---

## Task 1: Extract shared UI primitives into `botShared.jsx`

**Files:**
- Create: `src/components/botShared.jsx`

- [ ] **Step 1: Create the module** with the exact primitives copied verbatim from `LiveCenter.jsx` (lines 9-21, 688-704, 719-739, 1044-1049).

```jsx
// Shared retro UI primitives used by both LiveCenter (Insights) and MatrixBot (Bot tab).
// Kept tiny and dependency-light so either screen can import without circular refs.
import { useState } from 'react'

export const NEON   = '#BDFF00'
export const NEON_T = 'var(--neon-title)'
export const R      = 'Rajdhani, sans-serif'
export const MUTED  = 'var(--muted)'
export const CARD   = 'var(--card)'
export const BORDER = 'var(--border2)'
export const TEXT   = 'var(--text)'
export const DANGER = '#FF3B3B'

export const SPREAD_LABEL = { MLB: 'Run Line', NHL: 'Puck Line', NBA: 'Spread', WNBA: 'Spread', NFL: 'Spread' }

export const BOOK_NAMES = {
  pinnacle: 'Pinnacle', draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM',
  williamhill_us: 'Caesars', betfair_ex_uk: 'Betfair', betfair_ex_eu: 'Betfair', hardrockbet: 'Hard Rock',
}

export const fmtAm = (n) => (n > 0 ? `+${n}` : `${n}`)

export function Sparkline({ series, color }) {
  if (!series || series.length < 2) return null
  const min = Math.min(...series), max = Math.max(...series)
  const range = max - min || 1
  const w = 120, h = 28, pad = 3
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '26px', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function InfoLabel({ label, tip, center = false }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={center ? { textAlign: 'center' } : undefined}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {label}
        {tip && (
          <button
            type="button"
            aria-label="What does this mean?"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ width: '15px', height: '15px', flexShrink: 0, borderRadius: '50%', border: `1px solid ${open ? NEON_T : MUTED}`, background: open ? 'rgba(189,255,0,0.12)' : 'transparent', color: open ? NEON_T : MUTED, fontSize: '10px', fontWeight: 700, lineHeight: 1, fontFamily: 'Georgia, serif', fontStyle: 'italic', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >i</button>
        )}
      </span>
      {open && tip && (
        <div style={{ marginTop: '7px', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{tip}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/michaeltejeda/Desktop/risk-matrix-labs && npx vite build`
Expected: build succeeds (no import errors). The module is not yet imported anywhere; this just confirms valid syntax.

- [ ] **Step 3: Commit**

```bash
git add src/components/botShared.jsx
git commit -m "feat(bot): extract shared retro UI primitives into botShared.jsx"
```

---

## Task 2: `botFeed.js` — pure feed logic (TDD)

**Files:**
- Create: `src/lib/botFeed.js`
- Test: `tests/bot-feed.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { gameKey, groupEdgesByGame, applyFeedFilters } from '../src/lib/botFeed.js'

const edge = (over) => ({ outcome: 'Cubs', away: 'Chicago Cubs', home: 'San Francisco Giants', evPct: 6.2, market: 'h2h', best: { book: 'betfair_ex_uk', price: 126 }, ...over })

describe('gameKey', () => {
  it('builds a stable away@home key, case/space-insensitive', () => {
    expect(gameKey('Chicago Cubs', 'San Francisco Giants')).toBe('chicago cubs@san francisco giants')
  })
  it('derives the key from an edge object', () => {
    expect(gameKey(edge())).toBe('chicago cubs@san francisco giants')
  })
})

describe('groupEdgesByGame', () => {
  it('groups edges under their game key and keeps highest EV first within a game', () => {
    const g = groupEdgesByGame([edge({ evPct: 2 }), edge({ evPct: 6.2 }), edge({ away: 'New York Mets', home: 'Atlanta Braves', evPct: 4 })])
    expect(g.length).toBe(2)
    expect(g[0].edges[0].evPct).toBe(6.2)        // games ordered by their best edge
    expect(g[0].edges[1].evPct).toBe(2)
    expect(g[1].away).toBe('New York Mets')
  })
  it('returns [] for no edges', () => {
    expect(groupEdgesByGame([])).toEqual([])
  })
})

describe('applyFeedFilters', () => {
  it('filters by minEvPct', () => {
    const out = applyFeedFilters([edge({ evPct: 1 }), edge({ evPct: 5 })], { minEvPct: 3 })
    expect(out.map(e => e.evPct)).toEqual([5])
  })
  it('scopes to a focused game key when provided', () => {
    const out = applyFeedFilters([edge(), edge({ away: 'New York Mets', home: 'Atlanta Braves' })], { focusKey: 'new york mets@atlanta braves' })
    expect(out.length).toBe(1)
    expect(out[0].away).toBe('New York Mets')
  })
  it('returns all when no opts', () => {
    expect(applyFeedFilters([edge(), edge()], {}).length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bot-feed.test.js`
Expected: FAIL — "does not provide an export named 'gameKey'".

- [ ] **Step 3: Write the implementation**

```js
// Pure helpers for the Bot FIND channel: identify a game, group edges under games,
// and apply the feed filter pills (min EV, focused game). No I/O — fully testable.

const norm = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')

// Accepts (away, home) strings OR a single edge/event object with .away/.home.
export function gameKey(awayOrObj, home) {
  if (awayOrObj && typeof awayOrObj === 'object') {
    return `${norm(awayOrObj.away)}@${norm(awayOrObj.home)}`
  }
  return `${norm(awayOrObj)}@${norm(home)}`
}

// → [{ key, away, home, commenceTime, edges:[...] }], games ordered by their best edge,
// edges within a game ordered highest EV first.
export function groupEdgesByGame(edges) {
  const map = new Map()
  for (const e of edges || []) {
    const key = gameKey(e)
    if (!map.has(key)) map.set(key, { key, away: e.away, home: e.home, commenceTime: e.commenceTime, edges: [] })
    map.get(key).edges.push(e)
  }
  const groups = [...map.values()]
  for (const g of groups) g.edges.sort((a, b) => b.evPct - a.evPct)
  groups.sort((a, b) => (b.edges[0]?.evPct ?? 0) - (a.edges[0]?.evPct ?? 0))
  return groups
}

// Filter the flat edge list by the active pills.
export function applyFeedFilters(edges, { minEvPct = 0, focusKey = null } = {}) {
  return (edges || []).filter(e =>
    e.evPct >= minEvPct &&
    (!focusKey || gameKey(e) === focusKey))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bot-feed.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/botFeed.js tests/bot-feed.test.js
git commit -m "feat(bot): pure feed grouping + filter logic"
```

---

## Task 3: `scanCache.js` — credit-guard cache (TDD)

**Files:**
- Create: `src/lib/scanCache.js`
- Test: `tests/scan-cache.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { cacheKey, getScan, putScan, clearScanCache } from '../src/lib/scanCache.js'

describe('scanCache', () => {
  beforeEach(() => clearScanCache())

  it('builds a key from sport + date', () => {
    expect(cacheKey('MLB', '2026-06-13')).toBe('MLB:2026-06-13')
  })
  it('returns null on a miss', () => {
    expect(getScan('MLB', '2026-06-13')).toBeNull()
  })
  it('stores and returns a scan result (no re-charge on re-read)', () => {
    const payload = { edges: [{ evPct: 6.2 }], creditsRemaining: 480 }
    putScan('MLB', '2026-06-13', payload)
    expect(getScan('MLB', '2026-06-13')).toEqual(payload)
  })
  it('isolates by sport and date', () => {
    putScan('MLB', '2026-06-13', { edges: [] })
    expect(getScan('NHL', '2026-06-13')).toBeNull()
    expect(getScan('MLB', '2026-06-14')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scan-cache.test.js`
Expected: FAIL — "does not provide an export named 'cacheKey'".

- [ ] **Step 3: Write the implementation**

```js
// In-memory cache of scan results so re-selecting a sport (same day) never re-charges
// API credits. Lives for the page session; cleared on reload (a fresh day = fresh key
// anyway). The credit guard the owner asked for: zero redundant calls.
const store = new Map()

export const cacheKey = (sport, date) => `${sport}:${date}`

export function getScan(sport, date) {
  return store.has(cacheKey(sport, date)) ? store.get(cacheKey(sport, date)) : null
}

export function putScan(sport, date, payload) {
  store.set(cacheKey(sport, date), payload)
}

export function clearScanCache() {
  store.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scan-cache.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanCache.js tests/scan-cache.test.js
git commit -m "feat(bot): in-memory scan cache (credit guard)"
```

---

## Task 4: Retro-TV skin CSS

**Files:**
- Create: `src/components/MatrixBot.css`

- [ ] **Step 1: Write the stylesheet**

```css
/* Retro broadcast-TV skin for the Matrix Bot tab. Inline styles handle layout/colors;
   this file carries the effects inline styles can't: scanlines, flicker, channel tune. */

.tvbot-bezel {
  position: relative;
  border-radius: 16px;
  background: #060606;
  border: 1px solid var(--border2);
  box-shadow: inset 0 0 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(189,255,0,0.06);
  overflow: hidden;
}

/* Faint moving scanlines over the screen content. */
.tvbot-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0px,
    rgba(0,0,0,0) 2px,
    rgba(0,0,0,0.18) 3px
  );
  z-index: 2;
  animation: tvbot-scan 8s linear infinite;
}

@keyframes tvbot-scan { from { background-position-y: 0; } to { background-position-y: 100px; } }

/* "ON AIR" dot. */
.tvbot-onair {
  display: inline-flex; align-items: center; gap: 6px;
}
.tvbot-onair .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #FF3B3B; box-shadow: 0 0 8px #FF3B3B;
  animation: tvbot-blink 1.4s steps(1) infinite;
}
@keyframes tvbot-blink { 0%,60% { opacity: 1; } 61%,100% { opacity: 0.25; } }

/* Channel-change flash when switching FIND/LOOK/TRACK. */
.tvbot-tune { animation: tvbot-tune 0.28s ease; }
@keyframes tvbot-tune {
  0% { opacity: 0.2; filter: brightness(2) blur(1px); transform: scale(1.01); }
  100% { opacity: 1; filter: none; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .tvbot-screen::before, .tvbot-onair .dot, .tvbot-tune { animation: none; }
}
```

- [ ] **Step 2: Verify it imports/builds** (after the component imports it in Task 5; for now just confirm valid CSS). Skip running here — covered by Task 5 build.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatrixBot.css
git commit -m "feat(bot): retro-TV skin stylesheet (scanlines, ON AIR, tune)"
```

---

## Task 5: `MatrixBot.jsx` — the 3-channel Bot tab

**Files:**
- Create: `src/components/MatrixBot.jsx`

This is the largest task. Build it in sub-steps, compiling after each. The component imports primitives from `botShared.jsx`, feed logic from `botFeed.js`, cache from `scanCache.js`, the skin from `MatrixBot.css`, and reuses `fetchEvents`, `fetchLineMovement`, `matchBetToEvent`, `evaluateBet`.

**Props signature (match how App wires LiveCenter):**
```jsx
export default function MatrixBot({ onLogPosition, bets = [], token = null, unitSize = 0 })
```

- [ ] **Step 1: Scaffold — imports, constants, shell, channel state machine**

```jsx
import { useState, useEffect, useMemo } from 'react'
import './MatrixBot.css'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER, BOOK_NAMES, SPREAD_LABEL, fmtAm, Sparkline } from './botShared.jsx'
import { fetchEvents } from '../lib/events.js'
import { fetchLineMovement } from '../lib/oddsHistory.js'
import { matchBetToEvent, evaluateBet } from '../lib/betMatch.js'
import { groupEdgesByGame, applyFeedFilters, gameKey } from '../lib/botFeed.js'
import { getScan, putScan } from '../lib/scanCache.js'

const SPORTS = ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL']
const todayStr = () => new Date().toISOString().slice(0, 10)
const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
const isPreGame = (ev) => ev.status === 'NS' || ev.status === 'STATUS_SCHEDULED'

export default function MatrixBot({ onLogPosition, bets = [], token = null, unitSize = 0 }) {
  const [channel, setChannel] = useState('find')   // find | look | track
  const [sport, setSport]     = useState('MLB')

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 12px 90px' }}>
      <ChannelChrome channel={channel} setChannel={setChannel} />
      <div key={channel} className="tvbot-bezel tvbot-tune" style={{ marginTop: '12px' }}>
        <div className="tvbot-screen" style={{ position: 'relative', padding: '14px' }}>
          {channel === 'find'  && <FindChannel sport={sport} setSport={setSport} token={token} unitSize={unitSize} onPick={() => {}} />}
          {channel === 'look'  && <LookPlaceholder />}
          {channel === 'track' && <TrackChannel bets={bets} sport={sport} />}
        </div>
      </div>
    </div>
  )
}

function LookPlaceholder() {
  return <div style={{ textAlign: 'center', color: MUTED, fontFamily: R, fontSize: '12px', padding: '24px' }}>Pick a play on CH 1 to tune in.</div>
}
```

- [ ] **Step 2: Add `ChannelChrome`** (the retro channel selector — CH1 FIND / CH2 LOOK / CH3 TRACK + ON AIR)

```jsx
function ChannelChrome({ channel, setChannel }) {
  const tabs = [['find', 'CH 1 · FIND'], ['look', 'CH 2 · LOOK'], ['track', 'CH 3 · TRACK']]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.2em', color: NEON_T }}>MATRIX TV BOT</span>
        <span className="tvbot-onair">
          <span className="dot" />
          <span style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', letterSpacing: '0.14em', color: DANGER }}>ON AIR</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setChannel(k)} style={{
            flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: 'pointer',
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            border: `1px solid ${channel === k ? NEON : BORDER}`,
            background: channel === k ? 'rgba(189,255,0,0.1)' : 'transparent',
            color: channel === k ? NEON_T : MUTED,
          }}>{label}</button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `FindChannel`** — sport pills, game slider (free `fetchEvents`), filter pills, RUN SCAN (cached), edge feed. `onPick(game, edge)` bubbles up to switch to LOOK (wired in Step 6).

```jsx
function FindChannel({ sport, setSport, token, unitSize, onPick }) {
  const [events, setEvents]   = useState([])
  const [focusKey, setFocus]  = useState(null)     // null = ALL GAMES
  const [minEv, setMinEv]     = useState(0)
  const [status, setStatus]   = useState('idle')   // idle | scanning | done | error
  const [scan, setScan]       = useState(null)     // { edges, creditsRemaining }
  const [err, setErr]         = useState('')

  // Game slider from Supabase (free). Reset focus + scan when sport changes.
  useEffect(() => {
    let live = true
    setFocus(null); setScan(getScan(sport, todayStr())); setStatus(getScan(sport, todayStr()) ? 'done' : 'idle')
    fetchEvents(sport, 'today').then(rows => { if (live) setEvents(rows || []) }).catch(() => {})
    return () => { live = false }
  }, [sport])

  const preGames = events.filter(isPreGame)

  async function runScan() {
    if (!token || status === 'scanning') return
    const cached = getScan(sport, todayStr())
    if (cached) { setScan(cached); setStatus('done'); return }      // credit guard: no re-charge
    setStatus('scanning'); setErr('')
    try {
      const res = await fetch(`/api/scan-edges?sport=${encodeURIComponent(sport)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `scan ${res.status}`)
      const data = await res.json()
      const payload = { edges: data.edges || [], creditsRemaining: data.creditsRemaining }
      putScan(sport, todayStr(), payload)
      setScan(payload); setStatus('done')
    } catch (e) { setErr(e.message); setStatus('error') }
  }

  const edges = useMemo(() => applyFeedFilters(scan?.edges || [], { minEvPct: minEv, focusKey }), [scan, minEv, focusKey])
  const groups = useMemo(() => groupEdgesByGame(edges), [edges])

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* sport pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {SPORTS.map(s => (
          <button key={s} onClick={() => setSport(s)} style={pill(sport === s)}>{s}</button>
        ))}
      </div>

      {/* game slider */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 0' }}>
        <button onClick={() => setFocus(null)} style={chip(focusKey === null)}>ALL GAMES</button>
        {preGames.map(ev => {
          const k = gameKey(ev.away_team, ev.home_team)
          return <button key={ev.external_event_id} onClick={() => setFocus(k)} style={chip(focusKey === k)}>
            <span style={{ fontWeight: 700 }}>{ev.away_abbr} @ {ev.home_abbr}</span>
            <span style={{ display: 'block', fontSize: '8px', color: MUTED }}>{(ev.start_time || '').slice(11, 16)}</span>
          </button>
        })}
      </div>

      {/* filter pills */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>MIN EV</span>
        {[0, 2, 5].map(v => <button key={v} onClick={() => setMinEv(v)} style={pill(minEv === v)}>{v === 0 ? 'ANY' : `${v}%+`}</button>)}
        <span style={{ ...pill(false), opacity: 0.5, cursor: 'not-allowed' }}>PROPS <b style={{ color: NEON_T }}>PRO</b></span>
      </div>

      {/* scan control + feed */}
      {!token && <Empty text="Log in to summon the bot — scans use credits." />}
      {token && status === 'idle' && (
        <ScanButton onClick={runScan} disabled={preGames.length === 0}
          label={preGames.length ? 'RUN SCAN' : 'NO PRE-GAME GAMES RIGHT NOW'} />
      )}
      {token && status === 'scanning' && <div style={{ textAlign: 'center', padding: '22px', fontFamily: 'Courier New, monospace', fontSize: '12px', color: NEON_T, letterSpacing: '0.1em' }}>SCANNING EVERY BOOK…</div>}
      {token && status === 'error' && <div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Scan failed — {err} <button onClick={runScan} style={{ ...pill(false), marginLeft: '8px' }}>RETRY</button></div>}

      {token && status === 'done' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.1em' }}>{groups.length ? `${edges.length} MATRIX${edges.length > 1 ? 'ES' : ''} FOUND` : 'NO VALID MATRIX'}</span>
            <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{scan?.creditsRemaining != null ? `${scan.creditsRemaining} scans left` : ''} · <button onClick={runScan} style={{ background: 'none', border: 'none', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '9px' }}>RE-SCAN</button></span>
          </div>
          {groups.length === 0 && <Empty text="Market's efficient right now — we won't fake an edge." />}
          {groups.map(g => g.edges.map((e, i) => (
            <FeedRow key={g.key + i} game={g} edge={e} unitSize={unitSize} onClick={() => onPick(g, e)} />
          )))}
        </>
      )}
    </div>
  )
}

const pill = (active) => ({ flexShrink: 0, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', border: `1px solid ${active ? NEON : BORDER}`, background: active ? NEON : 'transparent', color: active ? '#0A0A0A' : MUTED })
const chip = (active) => ({ flexShrink: 0, padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontFamily: R, fontSize: '11px', textAlign: 'center', border: `1px solid ${active ? NEON : BORDER}`, background: active ? 'rgba(189,255,0,0.1)' : CARD, color: active ? NEON_T : TEXT })

function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '20px 12px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.04em' }}>{text}</div>
}

function ScanButton({ onClick, disabled, label }) {
  return <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '12px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: `1px solid ${disabled ? BORDER : NEON}`, background: 'transparent', color: disabled ? MUTED : NEON_T }}>{label}</button>
}

function FeedRow({ game, edge, unitSize, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer', background: CARD, border: `1px solid ${NEON}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: TEXT }}>{edge.outcome}</div>
        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{game.away} @ {game.home} · {BOOK_NAMES[edge.best.book] || edge.best.book}</div>
        {unitSize > 0 && <div style={{ fontFamily: R, fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>Size 1u · ${Math.round(unitSize)}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: NEON_T }}>{fmtAm(edge.best.price)}</div>
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>+{edge.evPct.toFixed(1)}% EV</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `TrackChannel`** — logged bets graded for EV/CLV against today's events (reuses `betMatch`).

```jsx
function TrackChannel({ bets, sport }) {
  const [events, setEvents] = useState([])
  useEffect(() => {
    let live = true
    fetchEvents(sport, 'today').then(r => { if (live) setEvents(r || []) }).catch(() => {})
    return () => { live = false }
  }, [sport])

  const graded = useMemo(() => {
    const out = []
    for (const b of bets || []) {
      const ev = events.find(e => matchBetToEvent(b, e))
      if (ev) out.push({ bet: b, ev, grade: evaluateBet(b, ev, null) })
    }
    return out
  }, [bets, events])

  if (!graded.length) return <Empty text="No graded positions for today's slate yet. Log a play on CH 1 and it shows here with CLV." />
  return (
    <div>
      <div style={{ fontFamily: R, fontSize: '11px', letterSpacing: '0.16em', color: NEON_T, marginBottom: '10px' }}>BEAT THE CLOSE</div>
      {graded.map(({ bet, ev, grade }, i) => (
        <div key={i} style={{ padding: '11px 12px', marginBottom: '8px', borderRadius: '10px', background: CARD, border: `1px solid ${BORDER}` }}>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: TEXT }}>{bet.pick || bet.event}</div>
          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>{ev.away_team} @ {ev.home_team}</div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
            {grade?.evPct != null && <Stat label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
            {grade?.clvPct != null && <Stat label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, good }) {
  return <div><div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>{label}</div><div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: good ? NEON_T : DANGER }}>{value}</div></div>
}
```

> NOTE on `evaluateBet(b, ev, null)`: pass the de-vig-stats arg as `null` if not readily available here — confirm `evaluateBet`'s third param is optional during implementation (it is used for win-prob in the Insights card). If it is required, compute `dvs` the same way `LiveCenter.jsx` does before calling, or render only the fields that don't need it. **Implementer: read `src/lib/betMatch.js:92` first and match its real signature; do not guess.**

- [ ] **Step 5: Build-check the component so far**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 6: Wire CH2 LOOK** — lift `focused` state into the parent, implement `LookChannel` (multi-book table via `/api/game-lines` + ML movement via `fetchLineMovement` + BET via `onLogPosition`), and replace `LookPlaceholder`.

Replace the parent's channel state usage so `onPick` stores the selected game/edge and switches channel:

```jsx
// in MatrixBot(): add
const [focused, setFocused] = useState(null)   // { game, edge }
// ...
{channel === 'find'  && <FindChannel sport={sport} setSport={setSport} token={token} unitSize={unitSize}
   onPick={(game, edge) => { setFocused({ game, edge }); setChannel('look') }} />}
{channel === 'look'  && <LookChannel focused={focused} sport={sport} token={token} onLogPosition={onLogPosition} onBack={() => setChannel('find')} />}
```

`LookChannel` (multi-book table mirrors the proven `LineShop` render; movement uses `fetchLineMovement` + `Sparkline`):

```jsx
function LookChannel({ focused, sport, token, onLogPosition, onBack }) {
  const [status, setStatus] = useState('idle')   // idle | loading | done | error
  const [data, setData]     = useState(null)
  const [mkt, setMkt]       = useState('h2h')
  const [move, setMove]     = useState(null)
  const [err, setErr]       = useState('')
  const dec = (p) => p == null ? null : (p > 0 ? 1 + p / 100 : 1 + 100 / -p)

  const game = focused?.game
  useEffect(() => {
    if (!game || !token) return
    let live = true
    setStatus('loading'); setErr('')
    fetch(`/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => { if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `lines ${res.status}`); return res.json() })
      .then(j => { if (live) { setData(j.found && j.markets ? j : null); setStatus('done') } })
      .catch(e => { if (live) { setErr(e.message); setStatus('error') } })
    // ML movement (free — odds_history). game.commenceTime/event id may be absent on an edge; guard.
    const evId = focused?.game?.external_event_id
    if (evId) fetchLineMovement(evId).then(m => { if (live) setMove(m) }).catch(() => {})
    return () => { live = false }
  }, [game, sport, token])

  if (!game) return <LookPlaceholder />
  const back = <button onClick={onBack} style={{ ...pill(false), marginBottom: '10px' }}>← CH 1</button>

  if (status === 'loading') return <>{back}<div style={{ textAlign: 'center', padding: '20px', fontFamily: 'Courier New, monospace', fontSize: '11px', color: MUTED }}>TUNING IN…</div></>
  if (status === 'error')   return <>{back}<div style={{ textAlign: 'center', padding: '16px', color: DANGER, fontFamily: R, fontSize: '11px' }}>Failed — {err}</div></>
  if (!data)                return <>{back}<Empty text="No book lines for this game (pre-game only)." /></>

  const M = data.markets
  const tabDefs = [['h2h', 'ML'], ['spreads', SPREAD_LABEL[sport] || 'Spread'], ['totals', 'Total']].filter(([k]) => M[k])
  const activeKey = M[mkt] ? mkt : tabDefs[0]?.[0]
  const cmp = M[activeKey]
  const isTotals = activeKey === 'totals'
  const cols = !cmp ? [] : isTotals
    ? cmp.outcomes.map(n => ({ name: n, label: /^o/i.test(n) ? 'OVER' : 'UNDER' }))
    : [{ name: cmp.outcomes.find(n => lw(n) === lw(game.away)) || cmp.outcomes[0], label: game.away },
       { name: cmp.outcomes.find(n => lw(n) === lw(game.home)) || cmp.outcomes[1], label: game.home }]
  const sortName = cols[0]?.name
  const rows = !cmp ? [] : [...cmp.rows].sort((x, y) => (dec(y.prices[sortName]) ?? 0) - (dec(x.prices[sortName]) ?? 0))
  const fmtPt = (pt) => pt == null ? '' : (pt > 0 ? `+${pt}` : `${pt}`)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {back}
      <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT, marginBottom: '2px' }}>{game.away} @ {game.home}</div>
      <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginBottom: '10px', letterSpacing: '0.1em' }}>BY BOOK · BEST AVAILABLE</div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {tabDefs.map(([k, label]) => <button key={k} onClick={() => setMkt(k)} style={pill(activeKey === k)}>{label}</button>)}
      </div>

      {cmp && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '6px', fontFamily: R, fontSize: '9px', color: MUTED }}>BOOK</th>
            {cols.map(c => <th key={c.name} style={{ textAlign: 'center', padding: '6px', fontFamily: R, fontSize: '10px', color: MUTED }}>{isTotals ? c.label : (lw(c.label) === lw(game.away) ? game.away : game.home).split(' ').pop()}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.book} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: '7px 6px', fontFamily: R, fontSize: '12px', fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>{BOOK_NAMES[r.book] || r.book}{r.sharp && <span style={{ fontSize: '8px', color: NEON_T, marginLeft: '5px' }}>SHARP</span>}</td>
                {cols.map(c => {
                  const p = r.prices[c.name], pt = r.points[c.name]
                  const isBest = cmp.best[c.name] && cmp.best[c.name].book === r.book
                  const canLog = onLogPosition && p != null
                  const pick = isTotals ? `${/^o/i.test(c.name) ? 'Over' : 'Under'} ${pt}` : activeKey === 'spreads' ? `${c.label.split(' ').pop()} ${fmtPt(pt)}` : `${c.label.split(' ').pop()} ML`
                  return (
                    <td key={c.name} onClick={() => canLog && onLogPosition({ sport, away_team: game.away, home_team: game.home, league: sport, external_event_id: game.external_event_id || '', start_time: game.commenceTime }, { pick, odds: p })} style={{ textAlign: 'center', padding: '7px 6px', cursor: canLog ? 'pointer' : 'default' }}>
                      <span style={{ display: 'inline-block', padding: isBest ? '2px 7px' : '2px 0', borderRadius: '5px', background: isBest ? NEON : 'transparent' }}>
                        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: isBest ? '#0A0A0A' : TEXT }}>{p == null ? '—' : fmtAm(p)}</span>
                        {pt != null && <span style={{ display: 'block', fontFamily: R, fontSize: '9px', color: isBest ? 'rgba(10,10,10,0.6)' : MUTED }}>{isTotals ? (/^o/i.test(c.name) ? 'o' : 'u') + pt : fmtPt(pt)}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ML movement, if any history exists */}
      {Array.isArray(move) && move.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.1em', marginBottom: '6px' }}>LINE MOVEMENT</div>
          {move.filter(m => m.series && m.series.length >= 2).map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontFamily: R, fontSize: '11px', color: TEXT, width: '90px' }}>{m.side || m.market}</span>
              <div style={{ flex: 1 }}><Sparkline series={m.series} color={NEON} /></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, textAlign: 'center', marginTop: '10px' }}>Green = best price on the main line · tap a book to log the bet</div>
    </div>
  )
}
```

> NOTE: the `move` object shape (`.side`, `.market`, `.series`) must be confirmed against `oddsHistory.fetchLineMovement` during implementation — **read `src/lib/oddsHistory.js:16` and adapt the labels to the real keys.** The guard `m.series.length >= 2` means no history → nothing renders (acceptable for launch).

- [ ] **Step 7: Final build-check**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/MatrixBot.jsx
git commit -m "feat(bot): Matrix TV Bot tab — FIND/LOOK/TRACK channels"
```

---

## Task 6: Wire the `bot` tab into `App.jsx`

**Files:**
- Modify: `src/App.jsx` (~2371, ~3746, ~4656, ~4704) + import at top.

- [ ] **Step 1: Import the component** (near the other component imports at the top of `App.jsx`)

```jsx
import MatrixBot from './components/MatrixBot.jsx'
```

And add the `Tv` icon to the existing lucide-react import (find the existing `from 'lucide-react'` line and add `Tv`):

```jsx
// e.g. import { TrendingUp, Zap, BookMarked, BarChart3, Target, Sliders, Handshake, Radio, Tv } from 'lucide-react'
```

- [ ] **Step 2: Add to `TAB_ORDER`** (line ~2371) so swipe nav includes it

```jsx
const TAB_ORDER = ['overview', 'ladder', 'bet log', 'analytics', 'rr engine', 'session', 'partners', 'bot']
```

- [ ] **Step 3: Add to the desktop tab bar** (line ~3746) — put `bot` right after `live` so the two "live betting" surfaces sit together

```jsx
{[['live','Live'],['bot','Bot'],['overview','Analytics'],['ladder','Ladder'],['bet log','Bet Log'],['analytics','Overview'],['rr engine','RR Engine'],['session','Session'],['partners','Partners']].map(([t, label]) => (
```

- [ ] **Step 4: Add the content switch** (immediately after the `tab === 'live'` block, ~line 4656)

```jsx
{tab === 'bot' && <MatrixBot onLogPosition={handleLogPosition} bets={bets} token={token} unitSize={stats.unitSize} />}
```

- [ ] **Step 5: Add to the mobile "More" sheet** (line ~4676) so phone users can reach it without crowding the 7-icon bottom bar

```jsx
{[
  { id: 'bot',       label: 'Bot',       icon: Tv },
  { id: 'live',      label: 'Live',      icon: Radio },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'session',   label: 'Session',   icon: Sliders },
].map(({ id, label, icon: Icon }) => (
```

> Bottom-nav placement is a product call (the bar already holds 7). Default here = Bot in the "More" sheet (top, with `Tv` icon). If the owner wants Bot promoted onto the primary bar, swap it in for a lower-priority item there. Confirm with owner before finalizing.

- [ ] **Step 6: Build + run the test suite**

Run: `npx vite build && npx vitest run`
Expected: build succeeds; all tests green (existing 126 + 12 new = 138).

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat(bot): wire Matrix TV Bot tab into app navigation"
```

---

## Task 7: DRY cleanup — point `LiveCenter.jsx` at `botShared.jsx`

**Files:**
- Modify: `src/components/LiveCenter.jsx` (lines 9-21, 688-704, 719-739, 1044-1049)

> Do this last so a regression here never blocks the Bot. If time-constrained, this task can be deferred — the Bot works without it (the only cost is duplicated primitives).

- [ ] **Step 1: Add the import** at the top of `LiveCenter.jsx`

```jsx
import { Sparkline, InfoLabel, BOOK_NAMES, SPREAD_LABEL, fmtAm } from './botShared.jsx'
```

- [ ] **Step 2: Delete the now-duplicated local definitions** in `LiveCenter.jsx`: the local `SPREAD_LABEL` (line 21), `BOOK_NAMES` (1044-1048), `fmtAm` (1049), `Sparkline` (688-704), `InfoLabel` (719-739). **Keep** the color-token consts (`NEON`, `NEON_T`, `R`, `MUTED`, `CARD`, `BORDER`, `TEXT`) as-is — LiveCenter uses them throughout and re-importing risks name clashes; leave them local.

- [ ] **Step 3: Build + test to confirm no regression**

Run: `npx vite build && npx vitest run`
Expected: build succeeds; all tests green. Manually confirm in preview that the Insights tab (EVBot/LineShop/Sparkline/InfoLabel) still renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/LiveCenter.jsx
git commit -m "refactor(bot): LiveCenter imports shared primitives from botShared (DRY)"
```

---

## Task 8: SW bump + local prod verification + deploy

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Bump the SW cache** (mandatory every deploy — cache-first PWA)

In `public/sw.js`, change `const CACHE = 'rml-v85'` → `const CACHE = 'rml-v86'`.

- [ ] **Step 2: Local prod-build verification** (fill `.env.local` Supabase creds from the connector if blank; clear SW + caches between rebuilds)

Run: `npx vite build && npx vite preview --port 4173`
Then in the browser (logged in as owner): open the **Bot** tab → CH1 FIND → pick MLB → confirm game slider populates (free) → tap **RUN SCAN** on a pre-game slate → confirm feed or honest "NO VALID MATRIX" + "scans left" → tap a feed row → CH2 LOOK shows the multi-book table → CH3 TRACK lists any matched logged bets. Confirm re-selecting MLB does NOT re-charge (cache).

- [ ] **Step 3: Commit the SW bump**

```bash
git add public/sw.js
git commit -m "chore(bot): bump SW to rml-v86 for Bot tab release"
```

- [ ] **Step 4: Deploy** (only after owner confirms the local preview looks right)

Run: `npx vercel deploy --prod --force`
Expected: live in ~60s at app.riskmatrixlabs.com.

- [ ] **Step 5: Push to origin**

```bash
git push origin main
```

---

## Self-Review (against the spec)

- **§3 three channels (FIND/LOOK/TRACK):** Tasks 5 (FindChannel, TrackChannel, LookChannel) + ChannelChrome. ✅
- **§4 top game slider + filter pills + "ALL GAMES" + scan-everything→filter:** Task 5 Step 3 (slider from `fetchEvents`, MIN EV pills, ALL GAMES chip, props pill disabled). ✅
- **§4 feed row = bet + best book + EV% + suggested unit size + tap→LOOK:** `FeedRow` + `onPick`. ✅
- **§5 retro-TV aesthetic:** Task 4 CSS (scanlines/ON AIR/tune) + bezel/screen classes. ✅
- **§6 reuse engine + endpoints + discipline:** scan-edges, game-lines, betMatch, clv, oddsHistory all reused; no engine rewrite. ✅
- **§7 credit discipline (pre-game only, cache, no blank, surface credits, tap-to-scan):** server pre-game gate + `scanCache` + "NO PRE-GAME GAMES" disabled button + "scans left" + RUN SCAN (no polling). ✅
- **§8 Phase 1 = game-line bot FREE; props = PRO pill disabled:** h2h only; PROPS pill shown disabled with PRO badge. ✅
- **§9 out of scope (no public splits; movement live-only):** no splits; movement renders only if `odds_history` has ≥2 points. ✅
- **§10 success path:** Task 8 Step 2 walks the exact end-to-end flow. ✅

**Open items the implementer MUST verify in code (flagged inline, do not guess):**
1. `evaluateBet` third-arg requirement (`src/lib/betMatch.js:92`) — TrackChannel.
2. `fetchLineMovement` return shape keys (`src/lib/oddsHistory.js:16`) — LookChannel movement labels.
3. The exact lucide-react import line in `App.jsx` to append `Tv`.
4. Whether `events` rows carry `external_event_id` reliably for the focused game so `fetchLineMovement` + `onLogPosition` get a real id (they should — it's the table PK).
</content>
</invoke>
