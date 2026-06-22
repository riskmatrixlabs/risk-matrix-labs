// Bullpen FATIGUE signal for the MLB O/U model — FREE (MLB Stats API, zero Odds-API credits).
//
// THEORY (owner's #1 requested signal): a bullpen that has been heavily worked over the last couple
// of days is gassed — managers reach for tired/lower-leverage arms, velocity drops, command slips,
// and more runs cross. A heavily-used recent bullpen therefore pushes the game total OVER. A rested
// pen (light recent relief workload, no back-to-back days) is a mild UNDER nudge — fresh high-leverage
// arms are available. This is a *nudge*, not a driver: bullpen ERA, park and weather remain primary,
// so we CAP the delta at ±0.5 runs and use a deadband so near-normal usage returns reason:null.
//
// Sign convention (matches umpire.js / pitcherSkill.js): positive delta = pushes OVER, negative = UNDER.
//
// DATA (all FREE from statsapi.mlb.com, no key — VERIFIED LIVE):
//   1. Recent games — GET /api/v1/schedule?sportId=1&teamId=<id>&startDate=<d-2>&endDate=<d-1>
//      → dates[].games[].gamePk for each completed game in the last ~2 days.
//   2. Per-game relief workload — GET /api/v1/game/<gamePk>/boxscore
//      → teams.{away|home}.pitchers[] (ordered: index 0 = the starter) and, per pitcher,
//        players["ID<pid>"].stats.pitching.inningsPitched ("1.2" = 1 + 2/3 IP) and
//        .gamesStarted (1 = started this game → the starter; 0 = reliever).
//      We sum innings for every pitcher with gamesStarted !== 1 (i.e. exclude the starter) →
//      that game's RELIEVER IP. Summed across the last 2 days = awayRecentRelieverIp etc.
//      A team that used its pen (>0 relief IP) on BOTH of the last two calendar days = back-to-back.
//
// Every failure path (no team id, fetch error, empty schedule, missing fields) degrades to
// { delta: 0, reason: null } — never throws, never spends a paid credit.

import { readScan, writeScan, isFresh, todayStr } from './scanStore.js'

// ESPN abbr → MLB Stats API team id (mirrors api/game-info.js MLB_TEAM_ID — same keying).
const MLB_TEAM_ID = {
  ARI: 109, AZ: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CHW: 145, CWS: 145, CIN: 113,
  CLE: 114, COL: 115, DET: 116, HOU: 117, KC: 118, LAA: 108, LAD: 119, MIA: 146, MIL: 158,
  MIN: 142, NYM: 121, NYY: 147, ATH: 133, OAK: 133, PHI: 143, PIT: 134, SD: 135, SEA: 136,
  SF: 137, STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
}

// ── tuning constants (run ESTIMATES / a hypothesis — the graded record tunes them) ──────────────
//
// Cap: fatigue is a nudge, not a driver → ±0.5 runs across the workload extremes.
export const FATIGUE_CAP = 0.5

// Per-team workload reference points (relief innings over the last ~2 days):
//   • A *normal* two-day relief load is roughly 6 IP (≈3 relief innings/game). That's our neutral
//     anchor → contributes ~0.
//   • A *gassed* pen has thrown a lot of relief lately (e.g. an extra-innings game + a blowout) →
//     well above NORMAL → positive (over).
//   • A *rested* pen threw little relief (long starts / off-day) → below NORMAL → negative (under).
const NORMAL_RELIEF_IP_2D = 6.0   // expected reliever IP per team over the trailing 2 days
// Runs per reliever-IP above/below normal, PER TEAM. ~2 IP of extra workload over normal ≈ +0.18
// runs from that pen; both pens gassed ≈ +0.36 before the back-to-back add-on. Gentle by design.
const K_IP = 0.045
// Back-to-back bonus: a pen used on BOTH of the last two days is a documented fatigue flag beyond raw
// IP (no rest day). Flat per-team over add-on.
const K_BACK_TO_BACK = 0.12

