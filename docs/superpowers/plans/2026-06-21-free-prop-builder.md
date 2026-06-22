# Free Guided Prop Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free, guided player-prop builder (player search → stat/side → free season/L5 context → line + odds) that logs a tracked prop, reused in the LOG BET modal and the Game Center game-Insights view.

**Architecture:** One pure logic module (`propBuilderLib.js`) + one controlled React component (`PropBuilder.jsx`) that emits `onChange(prop|null)`. The modal mirrors `prop` into its existing form and uses its existing LOG BET button; Game Center renders the builder above Line Shop with its own ADD TO SLIP button that calls the existing `onAddToSlip`. All data comes from existing free ESPN-backed endpoints (`player-search`, `player-stats`, `box-score`) — zero Odds-API credits.

**Tech Stack:** React 18 + Vite, Vitest + @testing-library/react, existing helpers (`statProgress.js`, `propMarkets.js`, `betMatch.js`).

---

## File Structure

- **Create** `src/lib/propBuilderLib.js` — pure helpers: `trackableStatOptions(sport)`, `assembleProp(parts)`, `pickStatValue(statsResp, market)`. One responsibility: prop assembly + stat resolution, no React.
- **Create** `src/components/PropBuilder.jsx` — the controlled builder UI. One responsibility: gather player/stat/side/line/odds and emit `onChange(prop|null)`.
- **Create** `tests/prop-builder-lib.test.js` and `tests/prop-builder.test.jsx`.
- **Modify** `src/App.jsx` — `AddBetModal`: add `'Player Prop'` bet type + mount PropBuilder (mirror into form). `BET_TYPES` at line 586; non-multiLeg input block at ~693.
- **Modify** `src/components/LiveCenter.jsx` — `GameDetail` Insights tab: render `<PropBuilder>` inside a `<Collapsible>` directly above `<LineShop>` (line ~2132), with an ADD TO SLIP button calling `onAddToSlip`.

---

## Task 1: Pure logic module `propBuilderLib.js`

**Files:**
- Create: `src/lib/propBuilderLib.js`
- Test: `tests/prop-builder-lib.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/prop-builder-lib.test.js
import { describe, it, expect } from 'vitest'
import { trackableStatOptions, assembleProp, pickStatValue } from '../src/lib/propBuilderLib.js'
import { parseProp, resolveStat } from '../src/lib/statProgress.js'

describe('trackableStatOptions', () => {
  it('offers only stats the box score can read (drops Total Bases + Threes)', () => {
    const mlb = trackableStatOptions('MLB').map(o => o.label)
    expect(mlb).toContain('Hits')
    expect(mlb).toContain('Strikeouts')
    expect(mlb).not.toContain('Total Bases')   // resolveStat returns null for it
    const nba = trackableStatOptions('NBA').map(o => o.label)
    expect(nba).toContain('Pts+Reb+Ast')
    expect(nba).not.toContain('Threes')
  })
  it('every offered stat round-trips: assembled pick parses + resolves', () => {
    const SYNTH = { hits: 2, runs: 1, RBIs: 1, homeRuns: 1, walks: 1, strikeouts: 7,
      points: 20, rebounds: 5, assists: 5, goals: 1, shotsTotal: 4, saves: 30 }
    for (const sport of ['MLB', 'NBA', 'NHL', 'WNBA']) {
      for (const opt of trackableStatOptions(sport)) {
        const { pick } = assembleProp({ player: 'Test Player', side: 'over', line: 1.5, statLabel: opt.label, sport, event: 'A vs B' })
        const parsed = parseProp(pick)
        expect(parsed, `parse ${pick}`).not.toBeNull()
        expect(resolveStat(SYNTH, parsed.market), `resolve ${opt.label}`).not.toBeNull()
      }
    }
  })
})

describe('assembleProp', () => {
  it('builds the canonical pick string and prop shape', () => {
    const prop = assembleProp({ player: 'Aaron Judge', side: 'over', line: 1.5, statLabel: 'Hits', sport: 'MLB', event: 'Reds vs Yankees', odds: -120 })
    expect(prop.pick).toBe('Aaron Judge Over 1.5 Hits')
    expect(prop).toMatchObject({ sport: 'MLB', event: 'Reds vs Yankees', side: 'over', line: 1.5, stat: 'Hits', odds: -120 })
  })
})

describe('pickStatValue', () => {
  const resp = { found: true, games: 10, last5games: 5,
    season: [{ label: 'H', value: 12 }, { label: 'HR', value: 3 }, { label: 'AB', value: 40 }],
    last5: [{ label: 'H', value: 7 }, { label: 'HR', value: 1 }] }
  it('returns per-game season + last5 for a simple stat', () => {
    const v = pickStatValue(resp, 'batter_hits')
    expect(v.seasonPerGame).toBeCloseTo(1.2, 2)
    expect(v.last5PerGame).toBeCloseTo(1.4, 2)
  })
  it('sums components for a combo stat (PRA)', () => {
    const nba = { found: true, games: 4, last5games: 4,
      season: [{ label: 'PTS', value: 80 }, { label: 'REB', value: 20 }, { label: 'AST', value: 16 }], last5: [] }
    expect(pickStatValue(nba, 'player_points_rebounds_assists').seasonPerGame).toBeCloseTo(29, 1)
  })
  it('returns null when the stat is not in the gamelog', () => {
    expect(pickStatValue({ found: false }, 'batter_hits')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prop-builder-lib.test.js`
