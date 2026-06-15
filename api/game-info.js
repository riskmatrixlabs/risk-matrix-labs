// Game info — FREE (ESPN scoreboard, zero Odds-API credits). Given sport + away/home team
// names, returns the matchup card data: logos, records, status/score, and (MLB) probable
// pitchers. Powers the CH2 game card. Cached 5 min.
import { requireAuth } from './_lib/auth.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getSavantMaps } from './savant.js'
import { fetchWeather } from './lib/weather.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'

export const config = { maxDuration: 20 }

const db = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
  : null

// Anchor the O/U lean to a real number: current total from events (synced free) + the open
// from odds_history's accruing total-point snapshots → since-open direction. All Supabase, $0.
async function totalAnchor(sport, away, home) {
  const sb = db(); if (!sb) return null
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
  try {
    const { data: evs } = await sb.from('events')
      .select('external_event_id, away_team, home_team, odds_total')
      .eq('sport', sport).gte('start_time', new Date(Date.now() - 8 * 3600e3).toISOString()).limit(60)
    const ev = (evs || []).find(e => lw(e.home_team) === lw(home) && lw(e.away_team) === lw(away))
    if (!ev) return null
    const current = ev.odds_total != null ? Number(ev.odds_total) : null
    let open = null
    const { data: hist } = await sb.from('odds_history')
      .select('point, captured_at').eq('external_event_id', String(ev.external_event_id))
      .eq('market', 'total').not('point', 'is', null).order('captured_at', { ascending: true }).limit(200)
    if (hist?.length) open = Number(hist[0].point)
    if (current == null && open == null) return null
    const dir = (current != null && open != null) ? Math.sign(current - open) : 0
    return { current, open, dir }
  } catch { return null }
}

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

// MLB park coords by HOME abbr → [lat, lon, dome?]. Domed/retractable parks neutralize weather
// (roof usually closed in heat/cold/rain) so we don't fake a wind/temp edge indoors.
export const PARK_GEO = {
  ARI: [33.4455, -112.0667, 1], ATL: [33.8908, -84.4678], BAL: [39.2839, -76.6217],
  BOS: [42.3467, -71.0972], CHC: [41.9484, -87.6553], CWS: [41.8299, -87.6338], CHW: [41.8299, -87.6338],
  CIN: [39.0975, -84.5069], CLE: [41.4962, -81.6852], COL: [39.7559, -104.9942], DET: [42.3390, -83.0485],
  HOU: [29.7572, -95.3556, 1], KC: [39.0517, -94.4803], LAA: [33.8003, -117.8827], LAD: [34.0739, -118.2400],
  MIA: [25.7781, -80.2197, 1], MIL: [43.0280, -87.9712, 1], MIN: [44.9817, -93.2776], NYM: [40.7571, -73.8458],
  NYY: [40.8296, -73.9262], ATH: [38.5802, -121.5132], OAK: [37.7516, -122.2005], PHI: [39.9061, -75.1665],
  PIT: [40.4469, -80.0057], SD: [32.7073, -117.1566], SF: [37.7786, -122.3893], SEA: [47.5914, -122.3325, 1],
  STL: [38.6226, -90.1928], TB: [27.7683, -82.6534, 1], TEX: [32.7473, -97.0832, 1], TOR: [43.6414, -79.3894, 1],
  WSH: [38.8730, -77.0074],
}

// ESPN abbr → MLB Stats API team id (statsapi.mlb.com, free, no key). Powers bullpen ERA.
const MLB_TEAM_ID = {
  ARI: 109, AZ: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CHW: 145, CWS: 145, CIN: 113,
  CLE: 114, COL: 115, DET: 116, HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146, MIL: 158,
  MIN: 142, NYM: 121, NYY: 147, ATH: 133, OAK: 133, PHI: 143, PIT: 134, SD: 135, SEA: 136,
  SF: 137, STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
}
const SEASON = 2026

