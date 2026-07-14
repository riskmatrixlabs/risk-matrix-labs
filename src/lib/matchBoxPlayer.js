// Robust player-name matcher for grading props against an ESPN box-score map.
//
// THE BUG THIS FIXES: prop grading looked up `boxMap[norm(playerName)]` where norm only stripped
// accents. But the prop feed strips SUFFIXES ("Vladimir Guerrero" vs box "Vladimir Guerrero Jr.")
// and HYPHENS ("kurodagrauer" vs box "kuroda-grauer") and PERIODS ("aj pollock" vs "a.j. pollock").
// So the keys never matched → the player's stat resolved to null → the prop sat ungraded forever
// (~⅔ of the PHLT grading gap). We reconcile by normalizing BOTH sides harder and matching the
// FULL name only — we never guess across a shared last name (that would mis-grade).

const SUFFIX_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])

// Lowercase, strip accents + punctuation (periods/apostrophes/hyphens), drop trailing generational
// suffix tokens, collapse whitespace.
export function normName(s) {
  const base = String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // accents
    .replace(/[.'`’\-]/g, '')                           // periods, apostrophes, hyphens
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return ''
  const toks = base.split(' ')
  while (toks.length > 1 && SUFFIX_TOKENS.has(toks[toks.length - 1])) toks.pop()
  return toks.join(' ')
}

// Return the box-score stats object for `propName`, or null if no confident full-name match.
export function matchBoxPlayer(propName, boxMap) {
  if (!boxMap) return null
  const target = normName(propName)
  if (!target) return null
  for (const k of Object.keys(boxMap)) {
    if (normName(k) === target) return boxMap[k]
  }
  return null
}

// True if a confident match exists — used to tell a genuine DNP (absent from a FINAL box) from a
// transient miss, so a DNP prop can be voided instead of sitting ungraded forever.
export function playerInBox(propName, boxMap) {
  return matchBoxPlayer(propName, boxMap) != null
}

// True if ANY box player shares this player's normalized last name. When a full-name match fails
// but the last name IS present, it's likely a matcher gap (same player, odd format) → we must NOT
// void it (don't guess). Only when the last name is entirely absent are we confident it's a DNP.
export function lastNameInBox(propName, boxMap) {
  if (!boxMap) return false
  const last = normName(propName).split(' ').pop()
  if (!last) return false
  for (const k of Object.keys(boxMap)) {
    if (normName(k).split(' ').pop() === last) return true
  }
  return false
}
