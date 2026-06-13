// Lightweight live sync — refreshes ONLY in-progress games, frequently.
// Heavy full slate (rosters, standings, pre-game, finals) stays in cron-sync-events.js (every 30 min).
// This file only touches the live-changing fields (score, situation, linescore, play-by-play,
// box score) for games that are currently IP, and MERGES them into the existing row's metadata
// so nothing static (logos, pitchers, last5, standings) is ever lost.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import webpush from 'web-push'

export const config = { maxDuration: 30 }

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:hello@riskmatrixlabs.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// When a watched game's score goes up, push "TEAM scored — A x, H y" to everyone opted in.
async function notifyScoreChanges(supabase, changes) {
  if (!changes.length) return 0
  const ids = changes.map(c => c.external_event_id)
  const { data: subs } = await supabase
    .from('game_notifications')
    .select('user_id, external_event_id')
    .in('external_event_id', ids)
  if (!subs?.length) return 0

  const userIds = [...new Set(subs.map(s => s.user_id))]
  const { data: pushes } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', userIds)
  const pushByUser = Object.fromEntries((pushes ?? []).map(p => [p.user_id, p.subscription]))
  const changeById = Object.fromEntries(changes.map(c => [c.external_event_id, c]))

  let sent = 0
  for (const sub of subs) {
    const c = changeById[sub.external_event_id]
    const subscription = pushByUser[sub.user_id]
    if (!c || !subscription) continue
    const payload = JSON.stringify({
      title: `${c.scorerAbbr} scored ⚾`,
      body: `${c.awayAbbr} ${c.awayScore} – ${c.homeAbbr} ${c.homeScore}`,
      url: 'https://app.riskmatrixlabs.com',
    })
    try {
      await webpush.sendNotification(subscription, payload)
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }
  return sent
}

export const SPORTS = [
  { key: 'MLB',  sport: 'baseball',   league: 'mlb'  },
  { key: 'NBA',  sport: 'basketball', league: 'nba'  },
  { key: 'NHL',  sport: 'hockey',     league: 'nhl'  },
  { key: 'NFL',  sport: 'football',   league: 'nfl'  },
  { key: 'WNBA', sport: 'basketball', league: 'wnba' },
]

export function etDateStr(offsetDays = 0) {
  const now = new Date()
  const etMs = now.getTime() + (-4 * 60) * 60 * 1000 + offsetDays * 86400000
  return new Date(etMs).toISOString().slice(0, 10).replace(/-/g, '')
}

function inGameWindow() {
  const h = new Date().getUTCHours()
  return h >= 13 || h < 4
}

export function mapStatus(statusName, statusDetail) {
  if (statusName?.startsWith('STATUS_FINAL')) {
    return statusDetail?.toLowerCase().includes('ot') || statusDetail?.toLowerCase().includes('so') ? 'AOT' : 'FT'
  }
  if (statusName === 'STATUS_IN_PROGRESS') return 'IP'
  if (statusDetail?.toLowerCase().includes('postponed')) return 'PPD'
  return 'NS'
}

// Sport-specific team-stats comparison (Apple Sports style), parsed from
// s.boxscore.teams. MLB stats live under batting/fielding groups; NHL/NBA are flat.
export function parseTeamStats(s, away, home, key) {
  const teams = s.boxscore?.teams ?? []
  if (teams.length < 2) return { away: null, home: null }
  const num = (v) => { const n = parseFloat(String(v ?? '').replace('%', '')); return isNaN(n) ? null : n }
  const byId = (id) => teams.find(t => String(t.team?.id) === String(id))
  const aT = byId(away.team?.id) ?? teams[0]
  const hT = byId(home.team?.id) ?? teams[1]

  const extract = (t) => {
    if (!t) return null
    if (key === 'MLB') {
      const bat = (t.statistics ?? []).find(x => x.name === 'batting')?.stats ?? []
      const fld = (t.statistics ?? []).find(x => x.name === 'fielding')?.stats ?? []
      const g = (arr, n) => { const it = arr.find(x => x.name === n); return it ? num(it.displayValue) : null }
      return {
        hits: g(bat, 'hits'), homeRuns: g(bat, 'homeRuns'), strikeouts: g(bat, 'strikeouts'), walks: g(bat, 'walks'),
        extraBaseHits: g(bat, 'extraBaseHits'), totalBases: g(bat, 'totalBases'), lob: g(bat, 'runnersLeftOnBase'),
        stolenBases: g(bat, 'stolenBases'), doublePlays: g(bat, 'GIDPs'), errors: g(fld, 'errors'),
      }
    }
    const st = t.statistics ?? []
    const g = (n) => { const it = st.find(x => x.name === n); return it ? num(it.displayValue) : null }
    if (key === 'NHL') {
      return {
        sog: g('shotsTotal'), hits: g('hits'), faceoffPct: g('faceoffPercent'),
        ppOpp: g('powerPlayOpportunities'), ppGoals: g('powerPlayGoals'), shGoals: g('shortHandedGoals'),
        penalties: g('penalties'), pim: g('penaltyMinutes'),
      }
    }
    // NBA / WNBA
    return {
      fgPct: g('fieldGoalPct'), ftPct: g('freeThrowPct'), tpPct: g('threePointFieldGoalPct'),
      assists: g('assists'), rebounds: g('totalRebounds'), defReb: g('defensiveRebounds'), offReb: g('offensiveRebounds'),
      steals: g('steals'), blocks: g('blocks'), fouls: g('fouls'), turnovers: g('totalTurnovers'),
      pointsOffTO: g('turnoverPoints'), pointsInPaint: g('pointsInPaint'), largestLead: g('largestLead'),
    }
  }
  return { away: extract(aT), home: extract(hT) }
}

// NHL skater box score (forwards + defensemen). ESPN splits skaters into separate
// 'forwards' and 'defenses' groups (an empty 'skaters' group + a 'goalies' group also
// exist). Column headers live in each group's `labels` array — there is NO `names`
// field. PTS is not a column, so it's derived as G + A. Shared by the live + heavy syncs.
export function parseNHLSkaters(playerGroup) {
  if (!playerGroup) return []
  const groups = (playerGroup.statistics ?? []).filter(g => g.name === 'forwards' || g.name === 'defenses')
  const rows = []
  for (const grp of groups) {
    const labels = grp.labels ?? []
    const idx = (n) => labels.findIndex(x => x.toUpperCase() === n.toUpperCase())
    for (const a of grp.athletes ?? []) {
      if (!a.athlete || !a.stats?.length) continue
      const g = parseInt(a.stats[idx('G')]) || 0
      const as = parseInt(a.stats[idx('A')]) || 0
      rows.push({
        name: a.athlete.shortName ?? a.athlete.displayName,
        pos:  a.athlete.position?.abbreviation ?? null,
        g, a: as, pts: g + as,
        pm:   a.stats[idx('+/-')] ?? null,
        pim:  parseInt(a.stats[idx('PIM')]) || 0,
        sog:  parseInt(a.stats[idx('SOG')] ?? a.stats[idx('S')]) || 0,
        hits: parseInt(a.stats[idx('HT')]) || 0,
      })
    }
  }
  return rows
}

// NHL goalie line from the box score `goalies` group (labels: GA, SA, SV, SV%, TOI…).
// Picks the goalie with the most ice time (the starter; a pulled/relief goalie has less).
export function parseNHLGoalie(playerGroup) {
  if (!playerGroup) return null
  const grp = (playerGroup.statistics ?? []).find(g => g.name === 'goalies')
  const labels = grp?.labels ?? []
  const idx = (n) => labels.findIndex(x => x.toUpperCase() === n.toUpperCase())
  const toiSec = (v) => { const m = String(v ?? '').match(/(\d+):(\d+)/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0 }
  const athletes = (grp?.athletes ?? []).filter(a => a.athlete && a.stats?.length)
  if (!athletes.length) return null
  const a = athletes.reduce((best, cur) => toiSec(cur.stats[idx('TOI')]) > toiSec(best.stats[idx('TOI')]) ? cur : best)
  return {
    name:    a.athlete.shortName ?? a.athlete.displayName,
    saves:   a.stats[idx('SV')]  ?? null,
    shots:   a.stats[idx('SA')]  ?? null,
    ga:      a.stats[idx('GA')]  ?? null,
    savePct: a.stats[idx('SV%')] ?? null,
    toi:     a.stats[idx('TOI')] ?? null,
  }
}

// Match a boxscore.players entry to a competitor team (falls back by slot index).
function nhlTeamGroup(s, team, slot) {
  return s.boxscore?.players?.find(p => String(p.team?.id) === String(team.team?.id)) ?? s.boxscore?.players?.[slot]
}

// Period/quarter scoring grid (Apple-Sports style) for NHL/NBA/WNBA/NFL.
// MLB keeps its own inning linescore. Built from the scoreboard competitors'
// `linescores` arrays. Pads to regulation length so unplayed periods show '-'.
export function parsePeriodLinescore(away, home, key) {
  const aLines = away.linescores ?? []
  const hLines = home.linescores ?? []
  if (!aLines.length && !hLines.length) return null
  const regP = key === 'NHL' ? 3 : 4
  const maxP = Math.max(aLines.length, hLines.length, regP)
  const cols = []
  for (let i = 1; i <= maxP; i++) {
    cols.push(i <= regP ? String(i) : (i === regP + 1 ? 'OT' : `${i - regP}OT`))
  }
  const row = (lines) => cols.map((_, i) => {
    const ls = lines[i]
    return ls ? String(ls.displayValue ?? ls.value ?? '-') : '-'
  })
  const tot = (score) => score != null && score !== '' ? parseInt(score) : null
  return {
    cols,
    away: { periods: row(aLines), total: tot(away.score) },
    home: { periods: row(hLines), total: tot(home.score) },
  }
}

// Standings groups (divisions/conferences) — all sports. Shared by live + heavy syncs.
export function parseStandings(s) {
  if (!s.standings?.groups?.length) return null
  return s.standings.groups.map(g => ({
    name: g.header ?? g.name ?? '',
    entries: (g.standings?.entries ?? []).map(e => ({
      team: e.team,
      stats: (e.stats ?? [])
        .filter(x => ['wins', 'losses', 'otLosses', 'points', 'gamesBehind', 'winPercent'].includes(x.name))
        .reduce((acc, x) => ({ ...acc, [x.name]: x.displayValue }), {}),
    })),
  }))
}

// NBA / WNBA player box score for one team group. Column headers are in `names`
// (basketball populates it, unlike hockey which only has `labels`).
export function parseHoopsPlayers(playerGroup) {
  if (!playerGroup) return []
  const names = playerGroup.statistics?.[0]?.names ?? []
  const idx = (n) => names.findIndex(x => x.toUpperCase() === n.toUpperCase())
  return (playerGroup.statistics?.[0]?.athletes ?? [])
    .filter(a => a.athlete && a.stats?.length)
    .map(a => ({
      name: a.athlete.shortName ?? a.athlete.displayName,
      pos:  a.athlete.position?.abbreviation ?? null,
      starter: a.starter ?? false,
      oncourt: a.active ?? false,   // ESPN flags the 5 players currently on the floor as `active`
      min:  a.stats[idx('MIN')] ?? null,
      pts:  parseInt(a.stats[idx('PTS')]) || 0,
      reb:  parseInt(a.stats[idx('REB')]) || 0,
      ast:  parseInt(a.stats[idx('AST')]) || 0,
      stl:  parseInt(a.stats[idx('STL')]) || 0,
      blk:  parseInt(a.stats[idx('BLK')]) || 0,
      fg:   a.stats[idx('FG')] ?? null,
      tp:   a.stats[idx('3PT')] ?? null,
      ft:   a.stats[idx('FT')] ?? null,
      to:   parseInt(a.stats[idx('TO')]) || 0,
    }))
}

// Non-MLB play feed: the last 20 plays PLUS every scoring play in the game (so goals
// and key scores never scroll off the window), merged in chronological order, newest first.
export function parseSimplePlays(s) {
  const all = s.plays ?? []
  if (!all.length) return []
  const seq = (p) => Number(p.sequenceNumber ?? p.id ?? 0)
  const recent = all.slice(-20)
  const inRecent = new Set(recent.map(p => p.id ?? p.sequenceNumber))
  const scoring = all.filter(p => p.scoringPlay && !inRecent.has(p.id ?? p.sequenceNumber))
  return [...scoring, ...recent]
    .sort((a, b) => seq(a) - seq(b))
    .map(p => ({
      text: p.text ?? p.type?.text ?? null, scoring: p.scoringPlay ?? false, period: p.period?.number ?? null,
      clock: p.clock?.displayValue ?? null, awayScore: p.awayScore ?? p.score?.away ?? null, homeScore: p.homeScore ?? p.score?.home ?? null,
    }))
    .reverse()
}

// NHL goal-scorer summary (Apple-Sports puck list), derived from scoring plays.
// Each goal: scorer, period label, and power-play flag (PPG). Split by team.
export function parseNHLGoals(s, away, home) {
  const plays = (s.plays ?? []).filter(p => p.scoringPlay && /goal/i.test(p.type?.text ?? p.text ?? ''))
  if (!plays.length) return null
  const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : (n === 4 ? 'OT' : `${n - 3}OT`)
  const awayId = String(away.team?.id ?? '')
  const out = { away: [], home: [] }
  for (const p of plays) {
    const teamId = String(p.team?.id ?? p.team ?? '')
    const scorer = (p.participants ?? []).find(x => x.athlete)?.athlete?.shortName
      ?? (p.participants ?? [])[0]?.athlete?.shortName ?? null
    const goal = { scorer, period: ord(p.period?.number ?? 0), ppg: /power.?play/i.test(p.strength?.text ?? '') }
    ;(teamId === awayId ? out.away : out.home).push(goal)
  }
  return (out.away.length || out.home.length) ? out : null
}

// Event subtitle from the scoreboard competition notes
// ("Stanley Cup Final - Game 5", "WNBA Commissioner's Cup", etc.).
// Flatten an events row's current odds into append-only odds_history snapshot rows.
// captured_at is passed in (caller stamps it once per run).
export function buildOddsSnapshots(rows, capturedAt) {
  const out = []
  for (const r of rows) {
    const base = { external_event_id: r.external_event_id, provider: 'espn', sport: r.sport, captured_at: capturedAt }
    const push = (market, side, value) => {
      if (value === null || value === undefined) return
      out.push({ ...base, market, side, value })
    }
    push('ml', 'home', r.odds_ml_home)
    push('ml', 'away', r.odds_ml_away)
    push('spread', 'home', r.odds_spread_home)
    push('spread', 'away', r.odds_spread_away)
    push('total', null, r.odds_total)
    // Also snapshot the JUICE (price) on the spread/total lines — the line value
    // (-1.5, 8.5) barely moves, but its price does. This is what powers CLV + real
    // movement % on Run Line / Total (ML already stores its price above).
    const m = r.metadata || {}
    push('spread_juice', 'home', m.spread_home_juice)
    push('spread_juice', 'away', m.spread_away_juice)
    push('total_juice', 'over',  m.over_juice)
    push('total_juice', 'under', m.under_juice)
  }
  return out
}

// Team trends — record splits (overall/home/road) + streak + win% + recent form.
// All derived from data already fetched (scoreboard competitor `records`, summary
// standings, and in-game `lastFiveGames`). No extra network calls.
export function parseTrends(away, home, s) {
  const standingEntry = (teamId) => {
    const groups = s?.standings?.groups ?? (s?.standings ? [s.standings] : [])
    for (const g of groups) {
      const entries = g.standings?.entries ?? g.entries ?? []
      const e = entries.find(x => String(x.team?.id) === String(teamId))
      if (e) return e
    }
    return null
  }
  const formFor = (teamId) => {
    const t = (s?.lastFiveGames ?? []).find(x => String(x.team?.id) === String(teamId))
    const evs = (t?.events ?? []).map(e => e.gameResult).filter(Boolean)
    return evs.length ? evs : null
  }
  const build = (comp) => {
    const recs = comp?.records ?? []
    const rec = (type) => recs.find(r => r.type === type)?.summary ?? null
    const st = standingEntry(comp?.team?.id)
    const stat = (n) => (st?.stats ?? []).find(x => x.name === n)?.displayValue ?? null
    const out = { overall: rec('total'), home: rec('home'), road: rec('road'), streak: stat('streak'), winPct: stat('winPercent') }
    const form = formFor(comp?.team?.id)
    if (form) { out.form = form; out.l5wins = form.filter(r => r === 'W').length; out.l5total = form.length }
    return out
  }
  const t = { away: build(away), home: build(home) }
  const useful = (x) => x && (x.overall || x.home || x.road || x.streak || x.form)
  return (useful(t.away) || useful(t.home)) ? t : null
}

export function eventNote(comp) {
  const n = comp.notes?.find(x => x.type === 'event') ?? comp.notes?.[0]
  return n?.headline ?? null
}

// Injuries per team from the ESPN summary `s.injuries` (already fetched — no extra call).
export function parseInjuries(s, away, home) {
  const list = s?.injuries ?? []
  if (!list.length) return null
  const forTeam = (teamId) => {
    const t = list.find(x => String(x.team?.id) === String(teamId))
    return (t?.injuries ?? []).map(i => ({
      name: i.athlete?.displayName ?? null,
      pos: i.athlete?.position?.abbreviation ?? null,
      status: i.status ?? null,
      detail: [i.details?.type, i.details?.detail].filter(Boolean).join(' ') || i.shortComment || null,
    })).filter(x => x.name)
  }
  const a = forTeam(away?.team?.id)
  const h = forTeam(home?.team?.id)
  return (a.length || h.length) ? { away: a, home: h } : null
}

// Head-to-head — this season's completed meetings + each score, tallied for THIS matchup.
// From the ESPN summary `seasonseries` (already fetched — no extra call). Works pregame.
export function parseSeasonSeries(s, awayAbbr, homeAbbr) {
  const ss = s?.seasonseries?.[0]
  if (!ss) return null
  const meetings = (ss.events ?? [])
    .filter(e => e.statusType?.completed)
    .map(e => {
      const comps = e.competitors ?? []
      const aw = comps.find(c => c.homeAway === 'away') ?? {}
      const hm = comps.find(c => c.homeAway === 'home') ?? {}
      return {
        date: e.date?.slice(0, 10) ?? null,
        away: { abbr: aw.team?.abbreviation ?? null, score: aw.score != null ? Number(aw.score) : null, win: !!aw.winner },
        home: { abbr: hm.team?.abbreviation ?? null, score: hm.score != null ? Number(hm.score) : null, win: !!hm.winner },
      }
    })
  let awayWins = 0, homeWins = 0
  for (const m of meetings) {
    const winAbbr = m.away.win ? m.away.abbr : m.home.win ? m.home.abbr : null
    if (winAbbr === awayAbbr) awayWins++
    else if (winAbbr === homeAbbr) homeWins++
  }
  return { awayWins, homeWins, meetings }
}

// Parse the live-changing slice of metadata for one in-progress game's summary.
export function buildLiveMeta(s, comp, away, home, key) {
  const meta = {}

  const _note = eventNote(comp)
  if (_note) meta.event_note = _note

  const _trends = parseTrends(away, home, s)
  if (_trends) meta.trends = _trends

  const _inj = parseInjuries(s, away, home)
  if (_inj) meta.injuries = _inj

  // Sport-specific team stats (Apple Sports style) for the always-visible comparison
  const _ts = parseTeamStats(s, away, home, key)
  if (_ts.away) meta.away_team_stats = _ts.away
  if (_ts.home) meta.home_team_stats = _ts.home

  if (key === 'MLB') {
    // Box score (hitting / pitching) — same shape as the full cron
    if (s.boxscore?.players?.length) {
      const findGroup = (id) => s.boxscore.players.find(p => String(p.team?.id) === String(id))
      const awayGroup = findGroup(away.team?.id) ?? s.boxscore.players[0]
      const homeGroup = findGroup(home.team?.id) ?? s.boxscore.players[1]
      const parseHitting = (g) => {
        if (!g) return []
        const hs = g.statistics?.find(x => x.type === 'batting') ?? g.statistics?.[0]
        if (!hs) return []
        const names = hs.names ?? []
        const idx = (n) => names.findIndex(x => x.toUpperCase() === n.toUpperCase())
        return (hs.athletes ?? []).filter(a => a.athlete).map(a => {
          const v = a.stats ?? []
          return {
            name: a.athlete.shortName ?? a.athlete.displayName, pos: a.position?.abbreviation ?? null,
            ab: parseInt(v[idx('AB')]) || 0, r: parseInt(v[idx('R')]) || 0, h: parseInt(v[idx('H')]) || 0,
            rbi: parseInt(v[idx('RBI')]) || 0, hr: parseInt(v[idx('HR')]) || 0, bb: parseInt(v[idx('BB')]) || 0,
            k: parseInt(v[idx('K')] ?? v[idx('SO')]) || 0, avg: v[idx('AVG')] ?? v[idx('BA')] ?? null,
          }
        })
      }
      const parsePitching = (g) => {
        if (!g) return []
        const ps = g.statistics?.find(x => x.type === 'pitching') ?? g.statistics?.[1]
        if (!ps) return []
        const names = ps.names ?? []
        const idx = (n) => names.findIndex(x => x.toUpperCase() === n.toUpperCase())
        return (ps.athletes ?? []).filter(a => a.athlete).map(a => {
          const v = a.stats ?? []
          return {
            name: a.athlete.shortName ?? a.athlete.displayName, ip: v[idx('IP')] ?? null,
            h: parseInt(v[idx('H')]) || 0, r: parseInt(v[idx('R')]) || 0, er: parseInt(v[idx('ER')]) || 0,
            hr: parseInt(v[idx('HR')]) || 0, bb: parseInt(v[idx('BB')]) || 0,
            k: parseInt(v[idx('K')] ?? v[idx('SO')]) || 0, pc_st: v[idx('PC-ST')] ?? null,
          }
        })
      }
      meta.away_hitting = parseHitting(awayGroup)
      meta.home_hitting = parseHitting(homeGroup)
      meta.away_pitching = parsePitching(awayGroup)
      meta.home_pitching = parsePitching(homeGroup)
    }

    // Situation (inning, outs, count, bases)
    if (s.situation) {
      const sit = s.situation
      const hStatus = s.header?.competitions?.[0]?.status
      const detail = hStatus?.type?.detail ?? s.linescore?.currentInningHalf ?? ''
      meta.situation = {
        inning: hStatus?.period ?? s.linescore?.currentInning ?? null,
        inningHalf: detail.toLowerCase().includes('bot') ? 'Bottom' : detail.toLowerCase().includes('top') ? 'Top' : null,
        outs: sit.outs ?? null, balls: sit.balls ?? null, strikes: sit.strikes ?? null,
        onFirst: sit.onFirst ? true : false, onSecond: sit.onSecond ? true : false, onThird: sit.onThird ? true : false,
        batter: sit.batter?.athlete?.shortName ?? sit.batter?.athlete?.displayName ?? null,
        pitcher: sit.pitcher?.athlete?.shortName ?? sit.pitcher?.athlete?.displayName ?? null,
      }
    }

    // Linescore (runs per inning + R/H)
    const toInnings = (arr) => (arr ?? []).map(v => v.displayValue != null ? String(v.displayValue) : (v.value != null ? String(v.value) : '-'))
    if (away.linescores?.length || home.linescores?.length) {
      const sumTeams = s.linescore?.teams ?? []
      const sumAway = sumTeams.find(l => String(l.team?.id) === String(away.team?.id)) ?? sumTeams[0]
      const sumHome = sumTeams.find(l => String(l.team?.id) === String(home.team?.id)) ?? sumTeams[1]
      meta.linescore = {
        away: { innings: toInnings(away.linescores), r: parseInt(away.score) || null, h: sumAway?.hits ?? meta.away_team_stats?.hits ?? null, e: sumAway?.errors ?? null },
        home: { innings: toInnings(home.linescores), r: parseInt(home.score) || null, h: sumHome?.hits ?? meta.home_team_stats?.hits ?? null, e: sumHome?.errors ?? null },
        currentInning: comp.status?.period ?? s.linescore?.currentInning ?? null,
      }
    }
  } else {
    // NHL / NBA / WNBA / NFL — period + clock
    const st = comp.status
    if (st?.period != null) meta.situation = { period: st.period, clock: st.displayClock ?? st.type?.shortDetail ?? null }

    // NHL skaters + goalies, so the box score refreshes every live tick (not just the 30-min sync)
    if (key === 'NHL' && s.boxscore?.players?.length) {
      meta.away_skaters = parseNHLSkaters(nhlTeamGroup(s, away, 0))
      meta.home_skaters = parseNHLSkaters(nhlTeamGroup(s, home, 1))
      const ag = parseNHLGoalie(nhlTeamGroup(s, away, 0))
      const hg = parseNHLGoalie(nhlTeamGroup(s, home, 1))
      if (ag) meta.away_goalie = ag
      if (hg) meta.home_goalie = hg
      const _goals = parseNHLGoals(s, away, home)
      if (_goals) meta.goals = _goals
    }

    // NBA / WNBA player box score, live every tick
    if ((key === 'NBA' || key === 'WNBA') && s.boxscore?.players?.length) {
      meta.away_players = parseHoopsPlayers(nhlTeamGroup(s, away, 0))
      meta.home_players = parseHoopsPlayers(nhlTeamGroup(s, home, 1))
    }
  }

  // Period/quarter linescore — non-MLB (MLB builds its own inning linescore above)
  if (key !== 'MLB') {
    const _ls = parsePeriodLinescore(away, home, key)
    if (_ls) meta.linescore = _ls
  }

  // Standings — all sports, so live games show them without waiting on the heavy sync
  const _st = parseStandings(s)
  if (_st) meta.standings = _st

  // Play-by-play (rich for MLB, simple otherwise) — same shape as the full cron
  if (s.plays?.length) {
    if (key === 'MLB') {
      meta.plays = s.plays.slice(-60).map(p => {
        const parts = p.participants ?? []
        const batter = parts.find(x => x.type === 'batter' || x.role?.toLowerCase() === 'batter')
        const pitcher = parts.find(x => x.type === 'pitcher' || x.role?.toLowerCase() === 'pitcher')
        return {
          text: p.text ?? p.type?.text ?? null, playType: p.type?.text ?? null, scoring: p.scoringPlay ?? false,
          period: p.period?.number ?? null, atBatId: p.atBatId ?? null,
          batter: batter?.athlete?.shortName ?? batter?.athlete?.displayName ?? null,
          pitcher: pitcher?.athlete?.shortName ?? pitcher?.athlete?.displayName ?? null,
          teamAbbr: p.team?.abbreviation ?? null, pitchType: p.pitchType?.text ?? null,
          pitchVelocity: p.pitchVelocity != null ? Math.round(p.pitchVelocity) : null,
          balls: p.balls ?? null, strikes: p.strikes ?? null, outs: p.outs ?? null,
          awayScore: p.awayScore ?? p.score?.away ?? null, homeScore: p.homeScore ?? p.score?.home ?? null,
        }
      }).reverse()
    } else {
      meta.plays = parseSimplePlays(s)
    }
  }

  return meta
}

// Find in-progress games for a sport (today) and build their live update.
async function fetchLiveForSport({ key, sport, league }) {
  let sb
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${etDateStr(0)}`)
    if (!res.ok) return []
    sb = await res.json()
  } catch (e) {
    console.warn(`live scoreboard failed for ${key}: ${e.message}`)
    return []
  }

  const updates = []
  for (const ev of sb?.events ?? []) {
    const comp = ev.competitions?.[0]
    if (!comp) continue
    const status = mapStatus(comp.status?.type?.name, comp.status?.type?.detail)
    if (status !== 'IP') continue // ONLY live games — this is what keeps it lightweight

    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    if (!home || !away) continue

    try {
      const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${ev.id}`)
      if (!sumRes.ok) { console.warn(`live summary not ok ${ev.id}: ${sumRes.status}`); continue }
      const s = await sumRes.json()
      updates.push({
        external_event_id: String(ev.id),
        sport: key,
        league: key,
        start_time: ev.date,
        home_team: home.team?.displayName ?? '',
        away_team: away.team?.displayName ?? '',
        status,
        home_score: home.score != null && home.score !== '' ? parseInt(home.score) : null,
        away_score: away.score != null && away.score !== '' ? parseInt(away.score) : null,
        liveMeta: buildLiveMeta(s, comp, away, home, key),
      })
    } catch (e) {
      console.warn(`live summary failed ${ev.id}: ${e.message}`)
    }
  }
  return updates
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }
  const isManual = req.method === 'POST'
  if (!isManual && !inGameWindow()) {
    return res.status(200).json({ skipped: true, reason: 'outside game window' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  // Gather live updates across all sports (today only)
  const updates = []
  for (const sport of SPORTS) updates.push(...await fetchLiveForSport(sport))

  if (updates.length === 0) {
    return res.status(200).json({ live: 0, reason: 'no in-progress games' })
  }

  // Merge live fields INTO existing metadata so static data (logos, pitchers, last5, standings) is preserved
  const ids = updates.map(u => u.external_event_id)
  const { data: existing } = await supabase
    .from('events')
    .select('external_event_id, metadata, home_score, away_score, home_abbr, away_abbr')
    .in('external_event_id', ids)
  const existingMap = Object.fromEntries((existing ?? []).map(r => [r.external_event_id, r.metadata ?? {}]))
  const prevById = Object.fromEntries((existing ?? []).map(r => [r.external_event_id, r]))

  // Detect score increases vs the last sync → who to notify (which team just scored).
  const scoreChanges = []
  for (const u of updates) {
    const prev = prevById[u.external_event_id]
    if (!prev) continue
    const oldA = prev.away_score ?? 0, oldH = prev.home_score ?? 0
    const newA = u.away_score ?? 0, newH = u.home_score ?? 0
    if (newA + newH > oldA + oldH) {
      const scorerAbbr = newA > oldA ? prev.away_abbr : prev.home_abbr
      scoreChanges.push({ external_event_id: u.external_event_id, scorerAbbr: scorerAbbr ?? 'A team', awayAbbr: prev.away_abbr ?? 'Away', homeAbbr: prev.home_abbr ?? 'Home', awayScore: newA, homeScore: newH })
    }
  }

  const rows = updates.map(u => ({
    external_event_id: u.external_event_id,
    provider: 'espn',
    sport: u.sport,
    league: u.league,
    start_time: u.start_time,
    home_team: u.home_team,
    away_team: u.away_team,
    status: u.status,
    home_score: u.home_score,
    away_score: u.away_score,
    metadata: { ...(existingMap[u.external_event_id] ?? {}), ...u.liveMeta },
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'external_event_id,provider' })

  if (error) {
    console.error('cron-sync-live upsert error:', error)
    return res.status(500).json({ error: error.message })
  }

  // Fire score notifications AFTER the new scores are persisted (so a 2nd run won't re-fire).
  let notified = 0
  try { notified = await notifyScoreChanges(supabase, scoreChanges) } catch (e) { console.warn('notify error:', e.message) }

  return res.status(200).json({ live: rows.length, games: rows.map(r => r.external_event_id), scoreChanges: scoreChanges.length, notified })
}
