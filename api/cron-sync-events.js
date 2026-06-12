import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { parseTeamStats, parseNHLSkaters, parseNHLGoalie, parseStandings, parseHoopsPlayers, parsePeriodLinescore, eventNote, parseNHLGoals, parseSimplePlays, buildOddsSnapshots } from './cron-sync-live.js'

// Allow this serverless function up to 60s — a full slate (3 dates × 5 sports,
// each with a per-game summary fetch) needs more than the 10s default.
export const config = { maxDuration: 60 }

const SPORTS = [
  { key: 'MLB',  sport: 'baseball',   league: 'mlb'  },
  { key: 'NBA',  sport: 'basketball', league: 'nba'  },
  { key: 'NHL',  sport: 'hockey',     league: 'nhl'  },
  { key: 'NFL',  sport: 'football',   league: 'nfl'  },
  { key: 'WNBA', sport: 'basketball', league: 'wnba' },
]

// Map over items with bounded concurrency (pool of `limit` workers).
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ET date string YYYYMMDD (UTC-4 EDT), offsetDays = -1/0/1
function etDateStr(offsetDays = 0) {
  const now = new Date()
  const etMs = now.getTime() + (-4 * 60) * 60 * 1000 + offsetDays * 86400000
  return new Date(etMs).toISOString().slice(0, 10).replace(/-/g, '')
}

// Run 9am–midnight ET (13:00–04:00 UTC) to cover early day games
function inGameWindow() {
  const h = new Date().getUTCHours()
  return h >= 13 || h < 4
}

function mapStatus(statusName, statusDetail) {
  if (statusName?.startsWith('STATUS_FINAL')) {
    return statusDetail?.toLowerCase().includes('ot') || statusDetail?.toLowerCase().includes('so')
      ? 'AOT' : 'FT'
  }
  if (statusName === 'STATUS_IN_PROGRESS') return 'IP'
  if (statusDetail?.toLowerCase().includes('postponed')) return 'PPD'
  return 'NS'
}

function parseAmerican(val) {
  const n = parseFloat(val)
  return isNaN(n) ? null : Math.round(n)
}

