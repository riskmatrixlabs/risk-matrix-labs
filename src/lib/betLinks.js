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

// Book homepages — fallback "Place" target when a book has no deep bet-slip link.
export const BOOK_HOME = {
  draftkings: 'https://sportsbook.draftkings.com/', fanduel: 'https://sportsbook.fanduel.com/',
  betmgm: 'https://sports.betmgm.com/', caesars: 'https://www.caesars.com/sportsbook-and-casino',
  williamhill_us: 'https://www.caesars.com/sportsbook-and-casino', espnbet: 'https://espnbet.com/',
  fanatics: 'https://sportsbook.fanatics.com/', betrivers: 'https://betrivers.com/',
  hardrockbet: 'https://app.hardrock.bet/', ballybet: 'https://play.ballybet.com/',
  betparx: 'https://www.betparx.com/', fliff: 'https://www.getfliff.com/', pinnacle: 'https://www.pinnacle.com/',
  novig: 'https://novig.us/', prophetx: 'https://prophetx.co/', rebet: 'https://www.rebet.app/', onyxodds: 'https://onyxodds.com/',
}
// Best place-link for a book: a real bet-slip deep link if the feed gave us one (decorated for
// affiliate), else the book's OneLink/referral (deep-opens the app + credits the referral),
// else the plain homepage. So "place on Hard Rock" opens the HR app via the owner's OneLink.
export function placeLink(book, deepLink) {
  return decorate(book, deepLink) || SIGNUP_LINKS[book] || BOOK_HOME[book] || null
}
