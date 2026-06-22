// Platoon (L/R) matchup signal for the MLB O/U model — a self-contained, additive run-delta.
//
// WHY: the same lineup scores very differently vs a LHP than vs a RHP. Season-stat models
// (team OPS/wOBA, even our lineup xwOBA) miss this entirely. This module reads each lineup's
// ACTUAL split-stat production vs the OPPOSING starter's throwing hand and compares it to that
// lineup's own baseline (its overall split-vs-the-other-hand and team norm). A lineup well ABOVE
// its baseline vs the hand it's facing → pushes the total OVER; well below → UNDER.
//
// DATA: free MLB Stats API (statsapi.mlb.com, no key) — same source/caching pattern as the
// bullpen-ERA read in api/game-info.js.
//
// ── LINEUP-TIMING CAVEAT (important) ──
// Confirmed batting orders only appear in the boxscore (battingOrder) ~3h before first pitch.
// Before that the boxscore battingOrder arrays are EMPTY. When no lineup is posted for EITHER
// side, this module returns { delta: 0, reason: null } — it never guesses. So the platoon edge
// only lights up for games inside the ~3h pre-game window (and degrades to neutral otherwise).
//
// EVERY failure path (no lineups, any fetch error, missing splits) → { delta: 0, reason: null }.

import { readScan, writeScan, isFresh } from './scanStore.js'

const SEASON = 2026

// ── Tunables (run estimates / a hypothesis; the graded record validates them over time) ──
export const HAND = {
  // How far a lineup's wOBA-vs-hand must sit above/below its baseline to register (wOBA points).
  strongAbove: 0.020,   // ~mashes the hand it faces
  weakBelow:   0.020,   // ~struggles vs the hand it faces
  // Convert an above/below-baseline wOBA edge (per lineup) into runs. A full ~.040 lineup-wide
  // wOBA swing across both teams maps to a few tenths of a run — kept gentle on purpose.
  runsPerWoba: 9.0,
  cap:         0.7,     // hard cap on |delta| in runs — platoon is a nudge, not a driver
  minBaseline: 0.250,   // sanity floor: ignore implausibly low split wOBA (bad/empty data)
}

// ── Pure delta calc (unit-tested, no I/O) ──
// lineupVsHandData: {
//   away: { vsHand: <wOBA the AWAY lineup posts vs the home starter's hand>, baseline: <its own ref wOBA> } | null,
//   home: { vsHand: <wOBA the HOME lineup posts vs the away starter's hand>, baseline: <its own ref wOBA> } | null,
// }
// awayStarterThrows / homeStarterThrows: 'L' | 'R' (used only for the human reason string).
export function handednessDelta({ gamePk, awayStarterThrows, homeStarterThrows, lineupVsHandData } = {}) {
  const ZERO = { delta: 0, reason: null }
  const d = lineupVsHandData
  if (!d || (!d.away && !d.home)) return ZERO

  // Per-lineup edge in wOBA points: how far this lineup's production vs the hand it faces sits
  // above (+) or below (−) its own baseline. null when a side has no posted/valid splits.
  const edge = (side) => {
    if (!side || side.vsHand == null || side.baseline == null) return null
    if (side.vsHand < HAND.minBaseline || side.baseline < HAND.minBaseline) return null
    return side.vsHand - side.baseline
  }
  const ae = edge(d.away)   // away lineup vs HOME starter's hand
  const he = edge(d.home)   // home lineup vs AWAY starter's hand
  if (ae == null && he == null) return ZERO

  // Sum the edges that exist → both lineups mashing their opposing hand stacks toward OVER.
  const sumEdge = (ae || 0) + (he || 0)
  let delta = sumEdge * HAND.runsPerWoba
  delta = Math.max(-HAND.cap, Math.min(HAND.cap, delta))
  delta = Math.round(delta * 10) / 10

  // Reason: name the dominant side's signal vs the hand it faces. Only when it's a real nudge.
  let reason = null
  const handName = (c) => (c === 'L' ? 'LHP' : c === 'R' ? 'RHP' : 'opp hand')
  const STRONG = HAND.strongAbove, WEAK = -HAND.weakBelow
  // Pick the side with the larger-magnitude edge to describe.
  const cand = [
    ae != null ? { e: ae, hand: handName(homeStarterThrows) } : null,
    he != null ? { e: he, hand: handName(awayStarterThrows) } : null,
  ].filter(Boolean).sort((x, y) => Math.abs(y.e) - Math.abs(x.e))
  const top = cand[0]
  if (top && Math.abs(delta) >= 0.1) {
    if (top.e >= STRONG) reason = `lineup mashes ${top.hand}`
    else if (top.e <= WEAK) reason = `weak vs ${top.hand}`
  }
  if (delta === 0) reason = null
  return { delta, reason }
}

// ── Data loader (free MLB Stats API; degrades to neutral on any failure) ──

async function gj(url, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}
const ymd = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10) // ET day

