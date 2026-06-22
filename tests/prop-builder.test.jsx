// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import PropBuilder from '../src/components/PropBuilder.jsx'

const MATCH = { player: 'Aaron Judge', id: '33192', headshot: '', team: 'NYY',
  game: { away: 'Cincinnati Reds', home: 'New York Yankees', away_abbr: 'CIN', home_abbr: 'NYY', external_event_id: '401111' } }

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/api/player-search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [MATCH] }) })
    if (String(url).includes('/api/player-stats'))  return Promise.resolve({ ok: true, json: () => Promise.resolve({ found: false }) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('PropBuilder — player search', () => {
  it('searches on typing and resolves the event when a player is picked', async () => {
    const onChange = vi.fn()
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => expect(screen.getByText('Aaron Judge')).toBeTruthy())
    fireEvent.click(screen.getByText('Aaron Judge'))
    await waitFor(() => expect(screen.getByText(/Cincinnati Reds vs New York Yankees/i)).toBeTruthy())
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('PropBuilder — completing the prop', () => {
  it('offers only trackable stats and emits the full prop when complete', async () => {
    const onChange = vi.fn()
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => screen.getByText('Aaron Judge'))
    fireEvent.click(screen.getByText('Aaron Judge'))
    await waitFor(() => screen.getByText(/auto-matched/i))
    const select = screen.getByLabelText(/stat/i)
    const opts = [...select.querySelectorAll('option')].map(o => o.textContent)
    expect(opts).toContain('Hits')
    expect(opts).not.toContain('Total Bases')
    fireEvent.change(select, { target: { value: 'Hits' } })
    fireEvent.change(screen.getByPlaceholderText(/line/i), { target: { value: '1.5' } })
    fireEvent.change(screen.getByPlaceholderText(/odds/i), { target: { value: '-120' } })
    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)[0]
      expect(last).toMatchObject({ pick: 'Aaron Judge Over 1.5 Hits', odds: -120, line: 1.5 })
    })
  })
})

describe('PropBuilder — free stat context', () => {
  it('shows season per-game for the chosen stat from player-stats', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/player-search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [MATCH] }) })
      if (String(url).includes('/api/player-stats'))  return Promise.resolve({ ok: true, json: () => Promise.resolve({ found: true, games: 10, last5games: 5, season: [{ label: 'H', value: 12 }], last5: [{ label: 'H', value: 7 }] }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    render(<PropBuilder sport="MLB" game={null} token="t" onChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'judge' } })
    await waitFor(() => screen.getByText('Aaron Judge'))
    fireEvent.click(screen.getByText('Aaron Judge'))
    await waitFor(() => screen.getByLabelText(/stat/i))
    fireEvent.change(screen.getByLabelText(/stat/i), { target: { value: 'Hits' } })
    await waitFor(() => expect(screen.getByText(/1\.2/)).toBeTruthy())
  })
})

describe('PropBuilder — inline onChange parent does not loop', () => {
  it('renders under a parent passing a new onChange identity each render without crashing', async () => {
    function Parent() {
      // mirrors the LOG BET modal: every onChange stores a fresh object,
      // forcing a re-render → a new inline onChange identity each render.
      const [, setProp] = React.useState(null)
      // inline arrow → new identity every render; must not infinite-loop
      return <PropBuilder sport="MLB" game={null} token="t" onChange={(p) => setProp({ p })} />
    }
    expect(() => render(<Parent />)).not.toThrow()
    // let effects settle
    await waitFor(() => expect(screen.getByPlaceholderText(/search player/i)).toBeTruthy())
  })
})
