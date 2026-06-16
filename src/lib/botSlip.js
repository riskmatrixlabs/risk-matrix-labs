// Pure helpers: turn a CH1 bot-scan output row into a Bet Matrix slip leg + share text.
// Lets the bot's outputs be one-tap added to the slip (no CH2 round-trip) and shared.

// Build a slip leg from a scan output row (game-line edge OR prop edge).
export function legFromRow(r) {
  if (!r) return null
  const g = r.game || {}
  const event = (g.away && g.home) ? `${g.away} vs ${g.home}` : (r.sub || '')
  return {
    pick:  r.label,
    odds:  Number(r.price) || 0,
    book:  r.book || null,
    link:  r.link || null,
    sport: g.sport || g._sport || null,
    event,
    evPct: r.evPct ?? null,
    isProp: !!r.isProp,
  }
}

const am = (a) => (Number(a) || 0) > 0 ? `+${a}` : `${a}`

// Share text for a single output (one pick).
export function pickShareText(r, bookLabel = (b) => b) {
  if (!r) return ''
  const bk   = r.book ? ` (${bookLabel(r.book)})` : ''
  const edge = r.evPct != null ? ` · +${Number(r.evPct).toFixed(1)}% edge` : ''
  return `🎯 ${r.label} ${am(r.price)}${bk}${edge}\n\nvia Risk Matrix Labs`
}

// Share text for the whole output screen (top edges on the board).
export function boardShareText(rows = [], bookLabel = (b) => b) {
  const top = rows.slice(0, 8)
  if (!top.length) return 'No edges on the board right now.\n\nvia Risk Matrix Labs'
  const lines = top.map(r =>
    `• ${r.label} ${am(r.price)}${r.book ? ` (${bookLabel(r.book)})` : ''}${r.evPct != null ? ` +${Number(r.evPct).toFixed(1)}%` : ''}`)
  return `⧡ TODAY'S MATRIX — ${rows.length} edge${rows.length === 1 ? '' : 's'}\n${lines.join('\n')}\n\nvia Risk Matrix Labs`
}
