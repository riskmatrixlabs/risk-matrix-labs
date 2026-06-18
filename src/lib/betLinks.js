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

// Copy text to the clipboard — best-effort and NON-INTRUSIVE.
// CRITICAL: do NOT create/focus/select a hidden <textarea> here. On iOS, grabbing focus inside the
// tap that also follows a book's universal link cancels the app-open and dumps the user on the
// App Store "download" page. The async clipboard API doesn't touch focus, so the book still opens.
// Copy is a bonus; opening the book is the job. Returns true optimistically when the API exists.
export function copyTextSync(text) {
  if (!text) return false
  try { navigator?.clipboard?.writeText?.(text); return true } catch { return false }
}

// No sportsbook exposes a public bet-slip deep-link, so opening a book can't pre-fill the pick.
// Instead we copy the exact pick to the clipboard and THEN open the book, so the operator pastes it
// into the book's search in ~2 seconds. Copy is best-effort — it never blocks the open.
// Returns true if the pick made it onto the clipboard.
export function copyPickAndOpen(pickText, url) {
  const copied = copyTextSync(pickText)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
  return copied
}