// Team bullpen (relief) ERA — owner's #1 O/U signal. Free MLB Stats API, cached ~12h.
async function bullpenEra(abbr) {
  const id = MLB_TEAM_ID[String(abbr || '').toUpperCase()]
  if (!id) return null
  const date = todayStr()
  const cached = await readScan(`BULLPEN-${id}`, date)
  if (cached?.payload?.era != null && isFresh(cached.scanned_at, Date.now(), 12 * 3600e3)) return cached.payload.era
  const j = await getJson(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=statSplits&group=pitching&season=${SEASON}&sitCodes=rp`, 7000)
  const era = parseFloat(j?.stats?.[0]?.splits?.[0]?.stat?.era)
  if (Number.isFinite(era)) { await writeScan(`BULLPEN-${id}`, date, { era }); return era }
  return null
}

// Game-hour weather → a run-scoring boost in [-1,+1] (hot air carries = over; cold = under).
// Returns { tempF, windMph, windDir, precipPct, boost, note } or null. Free (open-meteo).
export async function gameWeather(homeAbbr, iso) {
  const geo = PARK_GEO[String(homeAbbr || '').toUpperCase()]
  if (!geo) return null
  if (geo[2]) return { dome: true, boost: 0, note: 'roof' }   // controlled environment
  const w = await fetchWeather(geo[0], geo[1], iso || new Date().toISOString()).catch(() => null)
  if (!w || w.tempF == null) return null
  let boost = 0; const parts = []
  if (w.tempF >= 88) { boost += 0.7; parts.push(`hot ${w.tempF}°`) }
  else if (w.tempF >= 80) { boost += 0.35; parts.push(`warm ${w.tempF}°`) }
  else if (w.tempF <= 48) { boost -= 0.7; parts.push(`cold ${w.tempF}°`) }
  else if (w.tempF <= 57) { boost -= 0.35; parts.push(`cool ${w.tempF}°`) }
  if (w.windMph >= 15) parts.push(`wind ${w.windMph}mph ${w.windDir}`)   // shown; direction-vs-park is a later refinement
  return { tempF: w.tempF, windMph: w.windMph, windDir: w.windDir, precipPct: w.precipPct, boost: Math.max(-1, Math.min(1, boost)), note: parts.join(' · ') }
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
    pitcherFull: pr?.fullName || pr?.displayName || pr?.shortName || null, // for Savant name-match
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

  // Over/Under lean (MLB) — scored on SKILL pitching (Statcast xERA/K%, less noisy than raw ERA;
  // shared with the PHLT props model) + ballpark, then ANCHORED to the live total with the
  // since-open move so it's a number to beat, not a naked guess. Best-effort; never blocks the card.
  let ou = null
  if (sport === 'MLB') {
    try {
      const [ae, he, sav, anchor, wx, aBp, hBp] = await Promise.all([
        pitcherEra(cfg, aSide.pitcherId), pitcherEra(cfg, hSide.pitcherId),
        getSavantMaps().catch(() => null), totalAnchor(sport, away, home).catch(() => null),
        gameWeather(hSide.abbr, iso).catch(() => null),
        bullpenEra(aSide.abbr).catch(() => null), bullpenEra(hSide.abbr).catch(() => null),
      ])
      aSide.era = ae; hSide.era = he
      // Statcast skill read per starter: xERA (fallback raw ERA), xBA-against (contact quality —
      // the cleanest "how hard is he hit" signal), and K% (strikeout arms suppress runs).
      const pStat = (s) => {
        const nn = sav?.normName(s.pitcherFull || s.pitcher || '')
        const x = nn ? sav?.pitcherX?.[nn] : null, k = nn ? sav?.pitcherK?.[nn] : null
        const eff = x?.xera ?? parseFloat(s.era)
        return { eff: Number.isFinite(eff) ? eff : null, xba: x?.xbaAgainst ?? null, kPct: k?.kPct ?? null, hasX: !!x }
      }
      const ap = pStat(aSide), hp = pStat(hSide)
      const pf = PARK[String(hSide.abbr).toUpperCase()] ?? 1.0
      let score = 0; const why = []
      if (pf >= 1.06) { score += 1; why.push('hitter park') }
      else if (pf <= 0.93) { score -= 1; why.push('pitcher park') }
      const usingX = ap.hasX || hp.hasX
      // xERA (regressed, tighter spread than raw ERA → tighter thresholds).
      if (ap.eff != null && hp.eff != null) {
        const avg = (ap.eff + hp.eff) / 2, worst = Math.max(ap.eff, hp.eff)
        const tag = usingX ? 'xERA' : 'ERA'
        if (avg <= 3.5) { score -= 1; why.push(`both arms sharp (${tag})`) }
        else if (worst >= 4.8) { score += 1; why.push(`a soft arm (${tag})`) }
        else if (avg >= 4.3) { score += 1; why.push(`weak pitching (${tag})`) }
      }
      // xBA-against: a starter hitters square up (≥.265) pushes over; a tough-contact arm (≤.215) under.
      if (ap.xba != null || hp.xba != null) {
        const xs = [ap.xba, hp.xba].filter(v => v != null)
        const worstXba = Math.max(...xs), bestXba = Math.min(...xs)
        if (worstXba >= 0.265) { score += 1; why.push('hard-hit arm (xBA)') }
        else if (bestXba <= 0.215 && xs.length === 2) { score -= 1; why.push('tough contact (xBA)') }
      }
      // Strikeout arms suppress balls in play → under; two contact arms → over.
      if (ap.kPct != null && hp.kPct != null) {
        if (ap.kPct >= 26 && hp.kPct >= 26) { score -= 1; why.push('two K arms') }
        else if (ap.kPct <= 18 && hp.kPct <= 18) { score += 1; why.push('contact arms') }
      }
      // Bullpen quality — owner's #1 signal. Weak relief (high ERA) on either side pushes over;
      // two shutdown pens push under. (Fatigue/recent-IP is a later refinement.)
      if (aBp != null && hBp != null) {
        const worstBp = Math.max(aBp, hBp), bestBp = Math.min(aBp, hBp)
        if (aBp >= 4.6 && hBp >= 4.6) { score += 1; why.push('two weak pens') }
        else if (worstBp >= 4.7) { score += 1; why.push('a weak pen') }
        else if (bestBp <= 3.3 && worstBp <= 3.7) { score -= 1; why.push('shutdown pens') }
      }
      // Weather: hot air carries → over; cold → under (domed parks neutralized).
      if (wx && wx.note && !wx.dome) {
        if (wx.boost >= 0.5) { score += 1; why.push(wx.note) }
        else if (wx.boost <= -0.5) { score -= 1; why.push(wx.note) }
        else if (wx.note) why.push(wx.note)   // mild/wind: show context without moving the lean
      }
      if (why.length || anchor?.current != null) {
        const lean = score >= 1 ? 'OVER' : score <= -1 ? 'UNDER' : 'LEAN'
        // Value vs the market: lean agrees with the move = late; line moved against the lean = value.
        let edge = null
        if (anchor && anchor.dir !== 0 && lean !== 'LEAN') {
          const moveOver = anchor.dir > 0   // total climbing
          if ((lean === 'OVER') === moveOver) edge = 'late — line already moved your way'
          else edge = 'value — line moved against the lean'
        }
        ou = { lean, strong: Math.abs(score) >= 2, reason: why.join(' · '), model: usingX ? 'statcast' : 'era',
          total: anchor || null, edge, weather: wx || null, bullpens: { away: aBp ?? null, home: hBp ?? null } }
      }
    } catch { /* O-U is a bonus — ignore failures */ }
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
