// Live box score — FREE (ESPN public summary, zero Odds-API credits). Returns a
// per-player canonical stat map for one game so the bot can show live prop progress
// (current stat vs the line) on tracked-bet cards. Read-only, public.
import { SPORTS } from './cron-sync-live.js'

const cleanNum = (v) => {
  const s = String(v ?? '').trim()
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Flatten ESPN boxscore.players[].statistics[] into { "<lower name>": { <key>: num } }.
// Each statistics category exposes parallel `keys` + per-athlete `stats` arrays; we zip
// them and keep only clean numeric values (skips combined keys like "hits-atBats").
function parseBox(summary) {
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
    return res.status(200).json({ players: parseBox(summary) })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
