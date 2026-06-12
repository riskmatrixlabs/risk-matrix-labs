# Live Center™ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live Center™ tab to Risk Matrix Labs — an Apple Sports-style game slate (MLB first) that lets operators log a position directly from a game card, auto-filling the AddBetModal with event data.

**Architecture:** Phase 1 only — ESPN hidden API for live scores/schedules + TheSportsDB for team artwork, both fetched server-side only via a provider abstraction layer, cached in Supabase `events` table. Frontend never calls any external API directly — it only reads from Supabase. Provider can be swapped (ESPN → API-Sports → Sportradar) by changing one file. Log Position pre-fills the existing `AddBetModal`. Phases 2–4 (active positions, auto-settlement) noted but not built here.

**Tech Stack:** React 18 + Vite, ESPN hidden API (free, no key), TheSportsDB (free tier, team logos), Supabase (existing project + new `events` table + Live Center sync), Vercel cron for sync, existing `AddBetModal` component.

**Provider layer principle:** `supabase/functions/sync-events/providers/` contains one file per data source. The Live Center sync orchestrates them. Frontend is completely insulated — if ESPN changes endpoints tomorrow, update one provider file, redeploy, done.

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Create | `src/components/LiveCenter.jsx` | Full Live Center UI — sport pills, date filter, game list, game detail, Log Position CTA |
| Create | `src/lib/events.js` | Supabase helpers for reading the `events` table (frontend only reads, never writes) |
| Create | `supabase/functions/sync-events/index.ts` | Live Center sync orchestrator — calls providers, upserts to `events` table |
| Create | `supabase/functions/sync-events/providers/espn.ts` | ESPN hidden API provider — fetches schedules + scores for MLB/NBA/NHL/NFL |
| Create | `supabase/functions/sync-events/providers/thesportsdb.ts` | TheSportsDB provider — fetches team logos + artwork, merges into events |
| Create | `supabase/functions/sync-events/providers/types.ts` | Shared provider interface — `GameEvent` type, all providers must return this shape |
| Modify | `src/App.jsx` | Add `'live'` tab to desktop nav + mobile nav, render `<LiveCenter>`, `handleLogPosition` |
| Modify | `vercel.json` | Add cron to trigger Live Center sync sync every 60 min (noon–midnight ET window) |

---

## Task 1: Supabase `events` table

**Files:**
- Run SQL in Supabase dashboard (no file to commit — but save migration locally)
- Create: `supabase/migrations/20260610_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260610_events.sql
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  external_event_id   text not null,
  provider            text not null default 'api-sports',
  sport               text not null,
  league              text not null,
  start_time          timestamptz not null,
  status              text not null default 'NS',
  home_team           text not null,
  away_team           text not null,
  home_abbr           text,
  away_abbr           text,
  home_score          int,
  away_score          int,
  home_record         text,
  away_record         text,
  odds_ml_home        int,
  odds_ml_away        int,
  odds_spread_home    numeric(5,1),
  odds_spread_away    numeric(5,1),
  odds_total          numeric(5,1),
  metadata            jsonb default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create unique index if not exists events_external_provider_idx
  on public.events (external_event_id, provider);

alter table public.events enable row level security;

-- Public read — operators see all games
create policy "events_read_all" on public.events
  for select using (true);

-- Only service role can write (Live Center sync uses service key)
create policy "events_service_write" on public.events
  for all using (auth.role() = 'service_role');

grant select on public.events to authenticated, anon;
```

- [ ] **Step 2: Run the migration**

Go to Supabase dashboard → SQL Editor → paste the file contents → Run.

Expected: table `events` appears in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610_events.sql
git commit -m "feat: add events table for Live Center"
```

---

## Task 2: Supabase helpers for events

**Files:**
- Create: `src/lib/events.js`

- [ ] **Step 1: Write the helper**

```js
// src/lib/events.js
import { supabase } from './supabase'

const SPORT_LEAGUE = {
  mlb:  'MLB',
  nba:  'NBA',
  nhl:  'NHL',
  nfl:  'NFL',
}

