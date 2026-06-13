// Link a logged bet to its Live Center game, parse the pick into a market/side,
// and grade it against the no-vig fair value + closing line.
import { devigTwoWay, americanToDecimal } from './devig'
import { computeClv } from './clv'

const lastWord = (s) => String(s || '').trim().split(/\s+/).pop().toUpperCase()

// Which side of THIS event does a free-text fragment refer to? 'away' | 'home' | null.
export function teamSide(text, event) {
  const t = String(text || '').toUpperCase()
  const aw = String(event.away_abbr || '').toUpperCase()
  const hm = String(event.home_abbr || '').toUpperCase()
  if (aw && new RegExp(`\\b${aw}\\b`).test(t)) return 'away'
  if (hm && new RegExp(`\\b${hm}\\b`).test(t)) return 'home'
  const awName = lastWord(event.away_team)
  const hmName = lastWord(event.home_team)
  if (awName && t.includes(awName)) return 'away'
  if (hmName && t.includes(hmName)) return 'home'
  return null
}

// Parse a pick string → { market, side, line? }.
// Handles "MIA ML", "PIT -1.5", "Over 9.5", "O 8.5", "Under 7", "MIA +1.5".
export function parsePick(pick, event) {
  const p = String(pick || '').trim()
  if (!p) return null
  const u = p.toUpperCase()

  // Total — Over/Under/O/U + number
  const totalM = u.match(/\b(OVER|UNDER|O|U)\b\s*([0-9]+(?:\.[0-9]+)?)/)
  if (totalM) {
    return { market: 'total', side: totalM[1][0] === 'O' ? 'over' : 'under', line: parseFloat(totalM[2]) }
  }

  const side = teamSide(u, event)

  // Spread — a signed number with a team (e.g. "PIT -1.5", "MIA +1.5")
  const spreadM = u.match(/([+-]\s*[0-9]+(?:\.[0-9]+)?)/)
  if (spreadM && side && !/\bML\b|MONEYLINE/.test(u)) {
    return { market: 'spread', side, line: parseFloat(spreadM[1].replace(/\s/g, '')) }
  }

  // Moneyline — explicit ML, or a bare team with no spread number
  if (side && (/\bML\b|MONEYLINE/.test(u) || !spreadM)) {
    return { market: 'ml', side }
  }
  return null
}

// Does this bet belong to this event? Sport + both teams present + same-ish date.
export function matchBetToEvent(bet, event) {
  if (!bet || !event) return false
  if (String(bet.sport || '').toUpperCase() !== String(event.sport || '').toUpperCase()) return false

  const ev = String(bet.event || '').toUpperCase()
  if (!ev) return false
  const hasTeam = (abbr, team) => {
    const a = String(abbr || '').toUpperCase()
    const n = lastWord(team)
    return (a && new RegExp(`\\b${a}\\b`).test(ev)) || (n && ev.includes(n))
  }
  if (!hasTeam(event.away_abbr, event.away_team) || !hasTeam(event.home_abbr, event.home_team)) return false

  // Date within ±1 day of the event's local date (lenient — books/users log loosely).
  if (bet.date && event.start_time) {
    const evDate = new Date(event.start_time)
    const betDate = new Date(`${bet.date}T12:00:00Z`)
    if (Math.abs(evDate - betDate) > 36 * 3600 * 1000) return false
  }
  return true
}

// Current offered American odds for a parsed pick, from the live event row.
function currentOdds(parsed, event, meta) {
  if (parsed.market === 'ml') return parsed.side === 'away' ? event.odds_ml_away : event.odds_ml_home
  if (parsed.market === 'spread') return parsed.side === 'away' ? meta.spread_away_juice : meta.spread_home_juice
  if (parsed.market === 'total') return parsed.side === 'over' ? meta.over_juice : meta.under_juice
  return null
}

// No-vig fair probability for the picked side, from the relevant two-way devig.
function fairForSide(parsed, dvs) {
  const { dv, dvSpread, dvTotal } = dvs || {}   // null dvs (no devig data) → no fair, never crash
  if (parsed.market === 'ml' && dv)        return { p: parsed.side === 'away' ? dv.fairA : dv.fairB,             fairAmerican: parsed.side === 'away' ? dv.fairAmericanA : dv.fairAmericanB }
  if (parsed.market === 'spread' && dvSpread) return { p: parsed.side === 'away' ? dvSpread.fairA : dvSpread.fairB, fairAmerican: parsed.side === 'away' ? dvSpread.fairAmericanA : dvSpread.fairAmericanB }
  if (parsed.market === 'total' && dvTotal)   return { p: parsed.side === 'over' ? dvTotal.fairA : dvTotal.fairB,   fairAmerican: parsed.side === 'over' ? dvTotal.fairAmericanA : dvTotal.fairAmericanB }
  return null
}

// Grade one matched bet: parsed pick + your price vs no-vig fair (EV%) and vs current line (CLV%).
// Returns null if the pick can't be parsed. EV/CLV fields are null when odds data is missing.
export function evaluateBet(bet, event, dvs) {
  const parsed = parsePick(bet.pick, event)
  if (!parsed) return null
  const yourAmerican = Number(bet.odds)
  const yourDec = americanToDecimal(yourAmerican)
  const fair = fairForSide(parsed, dvs)
  const cur = currentOdds(parsed, event, event.metadata || {})

  let evPct = null
  if (fair && yourDec != null) evPct = (fair.p * yourDec - 1) * 100
  const clv = (cur != null && !Number.isNaN(yourAmerican)) ? computeClv(yourAmerican, cur) : null

  return {
    parsed,
    pick: bet.pick,
    book: bet.book,
    result: bet.result,
    yourAmerican,
    fairProb: fair?.p ?? null,
    fairAmerican: fair?.fairAmerican ?? null,
    currentAmerican: cur ?? null,
    evPct,
    clvPct: clv?.clvPct ?? null,
  }
}
