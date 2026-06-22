// Live box score — FREE (ESPN public summary, zero Odds-API credits). Returns a
// per-player canonical stat map for one game so the bot can show live prop progress
// (current stat vs the line) on tracked-bet cards, plus the live game-winner win
// probability (ESPN winprobability) so ML bet cards show a win-prob that actually
// moves with the score. Read-only, public.
import { SPORTS } from './cron-sync-live.js'

// ESPN summary.winprobability is a per-play array; the LAST entry is the current
// state. homeWinPercentage is 0..1 for the HOME team; away = 1 − home − tie. This
// is the game-winner probability — valid for moneyline picks only (not totals/props).
function parseWinPct(summary) {
  const wp = summary?.winprobability
  if (!Array.isArray(wp) || wp.length === 0) return null
  const last = wp[wp.length - 1]
  const home = Number(last?.homeWinPercentage)
  if (!Number.isFinite(home)) return null
  const tie = Number(last?.tiePercentage) || 0
  const away = Math.max(0, 1 - home - tie)
  return { home, away }
}

const cleanNum = (v) => {
  const s = String(v ?? '').trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Flatten ESPN boxscore.players[].statistics[] into { "<lower name>": { <key>: num } }.
// Each statistics category exposes parallel `keys` + per-athlete `stats` arrays; we zip
// them and keep only clean numeric values (skips combined keys like "hits-atBats").
export function parseBox(summary) {
  const out = {}
  for (const team of summary?.boxscore?.players || []) {
    for (const cat of team.statistics || []) {
      const keys = cat.keys || []
      for (const a of cat.athletes || []) {
        const name = norm(a.athlete?.displayName)
        if (!name) continue
        const vals = a.stats || []
        const rec = out[name] || (out[name] = {})
        keys.forEach((k, i) => { const n = cleanNum(vals[i]); if (n != null && rec[k] == null) rec[k] = n })
      }
    }
  }
  return out
}

export default async function handler(req, res) {
  const id  = String(req.query.id ?? '')
  const cfg = SPORTS.find(s => s.key === String(req.query.sport ?? '').toUpperCase())
  if (!id || !cfg) return res.status(400).json({ error: 'missing id or sport' })

  res.setHeader('Cache-Control', 'no-store')
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/summary?event=${id}`)
    if (!r.ok) return res.status(200).json({ players: {} })
    const summary = await r.json()
    return res.status(200).json({ players: parseBox(summary), winPct: parseWinPct(summary) })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