Expected: FAIL — `propBuilderLib.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/propBuilderLib.js
// Pure helpers for the free guided prop builder. No React, no network.
import { PROP_MARKETS, labelFor } from './propMarkets.js'
import { resolveStat } from './statProgress.js'

// Synthetic stat record with every key resolveStat reads, all set so any
// resolvable market returns a number. Markets resolveStat can't read (total
// bases, threes) return null here and are therefore excluded from the builder.
const SYNTH = {
  hits: 1, runs: 1, RBIs: 1, homeRuns: 1, walks: 1, strikeouts: 1, earnedRuns: 1,
  points: 1, rebounds: 1, assists: 1, steals: 1, blocks: 1, goals: 1,
  shotsTotal: 1, shots: 1, saves: 1,
}

// The stat options to offer for a sport = its basic prop markets, filtered to
// the ones the live box score can actually track. Returns [{ key, label }].
export function trackableStatOptions(sport) {
  const markets = PROP_MARKETS[String(sport || '').toUpperCase()] || []
  return markets
    .filter(key => resolveStat(SYNTH, labelFor(key)) != null)
    .map(key => ({ key, label: labelFor(key) }))
}

const sideWord = (s) => (String(s).toLowerCase() === 'under' ? 'Under' : 'Over')

// Assemble the canonical pick string + prop object the parents consume.
export function assembleProp({ player, side, line, statLabel, sport, event, odds = null }) {
  const pick = `${String(player).trim()} ${sideWord(side)} ${line} ${statLabel}`
  return {
    sport, event,
    player: String(player).trim(),
    stat: statLabel,
    side: String(side).toLowerCase() === 'under' ? 'under' : 'over',
    line: Number(line),
    odds: odds == null ? null : Number(odds),
    pick,
  }
}

// Map a prop market to the gamelog label token(s) used by /api/player-stats.
// Combo markets sum their components. Exact (case-insensitive) label match so
// 'H' never collides with 'HR'.
const STAT_TOKENS = {
  pitcher_strikeouts: ['K', 'SO'], batter_hits: ['H'], batter_home_runs: ['HR'],
  batter_rbis: ['RBI'], batter_walks: ['BB'],
  player_points: ['PTS'], player_rebounds: ['REB'], player_assists: ['AST'],
  player_points_rebounds_assists: ['PTS', 'REB', 'AST'],
  player_shots_on_goal: ['SOG', 'S'], player_goals: ['G'], player_total_saves: ['SV', 'SA'],
}

function sumTokens(entries, tokens) {
  if (!Array.isArray(entries)) return null
  let total = 0, hit = false
  for (const tok of tokens) {
    const e = entries.find(x => String(x.label).trim().toUpperCase() === tok)
    if (e != null) { total += Number(e.value) || 0; hit = true }
  }
  return hit ? total : null
}

// Returns { seasonPerGame, last5PerGame } or null if the stat isn't in the log.
// For combo markets (…_rebounds_assists) all tokens are summed; otherwise the
// first token that exists wins (so 'H' vs 'HR' never collide).
export function pickStatValue(resp, market) {
  if (!resp || !resp.found) return null
  const tokens = STAT_TOKENS[market]
  if (!tokens) return null
  const isCombo = market.endsWith('_rebounds_assists')
  const valueFor = (entries) => {
    if (isCombo) return sumTokens(entries, tokens)
    for (const tok of tokens) { const v = sumTokens(entries, [tok]); if (v != null) return v }
    return null
  }
  const seasonTotal = valueFor(resp.season)
  if (seasonTotal == null) return null
  const last5Total = valueFor(resp.last5)
  const games = resp.games || 1
  const l5g = resp.last5games || 0
  return {
    seasonPerGame: seasonTotal / games,
    last5PerGame: l5g ? (last5Total ?? 0) / l5g : null,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/prop-builder-lib.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/propBuilderLib.js tests/prop-builder-lib.test.js
git commit -m "feat(props): pure prop-builder lib — trackable stats, pick assembly, gamelog stat lookup"
```

