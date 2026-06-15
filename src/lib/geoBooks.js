// Geo-aware book availability — show operators the books they can actually use where they
// live (Pikkit-style). Best-effort map for 2025; the user can override their state and there's
// always a "show all" escape hatch, so an imperfect entry never traps anyone.

// Regulated online sportsbooks we track that are broadly available in legal-online states.
export const REGULATED = ['draftkings', 'fanduel', 'betmgm', 'williamhill_us', 'espnbet', 'betrivers', 'fanatics', 'hardrockbet', 'ballybet', 'betparx', 'fliff']

// Offshore / grey-market books — operate regardless of state law (shown everywhere, tagged).
export const OFFSHORE = ['bovada', 'betonlineag', 'betus', 'mybookieag', 'lowvig']

// Exchanges / sweepstakes / DFS-style apps (Novig, ProphetX, Fliff, Rebet, Onyx) — operate
// broadly nationwide, including DFS-only and single-operator states like FL. Placeable everywhere.
export const NATIONWIDE = ['novig', 'prophetx', 'fliff', 'rebet', 'onyxodds']

// States with NO full legal online sportsbook → regulated list is empty; users rely on
// DFS pick'em (PrizePicks/Underdog/Dabble), the Novig exchange, or offshore (sign-up links).
const DFS_ONLY = new Set(['CA', 'TX', 'GA', 'MN', 'MO', 'AL', 'AK', 'OK', 'UT', 'ID', 'HI', 'SC', 'NM'])

// Limited / special single-operator markets.
const SPECIAL = {
  FL: ['hardrockbet'],                          // Hard Rock is FL's lone legal mobile book
  NV: ['williamhill_us', 'betmgm', 'betrivers'],// in-person heavy; a few apps
}

// Which tracked sportsbooks are usable in a state. null = unknown → caller shows all.
export function booksForState(state) {
  if (!state) return null
  const st = String(state).toUpperCase()
  if (SPECIAL[st]) return SPECIAL[st]
  if (DFS_ONLY.has(st)) return []
  return REGULATED
}

// DFS / exchange sign-up suggestions per state (referral keys → betLinks.SIGNUP_LINKS).
export function signupSuggestionsForState(state) {
  const st = String(state || '').toUpperCase()
  if (st === 'FL') return ['hardrockbet', 'prizepicks', 'underdog', 'novig']
  if (DFS_ONLY.has(st)) return ['prizepicks', 'underdog', 'dabble', 'novig']
  return ['prizepicks', 'underdog', 'novig']   // DFS/exchange everywhere as extra options
}

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

// Rough timezone → default state guess (only to pre-fill the picker; user can change it).
export function guessState() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const map = {
      'America/New_York': 'NY', 'America/Detroit': 'MI', 'America/Chicago': 'IL',
      'America/Denver': 'CO', 'America/Phoenix': 'AZ', 'America/Los_Angeles': 'CA',
      'America/Indiana/Indianapolis': 'IN', 'America/Boise': 'ID',
    }
    return map[tz] || null
  } catch { return null }
}