// One hitter's wOBA vs a given pitcher hand from statSplits (vl = vs LHP, vr = vs RHP).
// MLB Stats split codes: 'vl' → vs left-handed pitching, 'vr' → vs right-handed pitching.
async function batterWobaVsHand(personId, hand /* 'L' | 'R' */) {
  if (!personId || (hand !== 'L' && hand !== 'R')) return null
  const sit = hand === 'L' ? 'vl' : 'vr'
  const date = ymd()
  const key = `HANDSPLIT-${personId}-${sit}`
  const cached = await readScan(key, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), 12 * 3600e3)) {
    return cached.payload.woba ?? null
  }
  const j = await gj(`https://statsapi.mlb.com/api/v1/people/${personId}/stats?stats=statSplits&sitCodes=${sit}&group=hitting&season=${SEASON}`)
  const splits = j?.stats?.[0]?.splits || []
  const stat = splits.find((s) => s.split?.code === sit)?.stat || splits[0]?.stat
  const woba = stat?.woba != null ? Number(stat.woba)
    : stat?.ops != null ? Number(stat.ops) * 0.5   // wOBA proxy when woba field absent (~OPS scale)
    : null
  const out = Number.isFinite(woba) ? woba : null
  await writeScan(key, date, { woba: out }, null)
  return out
}

// Aggregate a posted lineup's wOBA vs a hand, plus its baseline (vs the OTHER hand) for reference.
// batters: [{ id }]. Returns { vsHand, baseline } | null.
async function lineupVsHand(batters, oppStarterHand) {
  if (!Array.isArray(batters) || !batters.length) return null
  if (oppStarterHand !== 'L' && oppStarterHand !== 'R') return null
  const otherHand = oppStarterHand === 'L' ? 'R' : 'L'
  const ids = batters.map((b) => b.id).filter(Boolean).slice(0, 9)
  if (ids.length < 6) return null   // need a real (≈confirmed) lineup
  const [vs, base] = await Promise.all([
    Promise.all(ids.map((id) => batterWobaVsHand(id, oppStarterHand).catch(() => null))),
    Promise.all(ids.map((id) => batterWobaVsHand(id, otherHand).catch(() => null))),
  ])
  const avg = (arr) => { const v = arr.filter((x) => x != null); return v.length >= 6 ? v.reduce((s, x) => s + x, 0) / v.length : null }
  const vsHand = avg(vs)
  // Baseline = this lineup's production vs the OTHER hand (its own reference point), so a lineup
  // that simply rakes everyone doesn't read as a platoon edge — only the SPLIT relative to itself.
  const baseline = avg(base)
  if (vsHand == null || baseline == null) return null
  return { vsHand: +vsHand.toFixed(3), baseline: +baseline.toFixed(3) }
}

// Fetch confirmed lineups + starter hands for a game, then build lineupVsHandData and the delta.
// Returns { delta, reason } — ALWAYS neutral { delta:0, reason:null } on any miss/failure.
//
// gamePk: MLB Stats API game id (from the schedule, e.g. via api/_lib/offense.js mlbGame()).
export async function loadHandednessDelta(gamePk) {
  const ZERO = { delta: 0, reason: null }
  if (!gamePk) return ZERO
  try {
    // Confirmed batting orders only exist in the boxscore ~3h pre-game (empty before that).
    const box = await gj(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`)
    const teams = box?.teams
    if (!teams) return ZERO

    const orderedBatters = (teamSide) => {
      const t = teams?.[teamSide]; if (!t) return []
      const players = t.players || {}
      // battingOrder is a 3-digit string ("100".."900"); starters present only when posted.
      return Object.values(players)
        .filter((p) => p?.battingOrder && Number(p.battingOrder) > 0 && Number(p.battingOrder) % 100 === 0)
        .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder))
        .map((p) => ({ id: p.person?.id }))
    }
    const awayBatters = orderedBatters('away')
    const homeBatters = orderedBatters('home')
    // No lineups posted on EITHER side → neutral (the documented timing fallback).
    if (awayBatters.length < 6 && homeBatters.length < 6) return ZERO

    // Starter hands: probable pitcher in the boxscore, else the live/feed pitcher hand.
    const starterHand = (teamSide) => {
      const t = teams?.[teamSide]; if (!t) return null
      const pp = t.players?.[`ID${t.team?.id}`] // not reliable; fall through to pitchers list
      const pitcherIds = t.pitchers || []
      const firstPitcher = pitcherIds.length ? t.players?.[`ID${pitcherIds[0]}`] : null
      const hand = firstPitcher?.person?.pitchHand?.code
      return hand === 'L' || hand === 'R' ? hand : null
    }
    let awayThrows = starterHand('away')
    let homeThrows = starterHand('home')
    // Fallback to the schedule probablePitcher hydrate if the boxscore lacks pitch hands.
    if (!awayThrows || !homeThrows) {
      const date = ymd()
      const sched = await gj(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&gamePk=${gamePk}&hydrate=probablePitcher`)
      const g = sched?.dates?.[0]?.games?.find((x) => String(x.gamePk) === String(gamePk))
      awayThrows = awayThrows || g?.teams?.away?.probablePitcher?.pitchHand?.code || null
      homeThrows = homeThrows || g?.teams?.home?.probablePitcher?.pitchHand?.code || null
    }
    if ((awayThrows !== 'L' && awayThrows !== 'R') || (homeThrows !== 'L' && homeThrows !== 'R')) return ZERO

    // Away lineup faces the HOME starter's hand; home lineup faces the AWAY starter's hand.
    const [away, home] = await Promise.all([
      lineupVsHand(awayBatters, homeThrows).catch(() => null),
      lineupVsHand(homeBatters, awayThrows).catch(() => null),
    ])
    if (!away && !home) return ZERO

    return handednessDelta({
      gamePk,
      awayStarterThrows: awayThrows,
      homeStarterThrows: homeThrows,
      lineupVsHandData: { away, home },
    })
  } catch { return ZERO }
}
