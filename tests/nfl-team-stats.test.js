import { describe, it, expect } from 'vitest'
import { parseTeamStatsCsv, parseWeeklyDefEpaCsv, mergeDefEpa } from '../api/_lib/nflTeamStats.js'

// Fixture: real nflverse stats_team_reg_2025.csv schema (verified 2026-08-11 against the
// live release asset), trimmed to the columns the parser reads plus a few extras so the
// header-name lookup (not positional indexing) is exercised. Two teams + one POST row
// that must be ignored.
const FIXTURE = [
  'season,team,season_type,games,completions,attempts,passing_yards,passing_interceptions,sacks_suffered,passing_epa,passing_20,carries,rushing_epa,rushing_10,def_interceptions,fumble_recovery_opp,fumbles_lost_total',
  '2025,ARI,REG,17,427,649,4354,11,59,4.75957977369818,49,366,-21.5048540234015,35,10,8,7',
  '2025,ATL,REG,17,332,545,3703,8,26,4.20909639709465,47,477,-19.2033657689311,54,12,5,9',
  '2025,ARI,POST,1,20,30,200,1,2,1.0,3,20,0.5,2,1,0,1',
].join('\n')

describe('parseTeamStatsCsv', () => {
  const stats = parseTeamStatsCsv(FIXTURE)

  it('keys by team abbreviation, REG rows only', () => {
    expect(Object.keys(stats).sort()).toEqual(['ARI', 'ATL'])
    // POST row must not overwrite ARI's REG numbers (games would be 1)
    expect(stats.ARI.playsPerGame).not.toBeCloseTo((30 + 20 + 2) / 1, 2)
  })

  it('hand-computed ARI metrics', () => {
    // plays = attempts + carries + sacks_suffered = 649 + 366 + 59 = 1074
    const plays = 649 + 366 + 59
    expect(stats.ARI.playsPerGame).toBeCloseTo(plays / 17, 4)
    // offEpaPerPlay = (passing_epa + rushing_epa) / plays
    expect(stats.ARI.offEpaPerPlay).toBeCloseTo((4.75957977369818 + -21.5048540234015) / plays, 6)
    // sackRateAllowed = sacks / dropbacks = 59 / (649 + 59)
    expect(stats.ARI.sackRateAllowed).toBeCloseTo(59 / (649 + 59), 6)
    // explosiveRate = (passing_20 + rushing_10) / plays = (49 + 35) / 1074
    expect(stats.ARI.explosiveRate).toBeCloseTo((49 + 35) / plays, 6)
    // turnoverMargin = takeaways − giveaways = (10 + 8) − (11 + 7) = 0
    expect(stats.ARI.turnoverMargin).toBe(0)
  })

  it('hand-computed ATL turnover margin', () => {
    // (12 + 5) − (8 + 9) = 0? no: 17 − 17 = 0 ... use exact: (12+5)-(8+9)=0
    expect(stats.ATL.turnoverMargin).toBe((12 + 5) - (8 + 9))
  })

  it('defEpaPerPlayAllowed is null — not present in the nflverse team-stats schema (honest gap)', () => {
    expect(stats.ARI.defEpaPerPlayAllowed).toBe(null)
  })

  it('missing columns fail soft to null per metric, not throw', () => {
    const out = parseTeamStatsCsv('season,team,season_type,games,attempts,carries,sacks_suffered\n2025,KC,REG,17,600,400,40')
    expect(out.KC.playsPerGame).toBeCloseTo(1040 / 17, 4)
    expect(out.KC.offEpaPerPlay).toBe(null)      // no epa columns
    expect(out.KC.explosiveRate).toBe(null)      // no explosive columns
    expect(out.KC.turnoverMargin).toBe(null)     // no turnover columns
    expect(out.KC.sackRateAllowed).toBeCloseTo(40 / 640, 6)
  })

  it('garbage / empty input → null', () => {
    expect(parseTeamStatsCsv('')).toBe(null)
    expect(parseTeamStatsCsv(null)).toBe(null)
    expect(parseTeamStatsCsv('not,a,team,stats\nfile,at,all,x')).toBe(null)
  })
})

