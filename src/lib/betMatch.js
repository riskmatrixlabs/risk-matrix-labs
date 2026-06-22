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

// The event's ET calendar date (YYYY-MM-DD) from its UTC start_time. ET = UTC−4.
// A 9:10pm ET game stored as 01:10 UTC the NEXT day → resolves back to its true ET date.
export function eventEtDate(event) {
  const t = Date.parse(event?.start_time)
  if (Number.isNaN(t)) return null
  return new Date(t - 4 * 3600e3).toISOString().slice(0, 10)
}

// The event's spread line for a given side ('away' | 'home').
function eventSpreadLine(event, side) {
  const v = side === 'away' ? event?.odds_spread_away : event?.odds_spread_home
  return v == null || v === '' ? null : Number(v)
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

  // Date within ±1 ET calendar day of the bet's date (lenient — books/users log loosely,
  // and a late-night ET game lives on the next UTC day). ET-based so the Jun-20-night
  // game resolves to Jun-20, letting findEventForBet's line/date ranking disambiguate.
  if (bet.date && event.start_time) {
    const etDate = eventEtDate(event)
    if (etDate) {
      const evMs = Date.parse(`${etDate}T12:00:00Z`)
      const betMs = Date.parse(`${bet.date}T12:00:00Z`)
      if (!Number.isNaN(evMs) && !Number.isNaN(betMs) && Math.abs(evMs - betMs) > 1.5 * 24 * 3600 * 1000) return false
    }
  }
  return true
}

// Resolve the single BEST event for a bet from a list of events, or null.
// Ranks multiple same-team/same-window candidates by (1) locked-line match,
// (2) exact ET date, (3) closest start — so a live 11.5 bet never grades a
// finished 10.5 game. Pure; never throws.
export function findEventForBet(bet, events) {
  if (!bet || !Array.isArray(events) || events.length === 0) return null
  const candidates = events.filter(e => matchBetToEvent(bet, e))
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  // (1) Line match — strongest signal. Compare the bet's locked line to each event's line.
  const lineDiffs = candidates.map(e => {
    const parsed = parsePick(bet.pick, e)
    if (!parsed) return null
    let evLine = null
    if (parsed.market === 'total') evLine = e.odds_total == null || e.odds_total === '' ? null : Number(e.odds_total)
    else if (parsed.market === 'spread') evLine = eventSpreadLine(e, parsed.side)
    if (evLine == null || parsed.line == null || Number.isNaN(evLine)) return null
    return Math.abs(Number(parsed.line) - evLine)
  })
  const haveAnyLine = lineDiffs.some(d => d != null)
  if (haveAnyLine) {
    const within = lineDiffs.filter(d => d != null && d <= 0.75)
    // If exactly one candidate is within 0.75 and others aren't, pick it outright.
    if (within.length === 1) {
      const idx = lineDiffs.findIndex(d => d != null && d <= 0.75)
      return candidates[idx]
    }
    // Otherwise prefer the smallest line diff among those that have a line.
    let best = -1, bestDiff = Infinity
    lineDiffs.forEach((d, i) => { if (d != null && d < bestDiff) { bestDiff = d; best = i } })
    if (best >= 0) return candidates[best]
  }

  // (2) Exact ET date.
  if (bet.date) {
    const exact = candidates.filter(e => eventEtDate(e) === bet.date)
    if (exact.length === 1) return exact[0]
    if (exact.length > 1) return pickClosestStart(exact, bet.date)
  }

  // (3) Recency — start_time closest to the bet's date.
  return pickClosestStart(candidates, bet.date)
}

function pickClosestStart(candidates, betDate) {
  const target = betDate ? Date.parse(`${betDate}T12:00:00Z`) : NaN
  if (Number.isNaN(target)) return candidates[0]
  let best = candidates[0], bestDiff = Infinity
  for (const e of candidates) {
    const t = Date.parse(e?.start_time)
    if (Number.isNaN(t)) continue
    const d = Math.abs(t - target)
    if (d < bestDiff) { bestDiff = d; best = e }
  }
  return best
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
