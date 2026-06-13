// In-memory cache of scan results so re-selecting a sport (same day) never re-charges
// API credits. Lives for the page session; cleared on reload (a fresh day = fresh key
// anyway). The credit guard the owner asked for: zero redundant calls.
const store = new Map()

export const cacheKey = (sport, date) => `${sport}:${date}`

export function getScan(sport, date) {
  return store.has(cacheKey(sport, date)) ? store.get(cacheKey(sport, date)) : null
}

export function putScan(sport, date, payload) {
  store.set(cacheKey(sport, date), payload)
}

export function clearScanCache() {
  store.clear()
}
