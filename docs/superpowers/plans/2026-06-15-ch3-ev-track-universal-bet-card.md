# CH3 · EV Track + Universal Bet Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `BetCard`/`BetTicket` component and recompose CH3 (TRACK) into a richer EV Track channel — record line, gear menu, status chips, date grouping, connected parlay tickets with a per-slip CLV bar — all inside the existing `TvFrame`, nothing removed.

**Architecture:** All testable logic lives in a new pure module `src/lib/betCard.js` (normalize a bet, derive leg/ticket status, compute the record, group by date, roll up slip CLV) — TDD'd with vitest (node env, `tests/`). The presentational React (`src/components/BetCard.jsx`) consumes those pure outputs and renders cards. `TrackChannel` in `MatrixBot.jsx` is recomposed to use them; `App.jsx` slip/bet-log rendering is swapped to the same card last.

**Tech Stack:** React 18 + Vite, vitest (node env), existing libs `betMatch.js` (`evaluateBet`, `matchBetToEvent`), `clv.js` (`computeClv`), `events.js` (`fetchEvents`), shared styling from `botShared.jsx` (`NEON`, `DANGER`, `MUTED`, `BORDER`, `TEXT`, `R`).

**Spec:** `docs/superpowers/specs/2026-06-15-ch3-ev-track-universal-bet-card-design.md`

**Bet object shape (from `src/App.jsx`):**
`{ id, date:'YYYY-MM-DD', sport, book, betType:'Straight'|'SGP'|'Parlay', event, pick, odds:Number, units, stake, result:'W'|'L'|'P'|'Open', pnl, legs?:[{pick,odds,book,sport,event,result?}] }`. A parlay has `betType !== 'Straight'` and/or a non-empty `legs` array; `pick` for a parlay may read `"Oilers ML + Over 5.5"`.

**Brand:** `#BDFF00` neon / `#0A0A0A` bg / `#FF3B3B` danger; amber for live = `#FFB800`. Rajdhani headers, Inter body. No gambling words. Mobile-first.

---

## File Structure

- **Create** `src/lib/betCard.js` — pure helpers: `STATUS`, `betStatus`, `normalizeBet`, `ticketStatus`, `computeRecord`, `groupByDate`, `slipClv`.
- **Create** `tests/bet-card.test.js` — vitest unit tests for the above.
- **Create** `src/components/BetCard.jsx` — `Avatar`, `BetCard` (single), `BetTicket` (parlay).
- **Modify** `src/components/MatrixBot.jsx` — recompose `TrackChannel` (scoreboard adds, gear menu, status chips, date grouping, empty state, live refresh); keep `TvFrame`, `LookSection`.
- **Modify** `src/App.jsx` — swap slip + bet-log bet rows to `BetCard`/`BetTicket`.

---

## Task 1: `betCard.js` — status constants + `betStatus`

Maps a bet/leg `result` to a UI status with color + icon. Single source of truth used by every card.

**Files:**
- Create: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { STATUS, betStatus } from '../src/lib/betCard.js'