---

## Task 2: `PropBuilder` — player search + selection

**Files:**
- Create: `src/components/PropBuilder.jsx`
- Test: `tests/prop-builder.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/prop-builder.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import PropBuilder from '../src/components/PropBuilder.jsx'

const MATCH = { player: 'Aaron Judge', id: '33192', headshot: '', team: 'NYY',
  game: { away: 'Cincinnati Reds', home: 'New York Yankees', away_abbr: 'CIN', home_abbr: 'NYY', external_event_id: '401111' } }

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/api/player-search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [MATCH] }) })
    if (String(url).includes('/api/player-stats'))  return Promise.resolve({ ok: true, json: () => Promise.resolve({ found: false }) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('PropBuilder — player search', () => {
  it('searches on typing and resolves the event when a player is picked', async () => {
    const onChange = vi.fn()
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => expect(screen.getByText('Aaron Judge')).toBeTruthy())
    fireEvent.click(screen.getByText('Aaron Judge'))
    // event resolved + shown
    await waitFor(() => expect(screen.getByText(/Cincinnati Reds vs New York Yankees/i)).toBeTruthy())
    // prop incomplete (no stat/line/odds yet) → onChange called with null
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prop-builder.test.jsx`
Expected: FAIL — `PropBuilder.jsx` does not exist.

- [ ] **Step 3: Write the implementation (player-search half)**

