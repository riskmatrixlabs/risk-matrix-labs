// Offense-side O/U signals — lineup xwOBA (platoon-adjusted) + recent scoring form.
// Pure scoring fns below are I/O-free and unit-tested; getOffense() (added in a later task) fetches.

import { readScan, writeScan } from './scanStore.js'
import { getSavantMaps, normName } from '../savant.js'

export const OFF = {
  xwobaStrong: 0.335,
  xwobaWeak:   0.305,
  formHigh:    9.8,
  formLow:     8.0,
  minBatters:  6,
}

export function platoonMult(batSide, starterHand) {
  if (!batSide || !starterHand) return 1
  if (batSide === 'S') return 1.03
  return batSide !== starterHand ? 1.05 : 0.95
}

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

export function offenseFactor(awayXwoba, homeXwoba) {
  if (awayXwoba == null || homeXwoba == null) return { score: 0, reason: null }
  const both = (cmp) => cmp(awayXwoba) && cmp(homeXwoba)
  if (both((x) => x >= OFF.xwobaStrong)) return { score: 1, reason: 'hot bats' }
  if (both((x) => x <= OFF.xwobaWeak))   return { score: -1, reason: 'cold lineups' }
  return { score: 0, reason: null }
}

export function formFactor(combinedRpg) {
  if (combinedRpg == null) return { score: 0, reason: null }
  if (combinedRpg >= OFF.formHigh) return { score: 1, reason: `high-scoring form (${combinedRpg.toFixed(1)})` }
  if (combinedRpg <= OFF.formLow)  return { score: -1, reason: `low-scoring form (${combinedRpg.toFixed(1)})` }
  return { score: 0, reason: null }
}

// --- data orchestration ---
const ymd = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10) // ET day
async function gj(url, ms = 6000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { const r = await fetch(url, { signal: c.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}
const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

// Map our away/home team names → today's MLB gamePk + posted lineups + probable-pitcher hands.
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
  const mapPlayers = (arr) => (arr || []).map((p) => ({ name: p.fullName, batSide: p.batSide?.code || null }))
  return {
    gamePk: g.gamePk,
    away: mapPlayers(g.lineups?.awayPlayers),
    home: mapPlayers(g.lineups?.homePlayers),
    awayStarterHand: g.teams?.away?.probablePitcher?.pitchHand?.code || null,
    homeStarterHand: g.teams?.home?.probablePitcher?.pitchHand?.code || null,
  }
}

// Team-season OPS as a strength proxy (MLB Stats team hitting).
async function teamWoba(teamId) {
  if (!teamId) return null
  const date = ymd()
  const c = await readScan(`TEAMWOBA-${teamId}`, date); if (c?.payload?.woba != null) return c.payload.woba
  const j = await gj(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${new Date().getUTCFullYear()}`, 7000)
  const woba = Number(j?.stats?.[0]?.splits?.[0]?.stat?.ops)
  if (Number.isFinite(woba)) { await writeScan(`TEAMWOBA-${teamId}`, date, { woba }, null); return woba }
  return null
}

// Recent per-game total runs (last ~7 finished games) for a team.
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
export async function getOffense({ away, home, awayId, homeId }) {
  const empty = { offense: { score: 0, reason: null }, form: { score: 0, reason: null }, source: 'none' }
  try {
    const sav = await getSavantMaps().catch(() => null)
    const batters = sav?.batter || {}
    const g = await mlbGame(away, home).catch(() => null)
    let awayX = null, homeX = null, source = 'none'
    if (g) {
      awayX = lineupXwoba(g.away, batters, g.homeStarterHand, normName)?.xwoba ?? null
      homeX = lineupXwoba(g.home, batters, g.awayStarterHand, normName)?.xwoba ?? null
      if (awayX != null && homeX != null) source = 'lineup'
    }
    if (source !== 'lineup') {
      const [ao, ho] = await Promise.all([teamWoba(awayId).catch(() => null), teamWoba(homeId).catch(() => null)])
      if (ao != null && ho != null) {
        awayX = +(ao * 0.45).toFixed(3); homeX = +(ho * 0.45).toFixed(3); source = 'team'
      }
    }
    const [ar, hr] = await Promise.all([recentRpg(awayId).catch(() => null), recentRpg(homeId).catch(() => null)])
    const combinedRpg = (ar != null && hr != null) ? (ar + hr) / 2 : null
    return { offense: offenseFactor(awayX, homeX), form: formFactor(combinedRpg), source }
  } catch { return empty }
}