/**
 * Fetch events for a given sport and date (YYYY-MM-DD).
 * date = 'today' | 'yesterday' | 'upcoming' | ISO date string
 */
export async function fetchEvents(sport, date = 'today') {
  const league = SPORT_LEAGUE[sport]
  if (!league) return { data: [], error: null }

  let query = supabase
    .from('events')
    .select('*')
    .eq('sport', sport.toUpperCase())
    .order('start_time', { ascending: true })

  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  const yest  = new Date(now - 86400000).toISOString().slice(0, 10)

  if (date === 'today') {
    query = query.gte('start_time', `${today}T00:00:00Z`).lte('start_time', `${today}T23:59:59Z`)
  } else if (date === 'yesterday') {
    query = query.gte('start_time', `${yest}T00:00:00Z`).lte('start_time', `${yest}T23:59:59Z`)
  } else if (date === 'upcoming') {
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
    query = query.gte('start_time', `${tomorrow}T00:00:00Z`)
      .lte('start_time', `${new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)}T23:59:59Z`)
      .limit(30)
  } else {
    query = query.gte('start_time', `${date}T00:00:00Z`).lte('start_time', `${date}T23:59:59Z`)
  }

  return query
}

/**
 * Fetch a single event by its Supabase id.
 */
export async function fetchEvent(id) {
  return supabase.from('events').select('*').eq('id', id).single()
}
```

- [ ] **Step 2: Write a unit test**

```js
// tests/events.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
  }
  return { supabase: chain }
})

import { fetchEvents, fetchEvent } from '../src/lib/events'

describe('fetchEvents', () => {
  it('returns empty array for unknown sport', async () => {
    const { data } = await fetchEvents('cricket', 'today')
    expect(data).toEqual([])
  })
})

describe('fetchEvent', () => {
  it('calls single() for a given id', async () => {
    const result = await fetchEvent('abc-123')
    expect(result.data).toEqual({ id: '1' })
  })
})
```

- [ ] **Step 3: Run the test**

```bash
npm test tests/events.test.js
```

Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/events.js tests/events.test.js
git commit -m "feat: events supabase helper + tests"
```

---

## Task 3: Provider layer + sync-events Live Center sync

**Files:**
- Create: `supabase/functions/sync-events/providers/types.ts`
- Create: `supabase/functions/sync-events/providers/espn.ts`
- Create: `supabase/functions/sync-events/providers/thesportsdb.ts`
- Create: `supabase/functions/sync-events/index.ts`

No API keys needed. ESPN is unauthenticated. TheSportsDB free tier uses the public key `1`.

- [ ] **Step 1: Write the shared GameEvent type**

```ts
// supabase/functions/sync-events/providers/types.ts

export interface GameEvent {
  external_event_id: string
  provider:          string   // 'espn' | 'api-sports' | 'sportradar'
  sport:             string   // 'MLB' | 'NBA' | 'NHL' | 'NFL'
  league:            string
  start_time:        string   // ISO 8601
  status:            string   // 'NS' | 'LIVE' | 'FT'
  home_team:         string
  away_team:         string
  home_abbr:         string
  away_abbr:         string
  home_score:        number | null
  away_score:        number | null
  home_record:       string | null
  away_record:       string | null
  home_logo:         string | null  // URL from TheSportsDB
  away_logo:         string | null  // URL from TheSportsDB
  odds_ml_home:      number | null
  odds_ml_away:      number | null
  odds_spread_home:  number | null
  odds_total:        number | null
  metadata:          Record<string, unknown>
}

export interface SportsProvider {
  fetchGames(sport: string, date: string): Promise<GameEvent[]>
}
```

- [ ] **Step 2: Write the ESPN provider**

ESPN hidden API base: `https://site.api.espn.com/apis/site/v2/sports`

Sport path mapping:
- MLB → `baseball/mlb`
- NBA → `basketball/nba`
- NHL → `hockey/nhl`
- NFL → `football/nfl`

