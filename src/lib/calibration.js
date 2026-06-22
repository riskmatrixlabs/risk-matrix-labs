// Calibration harness for the O/U model's `strong` rating.
//
// PURE module — no network, no React. The runner (scripts/calibration-report.mjs)
// pulls graded `lean_results` rows from Supabase and feeds them here.
//
// Core question: does a bigger `edge_runs` (the model's projected edge in runs)
// predict a higher HIT-rate? We bucket by edge magnitude and report win% per
// bucket with a Wilson 95% confidence interval — so we don't trust small-n noise.
//
// Grading encoding: `result` is 'W' (win) / 'L' (loss). Anything else
// (push, null, legacy 'HIT'/'MISS', etc.) is EXCLUDED from win-rate math.

// Z for 95% two-sided.
const Z = 1.959963984540054

/**
 * 95% Wilson score interval for a binomial proportion.
 * Honest for small n (unlike the naive normal approximation).
 * @param {number} wins
 * @param {number} n total graded
 * @returns {{lo:number, hi:number}} — n=0 returns {lo:0, hi:1}
 */
export function wilsonInterval(wins, n) {
  if (!n || n <= 0) return { lo: 0, hi: 1 }
  const p = wins / n
  const z2 = Z * Z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const margin = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return {
    lo: Math.max(0, center - margin),
    hi: Math.min(1, center + margin),
  }
}

/**
 * Map a `result` value to a win boolean. 'W' → true, 'L' → false,
 * everything else (push/null/unknown) → null (excluded from win math).
 */
export function resultToWin(result) {
  if (result === 'W') return true
  if (result === 'L') return false
  return null
}

// A row is "graded" for calibration if it has a numeric edge_runs AND a W/L result.
function isGraded(row) {
  return (
    typeof row.edge_runs === 'number' &&
    Number.isFinite(row.edge_runs) &&
    resultToWin(row.result) !== null
  )
}

function bucketLabels(edges) {
  const sorted = [...edges].sort((a, b) => a - b)
  const labels = []
  for (let i = 0; i <= sorted.length; i++) {
    if (i === 0) labels.push(`<${sorted[0]}`)
    else if (i === sorted.length) labels.push(`≥${sorted[i - 1]}`)
    else labels.push(`${sorted[i - 1]}–${sorted[i]}`)
  }
  return { sorted, labels }
}

/**
 * Bucket graded rows by edge magnitude.
 * Default edges [1, 1.5] → buckets [<1, 1–1.5, ≥1.5].
 * Rows lacking numeric edge_runs or a W/L result are excluded (counted).
 * @returns {{buckets:Array<{label,n,wins,winPct,ci}>, excluded:number}}
 */
export function bucketByEdge(rows = [], edges = [1, 1.5]) {
  const { sorted, labels } = bucketLabels(edges)
  const stats = labels.map((label) => ({ label, n: 0, wins: 0 }))
  let excluded = 0

  for (const row of rows) {
    if (!isGraded(row)) {
      excluded++
      continue
    }
    const e = row.edge_runs
    // find bucket index: first threshold strictly greater than e
    let idx = sorted.findIndex((t) => e < t)
    if (idx === -1) idx = sorted.length // >= last threshold
    stats[idx].n++
    if (resultToWin(row.result)) stats[idx].wins++
  }

  const buckets = stats.map((b) => ({
    ...b,
    winPct: b.n ? b.wins / b.n : null,
    ci: wilsonInterval(b.wins, b.n),
  }))
  return { buckets, excluded }
}

function tally(rows) {
  let n = 0
  let wins = 0
  for (const row of rows) {
    const w = resultToWin(row.result)
    if (w === null) continue
    n++
    if (w) wins++
  }
  return { n, wins, winPct: n ? wins / n : null, ci: wilsonInterval(wins, n) }
}

const READY_THRESHOLD = 250

/**
 * Full calibration summary: overall, by-strong, by-edge buckets, a `ready`
 * flag (gradedN >= 250) and a short human verdict.
 */
export function summarize(rows = [], edges = [1, 1.5]) {
  const gradedRows = rows.filter(isGraded)
  const gradedN = gradedRows.length

  const overall = tally(gradedRows)
  const byStrong = {
    strong: tally(gradedRows.filter((r) => r.strong === true)),
    notStrong: tally(gradedRows.filter((r) => r.strong !== true)),
  }
  const { buckets, excluded } = bucketByEdge(rows, edges)

  const ready = gradedN >= READY_THRESHOLD

  let verdict
  if (gradedN === 0) {
    verdict = `insufficient data — 0 graded edges; need ~${READY_THRESHOLD}`
  } else if (!ready) {
    verdict = `insufficient data — ${gradedN} graded edge${gradedN === 1 ? '' : 's'}; need ~${READY_THRESHOLD} for a trustworthy read`
  } else {
    const pct = overall.winPct != null ? (overall.winPct * 100).toFixed(1) : '—'
    verdict = `ready — ${gradedN} graded edges, ${pct}% overall hit-rate`
  }

  return {
    ready,
    gradedN,
    threshold: READY_THRESHOLD,
    excluded,
    overall,
    byStrong,
    buckets,
    verdict,
  }
}