// Weekly fixture: real nflverse stats_team_week_2025.csv schema (verified 2026-08-11 by
// downloading the live release asset — 133 columns, no quoted fields; trimmed here to the
// columns the parser reads). defEpaPerPlayAllowed(T) = mean over T's games of the OPPONENT
// row's offensive EPA/play in that game (rows where opponent_team === T).
const WEEKLY_FIXTURE = [
  'season,week,team,season_type,game_id,opponent_team,attempts,sacks_suffered,passing_epa,carries,rushing_epa',
  // Week 1: KC vs DEN (both rows of the same game)
  '2025,1,KC,REG,2025_01_KC_DEN,DEN,30,2,5.2,20,1.0',      // KC off: 6.2/52 → DEN allowed
  '2025,1,DEN,REG,2025_01_KC_DEN,KC,28,4,-3.24,22,0.54',   // DEN off: -2.7/54 = -0.05 → KC allowed
  // Week 2: rematch
  '2025,2,DEN,REG,2025_02_DEN_KC,KC,26,1,6.0,23,1.5',      // DEN off: 7.5/50 = 0.15 → KC allowed
  '2025,2,KC,REG,2025_02_DEN_KC,DEN,35,0,2.0,15,0.5',      // KC off: 2.5/50 = 0.05 → DEN allowed
  // POST row must be ignored
  '2025,19,KC,POST,2025_19_KC_DEN,DEN,40,3,9.9,10,1.1',
  // Row with missing EPA → skipped (no fabricated per-game value)
  '2025,3,LAC,REG,2025_03_LAC_LV,LV,30,2,,20,1.0',
].join('\n')

describe('parseWeeklyDefEpaCsv', () => {
  const def = parseWeeklyDefEpaCsv(WEEKLY_FIXTURE)

  it('defEpaPerPlayAllowed = mean of opponents’ per-game off EPA/play (REG only)', () => {
    // KC allowed: DEN w1 (-2.7/54) and DEN w2 (7.5/50) → mean(-0.05, 0.15) = 0.05
    expect(def.KC).toBeCloseTo((-2.7 / 54 + 7.5 / 50) / 2, 6)
    // DEN allowed: KC w1 (6.2/52) and KC w2 (2.5/50)
    expect(def.DEN).toBeCloseTo((6.2 / 52 + 2.5 / 50) / 2, 6)
  })

  it('POST rows ignored; rows with missing EPA skipped (LV gets no key)', () => {
    expect(def.LV).toBeUndefined()
    // KC mean unchanged by the POST row (asserted above by exact value)
  })

  it('garbage / missing-column input → null', () => {
    expect(parseWeeklyDefEpaCsv('')).toBe(null)
    expect(parseWeeklyDefEpaCsv(null)).toBe(null)
    expect(parseWeeklyDefEpaCsv('season,team,season_type\n2025,KC,REG')).toBe(null) // no opponent_team
  })
})

describe('mergeDefEpa', () => {
  it('fills defEpaPerPlayAllowed from the weekly map; missing team stays null (fail-soft)', () => {
    const stats = parseTeamStatsCsv(FIXTURE)
    const merged = mergeDefEpa(stats, { ARI: -0.031 })
    expect(merged.ARI.defEpaPerPlayAllowed).toBeCloseTo(-0.031, 6)
    expect(merged.ATL.defEpaPerPlayAllowed).toBe(null)
    // untouched metrics survive the merge
    expect(merged.ARI.sackRateAllowed).toBeCloseTo(59 / (649 + 59), 6)
  })
  it('null def map → stats pass through with def null', () => {
    const stats = parseTeamStatsCsv(FIXTURE)
    const merged = mergeDefEpa(stats, null)
    expect(merged.ARI.defEpaPerPlayAllowed).toBe(null)
  })
  it('null stats → null', () => {
    expect(mergeDefEpa(null, { KC: 0.1 })).toBe(null)
  })
})
