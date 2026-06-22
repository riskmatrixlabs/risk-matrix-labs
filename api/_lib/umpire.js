// Home-plate UMPIRE signal for the MLB O/U model — FREE (MLB Stats API, zero Odds-API credits).
//
// THEORY: the home-plate umpire's strike-zone size is a real, modest run-scoring signal.
//   - WIDE zone  → more called strikes → more strikeouts, fewer walks → fewer baserunners → UNDER
//   - TIGHT zone → fewer called strikes → more walks, deeper counts → more offense → OVER
// Across the documented extremes (most pitcher-friendly vs most hitter-friendly ump) the swing is
// roughly ~0.5 runs/game. We model the umpire as a SMALL signal and CAP the delta at ±0.4 runs so
// it nudges, never dominates, the lean (bullpen ERA + park + weather remain the primary drivers).
//
// DATA — two pieces:
//   1. WHICH ump? — FREE from MLB Stats API boxscore: /api/v1/game/{gamePk}/boxscore → `officials[]`,
//      filter official.officialType === "Home Plate". NOTE: officials are only populated AFTER the
//      lineup card is posted (~a few hours pre-first-pitch). Before that the array is empty → we
//      return { delta: 0, reason: null } and degrade gracefully (no fabricated signal).
//   2. HOW does that ump lean? — a STATIC SEED TABLE (UMP_TENDENCY) of well-known MLB plate umpires
//      with their documented over/under tendency. This is a COARSE, hand-seeded table built from
//      PUBLIC umpire-tendency commentary (career over% / boost-runs reputation). It is NOT a live
//      per-ump runs/game feed.
//
// HONEST CAVEAT (documented per spec): the clean, continuously-updated per-umpire runs/game and
// strike-zone metrics live behind PAID feeds (e.g. UmpScorecards' Patreon, and similar
// subscription data). We do NOT have that here. UMP_TENDENCY is a name-matched approximation only:
//   - it is static (does not update as an ump's season evolves),
//   - it covers ~30 names, not the full ~76-ump roster (unknown ump → delta 0),
//   - tendencies are bucketed (strong/mild over/under), not exact runs/game.
// Treat this as a directional nudge, not a precise number. When a real per-ump feed is wired in,
// replace UMP_TENDENCY lookups with the feed and keep umpireDelta()'s shape.

import { readScan, writeScan, isFresh, todayStr } from './scanStore.js'

// Cap so the umpire is a modest nudge, not a driver. ~0.5-run swing across extremes → ±0.4 cap.
export const UMP_DELTA_CAP = 0.4

// Tendency buckets → run delta. Negative = under (wide/pitcher-friendly zone), positive = over
// (tight/hitter-friendly zone). Magnitudes scale strong > mild and stay within the cap.
const TENDENCY_DELTA = {
  strong_under: -0.35,
  under:        -0.20,
  mild_under:   -0.10,
  neutral:       0.00,
  mild_over:     0.10,
  over:          0.20,
  strong_over:   0.35,
}

// STATIC SEED TABLE — ~30 well-known MLB home-plate umpires keyed by normalized name, with a
// documented over/under lean bucket. Hand-seeded from public umpire-tendency reputation
// (career over% / runs-boost commentary). COARSE + STATIC — see caveat above. Unknown ump → 0.
//
// Naming: keys are lowercased, trimmed, accents/punctuation stripped (see normName) so feed names
// like "Ángel Hernández" or "C.B. Bucknor" still match.
export const UMP_TENDENCY = {
  // --- Lean OVER (tight zone / hitter-friendly reputation) ---
  'angel hernandez':   'strong_over',
  'doug eddings':      'over',
  'cb bucknor':        'over',
  'phil cuzzi':        'over',
  'laz diaz':          'over',
  'hunter wendelstedt':'mild_over',
  'dan bellino':       'mild_over',
  'nic lentz':         'mild_over',
  'ryan additon':      'mild_over',
  'mark carlson':      'over',
  'chris guccione':    'mild_over',
  'tripp gibson':      'mild_over',
  'jordan baker':      'mild_over',
  'alan porter':       'mild_over',

  // --- Lean UNDER (wide zone / pitcher-friendly reputation) ---
  'pat hoberg':        'strong_under',
  'will little':       'under',
  'john libka':        'under',
  'jansen visconti':   'under',
  'edwin moscoso':     'mild_under',
  'ben may':           'under',
  'lance barksdale':   'mild_under',
  'adam hamari':       'mild_under',
  'james hoye':        'mild_under',
  'quinn wolcott':     'under',
  'vic carapazza':     'mild_under',
  'ryan blakney':      'mild_under',
  'sean barber':       'mild_under',
  'mike muchlinski':   'under',

  // --- Roughly even ---
  'joe west':          'neutral',
  'ted barrett':       'neutral',
  'bill miller':       'neutral',
  'marvin hudson':     'neutral',
}

