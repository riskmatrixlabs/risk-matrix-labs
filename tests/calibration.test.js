import { describe, it, expect } from 'vitest'
import {
  wilsonInterval,
  resultToWin,
  bucketByEdge,
  summarize,
} from '../src/lib/calibration.js'

describe('wilsonInterval', () => {
  it('n=0 → safe {lo:0,hi:1}', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lo: 0, hi: 1 })
  })
  it('18/32 ≈ .563 with a band that brackets the point estimate', () => {
    const { lo, hi } = wilsonInterval(18, 32)
    // point estimate
    expect(18 / 32).toBeCloseTo(0.5625, 4)
    expect(lo).toBeLessThan(0.5625)
    expect(hi).toBeGreaterThan(0.5625)
    // known Wilson 95% band for 18/32 ≈ [0.392, 0.717]
    expect(lo).toBeCloseTo(0.392, 2)
    expect(hi).toBeCloseTo(0.717, 2)
  })
  it('all wins → hi capped at 1, lo below 1', () => {
    const { lo, hi } = wilsonInterval(10, 10)
    expect(hi).toBeLessThanOrEqual(1)
    expect(lo).toBeLessThan(1)
    expect(lo).toBeGreaterThan(0)
  })
  it('bigger n → tighter band', () => {
    const small = wilsonInterval(5, 10)
    const big = wilsonInterval(50, 100)
    expect(big.hi - big.lo).toBeLessThan(small.hi - small.lo)
  })
})

describe('resultToWin', () => {
  it('W → true', () => expect(resultToWin('W')).toBe(true))
  it('L → false', () => expect(resultToWin('L')).toBe(false))
  it('push/null/other → null (excluded)', () => {
    expect(resultToWin('P')).toBeNull()
    expect(resultToWin('push')).toBeNull()
    expect(resultToWin(null)).toBeNull()
    expect(resultToWin(undefined)).toBeNull()
    expect(resultToWin('HIT')).toBeNull()
  })
})

describe('bucketByEdge', () => {
  const rows = [
    { edge_runs: 0.5, result: 'W' }, // <1
    { edge_runs: 0.8, result: 'L' }, // <1
    { edge_runs: 1.0, result: 'W' }, // 1–1.5
    { edge_runs: 1.4, result: 'L' }, // 1–1.5
    { edge_runs: 1.5, result: 'W' }, // ≥1.5
    { edge_runs: 2.0, result: 'W' }, // ≥1.5
    { edge_runs: null, result: 'W' }, // excluded (no edge)
    { edge_runs: 1.2, result: 'P' }, // excluded (push)
    { edge_runs: 1.2, result: null }, // excluded (no result)
  ]
  it('splits into <1, 1–1.5, ≥1.5 with correct n/wins', () => {
    const { buckets, excluded } = bucketByEdge(rows)
    expect(buckets.map((b) => b.n)).toEqual([2, 2, 2])
    expect(buckets.map((b) => b.wins)).toEqual([1, 1, 2])
    expect(excluded).toBe(3)
  })
  it('each bucket carries label, winPct, ci', () => {
    const { buckets } = bucketByEdge(rows)
    for (const b of buckets) {
      expect(typeof b.label).toBe('string')
      expect(b.winPct).toBeCloseTo(b.wins / b.n, 6)
      expect(b.ci).toHaveProperty('lo')
      expect(b.ci).toHaveProperty('hi')
    }
  })
  it('custom edges respected', () => {
    const { buckets } = bucketByEdge(rows, [2])
    // two buckets: <2 and ≥2
    expect(buckets.length).toBe(2)
    expect(buckets[1].n).toBe(1) // only edge_runs 2.0
  })
})

describe('summarize', () => {
  const graded = (n, wins, strong, edge) =>
    Array.from({ length: n }, (_, i) => ({
      result: i < wins ? 'W' : 'L',
      strong,
      edge_runs: edge,
    }))

  it('empty → not ready, verdict mentions insufficient', () => {
    const s = summarize([])
    expect(s.ready).toBe(false)
    expect(s.gradedN).toBe(0)
    expect(s.verdict).toMatch(/insufficient/i)
  })
  it('ready flag flips at 250 graded', () => {
    const below = summarize(graded(249, 130, true, 1.2))
    const at = summarize(graded(250, 130, true, 1.2))
    expect(below.ready).toBe(false)
    expect(at.ready).toBe(true)
  })
  it('overall + by-strong + buckets present', () => {
    const rows = [
      ...graded(10, 6, true, 1.6),
      ...graded(10, 4, false, 0.7),
    ]
    const s = summarize(rows)
    expect(s.overall.n).toBe(20)
    expect(s.overall.wins).toBe(10)
    expect(s.byStrong.strong.n).toBe(10)
    expect(s.byStrong.notStrong.n).toBe(10)
    expect(s.byStrong.strong.wins).toBe(6)
    expect(s.buckets.length).toBe(3)
  })
  it('excludes ungraded rows from counts', () => {
    const rows = [
      ...graded(5, 3, true, 1.2),
      { result: null, strong: true, edge_runs: 1.2 },
      { result: 'W', strong: true, edge_runs: null },
    ]
    const s = summarize(rows)
    expect(s.gradedN).toBe(5)
  })
})
