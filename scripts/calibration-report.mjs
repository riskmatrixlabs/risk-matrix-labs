#!/usr/bin/env node
/**
 * Calibration report for the O/U model's `strong` rating (READ-ONLY).
 *
 * Pulls graded O/U leans from Supabase `lean_results`, feeds them to the pure
 * calibration functions in src/lib/calibration.js, and prints a readable report:
 * overall hit-rate, by-strong split, and by-edge buckets — each with n, win%,
 * and a Wilson 95% CI — plus a verdict and a grading-completeness line.
 *
 * DORMANT BY DESIGN: today there are ~0 graded edges (edge_runs only started
 * logging recently). This runs cleanly on empty/near-empty data and "lights up"
 * as graded rows accrue. It NEVER writes to the DB.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Missing → clean message, exit 0.
 *
 * Usage:  node scripts/calibration-report.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { summarize } from '../src/lib/calibration.js'

const fmtPct = (p) => (p == null ? '  —  ' : `${(p * 100).toFixed(1)}%`.padStart(6))
const fmtCi = (ci) =>
  ci ? `[${(ci.lo * 100).toFixed(0)}–${(ci.hi * 100).toFixed(0)}%]` : ''

function printRow(label, s) {
  console.log(
    `  ${label.padEnd(14)} n=${String(s.n).padStart(4)}  ` +
      `win=${fmtPct(s.winPct)}  ci=${fmtCi(s.ci)}`,
  )
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log(
      '\nCalibration report — SKIPPED.\n' +
        'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.\n' +
        'Set them to run the read-only report against lean_results.\n',
    )
    process.exit(0)
  }

  const supabase = createClient(url, key)

  // READ-ONLY select. Pull only the columns we need.
  const { data, error } = await supabase
    .from('lean_results')
    .select('result, edge_runs, strong, model_version, clv')

  if (error) {
    console.error('\nFailed to read lean_results:', error.message, '\n')
    process.exit(1)
  }

  const rows = data || []
  const s = summarize(rows)

  // Grading-completeness: rows that HAVE an edge_runs but aren't yet W/L graded.
  const withEdge = rows.filter(
    (r) => typeof r.edge_runs === 'number' && Number.isFinite(r.edge_runs),
  )
  const ungradedEdge = withEdge.filter(
    (r) => r.result !== 'W' && r.result !== 'L',
  ).length

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  O/U STRONG-RATING CALIBRATION REPORT  (read-only)')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  rows pulled: ${rows.length}   graded edges: ${s.gradedN}`)
  console.log(
    `  edge_runs rows: ${withEdge.length}   still ungraded: ${ungradedEdge}`,
  )
  console.log('──────────────────────────────────────────────────────────')

  console.log('\n  OVERALL')
  printRow('all', s.overall)

  console.log('\n  BY CONFIDENCE')
  printRow('strong', s.byStrong.strong)
  printRow('not-strong', s.byStrong.notStrong)

  console.log('\n  BY EDGE (runs)')
  for (const b of s.buckets) printRow(b.label, b)

  console.log('\n──────────────────────────────────────────────────────────')
  console.log(`  VERDICT: ${s.verdict}`)
  console.log(`  ready: ${s.ready}  (threshold ${s.threshold} graded edges)`)
  console.log('══════════════════════════════════════════════════════════\n')

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
