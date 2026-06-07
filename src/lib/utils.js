/**
 * Pure utility functions extracted from App.jsx for testability.
 * These are the core math functions — no React, no Supabase, no side effects.
 */

export function calcStats(bets, bankroll) {
  const settled       = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
  const regular       = settled.filter(b => !b.ladder)
  const ladderSettled = settled.filter(b => b.ladder)
  const unitSize      = bankroll > 0 ? bankroll / 100 : 1

  const wins   = regular.filter(b => b.result === 'W')
  const losses = regular.filter(b => b.result === 'L')

  const netUnits   = regular.reduce((s, b) => s + b.pnl, 0)
  const totalUnits = regular.reduce((s, b) => s + b.units, 0)
  const unitsWon   = wins.reduce((s, b) => s + b.pnl, 0)
  const unitsLost  = losses.reduce((s, b) => s + Math.abs(b.pnl), 0)

  const ladderNetDollars = ladderSettled.reduce((s, b) => s + b.pnl, 0)

  const regularDollar = (b) =>
    (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * unitSize

  const regularNetDollars = regular.reduce((s, b) => s + regularDollar(b), 0)
  const openStakeTotal    = bets.filter(b => b.result === 'Open').reduce((s, b) => s + (b.stake > 0 ? b.stake : b.units * unitSize), 0)
  const currentBankroll   = bankroll + regularNetDollars + ladderNetDollars - openStakeTotal

  const allWins   = settled.filter(b => b.result === 'W')
  const allLosses = settled.filter(b => b.result === 'L')
  const allWon$   = allWins.reduce((s, b) => s + (b.ladder ? b.pnl : regularDollar(b)), 0)
  const allLost$  = allLosses.reduce((s, b) => s + (b.ladder ? Math.abs(b.pnl) : Math.abs(regularDollar(b))), 0)
  const avgWin$   = allWins.length   ? allWon$  / allWins.length   : 0
  const avgLoss$  = allLosses.length ? allLost$ / allLosses.length : 0

  const activeLadderRung = bets.filter(b => b.ladder && b.result === 'Open').sort((a, z) => a.ladderId - z.ladderId)[0] ?? null
  const openBets  = activeLadderRung
    ? [...bets.filter(b => b.result === 'Open' && !b.ladder), activeLadderRung]
    : bets.filter(b => b.result === 'Open' && !b.ladder)

  const openRisk$  = openBets.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const openUnits  = openBets.reduce((s, b) => s + b.units, 0)
  const largestWin$  = allWins.length   ? Math.max(...allWins.map(b => b.ladder ? b.pnl : regularDollar(b))) : 0
  const largestLoss$ = allLosses.length ? Math.max(...allLosses.map(b => b.ladder ? Math.abs(b.pnl) : Math.abs(regularDollar(b)))) : 0
  const avgOdds      = settled.length ? settled.reduce((s, b) => s + b.odds, 0) / settled.length : 0
  const winRate      = (allWins.length + allLosses.length) > 0 ? allWins.length / (allWins.length + allLosses.length) : 0
  const totalRisked$ = settled.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const totalRiskedU = unitSize > 0 ? totalRisked$ / unitSize : 0
  const netPnl$  = regularNetDollars + ladderNetDollars
  const netPnlU  = unitSize > 0 ? netPnl$ / unitSize : 0
  const roi      = totalRisked$ > 0 ? netPnl$ / totalRisked$ : 0

  return {
    currentBankroll, netUnits, totalUnits, unitsWon, unitsLost,
    wins: allWins.length, losses: allLosses.length, total: allWins.length + allLosses.length,
    largestWin: largestWin$, largestLoss: largestLoss$,
    avgWin$, avgLoss$, allWon$, allLost$,
    avgOdds, winRate, roi, unitSize,
    openBets: openBets.length, openRisk$, openUnits,
    totalRisked$, totalRiskedU,
    netPnl$, netPnlU,
    ladderNetDollars, activeLadderRung,
  }
}

export function calcTilt(bets) {
  const settled = bets.filter(b => b.result === 'W' || b.result === 'L')
  if (!settled.length) return { level: 'GREEN', reasons: [] }

  let consecutive = 0
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].result === 'L') consecutive++
    else break
  }

  let chasingDetected = false
  for (let i = 1; i < settled.length; i++) {
    if (settled[i - 1].result === 'L' && settled[i].units > settled[i - 1].units) {
      chasingDetected = true
      break
    }
  }

  const reasons = []
  if (consecutive >= 3) reasons.push(`${consecutive} consecutive losses`)
  else if (consecutive === 2) reasons.push('2 losses in a row')
  if (chasingDetected) reasons.push('bet sizing increased after a loss')

  if (consecutive >= 3 || chasingDetected) return { level: 'RED', reasons }
  if (consecutive === 2) return { level: 'YELLOW', reasons }
  return { level: 'GREEN', reasons: [] }
}

export function fmtOdds(v) {
  return v > 0 ? `+${v}` : `${v}`
}

// American odds → implied probability
export function impliedProb(odds) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

// Ladder math — to-win amount from stake at given odds
export function ladderToWin(stake, odds) {
  if (odds > 0) return +(stake * (odds / 100)).toFixed(2)
  return +(stake / (Math.abs(odds) / 100)).toFixed(2)
}
