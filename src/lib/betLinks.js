// Affiliate-ready bet-link wrapper. Today it's a passthrough so we ship deep-links now;
// when affiliate deals exist, add per-book params here in ONE place (no UI rework).
const AFFILIATE = {}   // e.g. { draftkings: (url) => `${url}?wpcid=RML` }

export function decorate(book, url) {
  if (!url) return null
  const fn = AFFILIATE[book]
  return fn ? fn(url) : url
}