function parseDecimal(val) {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

async function fetchSport({ key, sport, league }, dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${dateStr}`
  let json
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const processEvent = async (ev) => {
    const comp = ev.competitions?.[0]
    if (!comp) return null

    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    if (!home || !away) return null

    const statusName   = comp.status?.type?.name   ?? ''
    const statusDetail = comp.status?.type?.detail ?? ''
    const status       = mapStatus(statusName, statusDetail)
    const isLive       = status === 'IP' || status === 'FT' || status === 'AOT'

    const oddsEntry  = comp.odds?.[0]
    let spreadLine   = oddsEntry?.spread
    let totalLine    = oddsEntry?.overUnder
    let homeMLRaw    = oddsEntry?.homeTeamOdds?.moneyLine
    let awayMLRaw    = oddsEntry?.awayTeamOdds?.moneyLine
    // ML + juice filled in via summary endpoint below

    const homeAbbr = home.team?.abbreviation ?? ''
    const awayAbbr = away.team?.abbreviation ?? ''
    const meta = {
      home_logo: `https://a.espncdn.com/i/teamlogos/${league}/500/${homeAbbr.toLowerCase()}.png`,
      away_logo: `https://a.espncdn.com/i/teamlogos/${league}/500/${awayAbbr.toLowerCase()}.png`,
      venue:     comp.venue?.fullName ?? null,
      venue_city: comp.venue?.address ? `${comp.venue.address.city ?? ''}, ${comp.venue.address.state ?? ''}`.replace(/^, |, $/, '') : null,
      broadcast: comp.broadcasts?.[0]?.names?.[0] ?? comp.broadcasts?.[0]?.market ?? null,
      series_summary: comp.series?.summary ?? comp.seriesSummary ?? null,
      event_note: eventNote(comp),
    }
    // Fetch summary for all sports: ML, juice, venue, broadcast, goalies, last5, standings
    try {
      const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${ev.id}`)
      if (sumRes.ok) {
        const s = await sumRes.json()

        // Team stats comparison (Apple Sports style) — all sports
        const _ts = parseTeamStats(s, away, home, key)
        if (_ts.away) meta.away_team_stats = _ts.away
        if (_ts.home) meta.home_team_stats = _ts.home

        // ML odds + juice + spread/total (pickcenter is the reliable source for live games)
        const pc = s.pickcenter?.[0]
        if (pc) {
          if (pc.awayTeamOdds?.moneyLine != null) {
            homeMLRaw = pc.homeTeamOdds?.moneyLine ?? homeMLRaw
            awayMLRaw = pc.awayTeamOdds?.moneyLine ?? awayMLRaw
          }
          if (pc.spread != null) spreadLine = String(pc.spread)
          if (pc.overUnder != null) totalLine = String(pc.overUnder)
          meta.spread_away_juice = parseAmerican(String(pc.awayTeamOdds?.spreadOdds ?? pc.pointSpread?.away?.close?.odds ?? ''))
          meta.spread_home_juice = parseAmerican(String(pc.homeTeamOdds?.spreadOdds ?? pc.pointSpread?.home?.close?.odds ?? ''))
          meta.over_juice        = parseAmerican(String(pc.overOdds  ?? pc.total?.over?.close?.odds  ?? ''))
          meta.under_juice       = parseAmerican(String(pc.underOdds ?? pc.total?.under?.close?.odds ?? ''))
        }

        // Venue + broadcast from summary (more reliable than scoreboard)
        if (!meta.venue && s.gameInfo?.venue?.fullName) {
          meta.venue = s.gameInfo.venue.fullName
          const addr = s.gameInfo.venue.address
          if (addr) meta.venue_city = `${addr.city ?? ''}, ${addr.state ?? ''}`.replace(/^, |, $/, '')
        }
        if (!meta.broadcast && s.broadcasts?.length) {
          meta.broadcast = s.broadcasts[0]?.names?.[0] ?? s.broadcasts[0]?.market ?? null
        }

        // Series summary (playoffs)
        const playSeries = s.header?.competitions?.[0]?.series?.find(x => x.type === 'playoff')
        if (playSeries?.summary) meta.series_summary = playSeries.summary

        // Last 5 games (all sports)
        if (s.lastFiveGames?.length) {
          const awayId = String(away.team?.id ?? '')
          const homeId = String(home.team?.id ?? '')
          const fmt = (teamEntry) => (teamEntry?.events ?? []).slice(0, 5).map(e => ({
            result: e.gameResult, score: e.score, atVs: e.atVs, date: e.gameDate?.slice(0, 10),
            opponent: e.opponent?.abbreviation ?? e.opponent?.shortDisplayName ?? null,
          }))
          meta.away_last5 = fmt(s.lastFiveGames.find(t => String(t.team?.id) === awayId))
          meta.home_last5 = fmt(s.lastFiveGames.find(t => String(t.team?.id) === homeId))
        }

        // Standings (all sports) — shared parser
        const _standings = parseStandings(s)
        if (_standings) meta.standings = _standings

        // MLB: probable pitchers
        if (key === 'MLB') {
          const comps = s.header?.competitions?.[0]?.competitors ?? []
          const getPitcher = (c) => {
            const p = c?.probables?.[0]; if (!p) return null
            const cats = p.statistics?.splits?.categories ?? []
            const stat = (n) => cats.find(x => x.name === n)?.displayValue ?? null
            return { name: p.athlete?.displayName ?? null, era: stat('ERA'), record: `${stat('wins') ?? 0}-${stat('losses') ?? 0}`, strikeouts: stat('strikeouts'), throws: p.athlete?.throws?.abbreviation ?? null }
          }
          const hp = getPitcher(comps.find(c => c.homeAway === 'home'))
          const ap = getPitcher(comps.find(c => c.homeAway === 'away'))
          if (hp) meta.home_pitcher = hp
          if (ap) meta.away_pitcher = ap

          // MLB box score (live + final) — data is in boxscore.players like NBA/NHL
          if (s.boxscore?.players?.length) {
            const findGroup = (id) => s.boxscore.players.find(p => String(p.team?.id) === String(id))
            const awayGroup = findGroup(away.team?.id) ?? s.boxscore.players[0]
            const homeGroup = findGroup(home.team?.id) ?? s.boxscore.players[1]

            const parseHitting = (group) => {
              if (!group) return []
              const hitStats = group.statistics?.find(s => s.type === 'batting') ?? group.statistics?.[0]
              if (!hitStats) return []
              const names = hitStats.names ?? []
              const idx = (n) => names.findIndex(x => x.toUpperCase() === n.toUpperCase())
              return (hitStats.athletes ?? [])
                .filter(a => a.athlete)
                .map(a => {
                  const sv = a.stats ?? []
                  return {
                    name: a.athlete.shortName ?? a.athlete.displayName,
                    pos:  a.position?.abbreviation ?? null,
                    ab:   parseInt(sv[idx('AB')])  || 0,
                    r:    parseInt(sv[idx('R')])   || 0,
                    h:    parseInt(sv[idx('H')])   || 0,
                    rbi:  parseInt(sv[idx('RBI')]) || 0,
                    hr:   parseInt(sv[idx('HR')])  || 0,
                    bb:   parseInt(sv[idx('BB')])  || 0,
                    k:    parseInt(sv[idx('K')] ?? sv[idx('SO')]) || 0,
                    avg:  sv[idx('AVG')] ?? sv[idx('BA')] ?? null,
                  }
                })
            }

            const parsePitching = (group) => {
              if (!group) return []
              const pitchStats = group.statistics?.find(s => s.type === 'pitching') ?? group.statistics?.[1]
              if (!pitchStats) return []
              const names = pitchStats.names ?? []
              const idx = (n) => names.findIndex(x => x.toUpperCase() === n.toUpperCase())
              return (pitchStats.athletes ?? [])
                .filter(a => a.athlete)
                .map(a => {
                  const sv = a.stats ?? []
                  return {
                    name:  a.athlete.shortName ?? a.athlete.displayName,
                    ip:    sv[idx('IP')]  ?? null,
                    h:     parseInt(sv[idx('H')])  || 0,
                    r:     parseInt(sv[idx('R')])  || 0,
                    er:    parseInt(sv[idx('ER')]) || 0,
                    hr:    parseInt(sv[idx('HR')]) || 0,
                    bb:    parseInt(sv[idx('BB')]) || 0,
                    k:     parseInt(sv[idx('K')] ?? sv[idx('SO')]) || 0,
                    pc_st: sv[idx('PC-ST')] ?? null,
                  }
                })
            }

            meta.away_hitting  = parseHitting(awayGroup)
            meta.home_hitting  = parseHitting(homeGroup)
            meta.away_pitching = parsePitching(awayGroup)
            meta.home_pitching = parsePitching(homeGroup)
          }

          // MLB situation (live only)
          if (s.situation) {
            const sit = s.situation
            const hComp = s.header?.competitions?.[0]
            const hStatus = hComp?.status
            const inningNum = hStatus?.period ?? s.linescore?.currentInning ?? null
            const detail = hStatus?.type?.detail ?? s.linescore?.currentInningHalf ?? ''
            const inningHalf = detail.toLowerCase().includes('bot') ? 'Bottom'
              : detail.toLowerCase().includes('top') ? 'Top' : null
            meta.situation = {
              inning:      inningNum,
              inningHalf,
              outs:        sit.outs ?? null,
              balls:       sit.balls ?? null,
              strikes:     sit.strikes ?? null,
              onFirst:     sit.onFirst  ? true : false,
              onSecond:    sit.onSecond ? true : false,
              onThird:     sit.onThird  ? true : false,
              batter:      sit.batter?.athlete?.shortName ?? sit.batter?.athlete?.displayName ?? null,
              pitcher:     sit.pitcher?.athlete?.shortName ?? sit.pitcher?.athlete?.displayName ?? null,
            }
          }

          // MLB linescore — scoreboard competitors have per-inning data
          const toInnings = (arr) => (arr ?? []).map(v => v.displayValue != null ? String(v.displayValue) : (v.value != null ? String(v.value) : '-'))
          if (away.linescores?.length || home.linescores?.length) {
            // H/E from summary s.linescore.teams if available, else null
            const sumTeams = s.linescore?.teams ?? []
            const sumAway = sumTeams.find(l => String(l.team?.id) === String(away.team?.id)) ?? sumTeams[0]
            const sumHome = sumTeams.find(l => String(l.team?.id) === String(home.team?.id)) ?? sumTeams[1]
            meta.linescore = {
              away: { innings: toInnings(away.linescores), r: parseInt(away.score) || null, h: sumAway?.hits ?? meta.away_team_stats?.hits ?? null, e: sumAway?.errors ?? null },
              home: { innings: toInnings(home.linescores), r: parseInt(home.score) || null, h: sumHome?.hits ?? meta.home_team_stats?.hits ?? null, e: sumHome?.errors ?? null },
              currentInning: comp.status?.period ?? s.linescore?.currentInning ?? null,
            }
          }
        }

        // NBA/WNBA box score — shared parser
        if (key === 'NBA' || key === 'WNBA') {
          if (s.boxscore?.players?.length) {
            const awayPlayers = s.boxscore.players.find(p => String(p.team?.id) === String(away.team?.id)) ?? s.boxscore.players[0]
            const homePlayers = s.boxscore.players.find(p => String(p.team?.id) === String(home.team?.id)) ?? s.boxscore.players[1]
            meta.away_players = parseHoopsPlayers(awayPlayers)
            meta.home_players = parseHoopsPlayers(homePlayers)
          }
        }

        // NHL/NBA situation (period + clock) + period/quarter linescore
        if (key === 'NHL' || key === 'NBA' || key === 'WNBA' || key === 'NFL') {
          const period = comp.status?.period ?? null
          const clock  = comp.status?.displayClock ?? null
          if (period || clock) {
            meta.situation = { period, clock }
          }
          const _ls = parsePeriodLinescore(away, home, key)
          if (_ls) meta.linescore = _ls
        }

        // NHL skaters + goalies — parsed from boxscore.players via shared helpers
        // in cron-sync-live.js (single source of truth for the live + heavy syncs).
        if (key === 'NHL' && s.boxscore?.players?.length) {
          const awayP = s.boxscore.players.find(p => String(p.team?.id) === String(away.team?.id)) ?? s.boxscore.players[0]
          const homeP = s.boxscore.players.find(p => String(p.team?.id) === String(home.team?.id)) ?? s.boxscore.players[1]
          meta.away_skaters = parseNHLSkaters(awayP)
          meta.home_skaters = parseNHLSkaters(homeP)
          meta.away_goalie  = parseNHLGoalie(awayP)
          meta.home_goalie  = parseNHLGoalie(homeP)
          const _goals = parseNHLGoals(s, away, home)
          if (_goals) meta.goals = _goals
        }

        // Play-by-play — last 20 plays (all sports, live + final)
        if (s.plays?.length) {
          if (key === 'MLB') {
            // MLB: capture full pitch/play data for at-bat grouping
            meta.plays = s.plays.slice(-60).map(p => {
              const parts = p.participants ?? []
              const batter  = parts.find(x => x.type === 'batter'  || x.role?.toLowerCase() === 'batter')
              const pitcher = parts.find(x => x.type === 'pitcher' || x.role?.toLowerCase() === 'pitcher')
              return {
                text:          p.text ?? p.type?.text ?? null,
                playType:      p.type?.text ?? null,
                scoring:       p.scoringPlay ?? false,
                period:        p.period?.number ?? null,
                atBatId:       p.atBatId ?? null,
                batter:        batter?.athlete?.shortName ?? batter?.athlete?.displayName ?? null,
                pitcher:       pitcher?.athlete?.shortName ?? pitcher?.athlete?.displayName ?? null,
                teamAbbr:      p.team?.abbreviation ?? null,
                pitchType:     p.pitchType?.text ?? null,
                pitchVelocity: p.pitchVelocity != null ? Math.round(p.pitchVelocity) : null,
                balls:         p.balls ?? null,
                strikes:       p.strikes ?? null,
                outs:          p.outs ?? null,
                awayScore:     p.awayScore ?? p.score?.away ?? null,
                homeScore:     p.homeScore ?? p.score?.home ?? null,
              }
            }).reverse()
          } else {
            meta.plays = parseSimplePlays(s)
          }
        }

        // MLB pitcher of record (final only)
        if (key === 'MLB' && s.decisions) {
          const fmtDecision = (d) => {
            if (!d?.athlete) return null
            const cats = d.statistics?.splits?.categories ?? []
            const stat = (n) => cats.find(x => x.name === n)?.displayValue ?? null
            return {
              name:   d.athlete.shortName ?? d.athlete.displayName,
              era:    stat('ERA'),
              record: stat('record') ?? `${stat('wins') ?? 0}-${stat('losses') ?? 0}`,
            }
          }
          meta.decisions = {
            winner: fmtDecision(s.decisions.winner),
            loser:  fmtDecision(s.decisions.loser),
            save:   fmtDecision(s.decisions.save),
          }
        }
      } else {
        console.warn(`summary fetch not ok for ${ev.id}: ${sumRes.status}`)
      }
    } catch (e) {
      console.warn(`summary fetch failed for ${ev.id}: ${e.message}`)
    }

    return {
      external_event_id: String(ev.id),
      provider:    'espn',
      sport:       key,
      league:      key,
      start_time:  ev.date,
      status,
      home_team:   home.team?.displayName ?? '',
      away_team:   away.team?.displayName ?? '',
      home_abbr:   home.team?.abbreviation ?? '',
      away_abbr:   away.team?.abbreviation ?? '',
      home_score:  isLive ? (home.score != null && home.score !== '' ? parseInt(home.score) : null) : null,
      away_score:  isLive ? (away.score != null && away.score !== '' ? parseInt(away.score) : null) : null,
      home_record: home.records?.[0]?.summary ?? null,
      away_record: away.records?.[0]?.summary ?? null,
      odds_ml_home:     homeMLRaw != null ? parseAmerican(String(homeMLRaw)) : null,
      odds_ml_away:     awayMLRaw != null ? parseAmerican(String(awayMLRaw)) : null,
      odds_spread_home: parseDecimal(spreadLine),
      odds_spread_away: spreadLine ? parseDecimal(String(-parseFloat(spreadLine))) : null,
      odds_total:       parseDecimal(totalLine),
      metadata:    meta,
      updated_at:  new Date().toISOString(),
    }
  }

  // Process events with bounded concurrency so a full slate finishes well inside
  // the function timeout, without bursting too many ESPN requests at once.
  return (await mapLimit(json?.events ?? [], 8, processEvent)).filter(Boolean)
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  // Allow manual POST to bypass game-window gate (for testing)
  const isManual = req.method === 'POST'
  if (!isManual && !inGameWindow()) {
    return res.status(200).json({ skipped: true, reason: 'outside game window' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  // Sync yesterday, today, and tomorrow so all three date tabs have data
  const dates   = [etDateStr(-1), etDateStr(0), etDateStr(1)]
  const counts  = {}
  const allRows = []

  for (const s of SPORTS) {
    counts[s.key] = 0
    for (const dateStr of dates) {
      const rows = await fetchSport(s, dateStr)
      counts[s.key] += rows.length
      allRows.push(...rows)
    }
  }

  if (allRows.length === 0) {
    return res.status(200).json({ upserted: 0, counts, dates })
  }

  // Preserve pre-game spread/total when ESPN drops them for live games
  const eventIds = allRows.map(r => r.external_event_id)
  const { data: existing } = await supabase
    .from('events')
    .select('external_event_id, odds_spread_home, odds_spread_away, odds_total, metadata')
    .in('external_event_id', eventIds)

  // A metadata blob is "rich" if it has any detailed key beyond the 6 basic ones
  // we always build (logos, venue, venue_city, broadcast, series_summary).
  const BASE_META_KEYS = new Set(['home_logo', 'away_logo', 'venue', 'venue_city', 'broadcast', 'series_summary'])
  const isRichMeta = (m) => m && typeof m === 'object' && Object.keys(m).some(k => !BASE_META_KEYS.has(k))

  if (existing?.length) {
    const existingMap = Object.fromEntries(existing.map(r => [r.external_event_id, r]))
    for (const row of allRows) {
      const prev = existingMap[row.external_event_id]
      if (!prev) continue
      if (row.odds_spread_home == null && prev.odds_spread_home != null) {
        row.odds_spread_home = prev.odds_spread_home
        row.odds_spread_away = prev.odds_spread_away
      }
      if (row.odds_total == null && prev.odds_total != null) {
        row.odds_total = prev.odds_total
      }
      // Never overwrite rich metadata with a bare blob: when this run failed to
      // fetch detailed stats (summary fetch errored), keep the existing rich
      // data and just refresh the basic fields on top of it.
      if (!isRichMeta(row.metadata) && isRichMeta(prev.metadata)) {
        row.metadata = { ...prev.metadata, ...row.metadata }
      }
    }
  }

  const { error } = await supabase
    .from('events')
    .upsert(allRows, { onConflict: 'external_event_id,provider' })

  if (error) {
    console.error('cron-sync-events upsert error:', error)
    return res.status(500).json({ error: error.message })
  }

  // Append odds snapshots for line movement + CLV (append-only; never blocks the sync).
  try {
    const snaps = buildOddsSnapshots(allRows, new Date().toISOString())
    if (snaps.length) await supabase.from('odds_history').insert(snaps)
  } catch (e) {
    console.warn('odds_history snapshot failed:', e.message)
  }

  return res.status(200).json({ upserted: allRows.length, counts, dates })
}
