import { supabase } from './supabase'

const SPORT_LEAGUE = {
  mlb:  'MLB',
  nba:  'NBA',
  nhl:  'NHL',
  nfl:  'NFL',
  wnba: 'WNBA',
}

function mapRow(row) {
  const m = row.metadata ?? {}
  return {
    ...row,
    away_logo:             m.away_logo             ?? null,
    home_logo:             m.home_logo             ?? null,
    odds_spread_away_juice: m.spread_away_juice    ?? null,
    odds_spread_home_juice: m.spread_home_juice    ?? null,
    odds_total_over_juice:  m.over_juice           ?? null,
    odds_total_under_juice: m.under_juice          ?? null,
  }
}

// Returns ET local date string YYYY-MM-DD (not UTC)
function etDate(offsetDays = 0) {
  const now = new Date()
  const etOffset = -4 * 60 // EDT (UTC-4) — adjust to -5 in winter
  const etMs = now.getTime() + etOffset * 60 * 1000 + offsetDays * 86400000
  return new Date(etMs).toISOString().slice(0, 10)
}

/**
 * Fetch events for a given sport and date window.
 * date = 'today' | 'yesterday' | 'upcoming' | ISO date string (YYYY-MM-DD)
 */
export async function fetchEvents(sport, date = 'today') {
  const league = SPORT_LEAGUE[sport?.toLowerCase()]
  if (!league) return { data: [], error: null }

  let query = supabase
    .from('events')
    .select('*')
    .eq('sport', league)
    .order('start_time', { ascending: true })

  // ET day runs 04:00 UTC → next day 03:59:59 UTC (UTC-4)
  function etWindow(etDateStr, nextEtDateStr) {
    return { from: `${etDateStr}T04:00:00Z`, to: `${nextEtDateStr}T03:59:59Z` }
  }

  if (date === 'today') {
    const { from, to } = etWindow(etDate(0), etDate(1))
    query = query.gte('start_time', from).lte('start_time', to)
  } else if (date === 'yesterday') {
    const { from, to } = etWindow(etDate(-1), etDate(0))
    query = query.gte('start_time', from).lte('start_time', to)
  } else if (date === 'upcoming') {
    const { from } = etWindow(etDate(1), etDate(2))
    const { to }   = etWindow(etDate(7), etDate(8))
    query = query.gte('start_time', from).lte('start_time', to).limit(30)
  } else {
    query = query.gte('start_time', `${date}T04:00:00Z`).lte('start_time', `${date}T03:59:59Z`)
  }

  const result = await query
  if (result.data) result.data = result.data.map(mapRow)
  return result
}

export async function fetchEvent(id) {
  return supabase.from('events').select('*').eq('id', id).single()
}

// All in-progress games across every sport (for the "Live" filter tab).
export async function fetchLiveEvents() {
  const result = await supabase
    .from('events')
    .select('*')
    .in('status', ['IP', 'LIVE'])
    .order('start_time', { ascending: true })
  if (result.data) result.data = result.data.map(mapRow)
  return result
}