// Deadband — inside this run window we call it neutral and return reason:null (avoid noise).
const DEAD = 0.10

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// "1.2" innings notation → real innings (1 + 2/3). MLB reports outs as the decimal: .1 = 1 out, .2 = 2.
export function ipToInnings(ip) {
  const n = parseFloat(ip)
  if (!Number.isFinite(n)) return 0
  const whole = Math.trunc(n)
  const outs = Math.round((n - whole) * 10) // .1 or .2
  if (outs === 1) return whole + 1 / 3
  if (outs === 2) return whole + 2 / 3
  return whole
}

// ── PURE delta function — unit-tested, no I/O ───────────────────────────────────────────────────
// Inputs (all per-team, optional):
//   awayRecentRelieverIp / homeRecentRelieverIp — reliever innings summed over the trailing ~2 days.
//   awayPenBackToBack    / homePenBackToBack    — true if the pen pitched relief on BOTH of those days.
// Returns { delta (runs, signed, capped ±FATIGUE_CAP), reason }.
//   Heavily-worked / back-to-back pens  → POSITIVE (over). Rested pens → NEGATIVE (under).
//   Missing IP for a side → that side sits out (additive; never invents a signal).
//   Near-normal usage (inside the deadband) → { delta: 0, reason: null }.
export function bullpenFatigueDelta({
  awayRecentRelieverIp,
  homeRecentRelieverIp,
  awayPenBackToBack,
  homePenBackToBack,
} = {}) {
  const num = (v) => (Number.isFinite(v) ? v : null)
  const aIp = num(awayRecentRelieverIp)
  const hIp = num(homeRecentRelieverIp)
  const haveAny = aIp != null || hIp != null
  if (!haveAny) return { delta: 0, reason: null }

  let delta = 0
  let gassed = false   // at least one pen clearly over normal
  // VOLUME signal only: reliever IP above/below normal over the trailing 2 days, per side that has
  // data. Positive (above normal) → tired pen → over; negative (rested) → under. NOTE: a team-level
  // "back-to-back" flag was removed (S65) — every bullpen pitches on consecutive game days, so it fired
  // on ~80% of games and re-introduced an over-bias. Real fatigue is workload VOLUME, captured here.
  if (aIp != null) { delta += (aIp - NORMAL_RELIEF_IP_2D) * K_IP; if (aIp - NORMAL_RELIEF_IP_2D > 1) gassed = true }
  if (hIp != null) { delta += (hIp - NORMAL_RELIEF_IP_2D) * K_IP; if (hIp - NORMAL_RELIEF_IP_2D > 1) gassed = true }

  delta = clamp(delta, -FATIGUE_CAP, FATIGUE_CAP)
  delta = Number(delta.toFixed(3))

  if (Math.abs(delta) < DEAD) return { delta: 0, reason: null }

  const reason = delta > 0
    ? (gassed ? 'gassed bullpen (over)' : 'tired bullpen (over)')
    : 'rested bullpen (under)'
  return { delta, reason }
}

// Internal fetch — same hardening as game-info.js / umpire.js (timeout + try/catch, null on failure).
async function getJson(url, ms = 7000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'risk-matrix-labs/1.0' } }); return r.ok ? await r.json() : null }
  catch { return null }
  finally { clearTimeout(timer) }
}

// YYYY-MM-DD for `nowMs` minus `daysAgo` days (UTC). Used to build the trailing schedule window.
function dayOffset(daysAgo, nowMs = Date.now()) {
  return new Date(nowMs - daysAgo * 86400e3).toISOString().slice(0, 10)
}

