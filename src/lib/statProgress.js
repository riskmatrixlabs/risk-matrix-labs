// Live progress for a tracked bet leg, Pikkit-style. Each bet type tracks differently:
//   • player prop  → current stat ÷ line (box score)
//   • game total   → combined score ÷ line
//   • ML / spread  → final/live score line (no bar)
// Ring = win probability (elsewhere); these helpers drive the bar / score readout.

const NEON = '#BDFF00'
const DANGER = '#FF3B3B'

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// "Zack Wheeler Over 6.5 Strikeouts" → { player, dir, line, market }
export function parseProp(title) {
  const m = String(title || '').match(/^(.+?)\s+(over|under|o|u)\s*([\d.]+)\s+(.+)$/i)
  if (!m) return null
  return { player: m[1].trim(), dir: m[2][0].toLowerCase() === 'o' ? 'over' : 'under', line: parseFloat(m[3]), market: m[4].trim() }
}

// Bare game total: "Over 9.5" / "Under 7" (no player, no trailing market word)
export function parseTotal(title) {
  const m = String(title || '').trim().match(/^(over|under|o|u)\s*([\d.]+)$/i)
  if (!m) return null
  return { dir: m[1][0].toLowerCase() === 'o' ? 'over' : 'under', line: parseFloat(m[2]) }
}

// Loose extractor: pull a direction + line from anywhere in the title (props, totals,
// team totals). Used to render an EMPTY bar pre-game so the bar always shows.
export function parseLine(title) {
  const m = String(title || '').match(/\b(over|under|o|u)\s*(\d[\d.]*)/i)
  if (!m) return null
  return { dir: m[1][0].toLowerCase() === 'o' ? 'over' : 'under', line: parseFloat(m[2]) }
}

// Empty/pre-game bar shell — shows the line with no fill until live stats arrive.
export function shellBar(line, dir) {
  if (!(line > 0)) return null
  return { current: null, line, dir, pct: 0, cashing: false, color: '#888780', label: '—', pending: true }
}

export function isMoneylineOrSpread(title) {
  const t = String(title || '')
  return /\bml\b|moneyline/i.test(t) || /[+-]\s*\d+(\.\d+)?\b/.test(t)
}

// Shared bar model. A win fills to 100%; otherwise progress toward the line.
export function buildBar(current, line, dir, status) {
  if (current == null || !(line > 0)) return null
  const busted = dir === 'under' && current > line
  const cashing = dir === 'over' ? current >= line : current <= line
  const isWin = status?.key === 'won' || (status?.key !== 'lost' && cashing)
  const pct = isWin ? 1 : Math.max(0, Math.min(1, current / line))
  let color = NEON
  if (status?.key === 'lost' || busted) color = DANGER
  else if (status?.key === 'live') color = busted ? DANGER : NEON
  return { current, line, dir, pct, cashing, color, label: `${current} / ${line}` }
}

// Resolve a player's current value for a prop market from a flat ESPN stat record.
export function resolveStat(stats, market) {
  if (!stats) return null
  const m = norm(market)
  const v = (k) => (typeof stats[k] === 'number' ? stats[k] : null)
  const sum = (...ks) => { const xs = ks.map(v).filter(n => n != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null }
  if (/(h\s*\+\s*r\s*\+\s*r|hits\s*\+\s*runs\s*\+\s*rbi|hits runs rbis)/.test(m)) return sum('hits', 'runs', 'RBIs')
  if (/(p\s*\+\s*r\s*\+\s*a|pts\s*\+\s*reb\s*\+\s*ast|points rebounds assists|pra)/.test(m)) return sum('points', 'rebounds', 'assists')
  if (m.includes('strikeout') || /\bk'?s?\b/.test(m)) return v('strikeouts')
  if (m.includes('total bases')) return null
  if (m.includes('home run') || m.includes('hr')) return v('homeRuns')
  if (m.includes('rbi')) return v('RBIs')
  if (m.includes('earned run')) return v('earnedRuns')
  if (m.includes('walk') || /\bbb\b/.test(m)) return v('walks')
  if (m.includes('hits allowed')) return v('hits')
  if (m.includes('hit')) return v('hits')
  if (m.includes('rebound') || /\breb\b/.test(m)) return v('rebounds')
  if (m.includes('assist') || /\bast\b/.test(m)) return v('assists')
  if (m.includes('steal')) return v('steals')
  if (m.includes('block')) return v('blocks')
  if (m.includes('three') || m.includes('3pt') || m.includes('3-point')) return null
  if (m.includes('point') || /\bpts?\b/.test(m)) return v('points')
  if (m.includes('goal')) return v('goals')
  if (m.includes('shot') || m.includes('sog')) return v('shotsTotal') ?? v('shots')
  if (m.includes('save')) return v('saves')
  if (m.includes('run')) return v('runs')
  return null
}

// Player-prop bar from box-score stats. Returns null when unresolvable.
export function statProgress(title, statsByPlayer, status) {
  const p = parseProp(title)
  if (!p || !statsByPlayer) return null
  const current = resolveStat(statsByPlayer[norm(p.player)], p.market)
  return buildBar(current, p.line, p.dir, status)
}

// Game-total bar from the event's combined score.
export function totalProgress(title, awayScore, homeScore, status) {
  const t = parseTotal(title)
  if (!t || awayScore == null || homeScore == null) return null
  return buildBar(Number(awayScore) + Number(homeScore), t.line, t.dir, status)
}

// Score readout for ML/spread legs, e.g. "NYK 110 – SAS 105".
export function scoreText(ev) {
  if (!ev || ev.away_score == null || ev.home_score == null) return null
  const aw = (ev.away_abbr || ev.away_team || '').toString().toUpperCase()
  const hm = (ev.home_abbr || ev.home_team || '').toString().toUpperCase()
  return `${aw} ${ev.away_score} – ${hm} ${ev.home_score}`
}
