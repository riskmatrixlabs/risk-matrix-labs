// Baseball Savant (Statcast) — FREE, no key. Feeds the PHLT v2.2 hitter-hit prop model:
//   • batter xBA (est_ba) — the "is this hitter actually hitting the ball hard" signal
//   • pitcher xBA-against (est_ba) + xERA/ERA — how beatable the pitcher is on contact
//   • pitcher K% + Whiff% — the Red-Flag-pitcher fade inputs
//
// Savant keys everything by MLBAM player_id and prints names "Last, First"; ESPN (our roster
// source) uses ESPN ids + "First Last". They don't share ids, so we MATCH BY NORMALIZED NAME.
// Season leaderboards barely move day-to-day, so each CSV is cached ~12h in scan_cache → the
// paid Odds-API budget is never touched and Savant gets one pull per slate. See rml-phlt-model.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'

export const config = { maxDuration: 25 }

const YEAR = 2026
const TTL_MS = 12 * 60 * 60 * 1000 // season stats are slow — one pull per ~half-day

const URLS = {
  // name, player_id, pa, ba, est_ba (=xBA), est_slg, est_woba
  batter: `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${YEAR}&position=&team=&filterType=bip&min=q&csv=true`,
  // same shape + era, xera, era_minus_xera_diff (est_ba here = xBA-AGAINST)
  pitcherX: `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=${YEAR}&position=&team=&filterType=bip&min=q&csv=true`,
  // name, player_id, k_percent, whiff_percent
  pitcherK: `https://baseballsavant.mlb.com/leaderboard/custom?year=${YEAR}&type=pitcher&filter=&min=q&selections=k_percent,whiff_percent&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm&sort=k_percent&sortDir=desc&csv=true`,
}

// ── helpers ──────────────────────────────────────────────────────────────────
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

// Strip accents/punctuation/suffixes so "Sánchez, Cristopher" and ESPN's "Cristopher Sanchez"
// collapse to the same key. Savant prints "Last, First" → flip to "first last".
function normName(raw) {
  let s = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (s.includes(',')) { const [last, first] = s.split(','); s = `${first.trim()} ${last.trim()}` }
  return s.replace(/[.'`’\-]/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
}

// Minimal RFC-ish CSV: handles quoted fields containing commas. One line → string[] of cells.
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim().length)
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0])
  return lines.slice(1).map(l => {
    const cells = parseCsvLine(l)
    const row = {}
    header.forEach((h, i) => { row[h] = cells[i] })
    return row
  })
}

// Fetch + cache one Savant leaderboard for today, mapped name→record by `build`.
// Returns { map, count, sample } ; degrades to an empty map on any failure (never throws).
async function loadBoard(kind, url, build) {
  const date = todayStr()
  const cached = await readScan(`SAVANT-${kind}`, date)
  if (cached?.payload?.map && isFresh(cached.scanned_at, Date.now(), TTL_MS)) {
    return { map: cached.payload.map, count: cached.payload.count, cached: true }
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'risk-matrix-labs/1.0' } })
    if (!r.ok) throw new Error(`savant ${kind} ${r.status}`)
    const rows = parseCsv(await r.text())
    const map = {}
    for (const row of rows) {
      const name = row['last_name, first_name']
      if (!name) continue
      const rec = build(row)
      if (rec) map[normName(name)] = rec
    }
    const count = Object.keys(map).length
    if (count) await writeScan(`SAVANT-${kind}`, date, { map, count })
    return { map, count, cached: false }
  } catch (e) {
    // fall back to a stale cache if we have one rather than going dark
    if (cached?.payload?.map) return { map: cached.payload.map, count: cached.payload.count, cached: true, stale: true }
    return { map: {}, count: 0, error: String(e?.message || e) }
  }
}

const buildBatter = (row) => {
  const xba = toNum(row.est_ba); if (xba == null) return null
  return { xba, xslg: toNum(row.est_slg), xwoba: toNum(row.est_woba), ba: toNum(row.ba), pa: toNum(row.pa) }
}
const buildPitcherX = (row) => {
  const xbaA = toNum(row.est_ba); if (xbaA == null) return null
  return { xbaAgainst: xbaA, era: toNum(row.era), xera: toNum(row.xera), pa: toNum(row.pa) }
}
const buildPitcherK = (row) => {
  const k = toNum(row.k_percent), w = toNum(row.whiff_percent)
  if (k == null && w == null) return null
  return { kPct: k, whiffPct: w }
}

// ── handler ──────────────────────────────────────────────────────────────────
// GET /api/savant?names=James Wood|Aaron Judge&pitchers=Sandy Alcantara
//   → { batters: { "<normName>": {xba,...} }, pitchers: { "<normName>": {xbaAgainst,kPct,whiffPct,...} } }
// ?probe=1 (owner-style debug) also returns board counts + a few sample keys to prove a live pull.
export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  res.setHeader('Cache-Control', 'public, max-age=3600')

  const splitNames = (s) => String(s || '').split('|').map(normName).filter(Boolean)
  const wantBatters = splitNames(req.query.names)
  const wantPitchers = splitNames(req.query.pitchers)
  const probe = req.query.probe === '1'

  const [batBoard, pxBoard, pkBoard] = await Promise.all([
    loadBoard('batter', URLS.batter, buildBatter),
    loadBoard('pitcherX', URLS.pitcherX, buildPitcherX),
    loadBoard('pitcherK', URLS.pitcherK, buildPitcherK),
  ])

  // Pick out only the requested players (or everything in probe mode).
  const pick = (board, names) => {
    if (!names.length && !probe) return {}
    const out = {}
    const keys = names.length ? names : Object.keys(board.map)
    for (const k of keys) if (board.map[k]) out[k] = board.map[k]
    return out
  }

  const pitchers = {}
  const pKeys = wantPitchers.length ? wantPitchers : (probe ? Object.keys(pxBoard.map) : [])
  for (const k of pKeys) {
    const x = pxBoard.map[k], kp = pkBoard.map[k]
    if (x || kp) pitchers[k] = { ...(x || {}), ...(kp || {}) }
  }

  const body = {
    ok: true,
    batters: pick(batBoard, wantBatters),
    pitchers,
    meta: {
      counts: { batter: batBoard.count, pitcherX: pxBoard.count, pitcherK: pkBoard.count },
      cached: { batter: !!batBoard.cached, pitcherX: !!pxBoard.cached, pitcherK: !!pkBoard.cached },
      matched: { batters: Object.keys(probe ? {} : pick(batBoard, wantBatters)).length, pitchers: Object.keys(pitchers).length },
    },
  }
  if (probe) {
    body.sample = {
      batter: Object.entries(batBoard.map).slice(0, 3).map(([k, v]) => ({ k, ...v })),
      pitcherX: Object.entries(pxBoard.map).slice(0, 3).map(([k, v]) => ({ k, ...v })),
      pitcherK: Object.entries(pkBoard.map).slice(0, 3).map(([k, v]) => ({ k, ...v })),
    }
  }
  return res.status(200).json(body)
}
