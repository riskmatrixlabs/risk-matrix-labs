// nflverse team-stats source for the NFL side model (SHADOW).
//
// Source: nflverse-data GitHub release, team-level regular-season stats:
//   https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_reg_<season>.csv
// Schema VERIFIED 2026-08-11 against the live stats_team_reg_2025.csv asset. Columns are
// located BY HEADER NAME (never position) so upstream column reordering can't corrupt us.
//
// Per-team output (keyed by team abbreviation, e.g. 'ARI'):
//   offEpaPerPlay         (passing_epa + rushing_epa) / plays, plays = attempts + carries + sacks_suffered
//   defEpaPerPlayAllowed  null from the SEASON file (no opponent-EPA column there); derived
//                         from the WEEKLY file instead (stats_team_week_<season>.csv, schema
//                         verified 2026-08-11 by downloading the live asset — has an
//                         opponent_team column). defEpaPerPlayAllowed(T) = mean over T's games
//                         of the opponent's offensive EPA/play in that game (rows where
//                         opponent_team === T). Weekly fetch cached separately (NFLDEF:<season>);
//                         if it fails, def stays null → nflLean emits no lean (honest null).
//   sackRateAllowed       sacks_suffered / (attempts + sacks_suffered)   (dropback proxy)
//   explosiveRate         (passing_20 + rushing_10) / plays  (standard explosive definition:
//                         pass gains 20+, rush gains 10+)
//   turnoverMargin        (def_interceptions + fumble_recovery_opp) − (passing_interceptions + fumbles_lost_total)
//   playsPerGame          plays / games
//
// Any metric whose source columns are missing → null for that metric (fail-soft). A file with
// no usable rows → null overall. Callers (game-info NFL branch) emit no lean on null.
//
// Cached 24h in scan_cache via the existing scanStore pattern, key `NFLSTATS:<season>`.
import { readScan, writeScan, isFresh } from './scanStore.js'

export const NFLSTATS_TTL_MS = 24 * 60 * 60 * 1000

export function statsUrl(season) {
  return `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_reg_${season}.csv`
}

export function weeklyStatsUrl(season) {
  return `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`
}

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const sum = (...vals) => vals.some((v) => v == null) ? null : vals.reduce((a, b) => a + b, 0)

// Pure parser — unit-tested on a fixture. csvText → { [teamAbbr]: metrics } | null.
// Simple comma split is safe: the verified schema has no quoted/comma-embedded fields
// (list columns use semicolons).
export function parseTeamStatsCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return null
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return null
  const header = lines[0].split(',').map((h) => h.trim())
  const col = (name) => header.indexOf(name) // -1 → missing → num(undefined) → null
  const iTeam = col('team'), iType = col('season_type')
  // Require the core identity columns — a file without them is not the stats_team schema.
  if (iTeam < 0 || iType < 0 || col('games') < 0) return null
  const out = {}
  for (let li = 1; li < lines.length; li++) {
    const f = lines[li].split(',')
    const team = (f[iTeam] || '').trim()
    if (!team) continue
    if (iType >= 0 && f[iType] !== 'REG') continue // regular season only
    const g = (name) => { const i = col(name); return i >= 0 ? num(f[i]) : null }

    const attempts = g('attempts'), carries = g('carries'), sacks = g('sacks_suffered')
    const plays = sum(attempts, carries, sacks)
    const games = g('games')
    const epa = sum(g('passing_epa'), g('rushing_epa'))
    const explosive = sum(g('passing_20'), g('rushing_10'))
    const takeaways = sum(g('def_interceptions'), g('fumble_recovery_opp'))
    const giveaways = sum(g('passing_interceptions'), g('fumbles_lost_total'))
    const dropbacks = sum(attempts, sacks)

    out[team] = {
      offEpaPerPlay: (epa != null && plays > 0) ? epa / plays : null,
      defEpaPerPlayAllowed: null, // not in the SEASON schema — merged in from the weekly file (mergeDefEpa)
      sackRateAllowed: (sacks != null && dropbacks > 0) ? sacks / dropbacks : null,
      explosiveRate: (explosive != null && plays > 0) ? explosive / plays : null,
      turnoverMargin: (takeaways != null && giveaways != null) ? takeaways - giveaways : null,
      playsPerGame: (plays != null && games > 0) ? plays / games : null,
    }
  }
  return Object.keys(out).length ? out : null
}

