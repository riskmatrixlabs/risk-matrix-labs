// Pitcher SKILL layer for the MLB O/U model — swing-and-miss + command, weighted OVER raw ERA.
//
// Research finding (rml-ou-model): CSW% (Called + Swinging Strike %) and K-BB% are the most
// predictive, least-noisy pitcher signals for run suppression. Strikeout/whiff arms keep the ball
// out of play → fewer runs (UNDER); contact arms (low CSW, low K-BB) inflate scoring (OVER). ERA is
// noisier (defense/sequencing/luck), so this module leans on CSW% and K-BB% instead.
//
// Self-contained: pulls two FREE Baseball Savant CSV leaderboards, caches daily exactly like
// api/savant.js getSavantMaps (scan_cache via scanStore), and keys by the same normalized name so a
// game-info.js starter ("First Last") matches Savant's "Last, First". Degrades to delta 0 / empty
// maps on any fetch failure — never throws, never touches the paid Odds-API budget.
import { readScan, writeScan, isFresh, todayStr } from './scanStore.js'
import { normName } from '../savant.js'

const YEAR = 2026
const TTL_MS = 12 * 60 * 60 * 1000 // season leaderboards barely move day-to-day → one pull per slate
const CACHE_V = 'v1'

// League baselines (approx 2024-25). CSW% ~28.5%, K-BB% ~13.5%. Used as the neutral anchor.
const LG_CSW = 28.5
const LG_KBB = 13.5

// Savant FREE CSVs (no key):
//   • pitch-arsenal-stats → per-pitch rows incl. called-strike% (pitches_per_game etc.); we roll a
//     pitcher's pitches up into a single CSW% (called-strike% + whiff-on-swing share of pitches).
//     Simpler + robust: expected_statistics doesn't carry CSW, so we use the arsenal board, and the
//     custom board (k_percent, bb_percent, swinging_strike_percent, called_strike_percent) as the
//     authoritative per-pitcher CSW + K-BB source when present.
//   • custom leaderboard → k_percent, bb_percent (→ K-BB%) and the strike-rate components for CSW%.
const URLS = {
  // name, player_id, k_percent, bb_percent, swinging_strike_percent, called_strike_percent
  skill: `https://baseballsavant.mlb.com/leaderboard/custom?year=${YEAR}&type=pitcher&filter=&min=10&selections=k_percent,bb_percent,swinging_strike_percent,called_strike_percent&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm&sort=k_percent&sortDir=desc&csv=true`,
}

// ── CSV helpers (mirror api/savant.js) ───────────────────────────────────────
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

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

// CSW% = called-strike% + swinging-strike% (both as % of total pitches). The custom board reports
// both directly, so CSW is just their sum. Returns null if neither component is present.
function buildSkill(row) {
  const k = toNum(row.k_percent)
  const bb = toNum(row.bb_percent)
  const csInner = toNum(row.called_strike_percent)
  const sw = toNum(row.swinging_strike_percent)
  const kbb = (k != null && bb != null) ? k - bb : null
  const csw = (csInner != null || sw != null) ? (csInner || 0) + (sw || 0) : null
  if (kbb == null && csw == null) return null
  return { kbb, csw, kPct: k, bbPct: bb }
}

// Fetch + cache the skill board for today (12h TTL), name-normalized. Degrades to {} on failure.
async function loadSkillBoard() {
  const date = todayStr()
  const cacheKind = `PSKILL-${CACHE_V}`
  const cached = await readScan(cacheKind, date)
  if (cached?.payload?.map && isFresh(cached.scanned_at, Date.now(), TTL_MS)) {
    return { map: cached.payload.map, count: cached.payload.count, cached: true }
  }
  try {
    const r = await fetch(URLS.skill, { headers: { 'User-Agent': 'risk-matrix-labs/1.0' } })
    if (!r.ok) throw new Error(`savant pskill ${r.status}`)
    const rows = parseCsv(await r.text())
    const map = {}
    for (const row of rows) {
      const name = row['last_name, first_name']
      if (!name) continue
      const rec = buildSkill(row)
      if (rec) map[normName(name)] = rec
    }
    const count = Object.keys(map).length
    if (count) await writeScan(cacheKind, date, { map, count })
    return { map, count, cached: false }
  } catch (e) {
    if (cached?.payload?.map) return { map: cached.payload.map, count: cached.payload.count, cached: true, stale: true }
    return { map: {}, count: 0, error: String(e?.message || e) }
  }
}

