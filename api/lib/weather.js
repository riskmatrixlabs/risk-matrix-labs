const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

export function degToCompass(deg) {
  return COMPASS[Math.round(Number(deg) / 22.5) % 16]
}

// Pure: pick the forecast values for the game's hour (UTC). Falls back to first hour.
export function pickHour(hourly, gameStartIso) {
  const times = hourly?.time ?? []
  if (!times.length) return null
  const target = String(gameStartIso).slice(0, 13)
  let idx = times.findIndex(t => String(t).slice(0, 13) === target)
  if (idx < 0) idx = 0
  return {
    tempF: Math.round(hourly.temperature_2m?.[idx]),
    windMph: Math.round(hourly.wind_speed_10m?.[idx]),
    windDir: degToCompass(hourly.wind_direction_10m?.[idx] ?? 0),
    windDeg: hourly.wind_direction_10m?.[idx] ?? null,   // raw met degrees (wind FROM) for windPark.js
    precipPct: hourly.precipitation_probability?.[idx] ?? null,
    humidityPct: hourly.relative_humidity_2m?.[idx] ?? null,
    feelsF: hourly.apparent_temperature?.[idx] != null ? Math.round(hourly.apparent_temperature[idx]) : null,
  }
}

// Open-Meteo free geocoding (no key). City name is enough; state ignored by the API but kept for clarity.
export async function geocode(city) {
  if (!city) return null
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
    if (!r.ok) return null
    const j = await r.json()
    const m = j.results?.[0]
    return m ? { lat: m.latitude, lon: m.longitude } : null
  } catch { return null }
}

// Open-Meteo free hourly forecast (no key) → values at the game hour.
export async function fetchWeather(lat, lon, gameStartIso) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2`
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json()
    return pickHour(j.hourly, gameStartIso)
  } catch { return null }
}
