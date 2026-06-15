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

// MLB run-scoring park factor by HOME team (approx; >1 hitter-friendly, <1 pitcher-friendly).
export const PARK = {
  COL: 1.13, CIN: 1.08, BOS: 1.06, KC: 1.05, TEX: 1.04, ARI: 1.04, PHI: 1.03, BAL: 1.03, CHC: 1.02,
  ATL: 1.01, WSH: 1.01, LAA: 1.00, MIN: 1.00, HOU: 1.00, TOR: 1.00, NYY: 1.00, CWS: 0.99, CHW: 0.99,
  MIL: 0.99, PIT: 0.98, STL: 0.97, CLE: 0.97, DET: 0.96, LAD: 0.97, TB: 0.95, NYM: 0.94, SD: 0.94,
  ATH: 0.94, OAK: 0.94, MIA: 0.92, SEA: 0.92, SF: 0.91,
}

async function getJson(url, ms = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null }
  catch { return null }
  finally { clearTimeout(timer) }
}

function side(c) {
  const t = c?.team || {}
  const pr = c?.probables?.[0]?.athlete
  return {
    name: t.displayName || t.name || '',
    abbr: t.abbreviation || '',
    logo: t.logo || t.logos?.[0]?.href || null,
    record: c?.records?.find(r => r.type === 'total')?.summary || c?.records?.[0]?.summary || null,
    score: c?.score ?? null,
    pitcher: pr?.shortName || pr?.displayName || null,
    pitcherId: pr?.id || null,
    era: null,
  }
}

// Starter's season ERA from the ESPN gamelog (latest cumulative ERA rate). FREE.
async function pitcherEra(cfg, id) {
  if (!id) return null
  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${cfg.sport}/${cfg.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels
  const stats = gl?.seasonTypes?.[0]?.categories?.[0]?.events?.[0]?.stats
  if (!Array.isArray(labels) || !Array.isArray(stats)) return null
  const i = labels.findIndex(l => /^ERA$/i.test(l))
  return i >= 0 ? stats[i] : null
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sport = String(req.query.sport || 'MLB').toUpperCase()
  const away = String(req.query.away || ''), home = String(req.query.home || '')
  const iso = String(req.query.iso || '')
  const cfg = SPORTS[sport]
  if (!cfg || !away || !home) return res.status(200).json({ found: false })
  res.setHeader('Cache-Control', 'public, max-age=300')
  try {

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
  const aSide = side(a), hSide = side(h)

  // Pull both starters' ERA (MLB) and flag an Over/Under lean — the thing nobody surfaces.
  // Best-effort: never let a pitcher-stats hiccup kill the whole game card.
  let ou = null
  if (sport === 'MLB') {
    try {
      const [ae, he] = await Promise.all([pitcherEra(cfg, aSide.pitcherId), pitcherEra(cfg, hSide.pitcherId)])
      aSide.era = ae; hSide.era = he
      const an = parseFloat(ae), hn = parseFloat(he)
      const pf = PARK[String(hSide.abbr).toUpperCase()] ?? 1.0
      let score = 0; const why = []
      // ballpark
      if (pf >= 1.06) { score += 1; why.push('hitter park') }
      else if (pf <= 0.93) { score -= 1; why.push('pitcher park') }
      // starting pitching (a soft arm on either side pushes over; two aces push under)
      if (Number.isFinite(an) && Number.isFinite(hn)) {
        const avg = (an + hn) / 2, worst = Math.max(an, hn)
        if (avg <= 3.3) { score -= 1; why.push('both arms sharp') }
        else if (worst >= 5.5) { score += 1; why.push('a soft arm') }
        else if (avg >= 4.6) { score += 1; why.push('weak pitching') }
      }
      if (why.length) {
        const lean = score >= 1 ? 'OVER' : score <= -1 ? 'UNDER' : 'LEAN'
        ou = { lean, strong: Math.abs(score) >= 2, reason: why.join(' · ') }
      }
    } catch { /* ERA/O-U is a bonus — ignore failures */ }
  }

  return res.status(200).json({
    found: true,
    status: { state: st.state || 'pre', detail: st.shortDetail || st.detail || '', completed: !!st.completed },
    away: aSide, home: hSide, ou,
  })
  } catch (e) {
    return res.status(200).json({ found: false, error: String(e?.message || e) })
  }
}