```jsx
// src/components/PropBuilder.jsx
// Free guided prop builder (controlled). Emits onChange(prop|null) as the user
// edits. Parents own the submit button. Zero Odds-API credits — uses the free
// player-search / player-stats / box-score chain.
import { useState, useEffect, useMemo } from 'react'
import { trackableStatOptions, assembleProp, pickStatValue } from '../lib/propBuilderLib.js'

const NEON = '#BDFF00', AMBER = '#FFAE2B', MUTED = '#8f8f8f', BORDER = '#2a2a2a'

export default function PropBuilder({ sport, game = null, token, onChange }) {
  const [query, setQuery]   = useState('')
  const [matches, setMatches] = useState([])
  const [player, setPlayer] = useState(null)   // { player, id, event }
  const [stat, setStat]     = useState(null)   // { key, label }
  const [side, setSide]     = useState('over')
  const [line, setLine]     = useState('')
  const [odds, setOdds]     = useState('')

  const statOptions = useMemo(() => trackableStatOptions(sport), [sport])
  const eventFromGame = game ? `${game.away_team || game.away} vs ${game.home_team || game.home}` : null

  // Debounced player search (typed mode). When a game is given, we still search
  // the sport then filter to that game's teams client-side.
  useEffect(() => {
    if (player) return
    const q = query.trim()
    if (q.length < 2) { setMatches([]); return }
    let on = true
    const t = setTimeout(() => {
      fetch(`/api/player-search?sport=${encodeURIComponent(sport)}&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { matches: [] })
        .then(j => {
          if (!on) return
          let rows = j.matches || []
          if (game) rows = rows.filter(m => m.game?.external_event_id === game.external_event_id)
          setMatches(rows.slice(0, 12))
        })
        .catch(() => { if (on) setMatches([]) })
    }, 250)
    return () => { on = false; clearTimeout(t) }
  }, [query, sport, token, game, player])

  const choosePlayer = (m) => {
    const event = eventFromGame || `${m.game?.away} vs ${m.game?.home}`
    setPlayer({ player: m.player, id: m.id, event })
    setMatches([]); setQuery('')
  }

  // Emit the assembled prop (or null) whenever inputs change.
  useEffect(() => {
    const lineN = parseFloat(line)
    const oddsN = parseInt(String(odds).replace(/[−–—]/g, '-').replace(/[^0-9-]/g, ''))
    if (!player || !stat || !Number.isFinite(lineN) || !Number.isFinite(oddsN)) { onChange?.(null); return }
    onChange?.(assembleProp({ player: player.player, side, line: lineN, statLabel: stat.label, sport, event: player.event, odds: oddsN }))
  }, [player, stat, side, line, odds, sport, onChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!player ? (
        <div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search player…"
            style={{ width: '100%', padding: '10px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
          {matches.map(m => (
            <div key={`${m.player}|${m.game?.external_event_id}`} onClick={() => choosePlayer(m)}
              style={{ padding: '8px 11px', cursor: 'pointer', color: '#fff' }}>
              {m.player} <span style={{ color: MUTED, fontSize: 11 }}>{m.team}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#121212', border: `1px solid ${NEON}33`, borderRadius: 10, padding: '8px 11px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 500 }}>{player.player}</div>
            <div style={{ color: MUTED, fontSize: 11 }}>{player.event} <span style={{ color: NEON }}>auto-matched</span></div>
          </div>
          <button type="button" onClick={() => { setPlayer(null); onChange?.(null) }}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: '4px 8px', cursor: 'pointer' }}>change</button>
        </div>
      )}
      {/* stat / side / line / odds / context added in Tasks 3-4 */}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prop-builder.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PropBuilder.jsx tests/prop-builder.test.jsx
git commit -m "feat(props): PropBuilder player search + selection with event auto-match"
```

---

## Task 3: `PropBuilder` — stat dropdown, side toggle, line/odds → emits prop

**Files:**
- Modify: `src/components/PropBuilder.jsx`
- Test: `tests/prop-builder.test.jsx`

- [ ] **Step 1: Add the failing test**

```jsx
// append to tests/prop-builder.test.jsx
describe('PropBuilder — completing the prop', () => {
  it('offers only trackable stats and emits the full prop when complete', async () => {
    const onChange = vi.fn()
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => screen.getByText('Aaron Judge'))
    fireEvent.click(screen.getByText('Aaron Judge'))
    await waitFor(() => screen.getByText(/auto-matched/i))
    // stat dropdown excludes Total Bases
    const select = screen.getByLabelText(/stat/i)
    const opts = [...select.querySelectorAll('option')].map(o => o.textContent)
    expect(opts).toContain('Hits')
    expect(opts).not.toContain('Total Bases')
    fireEvent.change(select, { target: { value: 'Hits' } })
    fireEvent.change(screen.getByPlaceholderText(/line/i), { target: { value: '1.5' } })
    fireEvent.change(screen.getByPlaceholderText(/odds/i), { target: { value: '-120' } })
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)[0]
      expect(last).toMatchObject({ pick: 'Aaron Judge Over 1.5 Hits', odds: -120, line: 1.5 })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prop-builder.test.jsx -t "completing the prop"`
Expected: FAIL — no stat select / line / odds inputs yet.

- [ ] **Step 3: Implement — replace the `{/* stat / side ... */}` comment with the controls**

```jsx
      {player && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1.3, fontSize: 11, color: MUTED }}>Stat
              <select aria-label="Stat" value={stat?.label || ''} onChange={e => setStat(statOptions.find(o => o.label === e.target.value) || null)}
                style={{ width: '100%', marginTop: 4, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }}>
                <option value="" disabled>Choose…</option>
                {statOptions.map(o => <option key={o.key} value={o.label}>{o.label}</option>)}
              </select>
            </label>
            <div style={{ flex: 1, fontSize: 11, color: MUTED }}>Side
              <div style={{ display: 'flex', marginTop: 4, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                {['over', 'under'].map(s => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    style={{ flex: 1, padding: '9px 0', fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: side === s ? NEON : 'transparent', color: side === s ? '#0A0A0A' : MUTED }}>{s === 'over' ? 'OVER' : 'UNDER'}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={line} onChange={e => setLine(e.target.value)} placeholder="Line  ·  1.5" inputMode="decimal"
              style={{ flex: 1, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
            <input value={odds} onChange={e => setOdds(e.target.value)} placeholder="Odds  ·  -120" inputMode="text"
              style={{ flex: 1, padding: '9px 11px', borderRadius: 10, background: '#121212', border: `1px solid ${BORDER}`, color: '#fff' }} />
          </div>
        </>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prop-builder.test.jsx`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/components/PropBuilder.jsx tests/prop-builder.test.jsx
git commit -m "feat(props): PropBuilder stat/side/line/odds controls emit assembled prop"
```

---

## Task 4: `PropBuilder` — free season/L5 context box

**Files:**
- Modify: `src/components/PropBuilder.jsx`
- Test: `tests/prop-builder.test.jsx`

- [ ] **Step 1: Add the failing test**

```jsx
// append to tests/prop-builder.test.jsx
describe('PropBuilder — free stat context', () => {
  it('shows season per-game for the chosen stat from player-stats', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/player-search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [MATCH] }) })
      if (String(url).includes('/api/player-stats'))  return Promise.resolve({ ok: true, json: () => Promise.resolve({ found: true, games: 10, last5games: 5, season: [{ label: 'H', value: 12 }], last5: [{ label: 'H', value: 7 }] }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => screen.getByText('Aaron Judge'))
    fireEvent.click(screen.getByText('Aaron Judge'))
    await waitFor(() => screen.getByLabelText(/stat/i))
    fireEvent.change(screen.getByLabelText(/stat/i), { target: { value: 'Hits' } })
    await waitFor(() => expect(screen.getByText(/1\.2/)).toBeTruthy())  // 12/10 season per game
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prop-builder.test.jsx -t "free stat context"`
Expected: FAIL — no context box yet.

- [ ] **Step 3: Implement — add a stats fetch + context box**

Add this effect after the existing emit effect:

```jsx
  const [statResp, setStatResp] = useState(null)
  useEffect(() => {
    if (!player?.id) { setStatResp(null); return }
    let on = true
    fetch(`/api/player-stats?sport=${encodeURIComponent(sport)}&id=${encodeURIComponent(player.id)}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { found: false })
      .then(j => { if (on) setStatResp(j) })
      .catch(() => { if (on) setStatResp({ found: false }) })
    return () => { on = false }
  }, [player, sport, token])

  const ctx = useMemo(() => (statResp && stat ? pickStatValue(statResp, stat.key) : null), [statResp, stat])
```

Then render the context box + a live preview just before the closing `</>` of the `player &&` block:

```jsx
          {ctx && (
            <div style={{ background: '#101510', border: `1px solid ${NEON}22`, borderRadius: 10, padding: '9px 11px', display: 'flex', gap: 16 }}>
              <div><div style={{ fontSize: 10, color: MUTED }}>SEASON / GM</div><div style={{ fontWeight: 700, color: '#fff' }}>{ctx.seasonPerGame.toFixed(1)}</div></div>
              {ctx.last5PerGame != null && <div><div style={{ fontSize: 10, color: MUTED }}>LAST 5 / GM</div><div style={{ fontWeight: 700, color: '#fff' }}>{ctx.last5PerGame.toFixed(1)}</div></div>}
            </div>
          )}
          {stat && line !== '' && odds !== '' && (
            <div style={{ background: '#121212', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ color: '#fff', marginBottom: 5 }}>{`${player.player} ${side === 'over' ? 'Over' : 'Under'} ${line} ${stat.label} · ${odds}`}</div>
              <span style={{ fontSize: 10, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 5, padding: '2px 7px' }}>your number — not a book line</span>
            </div>
          )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prop-builder.test.jsx`
Expected: PASS (all four describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/components/PropBuilder.jsx tests/prop-builder.test.jsx
git commit -m "feat(props): PropBuilder free season/L5 context + live preview"
```

---

## Task 5: Mount in the LOG BET modal (`AddBetModal`)

**Files:**
- Modify: `src/App.jsx` (import; `BET_TYPES` line 586; non-multiLeg block ~693)
- Test: `tests/prop-builder.test.jsx` (mapping assertion — pure, no full-modal render)

- [ ] **Step 1: Add a mapping test (the modal turns a prop into a bet record)**

```jsx
// append to tests/prop-builder-lib.test.js
import { assembleProp as _assemble } from '../src/lib/propBuilderLib.js'
describe('modal mapping', () => {
  it('a prop maps onto the straight-bet fields the modal submits', () => {
    const prop = _assemble({ player: 'Aaron Judge', side: 'over', line: 1.5, statLabel: 'Hits', sport: 'MLB', event: 'Reds vs Yankees', odds: -120 })
    const record = { betType: 'Player Prop', sport: prop.sport, event: prop.event, pick: prop.pick, odds: prop.odds }
    expect(record).toMatchObject({ betType: 'Player Prop', event: 'Reds vs Yankees', pick: 'Aaron Judge Over 1.5 Hits', odds: -120 })
  })
})
```

- [ ] **Step 2: Run it (passes immediately — guards the contract)**

Run: `npx vitest run tests/prop-builder-lib.test.js -t "modal mapping"`
Expected: PASS.

- [ ] **Step 3: Add the import and the bet type**

In `src/App.jsx`, add near the other component imports (around line 15):

```jsx
import PropBuilder from './components/PropBuilder.jsx'
```

Change `BET_TYPES` (line 586) from:

```jsx
    const BET_TYPES  = ['Straight','Parlay','SGP','RR 2s','RR 3s','Live Bet','Hedge']
```
to:
```jsx
    const BET_TYPES  = ['Straight','Player Prop','Parlay','SGP','RR 2s','RR 3s','Live Bet','Hedge']
```

- [ ] **Step 4: Mount PropBuilder in the non-multiLeg branch**

In the `{!multiLeg ? (` block (~line 693), wrap the existing Event/Pick inputs so that when `form.betType === 'Player Prop'` we render the builder instead. The builder mirrors its prop into `form.event/pick/odds`, so the existing submit + `isDisabled` logic (which checks `form.event && form.pick && form.odds`) works unchanged. Replace the opening of that branch:

```jsx
          {!multiLeg ? (
            form.betType === 'Player Prop' ? (
              <div style={{ padding: '4px 0' }}>
                <PropBuilder
                  sport={form.sport}
                  game={null}
                  token={token}
                  onChange={(prop) => setForm(p => ({
                    ...p,
                    event: prop?.event || '',
                    pick:  prop?.pick  || '',
                    odds:  prop?.odds != null ? String(prop.odds) : '',
                  }))}
                />
              </div>
            ) : (
              // ← existing Event/Pick/odds inputs stay here, unchanged
```

Close the new conditional with an extra `)` at the end of the existing non-multiLeg input group (before the `) : (` that begins the multiLeg branch). The builder needs `token` — `AddBetModal` must receive it: add `token` to the `AddBetModal({ ... })` props (line 449) and pass `token={token}` at both `<AddBetModal>` call sites (search `<AddBetModal`).

- [ ] **Step 5: Verify build + unit tests, then manual smoke**

Run: `npm test && npm run check:undef && npm run build`
Expected: all green.
Then manual (Step in Task 7): open LOG BET → Player Prop → confirm the builder renders and logging creates a tracked prop.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx tests/prop-builder-lib.test.js
git commit -m "feat(props): Player Prop bet type mounts PropBuilder in LOG BET modal"
```

---

## Task 6: Mount in Game Center Insights, above Line Shop

**Files:**
- Modify: `src/components/LiveCenter.jsx` (import; GameDetail Insights, above `<LineShop>` ~line 2132)

- [ ] **Step 1: Add the import**

In `src/components/LiveCenter.jsx` near the other imports:

```jsx
import PropBuilder from './PropBuilder.jsx'
```

- [ ] **Step 2: Render the builder above Line Shop inside a Collapsible**

Immediately BEFORE the `<LineShop ... />` line (~2132), insert:

```jsx
                {/* Free guided prop builder → adds to the slip (sits above Line Shop) */}
                <PropBuilderSection event={event} token={token} onAddToSlip={onAddToSlip} />
```

Then add this small wrapper component near the other helper components in the file (e.g. just below `function Collapsible(...)` at ~line 882):

```jsx
// Free prop builder wrapped for Game Center: builds a prop and drops it on the slip.
function PropBuilderSection({ event, token, onAddToSlip }) {
  const [prop, setProp] = useState(null)
  if (!onAddToSlip) return null
  return (
    <Collapsible title="Build a prop" sub="free · tracks live" defaultOpen={false}>
      <PropBuilder sport={event.sport} game={event} token={token} onChange={setProp} />
      <button type="button" disabled={!prop}
        onClick={() => { if (prop) { onAddToSlip({ pick: prop.pick, odds: prop.odds, sport: prop.sport, event: prop.event, book: null }); setProp(null) } }}
        style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 11, fontWeight: 700, letterSpacing: '0.14em',
          border: 'none', cursor: prop ? 'pointer' : 'default', background: prop ? NEON : '#1c1c1c', color: prop ? '#0A0A0A' : '#666' }}>
        + ADD TO SLIP
      </button>
    </Collapsible>
  )
}
```

`useState` is already imported in LiveCenter (line 6). `NEON` is already in scope (used throughout the file).

- [ ] **Step 3: Verify build + tests**

Run: `npm test && npm run check:undef && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/LiveCenter.jsx
git commit -m "feat(props): free prop builder in Game Center Insights, adds to slip"
```

---

## Task 7: Live verification + ship

**Files:** `public/sw.js` (bump CACHE)

- [ ] **Step 1: Bump the service worker cache**

Edit `public/sw.js` line 1: `const CACHE = 'rml-v472';` → next number (e.g. `rml-v473`).

- [ ] **Step 2: Guarded deploy**

Run: `npm run ship`
Expected: tests pass, undef check passes, build succeeds, deploys to prod.

- [ ] **Step 3: Manual verify in Chrome (project rule — verify on app.riskmatrixlabs.com)**

1. LOG BET → select **Player Prop** → search a player in a live/today MLB game → pick a stat → set line + odds → log it. Confirm the bet appears with a live stat bar that fills off the box score.
2. Game Center → tap a game → **Insights** → **Build a prop** (above Line Shop) → build one → **ADD TO SLIP** → confirm the leg lands in the slip.
3. Confirm no error boundary; check the console for errors.

- [ ] **Step 4: Commit the SW bump (if not already committed by ship)**

```bash
git add public/sw.js
git commit -m "chore: bump SW cache for free prop builder"
```

- [ ] **Step 5: Merge to main when verified**

```bash
git checkout main && git merge --no-ff feat/free-prop-builder -m "feat: free guided prop builder (Log Bet modal + Game Center)"
git push origin main
```

---

## Notes for the implementer

- **Free/paid boundary:** the builder never fetches odds. Line + odds are user-typed. EV/edge stay paid (not shown here).
- **Why stats are filtered:** `resolveStat` returns `null` for `total_bases` and `threes`; `trackableStatOptions` drops exactly those so every offered prop draws a live bar. Do not hardcode the exclusion list — keep the `resolveStat(SYNTH, …)` probe.
- **Event matching:** the prop's `event` is `"<away> vs <home>"`, which `betMatch.matchBetToEvent` matches leniently (abbr or last-word). If a player's game can't be matched later, the prop still logs but won't draw a live bar — same as today's manual path.
- **Token:** both `player-search` (typed mode) and `player-stats` require auth — always pass `Authorization: Bearer <token>`.