```ts
// supabase/functions/sync-events/providers/espn.ts
import type { GameEvent, SportsProvider } from './types.ts'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

const SPORT_PATHS: Record<string, string> = {
  MLB: 'baseball/mlb',
  NBA: 'basketball/nba',
  NHL: 'hockey/nhl',
  NFL: 'football/nfl',
}

function parseRecord(competitor: any): string | null {
  return competitor?.records?.[0]?.summary ?? null
}

function mapStatus(detail: string, state: string): string {
  if (state === 'pre')  return 'NS'
  if (state === 'post') return 'FT'
  if (state === 'in')   return 'LIVE'
  return state ?? 'NS'
}

function mapEvent(ev: any, sport: string): GameEvent {
  const comp  = ev.competitions?.[0]
  const home  = comp?.competitors?.find((c: any) => c.homeAway === 'home')
  const away  = comp?.competitors?.find((c: any) => c.homeAway === 'away')
  const state = ev.status?.type?.state ?? 'pre'

  return {
    external_event_id: `espn-${ev.id}`,
    provider:          'espn',
    sport,
    league:            sport,
    start_time:        ev.date,
    status:            mapStatus(ev.status?.type?.description, state),
    home_team:         home?.team?.displayName ?? '',
    away_team:         away?.team?.displayName ?? '',
    home_abbr:         home?.team?.abbreviation ?? '',
    away_abbr:         away?.team?.abbreviation ?? '',
    home_score:        home?.score != null ? parseInt(home.score) : null,
    away_score:        away?.score != null ? parseInt(away.score) : null,
    home_record:       parseRecord(home),
    away_record:       parseRecord(away),
    home_logo:         null,  // filled by TheSportsDB provider
    away_logo:         null,
    odds_ml_home:      null,  // odds not in ESPN hidden API
    odds_ml_away:      null,
    odds_spread_home:  null,
    odds_total:        null,
    metadata:          { espn_id: ev.id },
  }
}

export const espnProvider: SportsProvider = {
  async fetchGames(sport: string, date: string): Promise<GameEvent[]> {
    const path = SPORT_PATHS[sport]
    if (!path) return []

    // ESPN date format: YYYYMMDD
    const espnDate = date.replace(/-/g, '')
    const url = `${ESPN_BASE}/${path}/scoreboard?dates=${espnDate}&limit=50`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) {
      console.error(`[espn] ${sport} ${date} → HTTP ${res.status}`)
      return []
    }

    const json = await res.json()
    return (json.events ?? []).map((ev: any) => mapEvent(ev, sport))
  },
}
```

- [ ] **Step 3: Write the TheSportsDB logo provider**

TheSportsDB free public key is `1`. It returns team badge URLs. We call it once per team abbreviation and merge logos into the events array.

```ts
// supabase/functions/sync-events/providers/thesportsdb.ts
import type { GameEvent } from './types.ts'

const TSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/1'

// Cache logos within a single sync run to avoid duplicate requests
const logoCache = new Map<string, string>()

async function fetchTeamLogo(teamName: string): Promise<string | null> {
  if (logoCache.has(teamName)) return logoCache.get(teamName)!

  try {
    const url = `${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const logo = json.teams?.[0]?.strTeamBadge ?? null
    if (logo) logoCache.set(teamName, logo)
    return logo
  } catch {
    return null
  }
}

export async function enrichWithLogos(events: GameEvent[]): Promise<GameEvent[]> {
  // Collect unique team names to minimise requests
  const teamNames = [...new Set(events.flatMap(e => [e.home_team, e.away_team]))]

  // Fetch all logos with a 200ms gap between requests to be polite
  for (const name of teamNames) {
    await fetchTeamLogo(name)
    await new Promise(r => setTimeout(r, 200))
  }

  return events.map(e => ({
    ...e,
    home_logo: logoCache.get(e.home_team) ?? null,
    away_logo: logoCache.get(e.away_team) ?? null,
  }))
}
```

- [ ] **Step 4: Write the Live Center sync orchestrator**

```ts
// supabase/functions/sync-events/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { espnProvider }    from './providers/espn.ts'
import { enrichWithLogos } from './providers/thesportsdb.ts'
import type { GameEvent }  from './providers/types.ts'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET          = Deno.env.get('CRON_SECRET') ?? ''

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Active provider — swap this one line to change data source
const provider = espnProvider

