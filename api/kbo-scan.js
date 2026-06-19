// KBO (Korean Baseball) over/under scan — 100% FREE (TheSportsDB schedule + Open-Meteo weather,
// zero Odds-API credits). KBO plays ~2–10pm KST = overnight/early-morning ET, so this fills the
// Spotlight slot when MLB is dark. Projects a game total from park factor + weather (+ dome), the
// same shape as the MLB O/U model — minus Statcast (KBO has no batted-ball tracking).
//
// GET /api/kbo-scan?date=YYYY-MM-DD   (date in KST; defaults to "today" in KST)
// Returns { date, games: [{ matchup, venue, projTotal, lean, edge, factors, weather }], note }.

// Home stadium per team → [lat, lon, dome?, parkFactor]. Park factors are rough KBO estimates
// (Jamsil/Gocheok suppress runs; Sajik/Daegu/Munhak play hitter-friendly) — calibrate over time.
const STADIUMS = {
  'LG Twins':       [37.5124, 127.0720, 0, 0.95],
  'Doosan Bears':   [37.5124, 127.0720, 0, 0.95],   // share Jamsil (run-suppressing)
  'Kiwoom Heroes':  [37.4982, 126.8673, 1, 0.93],   // Gocheok Sky Dome (pitcher-friendly)
  'SSG Landers':    [37.4368, 126.6933, 0, 1.05],   // Incheon Munhak (HR-friendly)
  'KT Wiz':         [37.2998, 127.0097, 0, 1.02],
  'Hanwha Eagles':  [36.3163, 127.4314, 0, 1.00],   // new Daejeon park (2025) — neutral baseline
  'Samsung Lions':  [35.8409, 128.6816, 0, 1.05],   // Daegu (hitter)
  'Lotte Giants':   [35.1940, 129.0616, 0, 1.06],   // Sajik (most HR-friendly)
  'KIA Tigers':     [35.1681, 126.8891, 0, 1.00],
  'NC Dinos':       [35.2224, 128.5818, 0, 1.02],
}
const BASELINE_TOTAL = 9.8   // KBO league-average game total (runs); the no-edge anchor.

const norm = (s) => String(s || '').trim()

function fmt2(n) { return Math.round(n * 10) / 10 }

// Weather → run boost in [-1, +1], same logic family as the MLB model (hot air carries = over).
async function weatherBoost(lat, lon, dome) {
  if (dome) return { boost: 0, note: 'dome', tempF: null, windMph: null }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,precipitation_probability&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`
    const r = await fetch(url)
    if (!r.ok) return { boost: 0, note: '', tempF: null, windMph: null }
    const j = await r.json()
    const h = j.hourly || {}
    // ~game time: KBO weekday first pitch 18:30 KST; weekend 14:00/17:00 — use the 18:00 local hour.
    const idx = Math.min(18, (h.time || []).length - 1)
    const tempF = h.temperature_2m?.[idx] != null ? Math.round(h.temperature_2m[idx]) : null
    const windMph = h.wind_speed_10m?.[idx] != null ? Math.round(h.wind_speed_10m[idx]) : null
    let boost = 0; const parts = []
    if (tempF != null) {
      if (tempF >= 86) { boost += 0.6; parts.push(`hot ${tempF}°`) }
      else if (tempF >= 78) { boost += 0.3; parts.push(`warm ${tempF}°`) }
      else if (tempF <= 50) { boost -= 0.6; parts.push(`cold ${tempF}°`) }
      else if (tempF <= 60) { boost -= 0.3; parts.push(`cool ${tempF}°`) }
    }
    if (windMph != null && windMph >= 14) parts.push(`wind ${windMph}mph`)
    return { boost: Math.max(-1, Math.min(1, boost)), note: parts.join(' · '), tempF, windMph }
  } catch { return { boost: 0, note: '', tempF: null, windMph: null } }
}

// KST "today" (UTC+9) as YYYY-MM-DD.
function kstDate() {
  const t = Date.now() + 9 * 3600e3
  return new Date(t).toISOString().slice(0, 10)
}

// Shared engine — used by the public endpoint AND the overnight cron, so there's ONE model.
export async function scanKBO(date) {
  // FREE schedule — TheSportsDB league 4830 (KBO), test key "123". strEvent = "Home vs Away".
  const sched = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&l=4830`)
    .then(r => r.ok ? r.json() : null).catch(() => null)
  const events = sched?.events || []
  const games = []
  for (const e of events) {
    const home = norm(e.strHomeTeam), away = norm(e.strAwayTeam)
    const geo = STADIUMS[home] || null
    const wx = geo ? await weatherBoost(geo[0], geo[1], geo[2]) : { boost: 0, note: 'park n/a', tempF: null, windMph: null }
    const pf = geo ? geo[3] : 1.0
    const projTotal = fmt2(BASELINE_TOTAL * pf + wx.boost)   // baseline × park + weather (runs)
    const edge = fmt2(projTotal - BASELINE_TOTAL)            // vs league baseline (no book line = free)
    const lean = edge >= 0.4 ? 'OVER' : edge <= -0.4 ? 'UNDER' : 'LEAN'
    const factors = []
    if (pf >= 1.04) factors.push('hitter park')
    else if (pf <= 0.95) factors.push('pitcher park')
    if (geo?.[2]) factors.push('dome')
    if (wx.note && wx.note !== 'dome') factors.push(wx.note)
    const hs = e.intHomeScore, as = e.intAwayScore
    const finalTotal = (hs != null && hs !== '' && as != null && as !== '') ? Number(hs) + Number(as) : null
    games.push({
      id: String(e.idEvent || ''), matchup: `${away} @ ${home}`, away, home,
      venue: e.strVenue || null, time: e.strTime || null,
      projTotal, baseline: BASELINE_TOTAL, edge, lean, factors, finalTotal,
      weather: { tempF: wx.tempF, windMph: wx.windMph, dome: !!geo?.[2] },
    })
  }
  games.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))   // strongest edge first
  return { date, count: games.length, games }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=600')
  const date = String(req.query?.date || kstDate())
  try {
    const out = await scanKBO(date)
    if (!out.games.length) return res.status(200).json({ ...out, note: 'No KBO games this date (off-season or none scheduled).' })
    return res.status(200).json({
      ...out,
      note: 'FREE scan (TheSportsDB + Open-Meteo, 0 credits). Projected total = baseline × park × weather. ' +
            'No book line yet (free) so edge is vs the KBO league baseline, not the market. No Statcast for KBO — park+weather model only.',
    })
  } catch (e) {
    return res.status(200).json({ date, games: [], error: String(e?.message || e) })
  }
}

export { kstDate }