// Normalize a name for table lookup: lowercase, strip accents, drop dots/commas/apostrophes,
// collapse whitespace. ("Á. Hernández" → "a hernandez", "C.B. Bucknor" → "cb bucknor").
export function normName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[.,'`]/g, '')                            // drop punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// PURE core — unit-tested, no I/O. Given an umpire name and/or an explicit tendency bucket,
// return { delta (runs, capped), reason }.
//   - Pass `tendency` to bypass the table (e.g. when a real feed supplies the bucket).
//   - Else we look `umpName` up in UMP_TENDENCY.
//   - Unknown / missing / neutral → { delta: 0, reason: null }.
export function umpireDelta({ umpName, tendency } = {}) {
  const bucket = tendency || (umpName ? UMP_TENDENCY[normName(umpName)] : null)
  if (!bucket || bucket === 'neutral' || !(bucket in TENDENCY_DELTA)) {
    return { delta: 0, reason: null }
  }
  let delta = TENDENCY_DELTA[bucket]
  // Hard cap (defensive — table values are already within range).
  delta = Math.max(-UMP_DELTA_CAP, Math.min(UMP_DELTA_CAP, delta))
  if (delta === 0) return { delta: 0, reason: null }
  const reason = delta < 0 ? 'wide-zone ump (under)' : 'hitter-friendly ump (over)'
  return { delta, reason }
}

// Internal: same fetch pattern as api/game-info.js (timeout + try/catch, returns null on failure).
async function getJson(url, ms = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null }
  catch { return null }
  finally { clearTimeout(timer) }
}

// LOADER — given an MLB Stats API gamePk, fetch the assigned home-plate umpire from the boxscore
// and return the umpire run delta for the O/U model. FREE (statsapi.mlb.com, no key).
//
// Cached ~6h in scan_cache (`UMP-<gamePk>`) — officials don't change once posted, so re-opening a
// game costs zero network. Cache stores the resolved name so a later lineup-post still re-resolves
// quickly. Degrades gracefully at every step:
//   - no gamePk            → { delta: 0, reason: null, umpName: null }
//   - boxscore unreachable  → { delta: 0, reason: null, umpName: null }
//   - officials[] empty (lineups not posted yet) → { delta: 0, reason: null, umpName: null }
//   - ump not in seed table → { delta: 0, reason: null, umpName: <name> }
export async function loadUmpireDelta(gamePk, { ttlMs = 6 * 3600e3 } = {}) {
  const none = (umpName = null) => ({ delta: 0, reason: null, umpName })
  if (!gamePk) return none()

  const date = todayStr()
  const key = `UMP-${gamePk}`
  // Cache hit: re-derive delta from the cached name (cheap, keeps table edits effective).
  const cached = await readScan(key, date)
  if (cached?.payload && isFresh(cached.scanned_at, Date.now(), ttlMs)) {
    const umpName = cached.payload.umpName || null
    if (!umpName) return none()
    return { ...umpireDelta({ umpName }), umpName }
  }

  const box = await getJson(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`, 7000)
  // officials[] is only populated once the lineup card posts → before that, no signal.
  const officials = Array.isArray(box?.officials) ? box.officials : []
  const hp = officials.find(o => o?.officialType === 'Home Plate')
  const umpName = hp?.official?.fullName || null

  // Cache the resolved name (even null → avoid re-hitting a not-yet-posted boxscore for the TTL).
  await writeScan(key, date, { umpName })

  if (!umpName) return none()
  return { ...umpireDelta({ umpName }), umpName }
}
