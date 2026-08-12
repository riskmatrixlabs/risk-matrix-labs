// Slate selection for the Spotlight SHADOW sections (NFL / NHL / WNBA / NBA).
//
// The bug this fixes: every shadow loop asked fetchEvents(sport, 'today'), so a sport with
// no games TODAY rendered nothing even when its next slate was already synced (owner saw an
// empty NFL section on Wed Aug 12 while 6 NFL games sat in `events` for Thu Aug 13). MLB
// only looked fine because MLB plays every day.
//
// Rule (pure, testable):
//   1. Today's PRE-GAME games (start_time in the future) → show them, no label. Behavior for
//      a sport that DOES have games today is byte-identical to before.
//   2. Otherwise fall back to the 'upcoming' window (src/lib/events.js: tomorrow 04:00Z →
//      +7 days 03:59Z, limit 30) and show ONLY the earliest slate DAY in it, labeled with
//      that date so the owner always knows which slate he is looking at ("THU 8/13").
//   3. Nothing pre-game either way → empty, no label (honest empty section).
//
// Snapshotting on the fallback slate is intentional and stays on: /api/snapshot-lean has its
// own pre-game guard and locks the FIRST pre-game lean per game/day, so locking early is the
// same behavior MLB already has.

const isPreGame = (e, nowMs) => {
  if (!e || !e.away_team || !e.home_team || !e.start_time) return false
  const t = Date.parse(e.start_time)
  return Number.isFinite(t) && t > nowMs
}

// ET calendar date key (YYYY-MM-DD) for a start_time — games are slated by ET day.
export function etDayKey(startTime) {
  const t = Date.parse(startTime)
  if (!Number.isFinite(t)) return null
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(t))
  const get = (type) => p.find((x) => x.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Header suffix for a fallback slate: "THU 8/13" (ET, uppercase, no leading zeros).
export function slateLabel(startTime) {
  const t = Date.parse(startTime)
  if (!Number.isFinite(t)) return ''
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date(t))
  const get = (type) => p.find((x) => x.type === type)?.value
  return `${String(get('weekday') || '').toUpperCase()} ${get('month')}/${get('day')}`
}

// → { games, fallback, label }. `games` are always PRE-GAME only (the shadow loops never
// re-read a lean after kickoff). `label` is '' unless we fell back to a future slate.
export function pickSlate(todayGames, upcomingGames, nowMs = Date.now()) {
  const todayPre = (todayGames || []).filter((e) => isPreGame(e, nowMs))
  if (todayPre.length) return { games: todayPre, fallback: false, label: '' }

  const upPre = (upcomingGames || [])
    .filter((e) => isPreGame(e, nowMs))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
  if (!upPre.length) return { games: [], fallback: false, label: '' }

  const firstDay = etDayKey(upPre[0].start_time)
  const games = upPre.filter((e) => etDayKey(e.start_time) === firstDay)
  return { games, fallback: true, label: slateLabel(upPre[0].start_time) }
}
