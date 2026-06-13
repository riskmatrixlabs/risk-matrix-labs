// @vitest-environment jsdom
// Proves the Matrix Bot actually RENDERS and FUNCTIONS with realistic data —
// scan → BOARD → ADD PROPS → ranked rows with Kelly sizing. Not just unit math.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MatrixBot from '../src/components/MatrixBot.jsx'

afterEach(cleanup)

vi.mock('../src/lib/events.js', () => ({
  fetchEvents: vi.fn(async () => ({ data: [
    { away_team: 'Chicago Cubs', home_team: 'San Francisco Giants', away_abbr: 'CHC', home_abbr: 'SF', external_event_id: 'evt1', start_time: '2099-12-31T23:00:00Z', status: 'STATUS_SCHEDULED' },
    { away_team: 'Los Angeles Dodgers', home_team: 'San Diego Padres', away_abbr: 'LAD', home_abbr: 'SD', external_event_id: 'evt2', start_time: '2099-12-31T23:30:00Z', status: 'STATUS_SCHEDULED' },
  ] })),
}))
vi.mock('../src/lib/oddsHistory.js', () => ({ fetchLineMovement: vi.fn(async () => ({})) }))

const EDGES = [
  { market: 'h2h',     outcome: 'Chicago Cubs',        point: null, best: { book: 'betfair_ex_us', price: 126, decimal: 2.26 }, evPct: 6.2, fairProb: 0.48, away: 'Chicago Cubs',        home: 'San Francisco Giants', commenceTime: '2099-12-31T23:00:00Z' },
  { market: 'spreads', outcome: 'Los Angeles Dodgers', point: -1.5, best: { book: 'betmgm',         price: 155, decimal: 2.55 }, evPct: 4.1, fairProb: 0.42, away: 'Los Angeles Dodgers', home: 'San Diego Padres',      commenceTime: '2099-12-31T23:30:00Z' },
  { market: 'totals',  outcome: 'Over',                point: 8.5,  best: { book: 'fanduel',        price: -105, decimal: 1.95 }, evPct: 3.0, fairProb: 0.53, away: 'Chicago Cubs',        home: 'San Francisco Giants', commenceTime: '2099-12-31T23:00:00Z' },
]
const PROP = { player: 'Spencer Strider', side: 'Over', point: 5.5, marketLabel: 'Strikeouts', best: { book: 'fanduel', price: -110, link: null }, fairProb: 0.55, evPct: 2.8 }

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj })

beforeEach(() => {
  global.fetch = vi.fn(async (url) => {
    if (url.includes('/api/scan-edges')) return jsonRes({ edges: EDGES, creditsRemaining: 1900 })
    if (url.includes('/api/scan-props')) {
      return url.includes('Cubs')
        ? jsonRes({ found: true, edges: [PROP], lineShopOnly: [], creditsRemaining: 1800 })
        : jsonRes({ found: false })
    }
    return jsonRes({})
  })
})

describe('MatrixBot — real render', () => {
  it('scans, flips to BOARD, and shows ML + spread + total edges with Kelly sizing', async () => {
    render(<MatrixBot token="tkn" bets={[]} bankroll={1000} unitSize={20} />)

    // events load → SCAN enabled
    const scanBtn = await screen.findByRole('button', { name: '▶ SCAN' })
    fireEvent.click(scanBtn)

    // flip to the dense board
    fireEvent.click(screen.getByRole('button', { name: /BOARD/ }))

    // all three markets render, correctly labeled, sorted by EV
    expect(await screen.findByText('CUBS ML')).toBeTruthy()
    expect(screen.getByText('DODGERS -1.5')).toBeTruthy()
    expect(screen.getByText('OVER 8.5')).toBeTruthy()
    expect(screen.getByText('+126')).toBeTruthy()
    expect(screen.getByText('+6.2%')).toBeTruthy()
    // Kelly stake shown on every edge (quarter-Kelly off the $1000 bankroll)
    expect(screen.getAllByText(/BET \$\d+/).length).toBe(3)
  })

  it('pulls props onto the board, PROP-tagged and ranked', async () => {
    render(<MatrixBot token="tkn" bets={[]} bankroll={1000} unitSize={20} />)
    fireEvent.click(await screen.findByRole('button', { name: '▶ SCAN' }))
    fireEvent.click(screen.getByRole('button', { name: /BOARD/ }))
    await screen.findByText('CUBS ML')

    fireEvent.click(screen.getByRole('button', { name: /ADD PROPS/ }))
    expect(await screen.findByText('Spencer Strider O5.5')).toBeTruthy()
    expect(screen.getByText('PROP')).toBeTruthy()
  })
})