// Public loader — mirrors getSavantMaps shape. Returns { csw, kbb } name→value maps + normName.
//   csw["first last"] = number (CSW%) ; kbb["first last"] = number (K-BB%)
export async function getPitcherSkillMaps() {
  const b = await loadSkillBoard()
  const csw = {}, kbb = {}
  for (const [nn, rec] of Object.entries(b.map || {})) {
    if (rec.csw != null) csw[nn] = rec.csw
    if (rec.kbb != null) kbb[nn] = rec.kbb
  }
  return { csw, kbb, normName, count: b.count, cached: !!b.cached }
}

// ── pure delta function ──────────────────────────────────────────────────────
// Both starters' CSW%/K-BB% → a gentle run-delta on the O/U total.
//   • Two high-CSW / high-K-BB arms  → NEGATIVE delta (swing-miss suppresses runs → UNDER)
//   • Two low-CSW  / low-K-BB arms   → POSITIVE delta (contact arms inflate scoring → OVER)
// CSW% and K-BB% each contribute; the two metrics are averaged into one signal. Capped ±0.7 runs.
// Missing either side's data for a metric → that metric sits out (additive, never regresses).
// reason: "two swing-miss arms (CSW)" (under) / "two contact arms" (over) / null if neutral/missing.
const CAP = 0.7
// Run-per-CSW-point and run-per-KBB-point coefficients (a hypothesis; the graded record tunes them).
// CSW spreads ~±5pts game-pair-avg; K-BB ~±6pts. Scaled so a clearly elite pair lands near the cap.
const K_CSW = 0.09   // runs per CSW% point below/above league (×2 sides averaged)
const K_KBB = 0.06   // runs per K-BB% point below/above league

const avg = (a, b) => (a + b) / 2

export function pitcherSkillDelta({ awayCsw, homeCsw, awayKbb, homeKbb } = {}) {
  const num = (v) => (Number.isFinite(v) ? v : null)
  awayCsw = num(awayCsw); homeCsw = num(homeCsw); awayKbb = num(awayKbb); homeKbb = num(homeKbb)

  const haveCsw = awayCsw != null && homeCsw != null
  const haveKbb = awayKbb != null && homeKbb != null
  if (!haveCsw && !haveKbb) return { delta: 0, reason: null }

  // High skill (above league) → negative run contribution (under). Note the negative sign.
  let delta = 0
  let cswSignal = 0, kbbSignal = 0
  if (haveCsw) { cswSignal = avg(awayCsw, homeCsw) - LG_CSW; delta += -cswSignal * K_CSW }
  if (haveKbb) { kbbSignal = avg(awayKbb, homeKbb) - LG_KBB; delta += -kbbSignal * K_KBB }

  delta = Math.max(-CAP, Math.min(CAP, delta))

  // reason: only fire when the pair clearly leans one way (avoid noise on near-neutral games).
  let reason = null
  const DEAD = 0.12 // run deadband — inside this, call it neutral
  if (delta <= -DEAD) {
    // swing-miss suppression. Credit CSW in the label when CSW is the (or a) driver.
    reason = haveCsw ? 'two swing-miss arms (CSW)' : 'two strikeout arms (K-BB)'
  } else if (delta >= DEAD) {
    reason = 'two contact arms'
  } else {
    delta = Number(delta.toFixed(3))
    return { delta, reason: null }
  }

  return { delta: Number(delta.toFixed(3)), reason }
}

export { normName }
