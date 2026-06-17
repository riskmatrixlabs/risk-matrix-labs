import { describe, it, expect } from 'vitest'
import {
  evScore, evScoreFromPct, clvScore, clvScoreFromBeatPct, weightedScore,
  phltScore, disciplineScore, operatorRating, ladderScore, roundRobinScore,
  finalBetScore, verdictFor, phltGradeFor, operatorLabelFor,
  gradeBetQuality, verdictFromBetGrade, WEIGHTS,
} from '../src/lib/evBrain.js'

describe('evScore', () => {
  it('computes edge, EV% and a tiered score from model prob vs price', () => {
    // -110 implies ~52.38%. Model says 60% → real edge.
    const r = evScore(0.60, -110)
    expect(r.implied).toBeCloseTo(0.5238, 3)
    expect(r.edge).toBeCloseTo(0.0762, 3)
    expect(r.evPct).toBeGreaterThan(8)
    expect(r.score).toBe(100)
  })
  it('scores a thin +EV bet in the middle tier', () => {
    const r = evScore(0.55, -110) // ~+1.6% edge → small EV
    expect(r.evPct).toBeGreaterThan(0)
    expect(r.evPct).toBeLessThan(8)
    expect(r.score).toBeLessThan(100)
    expect(r.score).toBeGreaterThanOrEqual(55)
  })
  it('flags a -EV bet as a pass (sub-50 score)', () => {
    const r = evScore(0.45, -110) // below breakeven
    expect(r.edge).toBeLessThan(0)
    expect(r.score).toBeLessThan(50)
    expect(r.isPass).toBe(true)
  })
  it('returns null on missing inputs', () => {
    expect(evScore(null, -110)).toBeNull()
    expect(evScore(0.5, null)).toBeNull()
  })
})

describe('clvScore', () => {
  it('rewards beating the close (got a better price than it closed)', () => {
    // Took +120, closed -130 → strong CLV
    const s = clvScore(120, -130)
    expect(s).toBeGreaterThanOrEqual(90)
  })
  it('scores a flat line near the middle', () => {
    expect(clvScore(-110, -110)).toBeGreaterThanOrEqual(50)
    expect(clvScore(-110, -110)).toBeLessThan(70)
  })
  it('penalizes a line that moved against you', () => {
    // Took -130, closed +120 → bad CLV
    expect(clvScore(-130, 120)).toBeLessThan(50)
  })
  it('returns null without both prices', () => {
    expect(clvScore(-110, null)).toBeNull()
  })
})

describe('weightedScore', () => {
  it('combines [value, weight] parts, ignoring null components and renormalizing', () => {
    expect(weightedScore([[80, 0.5], [60, 0.5]])).toBeCloseTo(70, 5)
    // a null component drops out and the rest renormalize
    expect(weightedScore([[80, 0.5], [null, 0.5]])).toBeCloseTo(80, 5)
  })
  it('returns null when every component is missing', () => {
    expect(weightedScore([[null, 0.5], [null, 0.5]])).toBeNull()
  })
})

describe('phltScore', () => {
  it('weights the six components per spec', () => {
    const s = phltScore({
      marketQuality: 100, opportunity: 100, matchupEdge: 100,
      gameEnvironment: 100, lineValue: 100, disciplineFit: 100,
    })
    expect(s).toBeCloseTo(100, 5)
  })
})

describe('disciplineScore', () => {
  it('subtracts penalties from the weighted base and clamps to 0', () => {
    const clean = disciplineScore({
      betSizeControl: 100, noChase: 100, ticketStructure: 100,
      marketSelection: 100, emotionalState: 100,
    })
    expect(clean).toBe(100)
    const tilted = disciplineScore(
      { betSizeControl: 80, noChase: 80, ticketStructure: 80, marketSelection: 80, emotionalState: 80 },
      ['liveChase', 'tilt'], // −20 −20
    )
    expect(tilted).toBe(40)
    const floored = disciplineScore(
      { betSizeControl: 10, noChase: 10, ticketStructure: 10, marketSelection: 10, emotionalState: 10 },
      ['liveChase', 'tilt', 'sizeJumpAfterWin'],
    )
    expect(floored).toBe(0)
  })
})

