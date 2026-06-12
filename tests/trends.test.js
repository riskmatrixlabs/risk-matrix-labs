import { describe, it, expect } from 'vitest'
import { parseTrends } from '../api/cron-sync-live.js'

const comp = (id, total, home, road) => ({
  team: { id }, score: '0',
  records: [
    { type: 'total', summary: total },
    { type: 'home',  summary: home },
    { type: 'road',  summary: road },
  ],
})

const summary = (streakAway, streakHome, last5) => ({
  standings: { groups: [ { standings: { entries: [
    { team: { id: '1' }, stats: [ { name: 'streak', displayValue: streakAway }, { name: 'winPercent', displayValue: '.500' } ] },
    { team: { id: '2' }, stats: [ { name: 'streak', displayValue: streakHome }, { name: 'winPercent', displayValue: '.638' } ] },
  ] } } ] },
  lastFiveGames: last5,
})

describe('parseTrends', () => {
  it('extracts record splits, streak, winPct', () => {
    const t = parseTrends(comp('1','30-30','15-15','15-15'), comp('2','44-25','23-16','21-9'), summary('L2','W1'))
    expect(t.away).toMatchObject({ overall: '30-30', home: '15-15', road: '15-15', streak: 'L2', winPct: '.500' })
    expect(t.home).toMatchObject({ overall: '44-25', home: '23-16', road: '21-9', streak: 'W1', winPct: '.638' })
  })

  it('adds recent form from lastFiveGames when present', () => {
    const last5 = [{ team: { id: '2' }, events: [ {gameResult:'W'},{gameResult:'W'},{gameResult:'L'},{gameResult:'W'},{gameResult:'W'} ] }]
    const t = parseTrends(comp('1','0-0','0-0','0-0'), comp('2','0-0','0-0','0-0'), summary('W1','W2', last5))
    expect(t.home.l5wins).toBe(4)
    expect(t.home.l5total).toBe(5)
    expect(t.home.form).toEqual(['W','W','L','W','W'])
    expect(t.away.form).toBeUndefined()
  })

  it('returns null when no useful data', () => {
    const empty = { team: { id: '9' }, records: [] }
    expect(parseTrends(empty, empty, {})).toBeNull()
  })
})