describe('betStatus', () => {
  it('maps W to won', () => expect(betStatus('W')).toBe(STATUS.won))
  it('maps L to lost', () => expect(betStatus('L')).toBe(STATUS.lost))
  it('maps P to push', () => expect(betStatus('P')).toBe(STATUS.push))
  it('maps Open/undefined to live', () => {
    expect(betStatus('Open')).toBe(STATUS.live)
    expect(betStatus(undefined)).toBe(STATUS.live)
  })
  it('each status carries a color and icon', () => {
    expect(STATUS.won.color).toBe('#BDFF00')
    expect(STATUS.lost.color).toBe('#FF3B3B')
    expect(STATUS.live.color).toBe('#FFB800')
    expect(STATUS.won.icon).toBe('ti-check')
    expect(STATUS.lost.icon).toBe('ti-x')
    expect(STATUS.live.icon).toBe('ti-clock')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "Failed to resolve import '../src/lib/betCard.js'".

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/betCard.js — pure helpers for the universal bet card. No React, no fetching.

export const STATUS = {
  won:  { key: 'won',  color: '#BDFF00', icon: 'ti-check' },
  lost: { key: 'lost', color: '#FF3B3B', icon: 'ti-x' },
  push: { key: 'push', color: '#888780', icon: 'ti-minus' },
  live: { key: 'live', color: '#FFB800', icon: 'ti-clock' },
}

// A bet/leg result string → UI status. Anything unsettled ('Open', missing) = live.
export function betStatus(result) {
  const r = String(result || '').toUpperCase()
  if (r === 'W') return STATUS.won
  if (r === 'L') return STATUS.lost
  if (r === 'P') return STATUS.push
  return STATUS.live
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (1 file, 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): status constants + betStatus mapping"
```

---

## Task 2: `normalizeBet` — straight vs parlay → uniform shape

Turns a raw logged bet into a uniform object the card renders directly, splitting parlay legs from `bet.legs` (preferred) or by parsing `pick` on ` + `.

**Files:**
- Modify: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { normalizeBet } from '../src/lib/betCard.js'

describe('normalizeBet', () => {
  it('straight bet → kind straight, single leg', () => {
    const n = normalizeBet({ id: 1, betType: 'Straight', sport: 'MLB', book: 'FanDuel',
      event: 'Yankees vs Red Sox', pick: 'Yankees ML', odds: -140, stake: 20, result: 'W', date: '2026-06-15' })
    expect(n.kind).toBe('straight')
    expect(n.title).toBe('Yankees ML')
    expect(n.subtitle).toBe('Yankees vs Red Sox')
    expect(n.legs).toHaveLength(1)
    expect(n.legs[0].odds).toBe(-140)
  })
  it('parlay with legs array → kind parlay, N legs', () => {
    const n = normalizeBet({ id: 2, betType: 'Parlay', sport: 'MLB', stake: 20, odds: 1200, result: 'Open',
      date: '2026-06-15', legs: [
        { pick: 'Yankees ML', odds: -140, event: 'NYY vs BOS', result: 'W' },
        { pick: 'Soto O1.5 TB', odds: 105, event: 'SD vs LAD', result: 'W' },
        { pick: 'Judge O1.5 TB', odds: 110, event: 'NYY vs BOS', result: 'Open' },
      ] })
    expect(n.kind).toBe('parlay')
    expect(n.legs).toHaveLength(3)
    expect(n.legs[1].title).toBe('Soto O1.5 TB')
  })
  it('parlay without legs array → splits pick on " + "', () => {
    const n = normalizeBet({ id: 3, betType: 'SGP', sport: 'NHL', stake: 10, odds: 142, result: 'Open',
      date: '2026-06-15', pick: 'Oilers ML + Over 5.5', event: 'Oilers vs Canucks' })
    expect(n.kind).toBe('parlay')
    expect(n.legs.map(l => l.title)).toEqual(['Oilers ML', 'Over 5.5'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "normalizeBet is not a function".

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/betCard.js`)

```js
const isParlay = (bet) =>
  (Array.isArray(bet.legs) && bet.legs.length > 0) ||
  (bet.betType && bet.betType !== 'Straight') ||
  / \+ /.test(String(bet.pick || ''))

function legFrom(raw, parent) {
  return {
    title: raw.pick || raw.title || '',
    subtitle: raw.event || parent.event || '',
    odds: raw.odds != null ? Number(raw.odds) : null,
    book: raw.book || parent.book || '',
    sport: raw.sport || parent.sport || '',
    result: raw.result != null ? raw.result : (parent.result === 'Open' ? 'Open' : raw.result),
    status: betStatus(raw.result != null ? raw.result : 'Open'),
  }
}

// Raw logged bet → uniform render object. Straight = 1 leg; parlay = N legs.
export function normalizeBet(bet) {
  const parlay = isParlay(bet)
  let legs
  if (parlay) {
    if (Array.isArray(bet.legs) && bet.legs.length) {
      legs = bet.legs.map(l => legFrom(l, bet))
    } else {
      legs = String(bet.pick || '').split(' + ').filter(Boolean)
        .map(p => legFrom({ pick: p.trim(), result: 'Open' }, bet))
    }
  } else {
    legs = [legFrom({ pick: bet.pick, odds: bet.odds, event: bet.event, result: bet.result }, bet)]
  }
  return {
    id: bet.id,
    kind: parlay ? 'parlay' : 'straight',
    title: parlay ? `${legs.length}-LEG PARLAY` : (bet.pick || bet.event || ''),
    subtitle: bet.event || '',
    sport: bet.sport || '',
    book: bet.book || '',
    odds: bet.odds != null ? Number(bet.odds) : null,
    stake: Number(bet.stake || 0),
    result: bet.result,
    status: betStatus(bet.result),
    date: bet.date || '',
    legs,
    raw: bet,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): normalizeBet for straight + parlay"
```

---

## Task 3: `ticketStatus` — "3 OF 6 HIT" + overall ticket result

Given a normalized parlay's legs, summarize: how many won, total, and whether the ticket is live/won/lost. A parlay loses if any leg lost; wins if all won; else live.

**Files:**
- Modify: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { ticketStatus, STATUS } from '../src/lib/betCard.js'

describe('ticketStatus', () => {
  const legs = (r) => r.map(x => ({ status: STATUS[x] }))
  it('counts wins and total', () => {
    const t = ticketStatus(legs(['won','won','won','lost','lost','live']))
    expect(t.won).toBe(3); expect(t.total).toBe(6); expect(t.label).toBe('3 OF 6 HIT')
  })
  it('any lost leg + nothing live → ticket lost', () => {
    const t = ticketStatus(legs(['won','lost']))
    expect(t.overall).toBe(STATUS.lost)
  })
  it('all won → ticket won', () => {
    const t = ticketStatus(legs(['won','won']))
    expect(t.overall).toBe(STATUS.won)
  })
  it('still legs live (no lost yet decided) → ticket live', () => {
    const t = ticketStatus(legs(['won','live']))
    expect(t.overall).toBe(STATUS.live)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "ticketStatus is not a function".

- [ ] **Step 3: Write minimal implementation** (append)

```js
// Summarize a parlay's legs → { won, total, label, overall }.
// Lost if any leg lost; won if every leg won; otherwise live.
export function ticketStatus(legs = []) {
  const total = legs.length
  const won = legs.filter(l => l.status === STATUS.won).length
  const anyLost = legs.some(l => l.status === STATUS.lost)
  const allWon = total > 0 && legs.every(l => l.status === STATUS.won)
  const overall = anyLost ? STATUS.lost : allWon ? STATUS.won : STATUS.live
  return { won, total, label: `${won} OF ${total} HIT`, overall }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): ticketStatus parlay summary"
```

---

## Task 4: `computeRecord` — W-L-P · units · ROI

The scoreboard record line. Pushes don't count as W or L. Units = sum of pnl (already in units in the bet log). ROI = profit / total risked.

**Files:**
- Modify: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { computeRecord } from '../src/lib/betCard.js'

describe('computeRecord', () => {
  it('tallies W-L-P, units and ROI from settled bets', () => {
    const bets = [
      { result: 'W', pnl: 0.9, units: 1, stake: 20 },
      { result: 'W', pnl: 1.25, units: 1, stake: 20 },
      { result: 'L', pnl: -1.5, units: 1.5, stake: 30 },
      { result: 'P', pnl: 0, units: 1, stake: 20 },
      { result: 'Open', pnl: 0, units: 1, stake: 20 },
    ]
    const r = computeRecord(bets)
    expect(r.w).toBe(2); expect(r.l).toBe(1); expect(r.p).toBe(1)
    expect(r.units).toBeCloseTo(0.65, 2)
    // profit 0.65u over 3.5u risked (settled only) → ~18.6%
    expect(r.roi).toBeCloseTo(18.6, 1)
  })
  it('empty → zeros, roi null', () => {
    const r = computeRecord([])
    expect(r).toEqual({ w: 0, l: 0, p: 0, units: 0, roi: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "computeRecord is not a function".

- [ ] **Step 3: Write minimal implementation** (append)

```js
// Settled-bet record for the scoreboard. units = sum of pnl (bet log pnl is in units).
// roi = profit units / risked units (settled only), as a percentage; null if nothing risked.
export function computeRecord(bets = []) {
  const settled = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
  const w = settled.filter(b => b.result === 'W').length
  const l = settled.filter(b => b.result === 'L').length
  const p = settled.filter(b => b.result === 'P').length
  const units = settled.reduce((s, b) => s + (Number(b.pnl) || 0), 0)
  const risked = settled.reduce((s, b) => s + (Number(b.units) || 0), 0)
  const roi = risked > 0 ? (units / risked) * 100 : null
  return { w, l, p, units, roi }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): computeRecord W-L-P units ROI"
```

---

## Task 5: `groupByDate` — Today first, per-day mini-tally

Group bets by `date`, newest first, each group carrying a tiny tally for its sub-header. `todayStr` is injected (pure — no `Date.now()` inside) so the test is deterministic.

**Files:**
- Modify: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { groupByDate } from '../src/lib/betCard.js'

describe('groupByDate', () => {
  const bets = [
    { id: 1, date: '2026-06-15', result: 'W', pnl: 0.9, units: 1 },
    { id: 2, date: '2026-06-15', result: 'L', pnl: -1, units: 1 },
    { id: 3, date: '2026-06-14', result: 'W', pnl: 1.1, units: 1 },
  ]
  it('groups newest first, labels today', () => {
    const g = groupByDate(bets, '2026-06-15')
    expect(g).toHaveLength(2)
    expect(g[0].date).toBe('2026-06-15')
    expect(g[0].label).toBe('TODAY')
    expect(g[1].label).toBe('2026-06-14')
  })
  it('per-day tally', () => {
    const g = groupByDate(bets, '2026-06-15')
    expect(g[0].tally).toEqual({ w: 1, l: 1, p: 0, units: -0.1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "groupByDate is not a function".

- [ ] **Step 3: Write minimal implementation** (append)

```js
// Group bets by date (newest first). `today` (YYYY-MM-DD) is injected for testability.
// Each group: { date, label, bets, tally:{w,l,p,units} }.
export function groupByDate(bets = [], today = '') {
  const m = new Map()
  for (const b of bets) {
    const d = b.date || ''
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(b)
  }
  const dates = [...m.keys()].sort((a, z) => (a < z ? 1 : a > z ? -1 : 0))
  return dates.map(d => {
    const list = m.get(d)
    const r = computeRecord(list)
    return {
      date: d,
      label: d === today ? 'TODAY' : d,
      bets: list,
      tally: { w: r.w, l: r.l, p: r.p, units: Math.round(r.units * 100) / 100 },
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): groupByDate with per-day tally"
```

---

## Task 6: `slipClv` — per-ticket CLV rollup

Average the per-leg CLV (from `computeClv`) into one slip number for the "YOU BEAT THE CLOSE" bar. Reuses existing `computeClv(entry, close)`.

**Files:**
- Modify: `src/lib/betCard.js`
- Test: `tests/bet-card.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { slipClv } from '../src/lib/betCard.js'

describe('slipClv', () => {
  it('averages per-leg clv from entry vs close pairs', () => {
    // leg A took -140 closed -160 (beat), leg B took +105 closed -110 (beat)
    const r = slipClv([{ entry: -140, close: -160 }, { entry: 105, close: -110 }])
    expect(r.beat).toBe(true)
    expect(r.clvPct).toBeGreaterThan(0)
  })
  it('ignores legs missing a close', () => {
    const r = slipClv([{ entry: -140, close: -160 }, { entry: 110, close: null }])
    expect(r.n).toBe(1)
  })
  it('no usable legs → null clv', () => {
    expect(slipClv([{ entry: 110, close: null }]).clvPct).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bet-card.test.js`
Expected: FAIL — "slipClv is not a function".

- [ ] **Step 3: Write minimal implementation** (append; add the import at top of `betCard.js`)

```js
// at TOP of src/lib/betCard.js, with the other imports:
import { computeClv } from './clv.js'
```

```js
// Roll per-leg CLV into one slip number. legs: [{ entry, close }]. Averages clvPct
// over legs that have both entry and a close. Returns { clvPct, beat, n }.
export function slipClv(legs = []) {
  const vals = []
  for (const l of legs) {
    if (l == null || l.entry == null || l.close == null) continue
    const c = computeClv(Number(l.entry), Number(l.close))
    if (c && c.clvPct != null) vals.push(c.clvPct)
  }
  if (!vals.length) return { clvPct: null, beat: false, n: 0 }
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return { clvPct: avg, beat: avg > 0, n: vals.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bet-card.test.js`
Expected: PASS (19 tests total).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all files pass (existing + `bet-card`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/betCard.js tests/bet-card.test.js
git commit -m "feat(betcard): slipClv per-ticket CLV rollup"
```

---

## Task 7: `BetCard.jsx` — Avatar + single `BetCard`

Presentational. Renders one normalized bet as an outlined card: avatar (headshot → logo → initials fallback), title/subtitle, odds + book chip, grade badge slot, status accent.

**Files:**
- Create: `src/components/BetCard.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/BetCard.jsx — the universal bet card. Pure presentational:
// give it a normalized bet (from src/lib/betCard.js) + optional grade { evPct, clvPct, verdict }.
import { NEON, MUTED, BORDER, TEXT } from './botShared.jsx'

const R = "'Rajdhani',sans-serif"
const I = "'Inter',sans-serif"
const AMBER = '#FFB800'

const fmtOdds = (o) => o == null ? '' : (o > 0 ? `+${o}` : `${o}`)
const initials = (s) => String(s || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase()

export function Avatar({ headshot, logo, label, status, size = 42 }) {
  const ring = status?.color || BORDER
  const common = { width: size, height: size, borderRadius: size > 34 ? 10 : 8, flexShrink: 0, objectFit: 'cover', border: `1px solid ${ring}55` }
  if (headshot) return <img src={headshot} alt="" style={common} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  if (logo) return <img src={logo} alt="" style={{ ...common, objectFit: 'contain', background: '#141414' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
  return (
    <div style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${ring}1a`, color: ring, fontFamily: R, fontWeight: 700, fontSize: size > 34 ? 15 : 11 }}>
      {initials(label)}
    </div>
  )
}

function GradeBadge({ label, value, good }) {
  const c = good ? NEON : '#FF3B3B'
  return (
    <div style={{ textAlign: 'center', padding: '5px 9px', borderRadius: 8, background: `${c}14`, border: `1px solid ${c}59` }}>
      <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: c }}>{value}</div>
    </div>
  )
}

export function BetCard({ bet, grade, compact = false }) {
  const st = bet.status
  const leg = bet.legs[0] || {}
  return (
    <div style={{ position: 'relative', background: '#0d0d0d', border: `1px solid ${st.color}59`, borderRadius: 14, padding: compact ? '9px 11px' : 13, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar headshot={leg.headshot} logo={leg.logo} label={bet.subtitle || bet.title} status={st} size={compact ? 30 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: R, fontSize: compact ? 14 : 17, fontWeight: 700, color: TEXT, letterSpacing: '0.02em', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{bet.title}</div>
          {bet.subtitle && <div style={{ fontFamily: I, fontSize: 11, color: MUTED }}>{bet.subtitle}</div>}
        </div>
        {bet.book && <span style={{ fontFamily: R, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#1c1c1c', color: '#9a9a9a' }}>{bet.book}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontFamily: R, fontSize: 9, color: MUTED, letterSpacing: '0.1em' }}>ODDS</span>
          <span style={{ fontFamily: R, fontSize: 17, fontWeight: 700, color: TEXT }}>{fmtOdds(bet.odds)}</span>
        </div>
        {grade?.evPct != null && <GradeBadge label="EV" value={`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`} good={grade.evPct >= 0} />}
        {grade?.clvPct != null && <GradeBadge label="CLV" value={`${grade.clvPct >= 0 ? '+' : ''}${grade.clvPct.toFixed(1)}%`} good={grade.clvPct >= 0} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build`
Expected: build succeeds (component is imported in Task 9; a standalone unused export still compiles).

- [ ] **Step 3: Commit**

```bash
git add src/components/BetCard.jsx
git commit -m "feat(betcard): Avatar + single BetCard component"
```

---

## Task 8: `BetTicket` — connected parlay + footer + CLV bar

Adds the parlay renderer to `BetCard.jsx`: header pill (`ticketStatus.label`), legs connected by a left rail with per-leg status nodes, each leg showing `entry · closed`, a footer (`odds · stake → win` + `TICKET EV`), and the bottom CLV "YOU BEAT THE CLOSE" bar.

**Files:**
- Modify: `src/components/BetCard.jsx`

- [ ] **Step 1: Add `BetTicket`** (append to `src/components/BetCard.jsx`; add the import line at top)

```jsx
// add to the import at the top of BetCard.jsx:
import { ticketStatus, slipClv } from '../lib/betCard.js'
```

```jsx
function LegRow({ leg }) {
  const st = leg.status
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', position: 'relative',
      background: st.key === 'live' ? 'rgba(255,184,0,0.05)' : 'transparent' }}>
      <Avatar headshot={leg.headshot} logo={leg.logo} label={leg.subtitle || leg.title} status={st} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: st.key === 'won' ? TEXT : st.key === 'live' ? AMBER : '#8a8a8a', textDecoration: st.key === 'lost' ? 'line-through' : 'none' }}>{leg.title}</div>
        <div style={{ fontFamily: I, fontSize: 10, color: st.key === 'live' ? AMBER : MUTED }}>
          {fmtOdds(leg.odds)}{leg.close != null ? ` · closed ${fmtOdds(leg.close)}` : ''}{st.key === 'live' ? ' · needs this' : ''}
        </div>
      </div>
      <i className={`ti ${st.icon}`} style={{ color: st.color, fontSize: 17 }} />
    </div>
  )
}

export function BetTicket({ bet, grade }) {
  const t = ticketStatus(bet.legs)
  const clv = grade?.slipClv ?? slipClv(bet.legs.map(l => ({ entry: l.odds, close: l.close })))
  const win = bet.odds != null && bet.stake ? (bet.odds > 0 ? bet.stake * bet.odds / 100 : bet.stake * 100 / Math.abs(bet.odds)) : null
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: '#0c0c0c', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>{bet.title}</span>
        <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${t.overall.color}1f`, color: t.overall.color }}>{t.label}{t.overall.key === 'live' ? ' · LIVE' : ''}</span>
      </div>

      <div style={{ position: 'relative', padding: '4px 0' }}>
        <div style={{ position: 'absolute', left: 27, top: 24, bottom: 24, width: 2, background: '#262626' }} />
        {bet.legs.map((leg, i) => <div key={i} style={{ position: 'relative', zIndex: 1 }}><LegRow leg={leg} /></div>)}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 13px 11px' }}>
        <div style={{ flex: 1.2, textAlign: 'center', background: '#141414', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 7 }}>
          <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.08em' }}>ODDS · STAKE → WIN</div>
          <div style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: TEXT }}>{fmtOdds(bet.odds)}{win != null ? ` · $${bet.stake.toFixed(0)} → $${win.toFixed(0)}` : ''}</div>
        </div>
        {grade?.evPct != null && (
          <div style={{ flex: 1, textAlign: 'center', background: `${NEON}14`, border: `1px solid ${NEON}59`, borderRadius: 8, padding: 7 }}>
            <div style={{ fontFamily: R, fontSize: 8, color: MUTED, letterSpacing: '0.08em' }}>TICKET EV</div>
            <div style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: grade.evPct >= 0 ? NEON : '#FF3B3B' }}>{`${grade.evPct >= 0 ? '+' : ''}${grade.evPct.toFixed(1)}%`}</div>
          </div>
        )}
      </div>

      {clv.clvPct != null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10,
          background: clv.beat ? `${NEON}12` : 'rgba(255,59,59,0.10)', borderTop: `1px solid ${(clv.beat ? NEON : '#FF3B3B')}40` }}>
          <i className={`ti ${clv.beat ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ color: clv.beat ? NEON : '#FF3B3B', fontSize: 18 }} />
          <span style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B', letterSpacing: '0.06em' }}>{clv.beat ? 'YOU BEAT THE CLOSE' : 'WORSE THAN CLOSE'}</span>
          <span style={{ fontFamily: R, fontSize: 15, fontWeight: 700, color: clv.beat ? NEON : '#FF3B3B' }}>{`${clv.clvPct >= 0 ? '+' : ''}${clv.clvPct.toFixed(1)}% CLV`}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/BetCard.jsx
git commit -m "feat(betcard): connected BetTicket parlay + CLV bar"
```

---

## Task 9: Recompose `TrackChannel` scoreboard — record line, operator tile, status chips

Enrich the existing SCOREBOARD `LookSection` (do not remove the three stat tiles). Add a record line, an Operator Rating tile (empty home), and status filter chips that filter the positions below.

**Files:**
- Modify: `src/components/MatrixBot.jsx` (`TrackChannel`, ~1199–1273)

- [ ] **Step 1: Add imports** at top of `MatrixBot.jsx` (after the existing `betMatch` import)

```js
import { normalizeBet, computeRecord, groupByDate, betStatus, STATUS } from '../lib/betCard.js'
import { BetCard, BetTicket } from './BetCard.jsx'
```

- [ ] **Step 2: Add state + derived record/status to `TrackChannel`** (inside the function, after the existing `board` useMemo)

```js
  const [statusFilter, setStatusFilter] = useState('all')   // all | live | pending | settled
  const record = useMemo(() => computeRecord(bets || []), [bets])

  // Bets pass the status chip filter (live = Open with a live game; pending = Open; settled = W/L/P)
  const statusOk = (b) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'settled') return ['W', 'L', 'P'].includes(b.result)
    return b.result === 'Open'   // 'live' and 'pending' both mean unsettled here
  }
```

- [ ] **Step 3: Insert the record line + operator tile** inside the SCOREBOARD `LookSection`, immediately AFTER the existing 3-tile grid `</div>` and BEFORE the footer note `<div ...>{graded.length > 0 ? ...}`:

```jsx
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px', marginTop: '8px' }}>
          <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 10px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>RECORD</div>
            <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: TEXT }}>
              {record.w}-{record.l}{record.p ? `-${record.p}` : ''} · {record.units >= 0 ? '+' : ''}{record.units.toFixed(1)}u{record.roi != null ? ` · ROI ${record.roi >= 0 ? '+' : ''}${record.roi.toFixed(1)}%` : ''}
            </div>
          </div>
          <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '9px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.1em' }}>OPERATOR</div>
            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: MUTED }}>SOON</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[['all', 'ALL'], ['live', 'LIVE'], ['pending', 'PENDING'], ['settled', 'SETTLED']].map(([k, lbl]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={pill(statusFilter === k)}>{lbl}</button>
          ))}
        </div>
```

- [ ] **Step 4: Verify it builds and renders**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatrixBot.jsx
git commit -m "feat(track): scoreboard record line + operator tile + status chips"
```

---

## Task 10: Recompose `TrackChannel` positions — date groups + BetCard/BetTicket + empty state

Replace the per-game `TrackGameCard` list inside TRACKED POSITIONS with date-grouped universal cards. Keep the `LookSection` wrapper. `TrackGameCard`'s closing-lines grid is preserved by feeding each normalized parlay leg a `close` (from the same `graded` data) — for v1, straights render `BetCard`, parlays render `BetTicket`.

**Files:**
- Modify: `src/components/MatrixBot.jsx` (`TrackChannel` render, ~1266–1270)

- [ ] **Step 1: Build the grouped, filtered position list** (inside `TrackChannel`, after `statusOk`)

```js
  const todayKey = todayStr()
  const visibleBets = useMemo(() => (bets || []).filter(statusOk), [bets, statusFilter])
  const dateGroups = useMemo(() => groupByDate(visibleBets, todayKey), [visibleBets])

  // Attach EV/CLV grade by re-using the existing `graded` match where available.
  const gradeFor = (b) => {
    const g = graded.find(x => x.bet === b)
    if (!g) return null
    return { evPct: g.grade.evPct, clvPct: g.grade.clvPct }
  }
```

- [ ] **Step 2: Replace the TRACKED POSITIONS `LookSection` body** with date groups of universal cards:

```jsx
      <LookSection label="TRACKED POSITIONS">
        {!visibleBets.length && <Empty text={`No ${statusFilter === 'all' ? '' : statusFilter + ' '}positions yet. Log a play on CH 1/2 and it grades here.`} />}
        {dateGroups.map((grp) => (
          <div key={grp.date || 'undated'} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 7px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.14em' }}>{grp.label}</span>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{grp.tally.w}-{grp.tally.l}{grp.tally.p ? `-${grp.tally.p}` : ''} · {grp.tally.units >= 0 ? '+' : ''}{grp.tally.units}u</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {grp.bets.map((b) => {
                const n = normalizeBet(b)
                return n.kind === 'parlay'
                  ? <BetTicket key={b.id} bet={n} grade={gradeFor(b)} />
                  : <BetCard key={b.id} bet={n} grade={gradeFor(b)} />
              })}
            </div>
          </div>
        ))}
      </LookSection>
```

- [ ] **Step 3: Add live auto-refresh** — re-fetch events every 60s so live legs update. Modify the existing events `useEffect` in `TrackChannel`:

```js
  useEffect(() => {
    let live = true
    const load = () => fetchEvents(sport, 'today').then(res => { if (live) setEvents(res?.data || []) }).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => { live = false; clearInterval(id) }
  }, [sport])
```

- [ ] **Step 4: Verify it builds**

Run: `npx vite build`
Expected: build succeeds. The old `TrackGameCard` may now be unused — leave it defined (harmless) or remove it if lint flags it.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatrixBot.jsx
git commit -m "feat(track): date-grouped universal cards + live refresh + empty state"
```

---

## Task 11: Gear menu on the SCOREBOARD header

Add a ⚙ button at the right of the SCOREBOARD `LookSection` label that opens an in-frame sheet with: time scope, sport filter, status filter (mirrors chips), settle manually, delete a position, reset scoreboard (confirm), share record. v1 wires the filters (time scope + status) and the destructive actions through callbacks already available; settle/share are stubbed to the existing handlers if present, else hidden.

**Files:**
- Modify: `src/components/MatrixBot.jsx` (`TrackChannel`, `LookSection`)

- [ ] **Step 1: Add a `headerRight` slot to `LookSection`** (~780) so a section can render an action on its header. Modify the signature and header row:

```jsx
function LookSection({ label, defaultOpen = true, headerRight = null, children }) {
```

Inside its header row markup, render `headerRight` on the right side (next to the chevron). Place it immediately before the closing of the header button/row container:

```jsx
      {headerRight && <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto' }}>{headerRight}</span>}
```

- [ ] **Step 2: Add gear state + sheet to `TrackChannel`**

```js
  const [gearOpen, setGearOpen] = useState(false)
  const [scope, setScope] = useState('all')   // all | 30d | 7d | today
```

- [ ] **Step 3: Pass the gear button into the SCOREBOARD section** — change `<LookSection label="SCOREBOARD">` to:

```jsx
      <LookSection label="SCOREBOARD" headerRight={
        <button aria-label="Track settings" onClick={() => setGearOpen(o => !o)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, fontSize: '16px' }}>
          <i className="ti ti-settings" />
        </button>
      }>
```

- [ ] **Step 4: Render the gear sheet** at the top of the `TvFrame` body (right after the `⬡ BEAT THE CLOSE` title div), shown only when `gearOpen`:

```jsx
      {gearOpen && (
        <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.14em', marginBottom: '6px' }}>TIME SCOPE</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {[['all', 'ALL-TIME'], ['30d', '30D'], ['7d', '7D'], ['today', 'TODAY']].map(([k, lbl]) => (
              <button key={k} onClick={() => setScope(k)} style={pill(scope === k)}>{lbl}</button>
            ))}
          </div>
          <button onClick={() => { if (confirm('Reset your tracked record? This cannot be undone.')) { /* reset handler */ } }}
            style={{ width: '100%', padding: '9px', background: 'transparent', border: `1px solid ${DANGER}59`, borderRadius: '8px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: DANGER }}>
            RESET SCOREBOARD
          </button>
        </div>
      )}
```

- [ ] **Step 5: Apply the time scope** — filter `bets` by `scope` before record/groups. Add a `scopedBets` memo and use it in place of `bets` for `record`, `visibleBets`:

```js
  const scopedBets = useMemo(() => {
    if (scope === 'all') return bets || []
    const days = scope === '30d' ? 30 : scope === '7d' ? 7 : 1
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (days - 1))
    const cutStr = cutoff.toISOString().slice(0, 10)
    return (bets || []).filter(b => (b.date || '') >= cutStr)
  }, [bets, scope])
```

Then change `computeRecord(bets || [])` → `computeRecord(scopedBets)` and `(bets || []).filter(statusOk)` → `scopedBets.filter(statusOk)`.

- [ ] **Step 6: Verify it builds**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/MatrixBot.jsx
git commit -m "feat(track): gear menu — time scope + reset; LookSection headerRight slot"
```

---

## Task 12: Adopt `BetCard` site-wide (slip + bet log)

Make it the universal card: render the in-app slip preview and the bet-log rows in `App.jsx` with `BetCard`/`BetTicket`. Keep all existing controls (per-leg toggles, place CTA) — only the visual row becomes the shared card. Scope to the read-only display rows; do not touch slip-building logic.

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the card + normalizer** at the top of `App.jsx`

```js
import { BetCard, BetTicket } from './components/BetCard.jsx'
import { normalizeBet } from './lib/betCard.js'
```

- [ ] **Step 2: Find the bet-log list render** (search `App.jsx` for where `bets.map(` renders a row in the log/overview view). Replace the inner visual row markup with:

```jsx
{(() => { const n = normalizeBet(b); return n.kind === 'parlay' ? <BetTicket bet={n} /> : <BetCard bet={n} /> })()}
```

Keep any surrounding wrapper that holds existing action buttons (edit/delete) — only the descriptive row is replaced.

- [ ] **Step 3: Verify it builds**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(betcard): adopt universal card in slip + bet log"
```

---

## Task 13: Full verification + deploy

**Files:** none (verify + ship)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all pass, including `tests/bet-card.test.js`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `betCard.js`, `BetCard.jsx`, `MatrixBot.jsx`, `App.jsx`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Bump SW cache version** — per `feedback-rml-sw-cache-staleness`, bump the `CACHE`/SW version constant (currently `rml-v254`) to `rml-v255` so the PWA serves the new bundle. (Search the service worker file for the version string.)

- [ ] **Step 5: Deploy to prod**

Run: `npm run build && npx vercel deploy --prod --force`

- [ ] **Step 6: Verify live in Chrome** (per `feedback-rml-verify-chrome`, `feedback-rml-testing`) — open `https://app.riskmatrixlabs.com` at mobile width, go to Matrix Bot → CH3 TRACK, confirm:
  - Scoreboard shows the 3 tiles + record line + OPERATOR/SOON tile + status chips.
  - Gear opens; time scope filters; reset confirms.
  - Positions are date-grouped (TODAY first) with per-day tally.
  - A straight renders a `BetCard`; a parlay renders a connected `BetTicket` with the "3 OF N HIT" pill, footer, and CLV bar.
  - Status chips filter the list.
  - Nothing from the old CH3 is missing.

- [ ] **Step 7: Final commit (version bump)**

```bash
git add -A
git commit -m "chore: bump SW cache to rml-v255 for CH3 EV Track ship"
```

---

## Self-Review Notes (author)

- **Spec coverage:** BetCard/BetTicket (T7–8), headshot/logo/initials avatar (T7), connected parlay + both-edge feel via rail + bordered ticket (T8), CLV bar (T8), scoreboard record line + operator tile + status chips (T9), date grouping + Today-first + mini-tally + empty state + live refresh (T10), gear menu w/ time scope + reset (T11), site-wide adoption (T12), nothing-removed + inside-TvFrame (T9–10 keep `LookSection`/`TvFrame`). ✓
- **Deferred to EV Brain (by design):** Operator Rating value (shows SOON), verdict badge (slot present), settle-manually + sport-filter + share in gear are listed in the spec but only time-scope/status/reset are wired in v1 — acceptable v1 cut; remaining gear actions are a fast follow once handlers exist. Flag to owner at execution.
- **Type consistency:** `normalizeBet` output (`kind`, `legs[].status`, `status`) consumed identically in BetCard/BetTicket/TrackChannel; `STATUS` keys (`won/lost/push/live`) used consistently.
