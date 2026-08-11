// Pure W/L/P grader for a model lean (server-side, no DB, no network).
// Unifies the total/ml/rl result logic for cron-grade-leans. Returns
// 'W' | 'L' | 'P' | null. null = cannot grade (bad score, unmappable side,
// unparseable pick, or unknown market) — the caller leaves the row ungraded.
//
// awayScore/homeScore must be finite numbers. The TOTAL path mirrors the cron's
// original inline behavior byte-for-byte (push first, then OVER/UNDER).

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n)

export function gradeLeanResult({ market, lean, pick_side, total_line, awayScore, homeScore }) {
  if (!isFiniteNum(awayScore) || !isFiniteNum(homeScore)) return null

  const mkt = market == null ? 'total' : String(market)

  // TOTAL (also legacy null/undefined market) — preserve the cron's exact logic.
  if (mkt === 'total') {
    const total = awayScore + homeScore
    // Guard null/''/undefined before coercion (Number(null) === 0 would mis-grade).
    if (total_line == null || total_line === '') return null
    const line = Number(total_line)
    if (!Number.isFinite(line)) return null
    if (total === line) return 'P'
    const side = String(lean || '').toUpperCase()
    if (side === 'OVER') return total > line ? 'W' : 'L'
    if (side === 'UNDER') return total < line ? 'W' : 'L'
    return null
  }

  // MONEYLINE — straight up, pick_side HOME/AWAY.
  if (mkt === 'ml') {
    const side = String(pick_side || '').toUpperCase()
    let teamScore, oppScore
    if (side === 'HOME') { teamScore = homeScore; oppScore = awayScore }
    else if (side === 'AWAY') { teamScore = awayScore; oppScore = homeScore }
    else return null
    if (teamScore > oppScore) return 'W'
    if (teamScore < oppScore) return 'L'
    return 'P'
  }

  // RUN/SPREAD LINE — pick_side like 'HOME -1.5' / 'AWAY +2.5' / 'HOME -3'.
  // Grade against the PARSED spread: signed margin + spread > 0 → W, < 0 → L, = 0 → P
  // (integer NFL spreads can push; half-point lines never do). Legacy MLB rows always
  // carry '-1.5' and grade identically to the old (margin >= 2) rule; a row with no
  // parseable spread token falls back to the legacy -1.5 assumption.
  if (mkt === 'rl') {
    const parts = String(pick_side || '').trim().split(/\s+/)
    const side = (parts[0] || '').toUpperCase()
    let teamScore, oppScore
    if (side === 'HOME') { teamScore = homeScore; oppScore = awayScore }
    else if (side === 'AWAY') { teamScore = awayScore; oppScore = homeScore }
    else return null
    const spread = Number.isFinite(Number(parts[1])) ? Number(parts[1]) : -1.5
    const adj = (teamScore - oppScore) + spread
    if (adj > 0) return 'W'
    if (adj < 0) return 'L'
    return 'P'
  }

  return null
}

// Pure W/L grader for a PHLT player-prop pick from a final box-score stat value.
// statValue = the player's final stat (e.g. hits). prop_line = the 0.5-style line.
// lean = 'OVER' | 'UNDER'. Returns 'W' | 'L' | 'P' | null. null = cannot grade
// (DNP / stat not found / unparseable line) — caller leaves the row ungraded, never guesses.
// No push on a .5 line; integer stats never equal 0.5, so 'P' won't occur in practice.
export function gradeProp({ statValue, prop_line, lean }) {
  if (!isFiniteNum(statValue)) return null
  if (!isFiniteNum(prop_line)) return null
  const hit = statValue >= prop_line
  const side = String(lean || '').toUpperCase()
  if (side === 'OVER') return hit ? 'W' : 'L'
  if (side === 'UNDER') return hit ? 'L' : 'W'
  return null
}