// Sports to sync — start MLB only, add others when validated
const ACTIVE_SPORTS = ['MLB']

// Only sync during game window: noon–midnight ET (17:00–05:00 UTC)
function inGameWindow(): boolean {
  const hour = new Date().getUTCHours()
  return hour >= 17 || hour < 5
}

// Use local date in ET (UTC-4 summer / UTC-5 winter)
function localDateET(): string {
  const now = new Date()
  const etOffset = -4 * 60  // EDT — adjust to -5 for EST in winter
  const etMs = now.getTime() + etOffset * 60 * 1000
  return new Date(etMs).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!inGameWindow()) {
    return new Response(JSON.stringify({ skipped: 'outside game window' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const date = localDateET()
    let allEvents: GameEvent[] = []

    for (const sport of ACTIVE_SPORTS) {
      const events = await provider.fetchGames(sport, date)
      allEvents.push(...events)
    }

    // Enrich with team logos from TheSportsDB
    allEvents = await enrichWithLogos(allEvents)

    if (allEvents.length > 0) {
      const rows = allEvents.map(e => ({ ...e, updated_at: new Date().toISOString() }))
      const { error } = await db
        .from('events')
        .upsert(rows, { onConflict: 'external_event_id,provider' })
      if (error) throw error
    }

    return new Response(JSON.stringify({ synced: allEvents.length, date }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[sync-events]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
```

- [ ] **Step 5: Deploy the Live Center sync**

```bash
supabase functions deploy sync-events --project-ref ocsrwhjypawbeoeyhfnc
```

Expected: `Deployed sync-events` in output.

- [ ] **Step 6: Test the Live Center sync manually**

```bash
curl -X POST https://ocsrwhjypawbeoeyhfnc.supabase.co/functions/v1/sync-events \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected response: `{"synced": N, "date": "2026-06-10"}` where N > 0 during game season.

Check Supabase table editor — rows should appear in `events` table.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sync-events/
git commit -m "feat: sync-events Live Center sync — ESPN provider + TheSportsDB logos, provider abstraction layer"
```

---

### To swap providers later

When ESPN breaks or you want to upgrade to API-Sports:
1. Create `supabase/functions/sync-events/providers/apisports.ts` implementing `SportsProvider`
2. In `index.ts` change one line: `const provider = apiSportsProvider`
3. Redeploy

Frontend never changes. Supabase table schema never changes.

---

## Task 4: Vercel cron trigger for sync-events

**Files:**
- Create: `api/cron-sync-events.js`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron handler**

```js
// api/cron-sync-events.js
// Calls the Supabase Live Center sync every 30 minutes to sync today's events.
export default async function handler(req, res) {
  const SUPABASE_URL      = process.env.SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  const CRON_SECRET       = process.env.CRON_SECRET ?? ''

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-cron-secret': CRON_SECRET,
      },
    })
    const body = await r.json()
    res.status(r.ok ? 200 : 500).json(body)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
```

- [ ] **Step 2: Add the cron entry to vercel.json**

Open `vercel.json`. In the `"crons"` array, add:

```json
{ "path": "/api/cron-sync-events", "schedule": "*/30 * * * *" }
```

So the full crons array becomes:
```json
"crons": [
  { "path": "/api/cron-trial-reminder",   "schedule": "0 14 * * *" },
  { "path": "/api/cron-push-reminder",    "schedule": "0 20 * * *" },
  { "path": "/api/cron-day-one",          "schedule": "0 15 * * *" },
  { "path": "/api/cron-trial-expired",    "schedule": "0 16 * * *" },
  { "path": "/api/cron-reengagement",     "schedule": "0 13 * * *" },
  { "path": "/api/cron-sync-events",      "schedule": "0 * * * *" }
]
```

- [ ] **Step 3: Commit**

```bash
git add api/cron-sync-events.js vercel.json
git commit -m "feat: vercel cron to sync events every 30 min"
```

---

## Task 5: LiveCenter React component

**Files:**
- Create: `src/components/LiveCenter.jsx`

This component owns the full Live Center UI: sport pills → date filter → game list → game detail with LOG POSITION CTA. No external dependencies beyond what's already in the project.

- [ ] **Step 1: Create the component**

```jsx
// src/components/LiveCenter.jsx
import { useState, useEffect } from 'react'
import { fetchEvents } from '../lib/events'

const NEON   = '#BDFF00'
const NEON_T = 'var(--neon-title)'
const R      = 'Rajdhani, sans-serif'
const MUTED  = 'var(--muted)'
const CARD   = 'var(--card)'
const BORDER = 'var(--border2)'

const SPORTS = ['MLB', 'NBA', 'NHL', 'NFL']
const DATES  = ['Yesterday', 'Today', 'Upcoming']

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function statusLabel(status, homeScore, awayScore) {
  if (status === 'FT' || status === 'AOT') return 'Final'
  if (status === 'NS')  return null   // show time instead
  if (status === 'LIVE' || status === 'IP') return 'LIVE'
  return status
}

function OddsChip({ label, odds }) {
  if (!odds) return null
  const sign = odds > 0 ? '+' : ''
  return (
    <div style={{
      background: 'rgba(189,255,0,0.07)', border: `1px solid rgba(189,255,0,0.18)`,
      borderRadius: '4px', padding: '3px 8px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '1px',
    }}>
      <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>{sign}{odds}</span>
    </div>
  )
}

function GameCard({ event, onClick }) {
  const live   = event.status === 'LIVE' || event.status === 'IP'
  const final  = event.status === 'FT' || event.status === 'AOT'
  const noScore = event.home_score == null

  return (
    <div onClick={onClick} style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px',
      padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(189,255,0,0.35)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
    >
      {/* Status row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {live && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,59,59,0.15)', border: '1px solid rgba(255,59,59,0.4)', borderRadius: '3px', padding: '2px 6px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 4px #FF3B3B' }} />
              <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: '#FF3B3B' }}>LIVE</span>
            </span>
          )}
          {final && (
            <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>Final</span>
          )}
          {!live && !final && (
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>{fmtTime(event.start_time)}</span>
          )}
        </div>
        <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{event.league}</span>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { name: event.away_team, abbr: event.away_abbr, record: event.away_record, score: event.away_score },
          { name: event.home_team, abbr: event.home_abbr, record: event.home_record, score: event.home_score },
        ].map((team, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>{team.name}</span>
              {team.record && (
                <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{team.record}</span>
              )}
            </div>
            {!noScore && (
              <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{team.score ?? 0}</span>
            )}
          </div>
        ))}
      </div>

      {/* Odds row */}
      {event.odds_ml_away && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <OddsChip label={event.away_abbr || 'Away'} odds={event.odds_ml_away} />
          <OddsChip label={event.home_abbr || 'Home'} odds={event.odds_ml_home} />
          {event.odds_total && <OddsChip label="O/U" odds={event.odds_total} />}
        </div>
      )}
    </div>
  )
}

function GameDetail({ event, onLogPosition, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Back */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
        display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content',
      }}>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>← BACK</span>
      </button>

      {/* Matchup header */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '20px' }}>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase', marginBottom: '14px' }}>
          {event.league} · {fmtTime(event.start_time)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          {[
            { name: event.away_team, record: event.away_record, score: event.away_score },
            { name: event.home_team, record: event.home_record, score: event.home_score },
          ].map((team, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : 'flex-end', gap: '4px' }}>
              <span style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)' }}>{team.name}</span>
              {team.record && <span style={{ fontFamily: R, fontSize: '9px', color: MUTED }}>{team.record}</span>}
              {team.score != null && <span style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: NEON_T }}>{team.score}</span>}
            </div>
          ))}
          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: MUTED, textAlign: 'center' }}>vs</div>
        </div>
      </div>

      {/* Odds */}
      {event.odds_ml_away && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase', marginBottom: '12px' }}>Main Lines</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <OddsChip label={`${event.away_abbr || 'Away'} ML`} odds={event.odds_ml_away} />
            <OddsChip label={`${event.home_abbr || 'Home'} ML`} odds={event.odds_ml_home} />
            {event.odds_spread_home != null && (
              <OddsChip label={`${event.home_abbr || 'Home'} Spread`} odds={event.odds_spread_home > 0 ? `+${event.odds_spread_home}` : event.odds_spread_home} />
            )}
            {event.odds_total && <OddsChip label="O/U" odds={event.odds_total} />}
          </div>
        </div>
      )}

      {/* LOG POSITION CTA */}
      <button onClick={() => onLogPosition(event)} style={{
        width: '100%', padding: '16px', borderRadius: '8px',
        background: NEON, border: 'none', cursor: 'pointer',
        fontFamily: R, fontSize: '13px', fontWeight: 700,
        letterSpacing: '0.18em', color: '#0A0A0A', textTransform: 'uppercase',
        boxShadow: `0 0 24px rgba(189,255,0,0.35)`,
      }}>
        LOG POSITION
      </button>
    </div>
  )
}

