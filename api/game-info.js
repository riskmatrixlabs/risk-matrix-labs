// Game info — FREE (ESPN scoreboard, zero Odds-API credits). Given sport + away/home team
// names, returns the matchup card data: logos, records, status/score, and (MLB) probable
// pitchers. Powers the CH2 game card. Cached 5 min.
import { requireAuth } from './_lib/auth.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getSavantMaps } from './savant.js'
import { fetchWeather } from './lib/weather.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'
import { getOffense } from './_lib/offense.js'
import { getPitcherSkillMaps, pitcherSkillDelta } from './_lib/pitcherSkill.js'
import { windParkDelta } from './_lib/windPark.js'
import { loadHandednessDelta } from './_lib/handedness.js'
import { loadUmpireDelta } from './_lib/umpire.js'
import { gameProjection, deriveBets } from './_lib/runModel.js'
import { loadBullpenFatigue } from './_lib/bullpenFatigue.js'

export const config = { maxDuration: 20 }

// Model version tag — stamped on every snapshot so calibration can segment by model (the S65 analysis
// showed we couldn't separate old vs new model on the record). Bump when the lean math changes.
const MODEL_VERSION = 'ou-s65-phase2'

const db = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
  : null

// Anchor the O/U lean to a real number: current total from events (synced free) + the open
// from odds_history's accruing total-point snapshots → since-open direction. All Supabase, $0.
async function totalAnchor(sport, away, home) {
  const sb = db(); if (!sb) return null
  const lw = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop()
  try {
    // Window to the next ~20h and order by start so the SOONEST matching game wins — a
    // matchup repeats across a series, so an unbounded/unordered find grabbed the wrong
    // day's row (null or stale total). Prefer a row that actually carries a total.
    const { data: evs } = await sb.from('events')
      .select('external_event_id, away_team, home_team, odds_total, start_time, metadata')
      .eq('sport', sport)
      .gte('start_time', new Date(Date.now() - 8 * 3600e3).toISOString())
      .lte('start_time', new Date(Date.now() + 20 * 3600e3).toISOString())
      .order('start_time', { ascending: true }).limit(60)
    const matches = (evs || []).filter(e => lw(e.home_team) === lw(home) && lw(e.away_team) === lw(away))
    // A synced total of 0 (or null) = no real total — don't let it through, or halfBelow turns 0 into
    // a fake -0.5 line. Prefer a match that actually carries a positive total.
    const hasTotal = (e) => e.odds_total != null && Number(e.odds_total) > 0
    const ev = matches.find(hasTotal) || matches[0]
    if (!ev) return null
    // Books rarely post WHOLE-number totals (10, 8, 11) — the real line is the half-point below
    // (9.5, 7.5, 10.5). Our synced total can come back rounded, so default whole numbers down to .5.
    const halfBelow = (n) => (n == null ? null : (Number.isInteger(n) ? n - 0.5 : n))
    const current = hasTotal(ev) ? halfBelow(Number(ev.odds_total)) : null
    let open = null
    // The free whole-slate sync (cron-sync-live) stores the total LINE in `value`, not `point`
    // (point is for the paid per-book path). Read `value` so since-open movement lights up for the
    // whole slate, not just games whose paid lines were fetched. (>0 drops junk 0-line snapshots.)
    const { data: hist } = await sb.from('odds_history')
      .select('value, captured_at').eq('external_event_id', String(ev.external_event_id))
      .eq('market', 'total').not('value', 'is', null).gt('value', 0)
      .order('captured_at', { ascending: true }).limit(200)
    if (hist?.length) open = halfBelow(Number(hist[0].value))
    if (current == null && open == null) return null
    const dir = (current != null && open != null) ? Math.sign(current - open) : 0
    // Over/under juice (the price) — already synced FREE in the event row, so a lean can become
    // a fully-priced slip leg with zero credits.
    const m = ev.metadata || {}
    const overJuice  = m.over_juice  != null ? Number(m.over_juice)  : null
    const underJuice = m.under_juice != null ? Number(m.under_juice) : null
    return { current, open, dir, overJuice, underJuice }
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

// MLB park coords by HOME abbr → [lat, lon, roof?]. roof: 1 = fixed dome (no weather shown),
// 2 = retractable (usually OPEN in summer → SHOW weather as info, but neutralize the model boost
// since we can't know the roof's state from the feed). Open-air parks have no flag.
export const PARK_GEO = {
  ARI: [33.4455, -112.0667, 2], ATL: [33.8908, -84.4678], BAL: [39.2839, -76.6217],
  BOS: [42.3467, -71.0972], CHC: [41.9484, -87.6553], CWS: [41.8299, -87.6338], CHW: [41.8299, -87.6338],
  CIN: [39.0975, -84.5069], CLE: [41.4962, -81.6852], COL: [39.7559, -104.9942], DET: [42.3390, -83.0485],
  HOU: [29.7572, -95.3556, 2], KC: [39.0517, -94.4803], LAA: [33.8003, -117.8827], LAD: [34.0739, -118.2400],
  MIA: [25.7781, -80.2197, 2], MIL: [43.0280, -87.9712, 2], MIN: [44.9817, -93.2776], NYM: [40.7571, -73.8458],
  NYY: [40.8296, -73.9262], ATH: [38.5802, -121.5132], OAK: [37.7516, -122.2005], PHI: [39.9061, -75.1665],
  PIT: [40.4469, -80.0057], SD: [32.7073, -117.1566], SF: [37.7786, -122.3893], SEA: [47.5914, -122.3325, 2],
  STL: [38.6226, -90.1928], TB: [27.7683, -82.6534, 1], TEX: [32.7473, -97.0832, 2], TOR: [43.6414, -79.3894, 2],
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
  if (geo[2] === 1) return { dome: true, boost: 0, note: 'roof' }   // fixed dome — no weather
  const retractable = geo[2] === 2                                    // roof usually open in summer
  const w = await fetchWeather(geo[0], geo[1], iso || new Date().toISOString()).catch(() => null)
  if (!w || w.tempF == null) return null
  let boost = 0; const parts = []
  if (w.tempF >= 88) { boost += 0.7; parts.push(`hot ${w.tempF}°`) }
  else if (w.tempF >= 80) { boost += 0.35; parts.push(`warm ${w.tempF}°`) }
  else if (w.tempF <= 48) { boost -= 0.7; parts.push(`cold ${w.tempF}°`) }
  else if (w.tempF <= 57) { boost -= 0.35; parts.push(`cool ${w.tempF}°`) }
  if (w.windMph >= 15) parts.push(`wind ${w.windMph}mph ${w.windDir}`)   // shown; direction-vs-park is a later refinement
  // Retractable roof: show the conditions as info, but neutralize the model boost (roof state unknown).
  return { tempF: w.tempF, windMph: w.windMph, windDir: w.windDir, windDeg: w.windDeg ?? null, precipPct: w.precipPct, humidityPct: w.humidityPct, feelsF: w.feelsF, retractable: retractable || undefined,
    boost: retractable ? 0 : Math.max(-1, Math.min(1, boost)), note: retractable ? 'retractable roof' : parts.join(' · ') }
}

// Park de-correlation (S64 PIT@COL fix): weather and park factor both encode air density (a ball
// carries in hot/thin air), so at an extreme park the hot-weather boost largely re-counts what the
// (pf-1) park term already captured. Damp the weather run-contribution by the park's extremity so
// altitude is counted ~once, not stacked across both terms. Pure: returns runs to add to delta.
//   neutral park (pf=1)   → full weather boost
//   Coors (pf≈1.4)        → boost × 0.6 (extremity capped at 0.4)
//   dome / no boost       → 0
export function parkAdjustedWeather(boost, pf, dome) {
  if (!boost || dome) return 0
  const parkExtreme = Math.min(Math.abs((pf ?? 1) - 1), 0.4)
  return boost * (1 - parkExtreme)
}

// Extreme-park edge regression (S64 PIT@COL guard). At extreme run-environment parks (Coras/GABP-type
// hitter parks, or the most suppressive pitcher parks) the model's projection terms are CORRELATED — the
// park factor, recent scoring form, the home starter's ERA and the bullpen ERA are all pushed the same
// way by the same run environment, so summing them OVER-states the edge (PIT@COL projected a conf-4
// STRONG over and lost by ~7). Until per-side road-split projection (Phase 3) decorrelates them properly,
// regress the edge toward the line in proportion to how extreme the park is — i.e. trust our own number
// LESS where it's been provably unreliable. Hypothesis, like the rest of the coefficients; the graded
// record validates it. Threshold |pf-1| >= 0.07 isolates it to COL/CIN + SF/SEA/MIA/SD/ATH.
export function extremeParkEdge(delta, pf) {
  const extremity = Math.abs((pf ?? 1) - 1)
  if (extremity < 0.07) return delta            // normal park → untouched
  const haircut = Math.min(extremity * 4, 0.5)  // COL(.13)→0.5 cap, CIN(.08)→0.32, SF(.09)→0.36
  return Math.round(delta * (1 - haircut) * 10) / 10
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
      const [ae, he, sav, anchor, wx, aBp, hBp, off, pskill, penFat] = await Promise.all([
        pitcherEra(cfg, aSide.pitcherId), pitcherEra(cfg, hSide.pitcherId),
        getSavantMaps().catch(() => null), totalAnchor(sport, away, home).catch(() => null),
        gameWeather(hSide.abbr, iso).catch(() => null),
        bullpenEra(aSide.abbr).catch(() => null), bullpenEra(hSide.abbr).catch(() => null),
        getOffense({ away, home, awayId: MLB_TEAM_ID[String(aSide.abbr || '').toUpperCase()], homeId: MLB_TEAM_ID[String(hSide.abbr || '').toUpperCase()] }).catch(() => null),
        getPitcherSkillMaps().catch(() => null),   // Phase 2: CSW%/K-BB% swing-miss layer (free Savant)
        loadBullpenFatigue(aSide.abbr, hSide.abbr).catch(() => null),   // Phase 2: bullpen FATIGUE (owner's #1; free MLB Stats API)
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
        const best = Math.min(ap.eff, hp.eff)
        if (avg <= 3.5) { score -= 1; why.push(`both arms sharp (${tag})`) }
        else if (best <= 3.0) { score -= 1; why.push(`an ace arm (${tag})`) }   // mirrors 'a soft arm' → UNDER
        else if (worst >= 4.8) { score += 1; why.push(`a soft arm (${tag})`) }
        else if (avg >= 4.3) { score += 1; why.push(`weak pitching (${tag})`) }
      }
      // xBA-against: a starter hitters square up (≥.265) pushes over; a tough-contact arm (≤.215) under.
      if (ap.xba != null || hp.xba != null) {
        const xs = [ap.xba, hp.xba].filter(v => v != null)
        const worstXba = Math.max(...xs), bestXba = Math.min(...xs)
        if (worstXba >= 0.265) { score += 1; why.push('hard-hit arm (xBA)') }
        else if (bestXba <= 0.215) { score -= 1; why.push('tough contact (xBA)') }   // one tough arm → UNDER (was: required both)
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
        else if (bestBp <= 3.3 && worstBp <= 3.7) { score -= 1; why.push('two shutdown pens') }
        else if (bestBp <= 3.3) { score -= 1; why.push('a shutdown pen') }   // one elite pen → UNDER, mirrors 'a weak pen'
      }
      // Weather: hot air carries → over; cold → under (domed parks neutralized).
      if (wx && wx.note && !wx.dome) {
        if (wx.boost >= 0.5) { score += 1; why.push(wx.note) }
        else if (wx.boost <= -0.5) { score -= 1; why.push(wx.note) }
        else if (wx.note) why.push(wx.note)   // mild/wind: show context without moving the lean
      }
      // Offense (lineup xwOBA) + recent scoring form — the under/over balancer. Additive; sits out
      // (score 0) when lineups/data are unavailable, so the lean never regresses below today's model.
      if (off?.offense?.score) { score += off.offense.score; why.push(off.offense.reason) }
      if (off?.form?.score)    { score += off.form.score;    why.push(off.form.reason) }
      // ── Line-anchored run-environment edge ──
      // The market line already prices park · starters · pens · rosters. Our edge is only the DEVIATION
      // our factors justify on top of it (a run-delta), so the model leans UNDER on sharp pitching as
      // readily as OVER instead of fighting every low line from a fixed average (the old OVER-bias bug).
      // The coefficients are run estimates (a hypothesis) — the graded record validates them over time.
      const LG_TOTAL = 8.6, LG_XERA = 4.0, LG_PEN = 4.1
      // Run-DELTA from a neutral game: how far our factors say THIS game deviates from average.
      // The market line already prices park/pitchers/rosters, so our edge is only this deviation —
      // applied ON TOP of the line (owner's rule: "anchor the lean to the live total"). Coefficients
      // raised vs the old absolute model so a real pitching/bullpen edge actually moves the number.
      // ── Phase 2 signals (free) — computed here, folded into delta below ──
      // pitcher SKILL: CSW%/K-BB% (swing-and-miss + command) judge each arm on its OWN skill, not its
      // park-inflated ERA. THE Coors fix: an elite strikeout arm at altitude is no longer disguised as a
      // "soft arm". wind-vs-park: wind blowing IN suppresses runs (under), OUT carries them (over).
      const pskNN = (s) => (pskill?.normName ? pskill.normName(s.pitcherFull || s.pitcher || '') : null)
      const aNN = pskNN(aSide), hNN = pskNN(hSide)
      const pskillD = pitcherSkillDelta({
        awayCsw: aNN ? pskill?.csw?.[aNN] : null, homeCsw: hNN ? pskill?.csw?.[hNN] : null,
        awayKbb: aNN ? pskill?.kbb?.[aNN] : null, homeKbb: hNN ? pskill?.kbb?.[hNN] : null,
      })
      const windD = windParkDelta({ parkAbbr: hSide.abbr, windSpeedMph: wx?.windMph, windDirDeg: wx?.windDeg, isDome: wx?.dome })
      // Phase 2 — platoon (L/R) edge. Only lights up inside the ~3h pre-game window once lineups post;
      // neutral { delta:0 } otherwise. Reuses the gamePk getOffense already resolved (no extra schedule
      // fetch). Bounded by per-fetch timeouts + 12h cache; degrades to neutral on any miss.
      // Both reuse the gamePk getOffense already resolved; run them together so they add no extra
      // latency. Each is gated (needs posted lineups/officials) + cached + degrades to neutral.
      const [handD, umpD] = off?.gamePk
        ? await Promise.all([
            loadHandednessDelta(off.gamePk).catch(() => ({ delta: 0, reason: null })),
            loadUmpireDelta(off.gamePk).catch(() => ({ delta: 0, reason: null })),
          ])
        : [{ delta: 0, reason: null }, { delta: 0, reason: null }]
      const penFatD = penFat || { delta: 0, reason: null }
      if (pskillD.reason) { score += Math.sign(pskillD.delta); why.push(pskillD.reason) }
      if (windD.reason)   { score += Math.sign(windD.delta);   why.push(windD.reason) }
      if (handD.reason)   { score += Math.sign(handD.delta);   why.push(handD.reason) }
      if (umpD.reason)    { score += Math.sign(umpD.delta);    why.push(umpD.reason) }
      if (penFatD.reason) { score += Math.sign(penFatD.delta); why.push(penFatD.reason) }

      let delta = 0
      // When the skill layer is active it already carries the pitching signal, so trim the raw-ERA
      // coefficient (1.3→1.0) to avoid double-counting the same arms (rml-ou-model Phase-2 note).
      const eraCoeff = pskillD.delta !== 0 ? 1.0 : 1.3
      if (ap.eff != null && hp.eff != null) delta += ((ap.eff + hp.eff) / 2 - LG_XERA) * eraCoeff  // starters
      delta += pskillD.delta                                                                        // Phase 2: swing-miss/command
      if (aBp != null && hBp != null)       delta += ((aBp + hBp) / 2 - LG_PEN) * 0.9           // bullpens — owner's #1 (was ×0.5)
      if (off?.offense?.score)              delta += off.offense.score * 0.45                   // lineup xwOBA
      if (off?.form?.score)                 delta += off.form.score * 0.30                      // recent scoring
      delta += windD.delta                                                                          // Phase 2: wind vs park
      delta += handD.delta                                                                          // Phase 2: platoon L/R edge
      delta += umpD.delta                                                                            // Phase 2: home-plate umpire
      delta += penFatD.delta                                                                         // Phase 2: bullpen fatigue (owner's #1)
      // Weather and park both encode air density (a ball carries in hot/thin air), so at an extreme
      // park the hot-weather boost is largely re-counting what (pf-1) already captured. Damp the
      // weather add-on by the park's extremity so altitude is counted ~once, not stacked. This is the
      // S64 PIT@COL fix: Coors (pf≈1.4) projected 13.8 vs a 10.5 line because park + weather + the
      // home starter's altitude-inflated xERA all summed the same cause. (Park de-correlation.)
      if (wx && !wx.dome && wx.boost) delta += parkAdjustedWeather(wx.boost, pf, wx.dome)
      delta += (pf - 1) * 4.0                                                                   // park tilts the deviation
      delta = extremeParkEdge(delta, pf)        // regress the edge at extreme parks (correlated-term guard)
      delta = Math.round(delta * 10) / 10

      if (why.length || anchor?.current != null) {
        // Only trust a plausible MLB game total (~6–13 runs). A value outside this is a mis-sourced
        // market (e.g. a -0.5 run line leaking in) — treat it as no line and fall back.
        const rawLine = anchor?.current ?? null
        const line = (rawLine != null && rawLine >= 5 && rawLine <= 15) ? rawLine : null
        let lean, edgeRuns = null, confidence, strong, proj
        if (line != null) {
          // ANCHOR TO THE LINE: projection = market line + our factor deviation. This makes the model
          // SYMMETRIC — it leans UNDER on sharp pitching as readily as OVER — instead of fighting every
          // low line from a fixed league-average anchor (the old 77%-OVER bias).
          proj = Math.round((line + delta) * 10) / 10
          edgeRuns = Math.round(delta * 10) / 10
          const mag = Math.abs(edgeRuns)
          lean = edgeRuns >= 1 ? 'OVER' : edgeRuns <= -1 ? 'UNDER' : 'LEAN'  // <1-run deviation = no edge → pass
          confidence = mag >= 2.5 ? 4 : mag >= 2 ? 3 : mag >= 1.5 ? 2 : 1
          strong = mag >= 2 && lean !== 'LEAN'   // a real ≥2-run deviation surfaces as "strong"
          // Extreme hitter park + OVER = the exact profile the model has been provably wrong on
          // (correlated over-projection). Never let it shout: strip STRONG, cap confidence, flag it.
          if (pf >= 1.08 && lean === 'OVER') {
            strong = false
            confidence = Math.min(confidence, 2)
            why.push('⚠ extreme park — model de-emphasized')
          }
        } else {
          // No market line → absolute fallback from league average; raw factor lean, never "strong".
          proj = Math.round((LG_TOTAL * pf + delta) * 10) / 10
          lean = score >= 1 ? 'OVER' : score <= -1 ? 'UNDER' : 'LEAN'
          confidence = 1; strong = false
        }
        // Agreement guard: if the qualitative factors and the run-edge point opposite ways, it's not a
        // clean signal → pass. (Belt-and-suspenders; with line-anchoring they almost always agree now.)
        if (lean !== 'LEAN' && score !== 0 && edgeRuns != null && Math.sign(score) !== Math.sign(edgeRuns)) {
          lean = 'LEAN'; strong = false
        }
        // Market-move context (value vs late): does the line's move agree with our lean?
        let edge = null
        if (anchor && anchor.dir !== 0 && lean !== 'LEAN') {
          const moveOver = anchor.dir > 0   // total climbing
          if ((lean === 'OVER') === moveOver) edge = 'late — line already moved your way'
          else edge = 'value — line moved against the lean'
        }
        ou = { lean, score, proj, edgeRuns, confidence, strong, reason: why.join(' · '), model: usingX ? 'statcast' : 'era',
          modelVersion: MODEL_VERSION,
          total: anchor || null, edge, weather: wx || null, bullpens: { away: aBp ?? null, home: hBp ?? null }, offenseSource: off?.source || 'none' }

        // Phase 3 (BETA, additive — does NOT replace the line-anchored `ou` lean above). Projects each
        // team's runs separately so an ace fully suppresses the side he faces (no starter-averaging) and
        // park/weather count once per side, then derives Total + ML + RL from one engine. Shown alongside
        // `ou` so the two can be compared on the graded record before any switch.
        const weatherPerSide = (wx && !wx.dome && wx.boost) ? parkAdjustedWeather(wx.boost, pf, wx.dome) / 2 : 0
        const gp = gameProjection({
          away: { offXwoba: off?.awayXwoba ?? null, starterXera: ap.eff, bullpenEra: aBp ?? null },
          home: { offXwoba: off?.homeXwoba ?? null, starterXera: hp.eff, bullpenEra: hBp ?? null },
          parkMult: pf, weatherRunsPerSide: weatherPerSide,
        })
        const marketTotal = (anchor?.current != null && anchor.current >= 5 && anchor.current <= 15) ? anchor.current : null
        ou.proj2 = { ...gp, bets: deriveBets({ proj: gp, marketTotal }) }
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
