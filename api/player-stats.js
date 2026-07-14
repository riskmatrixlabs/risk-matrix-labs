// Player stats — FREE (ESPN public gamelog, zero Odds-API credits). Computes a useful line for
// the CH2 player card: season rates (AVG/OPS…), season counting totals, and LAST-5-GAMES form
// (what prop bettors actually care about). Cached 15 min.
import { requireAuth } from './_lib/auth.js'

export const config = { maxDuration: 20 }

const SPORTS = {
  MLB:  { sport: 'baseball',   league: 'mlb'  },
  WNBA: { sport: 'basketball', league: 'wnba' },
  NBA:  { sport: 'basketball', league: 'nba'  },
  NBASL: { sport: 'basketball', league: 'nba-summer-las-vegas' },
  NHL:  { sport: 'hockey',     league: 'nhl'  },
}

async function getJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null }
}

const isRate = (v) => typeof v === 'string' && /^-?\.?\d*\.\d+$/.test(v.trim())   // ".287", "3.42"
const toNum = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0 }
const fmtInt = (n) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sport = String(req.query.sport || 'MLB').toUpperCase()
  const id = String(req.query.id || '')
  const cfg = SPORTS[sport]
  if (!cfg || !id) return res.status(200).json({ found: false })
  res.setHeader('Cache-Control', 'public, max-age=900')

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${cfg.sport}/${cfg.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels
  if (!Array.isArray(labels) || !labels.length) return res.status(200).json({ found: false })

  // Flatten the regular-season games (ESPN returns newest-first).
  const evs = []
  for (const st of (gl.seasonTypes || []).slice(0, 1)) {
    for (const cat of (st.categories || [])) {
      for (const e of (cat.events || [])) if (Array.isArray(e.stats)) evs.push(e)
    }
  }
  if (!evs.length) return res.status(200).json({ found: false })

  const recent = evs[0].stats
  const rateIdx = labels.map((l, i) => ({ l, i })).filter(({ i }) => isRate(recent[i]))
  const countIdx = labels.map((l, i) => ({ l, i })).filter(({ i }) => !isRate(recent[i]))
  const sumOver = (list) => countIdx.map(({ l, i }) => ({ label: l, value: list.reduce((s, e) => s + toNum(e.stats[i]), 0) }))

  const meta = evs[0].eventId ? gl?.events?.[evs[0].eventId] : null
  return res.status(200).json({
    found: true,
    games: evs.length,
    rates: rateIdx.map(({ l, i }) => ({ label: l, value: recent[i] })),
    season: sumOver(evs).map(s => ({ ...s, value: fmtInt(s.value) })),
    last5: sumOver(evs.slice(0, 5)).map(s => ({ ...s, value: fmtInt(s.value) })),
    last5games: Math.min(5, evs.length),
    opp: meta?.opponent?.abbreviation || null,
    vs: meta?.atVs || null,
  })
}
