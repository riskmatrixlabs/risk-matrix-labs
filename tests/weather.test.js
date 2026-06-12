import { describe, it, expect, vi, afterEach } from 'vitest'
import { pickHour, degToCompass, geocode, fetchWeather } from '../api/lib/weather.js'

const hourly = {
  time: ['2026-06-12T18:00', '2026-06-12T19:00', '2026-06-12T20:00'],
  temperature_2m: [78, 80, 79],
  precipitation_probability: [10, 15, 20],
  wind_speed_10m: [8, 10, 12],
  wind_direction_10m: [270, 283, 0],
}

describe('degToCompass', () => {
  it('maps degrees to 16-point compass', () => {
    expect(degToCompass(0)).toBe('N')
    expect(degToCompass(90)).toBe('E')
    expect(degToCompass(180)).toBe('S')
    expect(degToCompass(270)).toBe('W')
    expect(degToCompass(283)).toBe('WNW')
  })
})

describe('pickHour', () => {
  it('picks the matching game hour', () => {
    expect(pickHour(hourly, '2026-06-12T19:40Z')).toEqual({ tempF: 80, windMph: 10, windDir: 'WNW', precipPct: 15 })
  })
  it('falls back to first hour if no match', () => {
    expect(pickHour(hourly, '2026-06-13T05:00Z')).toEqual({ tempF: 78, windMph: 8, windDir: 'W', precipPct: 10 })
  })
  it('returns null for empty hourly', () => {
    expect(pickHour({ time: [] }, '2026-06-12T19:00Z')).toBeNull()
    expect(pickHour(null, '2026-06-12T19:00Z')).toBeNull()
  })
})

describe('geocode', () => {
  afterEach(() => vi.restoreAllMocks())
  it('returns lat/lon for a city', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ latitude: 40.44, longitude: -79.99 }] }) })
    expect(await geocode('Pittsburgh', 'Pennsylvania')).toEqual({ lat: 40.44, lon: -79.99 })
  })
  it('returns null when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    expect(await geocode('Nowhere')).toBeNull()
  })
})

describe('fetchWeather', () => {
  afterEach(() => vi.restoreAllMocks())
  it('fetches forecast and picks the game hour', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly }) })
    expect(await fetchWeather(40.44, -79.99, '2026-06-12T19:40Z')).toEqual({ tempF: 80, windMph: 10, windDir: 'WNW', precipPct: 15 })
  })
})
