// Grade a logged bet (single OR parlay) → { evPct, clvPct, winProb } against matched events.
// Same math CH3 uses, extracted so the Bets-tab cards grade identically.
import { findEventForBet, evaluateBet } from './betMatch.js'
import { devigTwoWay, americanToDecimal, americanToImplied } from './devig.js'
import { modelEvPct } from './modelEv.js'

function buildDvs(ev) {
  const m = ev.metadata || {}
  return {
    dv:       (ev.odds_ml_away != null && ev.odds_ml_home != null) ? devigTwoWay(ev.odds_ml_away, ev.odds_ml_home) : null,
    dvSpread: (m.spread_away_juice != null && m.spread_home_juice != null) ? devigTwoWay(m.spread_away_juice, m.spread_home_juice) : null,
    dvTotal:  (m.over_juice != null && m.under_juice != null) ? devigTwoWay(m.over_juice, m.under_juice) : null,
  }
}

const decFromAm = (a) => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1

export function gradeBet(bet, events = [], modelEdges = {}) {
  if (!bet) return null
  const legs = Array.isArray(bet.legs) ? bet.legs : null

  // ── Parlay: grade each leg vs its own event, then combine ──
  if (legs && legs.length >= 2) {
    const per = legs.map(leg => {
      const ev = findEventForBet({ sport: leg.sport || bet.sport, event: leg.event, date: bet.date, pick: leg.pick }, events)
      return ev ? evaluateBet({ pick: leg.pick, odds: leg.odds, sport: leg.sport || bet.sport, event: leg.event, date: bet.date }, ev, buildDvs(ev)) : null
    })
    if (!per.some(Boolean)) return fallback(bet)
    const own = Number(bet.odds)
    let evPct = null, winProb = null, clvPct = null
    const probs = per.map(g => g?.fairProb)
    if (probs.every(p => p != null)) {
      winProb = probs.reduce((a, p) => a * p, 1)
      if (Number.isFinite(own)) evPct = (winProb * decFromAm(own) - 1) * 100
    }
    const closes = per.map(g => g?.currentAmerican)
    const entryDec = Number.isFinite(own) ? americanToDecimal(own) : null
    if (entryDec != null && closes.every(c => c != null)) {
      const comboCloseDec = closes.reduce((a, c) => a * (americanToDecimal(c) || 1), 1)
      if (comboCloseDec > 0) clvPct = (entryDec / comboCloseDec - 1) * 100
    }
    const out = (evPct != null || clvPct != null || winProb != null) ? { evPct, clvPct, winProb } : fallback(bet)
    return out ? { ...out, modelEvPct: null } : out
  }

  // ── Single ──
  const ev = findEventForBet(bet, events)
  if (!ev) { const fb = fallback(bet); return fb ? { ...fb, modelEvPct: null } : fb }
  const g = evaluateBet(bet, ev, buildDvs(ev))
  if (!g) { const fb = fallback(bet); return fb ? { ...fb, modelEvPct: null } : fb }
  // ADDITIVE: separate model-adjusted EV for MLB total bets with a model edge (headline evPct untouched).
  const edge = modelEdges[ev?.external_event_id]
  const mev = modelEvPct({
    pick: bet.pick,
    americanOdds: Number(bet.odds),
    overJuice: ev?.metadata?.over_juice,
    underJuice: ev?.metadata?.under_juice,
    modelEdgeRuns: edge,
  })
  return { evPct: g.evPct, clvPct: g.clvPct, winProb: g.fairProb ?? fallback(bet)?.winProb ?? null, modelEvPct: mev }
}

// No event match → at least a win-prob from the bet's own odds, so the ring still fills.
function fallback(bet) {
  const own = Number(bet.odds)
  return Number.isFinite(own) ? { winProb: americanToImplied(own) } : null
}
