// Live prop progress: turn a prop pick + a player's live box-score stats into a
// "current vs line" bar (Pikkit-style). Ring = win probability; this bar = the stat.
// Pure + data-driven; no network here.

const NEON = '#BDFF00'
const DANGER = '#FF3B3B'

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// "Zack Wheeler Over 6.5 Strikeouts" → { player, dir:'over'|'under', line, market }
export function parseProp(title) {
  const m = String(title || '').match(/^(.+?)\s+(over|under|o|u)\s*([\d.]+)\s+(.+)$/i)
  if (!m) return null
  return { player: m[1].trim(), dir: m[2][0].toLowerCase() === 'o' ? 'over' : 'under', line: parseFloat(m[3]), market: m[4].trim() }
}

// Resolve the player's current value for a prop market from a flat ESPN stat record
// (keys as returned by api/box-score.js). Returns a number or null if unsupported.
export function resolveStat(stats, market) {
  if (!stats) return null
  const m = norm(market)
  const v = (k) => (typeof stats[k] === 'number' ? stats[k] : null)
  const sum = (...ks) => { const xs = ks.map(v).filter(n => n != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null }

  // Combined markets first (contain '+')
  if (/(h\s*\+\s*r\s*\+\s*r|hits\s*\+\s*runs\s*\+\s*rbi|hits runs rbis)/.test(m)) return sum('hits', 'runs', 'RBIs')
  if (/(p\s*\+\s*r\s*\+\s*a|pts\s*\+\s*reb\s*\+\s*ast|points rebounds assists|pra)/.test(m)) return sum('points', 'rebounds', 'assists')

  // MLB
  if (m.includes('strikeout') || /\bk'?s?\b/.test(m)) return v('strikeouts')
  if (m.includes('total bases')) return null                 // not in ESPN boxscore (needs 2B/3B); unsupported
  if (m.includes('home run') || m.includes('hr')) return v('homeRuns')
  if (m.includes('rbi')) return v('RBIs')
  if (m.includes('earned run')) return v('earnedRuns')
  if (m.includes('walk') || /\bbb\b/.test(m)) return v('walks')
  if (m.includes('hits allowed')) return v('hits')
  if (m.includes('hit')) return v('hits')

  // NBA
  if (m.includes('rebound') || /\breb\b/.test(m)) return v('rebounds')
  if (m.includes('assist') || /\bast\b/.test(m)) return v('assists')
  if (m.includes('steal')) return v('steals')
  if (m.includes('block')) return v('blocks')
  if (m.includes('three') || m.includes('3pt') || m.includes('3-point')) return null  // combined key, unsupported
  if (m.includes('point') || /\bpts?\b/.test(m)) return v('points')

  // NHL
  if (m.includes('goal')) return v('goals')
  if (m.includes('shot') || m.includes('sog')) return v('shotsTotal') ?? v('shots')
  if (m.includes('save')) return v('saves')

  // generic "runs"/"points" already handled; "run" last so "home run" matched above
  if (m.includes('run')) return v('runs')
  return null
}

// Build the bar model for a leg. statsByPlayer = { "<norm name>": {key:num} }.
// status = the leg's STATUS object ({key:'won'|'lost'|'live'|'push'}).
// Returns null when there's no resolvable live/final stat (then no bar is shown).
export function statProgress(title, statsByPlayer, status) {
  const p = parseProp(title)
  if (!p || !statsByPlayer) return null
  const current = resolveStat(statsByPlayer[norm(p.player)], p.market)
  if (current == null || !(p.line > 0)) return null

  const busted = p.dir === 'under' && current > p.line
  const cashing = p.dir === 'over' ? current >= p.line : current <= p.line
  // A win fills the bar completely. Otherwise show progress toward the line.
  const isWin = status?.key === 'won' || (status?.key !== 'lost' && cashing)
  const pct = isWin ? 1 : Math.max(0, Math.min(1, current / p.line))
  // Sportsbook coloring: settled win = green, settled loss = red; live = green while
  // on track, red once an under busts.
  let color = NEON
  if (status?.key === 'lost' || busted) color = DANGER
  else if (status?.key === 'won') color = NEON
  else if (status?.key === 'live') color = busted ? DANGER : NEON

  return { current, line: p.line, dir: p.dir, pct, cashing, color, label: `${current} / ${p.line}` }
}
