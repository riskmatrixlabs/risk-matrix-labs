// Pure helper: turn the model's persisted ML/Run-Line team leans into display lines.
// Thresholds MUST match what the backend persists/grades, so the surfaced lean == the recorded one:
//   ML shown only when winProb  >= 0.55
//   RL shown only when coverProb >= 0.50
// Below threshold → nothing (no clutter). Returns [] when bets is null or nothing qualifies.
//
// Brand: frame as the MODEL's lean — team abbr + market abbr + probability (e.g. "PHI ML 61%").
// Never the words pick/lock/play/bet/tip/luck.

export function teamLeanLines(bets, awayAbbr, homeAbbr, { ml = 0.55, rl = 0.50 } = {}) {
  if (!bets) return []
  const out = []

  // ML — pick is 'HOME' | 'AWAY'; abbr = HOME → homeAbbr, AWAY → awayAbbr (fallback to the pick word).
  const mlBet = bets.ml
  if (mlBet && (mlBet.pick === 'HOME' || mlBet.pick === 'AWAY') && typeof mlBet.winProb === 'number' && mlBet.winProb >= ml) {
    const side = mlBet.pick === 'HOME' ? 'home' : 'away'
    const abbr = (mlBet.pick === 'HOME' ? homeAbbr : awayAbbr) || mlBet.pick
    out.push({ market: 'ML', side, abbr, prob: mlBet.winProb, label: `${abbr} ML ${Math.round(mlBet.winProb * 100)}%` })
  }

  // RL — pick is 'HOME -1.5' | 'AWAY -1.5'; parse the leading word for the abbr.
  const rlBet = bets.rl
  if (rlBet && typeof rlBet.pick === 'string' && typeof rlBet.coverProb === 'number' && rlBet.coverProb >= rl) {
    const word = rlBet.pick.trim().split(/\s+/)[0]
    if (word === 'HOME' || word === 'AWAY') {
      const side = word === 'HOME' ? 'home' : 'away'
      const abbr = (word === 'HOME' ? homeAbbr : awayAbbr) || word
      out.push({ market: 'RL', side, abbr, prob: rlBet.coverProb, label: `${abbr} -1.5 ${Math.round(rlBet.coverProb * 100)}%` })
    }
  }

  return out
}
