// PHLT v2.2 orchestration — server-side because ESPN + Savant block browser CORS, and a hitter's
// Form/Streak/Cold-Zone terms need that gamelog. Client sends the prop-hitter names it already has;
// we fetch (cached) ESPN form per hitter + the opposing probable pitcher + Savant maps + park, run
// the PURE scorer (src/lib/phlt.js), and return one verdict per requested name. MLB only.
import { requireAuth } from './_lib/auth.js'
import { readScan, writeScan, isFresh, todayStr } from './_lib/scanStore.js'
import { getSavantMaps } from './savant.js'
import { PARK, gameWeather } from './game-info.js'
import { buildIndex } from './player-search.js'
import { scoreHit } from '../src/lib/phlt.js'

export const config = { maxDuration: 30 }

const ESPN = { sport: 'baseball', league: 'mlb' }
const FORM_TTL_MS = 30 * 60 * 1000   // a hitter's recent form is stable within the slate
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'`’\-]/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }

async function getJson(url, ms = 7000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null }
  catch { return null } finally { clearTimeout(t) }
}

// Roster index (name → {id, team}) — reuse the same cached PLAYERS:<sport> index scan-props uses.
async function rosterIndex(sport) {
  const dateYmd = todayStr().replace(/-/g, '')
  const cached = await readScan(`PLAYERS:${sport}`, dateYmd)
  let index = cached?.payload?.index
  // Build the free ESPN roster index on demand if no one's populated it today (mirrors scan-props).
  if (!index?.length) {
    try { const built = await buildIndex(sport); index = built.index; await writeScan(`PLAYERS:${sport}`, dateYmd, built, null) }
    catch { index = [] }
  }
  const byFull = {}, byLast = {}
  for (const r of index || []) {
    const v = { id: r.id || null, team: r.team || null, bats: r.bats || null, throws: r.throws || null }
    const n = norm(r.player)
    byFull[n] = v; byLast[n.split(/\s+/).pop()] = v
  }
  return { byFull, byLast }
}

