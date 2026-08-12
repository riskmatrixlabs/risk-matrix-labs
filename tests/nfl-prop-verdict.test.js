// NFL prop verdict model (SESSION-AUTHORED — there is no owner NFL prop formula in
// docs/models/MODELS.md). Same verdict contract as the WNBA/NBA/NHL siblings.
import { describe, it, expect } from 'vitest'
import { nflPropVerdict, nflPropScore, nflTier, REF_VOLUME_PER_GAME, PASS_LEANING } from '../src/lib/nflPropVerdict.js'

const base = {
  market: 'player_pass_yds',
  volumePerGame: 33,       // pass attempts / g
  last3Rate: 265,          // pass yards / g, last 3
  seasonRate: 245,         // pass yards / g, season
  oddsTotal: 47,
  teamSpread: -7,          // player's team favored by 7
  evPct: 4,
  line: 249.5,
}

describe('nflPropScore', () => {
  it('applies the documented 30/20/20/15/15 weights', () => {
    expect(nflPropScore({ volume: 1, recentForm: 1, matchup: 1, gameScript: 1, lineValue: 1 })).toBe(100)
    expect(nflPropScore({ volume: 0, recentForm: 0, matchup: 0, gameScript: 0, lineValue: 0 })).toBe(0)
    expect(nflPropScore({ volume: 1, recentForm: 0, matchup: 0, gameScript: 0, lineValue: 0 })).toBe(30)
  })
  it('is null on any non-finite input (never NaN into the UI)', () => {
    expect(nflPropScore({ volume: 1, recentForm: null, matchup: 1, gameScript: 1, lineValue: 1 })).toBeNull()
    expect(nflPropScore({})).toBeNull()
  })
})

describe('nflTier bounds', () => {
  it('maps score → A/B/C/AVOID at 75/62/50', () => {
    expect(nflTier(75).tier).toBe('A')
    expect(nflTier(74.99).tier).toBe('B')
    expect(nflTier(62).tier).toBe('B')
    expect(nflTier(61.99).tier).toBe('C')
    expect(nflTier(50).tier).toBe('C')
    expect(nflTier(49.99).tier).toBe('AVOID')
  })
})

describe('nflPropVerdict — hand-computed', () => {
  const v = nflPropVerdict(base)
  it('produces the hand-computed score and tier', () => {
    // volume 33/35=.942857×30=28.2857 · form (0.5+20/490)=.540816×20=10.8163
    // matchup implied team total (47/2)+(7/2)=27 → 27/30=.9×20=18
    // gameScript pass market, favored 7 → 0.5−(7/14)/2=.25×15=3.75 · value (0.5+4/20)=.7×15=10.5
    expect(v.score).toBeCloseTo(71.35, 2)
    expect(v.tier).toBe('B')
    expect(v.label).toBe('Strong')
    expect(v.faded).toBe(false)
  })
  it('projects from the two real observed rates and edges against the posted line', () => {
    expect(v.projection).toBe(255)      // (265 + 245) / 2
    expect(v.edge).toBe(5.5)            // 255 − 249.5
  })
  it('returns the five breakdown bars the render path expects', () => {
    expect(Object.keys(v.breakdown).sort()).toEqual(['form', 'matchup', 'script', 'value', 'volume'])
    expect(v.breakdown.volume).toBe(94)
    expect(v.breakdown.matchup).toBe(90)
    expect(v.breakdown.script).toBe(25)
    expect(v.breakdown.value).toBe(70)
  })
  it('carries the market through', () => {
    expect(v.market).toBe('player_pass_yds')
  })
})

describe('game script direction is per-market', () => {
  it('a favored team running the ball scores HIGH on rush markets and LOW on pass markets', () => {
    const rush = nflPropVerdict({ ...base, market: 'player_rush_yds', volumePerGame: 18, last3Rate: 80, seasonRate: 80, line: 75.5 })
    const pass = nflPropVerdict(base)
    expect(rush.breakdown.script).toBe(75)
    expect(pass.breakdown.script).toBe(25)
  })
  it('a big underdog flips it — passing up, rushing down', () => {
    const dogPass = nflPropVerdict({ ...base, teamSpread: 10 })
    expect(dogPass.breakdown.script).toBe(86)   // 0.5 + (10/14)/2 = 0.857
    const dogRush = nflPropVerdict({ ...base, market: 'player_rush_yds', volumePerGame: 18, last3Rate: 80, seasonRate: 80, line: 75.5, teamSpread: 10 })
    expect(dogRush.breakdown.script).toBe(14)
  })
  it('pass-leaning market table covers receiving as a passing-game market', () => {
    expect(PASS_LEANING.has('player_reception_yds')).toBe(true)
    expect(PASS_LEANING.has('player_receptions')).toBe(true)
    expect(PASS_LEANING.has('player_rush_yds')).toBe(false)
  })
})

describe('honest-null contract — any underivable input means NO verdict', () => {
  it('unmodeled market', () => {
    expect(nflPropVerdict({ ...base, market: 'player_anytime_td' })).toBeNull()
    expect(nflPropVerdict({ ...base, market: 'player_1st_td' })).toBeNull()
  })
  for (const k of ['volumePerGame', 'last3Rate', 'seasonRate', 'oddsTotal', 'teamSpread', 'evPct', 'line']) {
    it(`missing ${k}`, () => {
      expect(nflPropVerdict({ ...base, [k]: null })).toBeNull()
      expect(nflPropVerdict({ ...base, [k]: undefined })).toBeNull()
    })
  }
  it('a zero/negative season rate makes recent form undefined', () => {
    expect(nflPropVerdict({ ...base, seasonRate: 0 })).toBeNull()
  })
  it('a non-positive total makes the matchup proxy undefined', () => {
    expect(nflPropVerdict({ ...base, oddsTotal: 0 })).toBeNull()
  })
  it('empty input object', () => {
    expect(nflPropVerdict()).toBeNull()
    expect(nflPropVerdict({})).toBeNull()
  })
})

describe('reference volume table', () => {
  it('documents a per-game volume reference for every modeled market', () => {
    for (const m of ['player_pass_yds', 'player_pass_tds', 'player_rush_yds', 'player_reception_yds', 'player_receptions']) {
      expect(Number.isFinite(REF_VOLUME_PER_GAME[m]), `no ref for ${m}`).toBe(true)
    }
  })
  it('clamps volume at 1 for an extreme workload', () => {
    const v = nflPropVerdict({ ...base, volumePerGame: 99 })
    expect(v.breakdown.volume).toBe(100)
  })
})
