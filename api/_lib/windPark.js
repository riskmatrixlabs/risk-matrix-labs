// windPark.js — wind direction relative to ballpark → run delta for the MLB O/U model.
// The strongest free "under" signal: wind blowing IN toward home plate suppresses runs (under),
// wind blowing OUT to center field carries balls (over). Pure, no I/O. Free.
//
// PARK_CF_AZIMUTH: home-plate → center-field compass bearing (degrees, 0=N, 90=E) for all 30 parks.
// Derived from each park's field orientation (public dataset). Values are approximate (±~10°),
// which is plenty for an out/in component since only the cosine projection matters.
export const PARK_CF_AZIMUTH = {
  ARI: 0,    // Chase Field — CF ~ due N
  ATL: 50,   // Truist Park
  BAL: 33,   // Camden Yards
  BOS: 45,   // Fenway Park
  CHC: 30,   // Wrigley Field
  CWS: 38,   // Guaranteed Rate Field
  CHW: 38,   // alias
  CIN: 28,   // Great American Ball Park
  CLE: 0,    // Progressive Field — CF ~ due N
  COL: 0,    // Coors Field — CF ~ due N
  DET: 25,   // Comerica Park
  HOU: 20,   // Minute Maid Park (retractable)
  KC:  10,   // Kauffman Stadium
  LAA: 38,   // Angel Stadium
  LAD: 22,   // Dodger Stadium
  MIA: 40,   // loanDepot park (retractable)
  MIL: 30,   // American Family Field (retractable)
  MIN: 80,   // Target Field
  NYM: 25,   // Citi Field
  NYY: 10,   // Yankee Stadium
  ATH: 60,   // Athletics (Sacramento / Sutter Health)
  OAK: 60,   // Oakland Coliseum
  PHI: 15,   // Citizens Bank Park
  PIT: 60,   // PNC Park
  SD:  0,    // Petco Park — CF ~ due N
  SF:  85,   // Oracle Park — CF ~ due E (toward the bay)
  SEA: 0,    // T-Mobile Park (retractable)
  STL: 65,   // Busch Stadium
  TB:  60,   // Tropicana Field (fixed dome — neutralized anyway)
  TEX: 30,   // Globe Life Field (retractable)
  TOR: 0,    // Rogers Centre (retractable)
  WSH: 30,   // Nationals Park
}

const DEG2RAD = Math.PI / 180
const RUNS_PER_MPH = 0.04   // gentle: ~12mph dead-out ≈ +0.48 runs
const CAP = 0.8             // ±0.8 runs max
const NEGLIGIBLE_MPH = 5    // |component| under this → no signal

// windParkDelta({ parkAbbr, windSpeedMph, windDirDeg, isDome }) → { delta, reason }
// windDirDeg = met direction the wind comes FROM (open-meteo wind_direction_10m).
// delta in RUNS: positive = wind out (over), negative = wind in (under). Dome/closed → 0.
export function windParkDelta({ parkAbbr, windSpeedMph, windDirDeg, isDome } = {}) {
  if (isDome) return { delta: 0, reason: null }
  const az = PARK_CF_AZIMUTH[String(parkAbbr || '').toUpperCase()]
  if (az == null || !Number.isFinite(windSpeedMph) || !Number.isFinite(windDirDeg) || windSpeedMph <= 0) {
    return { delta: 0, reason: null }
  }
  // Direction the wind is blowing TOWARD, then project onto the home-plate→CF axis.
  const blowingToward = (windDirDeg + 180) % 360
  const component = Math.cos((blowingToward - az) * DEG2RAD) * windSpeedMph
  if (Math.abs(component) < NEGLIGIBLE_MPH) return { delta: 0, reason: null }

  const raw = component * RUNS_PER_MPH
  const delta = Math.max(-CAP, Math.min(CAP, raw))
  const mph = Math.round(Math.abs(component))
  const reason = component > 0 ? `wind out ${mph}mph (over)` : `wind in ${mph}mph (under)`
  return { delta, reason }
}

export default windParkDelta