// Today's probable pitchers by team abbr, from the ESPN scoreboard (same source as game-info).
async function probables(away, home, iso) {
  const day = (iso ? new Date(iso) : new Date()).toISOString().slice(0, 10).replace(/-/g, '')
  const sb = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${ESPN.sport}/${ESPN.league}/scoreboard?dates=${day}`)
  const want = [norm(away), norm(home)]
  for (const ev of sb?.events || []) {
    const comp = ev.competitions?.[0]; if (!comp) continue
    const sides = (comp.competitors || []).map(c => {
      const a = c.probables?.[0]?.athlete
      return {
        abbr: c.team?.abbreviation || '',
        name: norm(c.team?.displayName || c.team?.name || ''),
        // FULL name — ESPN shortName is "Z. Wheeler" which won't match Savant's "Zack Wheeler".
        pitcher: a?.fullName || a?.displayName || a?.shortName || null,
      }
    })
    if (sides.some(s => want.includes(s.name)) || sides.some(s => want.includes(s.abbr.toLowerCase()))) {
      const out = {}; for (const s of sides) out[s.abbr] = s
      return out
    }
  }
  return {}
}

// Compute a hitter's recent form from the ESPN gamelog (newest-first). Cached per athlete.
async function hitterForm(id) {
  if (!id) return null
  const date = todayStr()
  const cached = await readScan(`PHLTGL:${id}`, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), FORM_TTL_MS)) return cached.payload

  const gl = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/${ESPN.sport}/${ESPN.league}/athletes/${id}/gamelog`)
  const labels = gl?.labels; if (!Array.isArray(labels) || !labels.length) return null
  const idx = (name) => labels.findIndex(l => String(l).toUpperCase() === name)
  const iH = idx('H'), iAB = idx('AB'), iBB = idx('BB')
  if (iH < 0 || iAB < 0) return null

  // Gather EVERY game across all seasonTypes/categories, then sort by the real game date (newest
  // first). ESPN groups events by month/seasonType in no guaranteed order, so taking seasonTypes[0]
  // returned a stale/partial slice (e.g. games 2+ weeks old) — that silently floored Form & Streak.
  const meta = gl.events || {}
  const evs = []
  for (const st of (gl.seasonTypes || []))
    for (const cat of (st.categories || []))
      for (const e of (cat.events || [])) if (Array.isArray(e.stats)) {
        const d = meta[e.eventId]?.gameDate || meta[e.id]?.gameDate || null
        evs.push({ ...e, _d: d ? Date.parse(d) : 0 })
      }
  if (!evs.length) return null
  evs.sort((a, b) => b._d - a._d) // newest game first by actual date, not ESPN's grouping order

  const H = (e) => toNum(e.stats[iH]) || 0
  const AB = (e) => toNum(e.stats[iAB]) || 0
  const BB = (e) => iBB >= 0 ? (toNum(e.stats[iBB]) || 0) : 0
  const sum = (arr, f) => arr.reduce((s, e) => s + f(e), 0)

  const last5 = evs.slice(0, 5), last4 = evs.slice(0, 4)
  const ab5 = sum(last5, AB)
  let streak = 0
  for (const e of evs) { if (AB(e) === 0) continue; if (H(e) >= 1) streak++; else break } // skip DNP, stop at a hitless game
  const totBB = sum(evs, BB), totPA = sum(evs, AB) + totBB
  const form = {
    avgLast5: ab5 ? +(sum(last5, H) / ab5).toFixed(3) : null,
    hitsLast4: sum(last4, H),
    hitStreak: streak,
    bbPct: totPA ? +((totBB / totPA) * 100).toFixed(1) : null,
    games: evs.length,
  }
  await writeScan(`PHLTGL:${id}`, date, form)
  return form
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  const sport = String(req.query.sport || 'MLB').toUpperCase()
  res.setHeader('Cache-Control', 'public, max-age=600')
  if (sport !== 'MLB') return res.status(200).json({ ok: true, sport, verdicts: {}, note: 'PHLT is MLB-only' })

  const away = String(req.query.away || ''), home = String(req.query.home || ''), iso = req.query.iso
  const names = String(req.query.names || '').split('|').map(s => s.trim()).filter(Boolean)
  if (!away || !home || !names.length) return res.status(400).json({ error: 'need away, home, names' })

  const [sav, roster, probs] = await Promise.all([getSavantMaps(), rosterIndex(sport), probables(away, home, iso)])
  const abbrs = Object.keys(probs)
  const homeAbbr = abbrs.find(a => probs[a] && norm(probs[a].name) === norm(home)) || abbrs[1] || home
  const parkFactor = (PARK[homeAbbr] || 1.0) * 100
  const wx = await gameWeather(homeAbbr, iso).catch(() => null)
  const weatherBoost = wx && !wx.dome ? wx.boost : null   // hot air carries (over) → helps a hitter

  // Pitcher context (xBA-against/K%/whiff from Savant, by name) for whoever is throwing for each side.
  const pitcherFor = (abbr) => {
    const p = probs[abbr]; if (!p?.pitcher) return null
    const nn = sav.normName(p.pitcher)
    const x = sav.pitcherX[nn], k = sav.pitcherK[nn]
    const throws = (roster.byFull[norm(p.pitcher)] || roster.byLast[norm(p.pitcher).split(/\s+/).pop()])?.throws || null
    if (!x && !k) return { name: p.pitcher, throws, sparse: true }
    return { name: p.pitcher, throws, xbaAgainst: x?.xbaAgainst ?? null, era: x?.era ?? null, kPct: k?.kPct ?? null, whiffPct: k?.whiffPct ?? null }
  }
  // Platoon: switch hitter (S/B) always favored; opposite hands favored; same hands disadvantaged.
  const platoon = (bats, throws) => {
    if (!bats || !throws) return 0
    if (bats === 'S' || bats === 'B') return 1
    return bats !== throws ? 1 : -1
  }
  const pitchers = {}; for (const a of abbrs) pitchers[a] = pitcherFor(a)

  const verdicts = {}
  await Promise.all(names.map(async (name) => {
    const nn = norm(name)
    const r = roster.byFull[nn] || roster.byLast[nn.split(/\s+/).pop()]
    const form = r?.id ? await hitterForm(r.id) : null
    const bat = sav.batter[nn]
    // opposing pitcher = the side whose abbr is NOT the hitter's team
    const oppAbbr = abbrs.find(a => a !== r?.team) || abbrs.find(a => a !== homeAbbr)
    const pit = pitchers[oppAbbr] || {}

    if (!form && !bat) { verdicts[name] = { score: null, tier: null, note: 'no data' }; return }
    const v = scoreHit({
      hitter: { avgLast5: form?.avgLast5, hitStreak: form?.hitStreak, bbPct: form?.bbPct, hitsLast4: form?.hitsLast4, xba: bat?.xba },
      pitcher: { kPct: pit.kPct, whiffPct: pit.whiffPct, xbaAgainst: pit.xbaAgainst, era: pit.era },
      matchup: { platoonEdge: platoon(r?.bats, pit.throws), xwoba: bat?.xwoba },
      park: { parkFactor, weatherBoost },
    })
    verdicts[name] = { ...v, vs: pit.name || null, team: r?.team || null }
  }))

  const out = {
    ok: true, sport, parkFactor, homeAbbr,
    pitchers: Object.fromEntries(Object.entries(pitchers).map(([a, p]) => [a, p?.name || null])),
    verdicts,
    meta: { savantCounts: sav.counts, matched: Object.values(verdicts).filter(v => v.score != null).length, requested: names.length },
  }
  if (req.query.debug === '1') {
    out.debug = {
      abbrs, rosterSize: Object.keys(roster.byFull).length,
      pitchersFull: pitchers,
      sample: names.slice(0, 3).map(name => {
        const nn = norm(name); const r = roster.byFull[nn] || roster.byLast[nn.split(/\s+/).pop()]
        return { name, nn, foundId: r?.id || null, foundTeam: r?.team || null, oppAbbr: abbrs.find(a => a !== r?.team), satvBatter: !!sav.batter[nn] }
      }),
    }
  }
  return res.status(200).json(out)
}
