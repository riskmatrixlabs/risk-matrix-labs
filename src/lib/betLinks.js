// Affiliate-ready bet-link wrapper. Today it's a passthrough so we ship deep-links now;
// when affiliate deals exist, add per-book params here in ONE place (no UI rework).
const AFFILIATE = {}   // e.g. { draftkings: (url) => `${url}?wpcid=RML` }

export function decorate(book, url) {
  if (!url) return null
  const fn = AFFILIATE[book]
  return fn ? fn(url) : url
}

// SIGN-UP / referral links — shown to operators who don't have a book yet (or for books our
// odds feed can't carry: Novig exchange + DFS pick'em). These are the owner's personal links.
export const SIGNUP_LINKS = {
  draftkings:  'https://sportsbook.draftkings.com/',
  fanduel:     'https://www.fanduel.com/',
  hardrockbet: 'https://hrb.onelink.me/aSsa/wivdtm1p',
  novig:       'https://novig.onelink.me/JHQQ/gbyrfj1h',   // code 10DE9E — exchange, not in odds feed
  underdog:    'https://play.underdogsports.com/vgwg/zmkci4hi',
  dabble:      'https://click.dabble.com/GaFA/dkhs5uxp',
  prizepicks:  'https://prizepicks.onelink.me/FjtC/zc8vfibx',
  onyx:        'https://onyxodds.com/?promo_code=KK762673',
}

// Display names for the sign-up CTAs (incl. DFS/exchange apps not in the odds feed).
export const SIGNUP_NAMES = {
  draftkings: 'DraftKings', fanduel: 'FanDuel', hardrockbet: 'Hard Rock',
  novig: 'Novig', underdog: 'Underdog', dabble: 'Dabble', prizepicks: 'PrizePicks', onyx: 'Onyx Odds',
}

export function signupLink(book) {
  return SIGNUP_LINKS[book] || null
}
