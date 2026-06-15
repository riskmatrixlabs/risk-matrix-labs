// Game info — FREE (ESPN scoreboard, zero Odds-API credits). Given sport + away/home team
// names, returns the matchup card data: logos, records, status/score, and (MLB) probable
// pitchers. Powers the CH2 game card. Cached 5 min.
import { requireAuth } from './_lib/auth.js'

export const config = { maxDuration: 20 }

const SPORTS = {
  MLB:  { sport: 'baseball',   league: 'mlb'  },
  WNBA: { sport: 'basketball', league: 'wnba' },
  NBA:  { sport: 'basketball', league: 'nba'  },
  NHL:  { sport: 'hockey',     league: 'nhl'  },
}
const lastWord = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()

async function getJson(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null }
}

function side(c) {
  const t = c?.team || {}
  return {
    name: t.displayName || t.name || '',
    abbr: t.abbreviation || '',
    logo: t.logo || t.logos?.[0]?.href || null,
    record: c?.records?.find(r => r.type === 'total')?.summary || c?.records?.[0]?.summary || null,
    score: c?.score ?? null,
    pitcher: c?.probables?.[0]?.athlete?.displayName || c?.probables?.[0]?.athlete?.shortName || null,
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sport = String(req.query.sport || 'MLB').toUpperCase()
  const away = String(req.query.away || ''), home = String(req.query.home || '')
  const iso = String(req.query.iso || '')
  const cfg = SPORTS[sport]
  if (!cfg || !away || !home) return res.status(200).json({ found: false })
  res.setHeader('Cache-Control', 'public, max-age=300')

  // Query the scoreboard for the GAME's ET date (tonight's slate isn't on the "current" board at
  // 2am), then fall back to the natural slate.
  const base = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard`
  const urls = []
  if (iso) { const d = new Date(new Date(iso).getTime() - 4 * 3600 * 1000); if (!isNaN(d)) urls.push(`${base}?dates=${d.toISOString().slice(0, 10).replace(/-/g, '')}`) }
  urls.push(base)

  const find = (events) => {
    for (const ev of events || []) {
      const c = ev.competitions?.[0]
      const h = c?.competitors?.find(x => x.homeAway === 'home')?.team
      const a = c?.competitors?.find(x => x.homeAway === 'away')?.team
      if (h && a && lastWord(h.displayName) === lastWord(home) && lastWord(a.displayName) === lastWord(away)) return c
    }
    return null
  }
  let comp = null
  for (const u of urls) { const sb = await getJson(u); comp = find(sb?.events); if (comp) break }
  if (!comp) return res.status(200).json({ found: false })

  const h = comp.competitors.find(x => x.homeAway === 'home')
  const a = comp.competitors.find(x => x.homeAway === 'away')
  const st = comp.status?.type || {}
  return res.status(200).json({
    found: true,
    status: { state: st.state || 'pre', detail: st.shortDetail || st.detail || '', completed: !!st.completed },
    away: side(a),
    home: side(h),
  })
}