// Pure parser for the WEEKLY file — defEpaPerPlayAllowed per team.
// For each REG row, the row team's offensive EPA/play that game =
//   (passing_epa + rushing_epa) / (attempts + carries + sacks_suffered)
// and it counts AGAINST the row's opponent_team. def(T) = mean over T's games.
// Rows with any missing component are skipped (no fabricated per-game value);
// a team with zero usable games gets no key. Missing core columns → null.
export function parseWeeklyDefEpaCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return null
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return null
  const header = lines[0].split(',').map((h) => h.trim())
  const col = (name) => header.indexOf(name)
  const need = ['team', 'season_type', 'opponent_team', 'attempts', 'carries', 'sacks_suffered', 'passing_epa', 'rushing_epa']
  if (need.some((n) => col(n) < 0)) return null
  const iType = col('season_type'), iOpp = col('opponent_team')
  const acc = {} // opponent → { sum, n }
  for (let li = 1; li < lines.length; li++) {
    const f = lines[li].split(',')
    if (f[iType] !== 'REG') continue
    const opp = (f[iOpp] || '').trim()
    if (!opp) continue
    const g = (name) => num(f[col(name)])
    const plays = sum(g('attempts'), g('carries'), g('sacks_suffered'))
    const epa = sum(g('passing_epa'), g('rushing_epa'))
    if (epa == null || !(plays > 0)) continue // skip unusable game rows
    const a = acc[opp] || (acc[opp] = { sum: 0, n: 0 })
    a.sum += epa / plays
    a.n += 1
  }
  const out = {}
  for (const [t, a] of Object.entries(acc)) out[t] = a.sum / a.n
  return Object.keys(out).length ? out : null
}

// Merge weekly-derived defEpaPerPlayAllowed into the season stats map. Pure.
// Missing def map or missing team → def stays null (fail-soft, honest null downstream).
export function mergeDefEpa(stats, defMap) {
  if (!stats) return null
  const out = {}
  for (const [t, m] of Object.entries(stats)) {
    const d = defMap && Number.isFinite(defMap[t]) ? defMap[t] : null
    out[t] = { ...m, defEpaPerPlayAllowed: d }
  }
  return out
}

// Generic cached CSV fetch → parsed payload. Fail-soft: fetch/parse failure → stale cache or null.
async function cachedCsv(cacheKey, seasonStr, url, parse) {
  const cached = await readScan(cacheKey, seasonStr)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), NFLSTATS_TTL_MS)) {
    return cached.payload
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) return cached?.payload || null // stale cache beats nothing
  const parsed = parse(await res.text())
  if (!parsed) return cached?.payload || null
  await writeScan(cacheKey, seasonStr, parsed, null) // best-effort; never throws
  return parsed
}

// Network + cache wrapper. 24h scan_cache TTL, keys NFLSTATS:<season> (season file) and
// NFLDEF:<season> (weekly-derived def EPA allowed, cached separately). Fail-soft: any
// fetch/parse/cache failure → null overall or def-null (callers emit no lean, never throw).
export async function fetchNflTeamStats(season) {
  const s = String(season)
  try {
    const [stats, defMap] = await Promise.all([
      cachedCsv('NFLSTATS', s, statsUrl(s), parseTeamStatsCsv),
      cachedCsv('NFLDEF', s, weeklyStatsUrl(s), parseWeeklyDefEpaCsv).catch(() => null),
    ])
    if (!stats) return null
    return mergeDefEpa(stats, defMap)
  } catch {
    return null
  }
}
