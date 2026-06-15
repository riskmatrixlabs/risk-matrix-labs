// Player recent stats — FREE (ESPN public API, zero Odds-API credits). Given a sport + ESPN
// athlete id (captured in player-search), returns the player's most recent game stat line so
// the CH2 player card isn't just a name + headshot.
import { requireAuth } from './_lib/auth.js'

export const config = { maxDuration: 20 }

const SPORTS = {
  MLB:  { sport: 'baseball',   league: 'mlb'  },
  WNBA: { sport: 'basketball', league: 'wnba' },
  NBA:  { sport: 'basketball', league: 'nba'  },
  NHL:  { sport: 'hockey',     league: 'nhl'  },
}

async function getJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sport = String(req.query.sport || 'MLB').toUpperCase()
  const id = String(req.query.id || '')
  const cfg = SPORTS[sport]
  if (!cfg || !id) return res.status(200).json({ found: false })
  res.setHeader('Cache-Control', 'public, max-age=900')   // stats barely change — cache 15 min

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${cfg.sport}/${cfg.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels
  if (!Array.isArray(labels) || !labels.length) return res.status(200).json({ found: false })

  // Most recent game = first event of the first category of the first season type.
  const ev = gl?.seasonTypes?.[0]?.categories?.[0]?.events?.[0]
  const stats = ev?.stats
  const meta = ev?.eventId ? gl?.events?.[ev.eventId] : null
  if (!Array.isArray(stats) || !stats.length) return res.status(200).json({ found: false })

  const pairs = stats.map((v, i) => ({ label: labels[i], value: v })).filter(p => p.label && p.value != null)
  return res.status(200).json({
    found: pairs.length > 0,
    recent: pairs,
    opponent: meta?.opponent?.abbreviation || null,
    date: meta?.gameDate || null,
    home: meta?.atVs || null,
  })
}
