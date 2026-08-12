// Live grading for a MONEYLINE (side) lean — the ML twin of the totals chip's "running total vs
// the line" check. Pure so it can be unit-tested away from the card.
//
// A side call is graded on who is in front RIGHT NOW: the pick's team ahead → 'ahead', behind →
// 'behind', level → 'tied'. Once the game is final the caller reads the same value as the settled
// result (ahead = won, behind = lost, tied = push/OT-pending).
//
// HONEST NULL: no pick, an unrecognised pick, or a missing/non-numeric score → null (no chip).
export function mlResult({ pick, homeScore, awayScore } = {}) {
  const side = String(pick || '').trim().toUpperCase().split(/\s+/)[0]
  if (side !== 'HOME' && side !== 'AWAY') return null
  // Number(null) === 0 and Number('') === 0 — a missing score must never read as a real 0-0.
  if (homeScore == null || awayScore == null || homeScore === '' || awayScore === '') return null
  const h = Number(homeScore), a = Number(awayScore)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  if (h === a) return 'tied'
  const homeAhead = h > a
  return (side === 'HOME') === homeAhead ? 'ahead' : 'behind'
}
