// Provider registry — the swap point. The whole app fetches odds through getProvider();
// switching vendors (OddsPapi, SportsGameOdds, …) = add an adapter file + flip ODDS_PROVIDER.
// Every adapter exports the same contract: NAME, SPORT_KEYS, fetchOdds({sport,markets,regions,apiKey}).
import * as theOddsApi from './theOddsApi.js'

const PROVIDERS = {
  theOddsApi,
  // oddspapi:        (add adapter, same contract)
  // sportsGameOdds:  (add adapter, same contract)
}

export function getProvider(name = process.env.ODDS_PROVIDER || 'theOddsApi') {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown odds provider "${name}". Known: ${Object.keys(PROVIDERS).join(', ')}`)
  return p
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS)