// For one MLB team id, pull the last `lookbackDays` of completed games and sum reliever IP, plus a
// per-day flag for back-to-back detection. Returns { relieverIp, backToBack } or null on failure.
async function teamRelieverLoad(teamId, { lookbackDays = 2, nowMs = Date.now() } = {}) {
  const start = dayOffset(lookbackDays, nowMs)
  const end = dayOffset(1, nowMs) // through yesterday — today's game hasn't generated a final box yet
  const sched = await getJson(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${start}&endDate=${end}`
  )
  const dates = Array.isArray(sched?.dates) ? sched.dates : []
  if (!dates.length) return { relieverIp: 0, backToBack: false }

  let relieverIp = 0
  const daysWithRelief = new Set()
  for (const dt of dates) {
    const games = Array.isArray(dt?.games) ? dt.games : []
    for (const g of games) {
      const state = g?.status?.abstractGameState
      if (state && state !== 'Final') continue // only completed games have a usable box
      const gamePk = g?.gamePk
      if (!gamePk) continue
      const box = await getJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`)
      // Find which side is our team (away or home) in this box.
      const sides = ['away', 'home']
      let dayIp = 0
      for (const side of sides) {
        const t = box?.teams?.[side]
        if (Number(t?.team?.id) !== Number(teamId)) continue
        const order = Array.isArray(t?.pitchers) ? t.pitchers : []
        for (const pid of order) {
          const p = t?.players?.[`ID${pid}`]
          const st = p?.stats?.pitching
          if (!st) continue
          if (Number(st.gamesStarted) === 1) continue // exclude the starter
          dayIp += ipToInnings(st.inningsPitched)
        }
      }
      relieverIp += dayIp
      if (dayIp > 0) daysWithRelief.add(dt?.date || gamePk)
    }
  }
  return { relieverIp, backToBack: daysWithRelief.size >= 2 }
}

// LOADER — given the two ESPN team abbreviations, compute the bullpen-fatigue delta for the matchup.
// FREE (statsapi.mlb.com). Cached ~8h in scan_cache (`PENFAT-<away>-<home>`): recent workload is fixed
// once yesterday's games are final, so re-opening a game costs zero network. Degrades to
// { delta: 0, reason: null } on any failure (unknown abbr, fetch error, empty schedule, missing fields).
export async function loadBullpenFatigue(awayAbbr, homeAbbr, { ttlMs = 8 * 3600e3, nowMs = Date.now() } = {}) {
  const none = (extra = {}) => ({ delta: 0, reason: null, ...extra })
  try {
    const awayId = MLB_TEAM_ID[String(awayAbbr || '').toUpperCase()]
    const homeId = MLB_TEAM_ID[String(homeAbbr || '').toUpperCase()]
    if (!awayId && !homeId) return none()

    const date = todayStr(nowMs)
    const key = `PENFAT-${String(awayAbbr || '').toUpperCase()}-${String(homeAbbr || '').toUpperCase()}`
    const cached = await readScan(key, date)
    if (cached?.payload && isFresh(cached.scanned_at, nowMs, ttlMs)) {
      return cached.payload
    }

    const [away, home] = await Promise.all([
      awayId ? teamRelieverLoad(awayId, { nowMs }).catch(() => null) : Promise.resolve(null),
      homeId ? teamRelieverLoad(homeId, { nowMs }).catch(() => null) : Promise.resolve(null),
    ])
    if (!away && !home) return none()

    const res = bullpenFatigueDelta({
      awayRecentRelieverIp: away ? away.relieverIp : null,
      homeRecentRelieverIp: home ? home.relieverIp : null,
      awayPenBackToBack: away ? away.backToBack : false,
      homePenBackToBack: home ? home.backToBack : false,
    })
    const payload = {
      ...res,
      awayRelieverIp: away ? Number(away.relieverIp.toFixed(2)) : null,
      homeRelieverIp: home ? Number(home.relieverIp.toFixed(2)) : null,
    }
    // Cache even a neutral result (avoids re-fetching multiple boxscores for the TTL).
    await writeScan(key, date, payload)
    return payload
  } catch {
    return none()
  }
}

export { MLB_TEAM_ID }