export default function LiveCenter({ onLogPosition }) {
  const [sport,       setSport]       = useState('MLB')
  const [dateFilter,  setDateFilter]  = useState('Today')
  const [events,      setEvents]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selectedId,  setSelectedId]  = useState(null)

  useEffect(() => {
    setLoading(true)
    setSelectedId(null)
    fetchEvents(sport.toLowerCase(), dateFilter.toLowerCase())
      .then(({ data }) => setEvents(data ?? []))
      .finally(() => setLoading(false))
  }, [sport, dateFilter])

  const selected = events.find(e => e.id === selectedId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text)' }}>LIVE CENTER™</div>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase' }}>Game → Position → Settlement</div>
      </div>

      {/* Sport pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
        {SPORTS.map(s => (
          <button key={s} onClick={() => setSport(s)} style={{
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
            padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: sport === s ? NEON : 'var(--card)',
            color: sport === s ? '#0A0A0A' : MUTED,
            boxShadow: sport === s ? `0 0 12px rgba(189,255,0,0.3)` : 'none',
          }}>{s}</button>
        ))}
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: '0', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        {DATES.map(d => (
          <button key={d} onClick={() => setDateFilter(d)} style={{
            flex: 1, padding: '8px', fontFamily: R, fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            background: dateFilter === d ? 'rgba(189,255,0,0.12)' : 'var(--card)',
            color: dateFilter === d ? NEON_T : MUTED,
            borderRight: d !== 'Upcoming' ? `1px solid ${BORDER}` : 'none',
          }}>{d}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>LOADING SLATE...</div>
      ) : selected ? (
        <GameDetail event={selected} onBack={() => setSelectedId(null)} onLogPosition={onLogPosition} />
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.14em' }}>NO GAMES FOUND</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(e => (
            <GameCard key={e.id} event={e} onClick={() => setSelectedId(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LiveCenter.jsx
git commit -m "feat: LiveCenter component — game list, game detail, LOG POSITION CTA"
```

---

## Task 6: Wire LiveCenter into App.jsx

**Files:**
- Modify: `src/App.jsx`

Three changes needed:
1. Import `LiveCenter`
2. Add `'live'` tab to desktop nav and mobile bottom nav
3. Add `initialBet` state + pass to `AddBetModal` + pass `onLogPosition` handler to `LiveCenter`

- [ ] **Step 1: Add the import at the top of App.jsx** (around line 10, after other component imports)

Find the block:
```jsx
import PartnersPage    from './components/PartnersPage'
```

Add after it:
```jsx
import LiveCenter      from './components/LiveCenter'
```

- [ ] **Step 2: Add `initialBet` state** (near line 2318 where other useState calls are)

Find:
```js
const [tab,          setTab]          = useState('overview')
```

Add immediately after it:
```js
const [initialBet,   setInitialBet]   = useState(null)
```

- [ ] **Step 3: Update the AddBetModal render** (line ~2951)

Find:
```jsx
{showAdd && <AddBetModal onAdd={b => {
```

The `AddBetModal` already accepts an `initial` prop (see line 432 of App.jsx). Change the render to pass it:
```jsx
{showAdd && <AddBetModal initial={initialBet} onAdd={b => {
```

And update `onClose` to also clear `initialBet`:
```jsx
onClose={() => { setShowAdd(false); setInitialBet(null) }}
```

- [ ] **Step 4: Add the `onLogPosition` handler** (add near the other handler functions, around line 2932)

Find `const roi = stats.roi` and add before it:
```jsx
const handleLogPosition = (event) => {
  setInitialBet({
    date:    new Date().toISOString().slice(0, 10),
    sport:   event.sport,
    event:   `${event.away_team} vs ${event.home_team}`,
    betType: 'Straight',
    book:    '',
    pick:    '',
    odds:    String(event.odds_ml_away ?? ''),
    units:   '',
    stake:   '',
    result:  'Open',
    pnl:     0,
    notes:   `Live Center — ${event.league} · ${event.external_event_id}`,
  })
  setShowAdd(true)
  setTab('bet log')
}
```

- [ ] **Step 5: Add `'live'` to the desktop tab list** (line ~3718)

Find:
```jsx
{[['overview','Analytics'],['ladder','Ladder'],['bet log','Bet Log'],['analytics','Overview'],['rr engine','RR Engine'],['session','Session'],['partners','Partners']].map(
```

Replace with:
```jsx
{[['live','Live Center'],['overview','Analytics'],['ladder','Ladder'],['bet log','Bet Log'],['analytics','Overview'],['rr engine','RR Engine'],['session','Session'],['partners','Partners']].map(
```

- [ ] **Step 6: Add `'live'` to the mobile bottom nav** (line ~4674)

The mobile nav already has 7 items and is tight. Add Live Center to the "More" sheet instead. Find the More sheet items array (line ~4647):
```jsx
[
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'session',   label: 'Session',   icon: Sliders },
]
```

Replace with:
```jsx
[
  { id: 'live',      label: 'Live',      icon: Radio     },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'session',   label: 'Session',   icon: Sliders },
]
```

Then add `Radio` to the lucide-react import at the top of App.jsx. Find the existing import line (starts with `import {`) and add `Radio` to it.

- [ ] **Step 7: Render LiveCenter in the tab content area** (line ~4627)

Find:
```jsx
{tab === 'partners' && <PartnersPage darkMode={darkMode} isMobile={isMobile} />}
```

Add after it:
```jsx
{tab === 'live' && <LiveCenter onLogPosition={handleLogPosition} />}
```

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire LiveCenter tab into App — desktop nav, mobile more sheet, Log Position handler"
```

---

## Task 7: Manual seed data for MVP testing (no API key yet)

While waiting for API-Sports free tier approval or before spending credits, seed the `events` table manually so the UI is testable immediately.

**Files:**
- Create: `supabase/seeds/events-mlb-sample.sql`

- [ ] **Step 1: Create the seed file**

```sql
-- supabase/seeds/events-mlb-sample.sql
-- Run once in Supabase SQL editor to seed today's MLB slate for testing.
-- Replace '2026-06-10' with actual today's date.

insert into public.events
  (external_event_id, provider, sport, league, start_time, status,
   home_team, away_team, home_abbr, away_abbr,
   home_score, away_score, home_record, away_record,
   odds_ml_home, odds_ml_away, odds_spread_home, odds_total)
values
  ('mlb-seed-1', 'manual', 'MLB', 'MLB', '2026-06-10T18:10:00Z', 'NS',
   'San Diego Padres', 'Cincinnati Reds', 'SD', 'CIN',
   null, null, '34-32', '32-34',
   -173, +145, -1.5, 8.5),
  ('mlb-seed-2', 'manual', 'MLB', 'MLB', '2026-06-10T19:05:00Z', 'NS',
   'New York Yankees', 'Boston Red Sox', 'NYY', 'BOS',
   null, null, '38-28', '31-35',
   -145, +125, -1.5, 9.0),
  ('mlb-seed-3', 'manual', 'MLB', 'MLB', '2026-06-10T22:10:00Z', 'NS',
   'Los Angeles Dodgers', 'San Francisco Giants', 'LAD', 'SF',
   null, null, '40-26', '29-37',
   -195, +165, -1.5, 7.5)
on conflict (external_event_id, provider) do nothing;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste the file contents → Run. Verify 3 rows appear in the `events` table.

- [ ] **Step 3: Commit**

```bash
git add supabase/seeds/events-mlb-sample.sql
git commit -m "chore: seed sample MLB events for Live Center testing"
```

---

## Task 8: Build + deploy

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: all existing tests pass (40 tests) plus the 2 new events tests = 42 passing.

- [ ] **Step 2: Build and preview**

```bash
npx vite build && npx vite preview --port 4173
```

Open http://localhost:4173 in browser. Verify:
- Live Center tab appears in desktop nav
- Live Center appears in mobile "More" sheet
- Sport pills render — MLB, NBA, NHL, NFL
- Today/Yesterday/Upcoming date filters work
- 3 seeded MLB games appear as cards
- Tapping a game card opens GameDetail
- LOG POSITION button opens AddBetModal pre-filled with team names and sport
- Closing the modal clears initialBet (no stale data on next open)

- [ ] **Step 3: Deploy**

```bash
npm run build && npx vercel deploy --prod --force
```

- [ ] **Step 4: Commit any final fixes**

```bash
git add -p
git commit -m "feat: Live Center MVP — game slate, game detail, Log Position"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Sport pill tabs (MLB/NBA/NHL/NFL) | Task 5 — SPORTS array in LiveCenter |
| Date filter (Yesterday/Today/Upcoming) | Task 5 — DATES array + fetchEvents logic |
| Game cards (teams, records, time, status, ML odds) | Task 5 — GameCard component |
| Tap game → game detail | Task 5 — selectedId state + GameDetail component |
| LOG POSITION CTA | Task 5 — GameDetail button, Task 6 — handleLogPosition |
| Auto-fill sport/teams/date/event on log | Task 6 — handleLogPosition sets initialBet |
| Mobile-first | Task 5 — all inline styles mobile-first, pill overflow scroll |
| API-Sports integration | Task 3 — Live Center sync |
| Database schema (events table) | Task 1 |
| Cron sync strategy (30 min) | Task 4 |
| Brand colors (#BDFF00 / #0A0A0A) | Task 5 — NEON, NEON_T constants throughout |
| Apple Sports simplicity | Task 5 — minimal cards, no clutter |
| MVP = MLB only first | Task 3 — SPORTS array has only MLB; Tasks 5 seeds MLB |

**Gaps (Phase 2+ — not in this plan):**
- Active Positions section on game detail (Phase 3)
- Auto-settlement when final score available (Phase 4)
- MLB probable pitchers / starting lineups (Phase 5)
- Team logos (API-Sports provides URLs — add to metadata in Task 3, render in Task 5 Phase 2)

**Placeholder scan:** No TBDs, no TODOs, no "implement later." All code blocks are complete.

**Type consistency:** `external_event_id` used in Task 1 (SQL), Task 3 (edge fn mapGame), Task 5 (notes field), Task 7 (seed). Consistent. `fetchEvents(sport, date)` used in Task 2 (definition) and Task 5 (useEffect call). Consistent.

---

## Notes for Next Phases

- **Phase 2 (Log From Game):** Done — `handleLogPosition` pre-fills `initialBet`. After logging, show a "Position logged" confirmation on the game detail page by checking `bets` for `external_event_id` in the notes field.
- **Phase 3 (Active Positions):** Add a query in `events.js` that joins bets with matching `external_event_id` from the notes field. Show open positions count on the game card.
- **Phase 4 (Auto-Settlement):** Extend `sync-events` Live Center sync — after upserting scores, query `bets` table for Open bets with matching event_id in notes, grade moneyline (home_score vs away_score), upsert result.
- **NBA/NHL/NFL:** Add entries to the `SPORTS` array in `sync-events/index.ts` with their API-Sports league IDs once MLB is validated.
