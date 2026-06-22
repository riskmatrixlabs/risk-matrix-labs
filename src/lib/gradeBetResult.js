// Pure grader: settle a bet's result from its game's FINAL score.
// Returns 'W' | 'L' | 'P' | null. Never throws, never guesses.
// null = cannot grade (not final, missing/invalid score, unparseable pick,
// unknown market, or a side we can't confidently map). The caller leaves the
// bet Open on null — correctness here auto-settles real money, so we are strict.
import { parsePick } from './betMatch'

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n)

export function gradeBetResult(bet, event) {
  if (!bet || !event) return null

  // 1) Only grade FINAL games.
  if (event.status !== 'FT' && event.status !== 'AOT') return null

  // 2) Require real numeric scores.
  const away = event.away_score
  const home = event.home_score
  if (!isFiniteNum(away) || !isFiniteNum(home)) return null

  // 3) Parse the pick with the shared parser.
  const parsed = parsePick(bet.pick, event)
  if (!parsed) return null

  // Total — over/under vs the combined final score.
  if (parsed.market === 'total') {
    if (!isFiniteNum(parsed.line)) return null
    const total = away + home
    if (total === parsed.line) return 'P'
    const wentOver = total > parsed.line
    if (parsed.side === 'over') return wentOver ? 'W' : 'L'
    if (parsed.side === 'under') return wentOver ? 'L' : 'W'
    return null
  }

  // Resolve the picked side's score vs the opponent's. Both ml and spread
  // use side 'away'|'home'; any other value is unmappable → null.
  let teamScore
  let oppScore
  if (parsed.side === 'away') { teamScore = away; oppScore = home }
  else if (parsed.side === 'home') { teamScore = home; oppScore = away }
  else return null

  // Moneyline — straight up.
  if (parsed.market === 'ml') {
    if (teamScore > oppScore) return 'W'
    if (teamScore < oppScore) return 'L'
    return 'P' // defensive: MLB has no ties, but a tie is a push not a guess
  }

  // Spread / run-line — apply the (signed) line to the picked team.
  if (parsed.market === 'spread') {
    if (!isFiniteNum(parsed.line)) return null
    const adjusted = teamScore + parsed.line
    if (adjusted > oppScore) return 'W'
    if (adjusted < oppScore) return 'L'
    return 'P'
  }

  // Unknown market → never guess.
  return null
}
