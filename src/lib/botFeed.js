// Pure helpers for the Bot FIND channel: identify a game, group edges under games,
// and apply the feed filter pills (min EV, focused game). No I/O — fully testable.

const norm = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')

// Accepts (away, home) strings OR a single edge/event object with .away/.home.
export function gameKey(awayOrObj, home) {
  if (awayOrObj && typeof awayOrObj === 'object') {
    return `${norm(awayOrObj.away)}@${norm(awayOrObj.home)}`
  }
  return `${norm(awayOrObj)}@${norm(home)}`
}

// → [{ key, away, home, commenceTime, edges:[...] }], games ordered by their best edge,
// edges within a game ordered highest EV first.
export function groupEdgesByGame(edges) {
  const map = new Map()
  for (const e of edges || []) {
    const key = gameKey(e)
    if (!map.has(key)) map.set(key, { key, away: e.away, home: e.home, commenceTime: e.commenceTime, edges: [] })
    map.get(key).edges.push(e)
  }
  const groups = [...map.values()]
  for (const g of groups) g.edges.sort((a, b) => b.evPct - a.evPct)
  groups.sort((a, b) => (b.edges[0]?.evPct ?? 0) - (a.edges[0]?.evPct ?? 0))
  return groups
}

// Filter the flat edge list by the active pills.
export function applyFeedFilters(edges, { minEvPct = 0, focusKey = null } = {}) {
  return (edges || []).filter(e =>
    e.evPct >= minEvPct &&
    (!focusKey || gameKey(e) === focusKey))
}
