// src/lib/betCard.js — pure helpers for the universal bet card. No React, no fetching.

import { computeClv } from './clv.js'

export const STATUS = {
  won:  { key: 'won',  color: '#BDFF00', icon: 'ti-check' },
  lost: { key: 'lost', color: '#FF3B3B', icon: 'ti-x' },
  push: { key: 'push', color: '#888780', icon: 'ti-minus' },
  live: { key: 'live', color: '#FFB800', icon: 'ti-clock' },
}

// A bet/leg result string → UI status. Anything unsettled ('Open', missing) = live.
export function betStatus(result) {
  const r = String(result || '').toUpperCase()
  if (r === 'W') return STATUS.won
  if (r === 'L') return STATUS.lost
  if (r === 'P') return STATUS.push
  return STATUS.live
}

const isParlay = (bet) =>
  (Array.isArray(bet.legs) && bet.legs.length > 0) ||
  (bet.betType && bet.betType !== 'Straight') ||
  / \+ /.test(String(bet.pick || ''))

function legFrom(raw, parent) {
  return {
    title: raw.pick || raw.title || '',
    subtitle: raw.event || parent.event || '',
    odds: raw.odds != null ? Number(raw.odds) : null,
    book: raw.book || parent.book || '',
    sport: raw.sport || parent.sport || '',
    result: raw.result != null ? raw.result : (parent.result === 'Open' ? 'Open' : raw.result),
    status: betStatus(raw.result != null ? raw.result : 'Open'),
  }
}

// Raw logged bet → uniform render object. Straight = 1 leg; parlay = N legs.
export function normalizeBet(bet) {
  const parlay = isParlay(bet)
  let legs
  if (parlay) {
    if (Array.isArray(bet.legs) && bet.legs.length) {
      legs = bet.legs.map(l => legFrom(l, bet))
    } else {
      legs = String(bet.pick || '').split(' + ').filter(Boolean)
        .map(p => legFrom({ pick: p.trim(), result: 'Open' }, bet))
    }
  } else {
    legs = [legFrom({ pick: bet.pick, odds: bet.odds, event: bet.event, result: bet.result }, bet)]
  }
  return {
    id: bet.id,
    kind: parlay ? 'parlay' : 'straight',
    title: parlay ? `${legs.length}-LEG PARLAY` : (bet.pick || bet.event || ''),
    subtitle: bet.event || '',
    sport: bet.sport || '',
    book: bet.book || '',
    odds: bet.odds != null ? Number(bet.odds) : null,
    stake: Number(bet.stake || 0),
    result: bet.result,
    status: betStatus(bet.result),
    date: bet.date || '',
    legs,
    raw: bet,
  }
}

// Summarize a parlay's legs → { won, total, label, overall }.
// Lost if any leg lost; won if every leg won; otherwise live.
export function ticketStatus(legs = []) {
  const total = legs.length
  const won = legs.filter(l => l.status === STATUS.won).length
  const anyLost = legs.some(l => l.status === STATUS.lost)
  const allWon = total > 0 && legs.every(l => l.status === STATUS.won)
  const overall = anyLost ? STATUS.lost : allWon ? STATUS.won : STATUS.live
  return { won, total, label: `${won} OF ${total} HIT`, overall }
}

// Settled-bet record for the scoreboard. units = sum of pnl (bet log pnl is in units).
// roi = profit units / risked units (settled only), as a percentage; null if nothing risked.
export function computeRecord(bets = []) {
  const settled = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
  const w = settled.filter(b => b.result === 'W').length
  const l = settled.filter(b => b.result === 'L').length
  const p = settled.filter(b => b.result === 'P').length
  const units = settled.reduce((s, b) => s + (Number(b.pnl) || 0), 0)
  const risked = settled.filter(b => b.result !== 'P').reduce((s, b) => s + (Number(b.units) || 0), 0)
  const roi = risked > 0 ? (units / risked) * 100 : null
  return { w, l, p, units, roi }
}

// Group bets by date (newest first). `today` (YYYY-MM-DD) is injected for testability.
// Each group: { date, label, bets, tally:{w,l,p,units} }.
export function groupByDate(bets = [], today = '') {
  const m = new Map()
  for (const b of bets) {
    const d = b.date || ''
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(b)
  }
  const dates = [...m.keys()].sort((a, z) => (a < z ? 1 : a > z ? -1 : 0))
  return dates.map(d => {
    const list = m.get(d)
    const r = computeRecord(list)
    return {
      date: d,
      label: d === today ? 'TODAY' : d,
      bets: list,
      tally: { w: r.w, l: r.l, p: r.p, units: Math.round(r.units * 100) / 100 },
    }
  })
}

// Roll per-leg CLV into one slip number. legs: [{ entry, close }]. Averages clvPct
// over legs that have both entry and a close. Returns { clvPct, beat, n }.
export function slipClv(legs = []) {
  const vals = []
  for (const l of legs) {
    if (l == null || l.entry == null || l.close == null) continue
    const c = computeClv(Number(l.entry), Number(l.close))
    if (c && c.clvPct != null) vals.push(c.clvPct)
  }
  if (!vals.length) return { clvPct: null, beat: false, n: 0 }
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return { clvPct: avg, beat: avg > 0, n: vals.length }
}