describe('label helpers', () => {
  it('maps final score to a brand-safe verdict (no "play")', () => {
    expect(verdictFor(90).key).toBe('PRIME')
    expect(verdictFor(80).key).toBe('STRONG')
    expect(verdictFor(70).key).toBe('LEAN')
    expect(verdictFor(50).key).toBe('PASS')
    // brand rule: never the word "play"
    expect(verdictFor(90).label.toLowerCase()).not.toContain('play')
  })
  it('maps PHLT score to a grade tier', () => {
    expect(phltGradeFor(95)).toBe('Elite')
    expect(phltGradeFor(82)).toBe('Strong')
    expect(phltGradeFor(72)).toBe('Lean')
    expect(phltGradeFor(63)).toBe('Watch')
    expect(phltGradeFor(40)).toBe('Pass')
  })
  it('maps operator rating to a label tier', () => {
    expect(operatorLabelFor(92)).toBe('Sharp')
    expect(operatorLabelFor(83)).toBe('Clean')
    expect(operatorLabelFor(74)).toBe('Developing')
    expect(operatorLabelFor(63)).toBe('Risky')
    expect(operatorLabelFor(40)).toBe('Degen Mode')
  })
})

describe('finalBetScore', () => {
  it('weights PHLT/EV/CLV/Fit/Discipline and returns a verdict', () => {
    const r = finalBetScore({ phlt: 90, ev: 90, clvProj: 90, ladderRRFit: 90, discipline: 90 })
    expect(r.score).toBeCloseTo(90, 5)
    expect(r.verdict.key).toBe('PRIME')
  })
  it('passes a weak bet', () => {
    const r = finalBetScore({ phlt: 50, ev: 40, clvProj: 50, ladderRRFit: 50, discipline: 50 })
    expect(r.score).toBeLessThan(65)
    expect(r.verdict.key).toBe('PASS')
  })
})

describe('weights are coherent', () => {
  it('every weight set sums to 1', () => {
    for (const [name, set] of Object.entries(WEIGHTS)) {
      const sum = Object.values(set).reduce((a, b) => a + b, 0)
      expect(sum, name).toBeCloseTo(1, 6)
    }
  })
})

describe('percent-based scorers (reused by the gradeBet adapter)', () => {
  it('evScoreFromPct mirrors evScore tiers', () => {
    expect(evScoreFromPct(9)).toBe(100)
    expect(evScoreFromPct(6)).toBe(85)
    expect(evScoreFromPct(4)).toBe(70)
    expect(evScoreFromPct(2)).toBe(55)
    expect(evScoreFromPct(-3)).toBeLessThan(50)
    expect(evScoreFromPct(null)).toBeNull()
  })
  it('clvScoreFromBeatPct mirrors clvScore tiers', () => {
    expect(clvScoreFromBeatPct(5)).toBeGreaterThanOrEqual(90)
    expect(clvScoreFromBeatPct(0)).toBe(60)
    expect(clvScoreFromBeatPct(-5)).toBeLessThan(50)
    expect(clvScoreFromBeatPct(null)).toBeNull()
  })
})

describe('verdictFromBetGrade (Phase-2 glue)', () => {
  it('grades a logged bet on EV + CLV alone (PHLT/discipline absent)', () => {
    const v = verdictFromBetGrade({ evPct: 9, clvPct: 5, winProb: 0.6 }, -110)
    // EV 100 + CLV ~100, other components null → renormalize → high verdict
    expect(v.score).toBeGreaterThan(85)
    expect(v.verdict.key).toBe('PRIME')
    expect(v.evScore).toBe(100)
  })
  it('passes a -EV, line-moved-against bet', () => {
    const v = verdictFromBetGrade({ evPct: -4, clvPct: -5, winProb: 0.45 }, -110)
    expect(v.verdict.key).toBe('PASS')
  })
  it('returns null when there is nothing real to grade on', () => {
    expect(verdictFromBetGrade({ winProb: 0.5 }, null)).toBeNull()
    expect(verdictFromBetGrade(null, -110)).toBeNull()
  })
})

describe('gradeBetQuality (top-level)', () => {
  it('produces a full grade from already-computed sub-scores', () => {
    const g = gradeBetQuality({
      modelProb: 0.60, americanOdds: -110, entryAmerican: -110, closeAmerican: -130,
      phlt: { marketQuality: 90, opportunity: 85, matchupEdge: 80, gameEnvironment: 80, lineValue: 85, disciplineFit: 90 },
      discipline: { betSizeControl: 90, noChase: 90, ticketStructure: 85, marketSelection: 85, emotionalState: 90 },
    })
    expect(g.ev.score).toBe(100)
    expect(g.clv).toBeGreaterThanOrEqual(90)
    expect(g.phlt).toBeGreaterThan(80)
    expect(g.final.verdict.key).toBeDefined()
    expect(['PRIME', 'STRONG', 'LEAN', 'PASS']).toContain(g.final.verdict.key)
  })
})
