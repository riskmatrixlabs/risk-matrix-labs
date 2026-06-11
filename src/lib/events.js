import { supabase } from './supabase'

const SPORT_LEAGUE = {
  mlb: 'MLB',
  nba: 'NBA',
  nhl: 'NHL',
  nfl: 'NFL',
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

  if (date === 'today') {
    const d = etDate(0)
    query = query.gte('start_time', `${d}T00:00:00Z`).lte('start_time', `${d}T23:59:59Z`)
  } else if (date === 'yesterday') {
    const d = etDate(-1)
    query = query.gte('start_time', `${d}T00:00:00Z`).lte('start_time', `${d}T23:59:59Z`)
  } else if (date === 'upcoming') {
    const from = etDate(1)
    const to   = etDate(7)
    query = query
      .gte('start_time', `${from}T00:00:00Z`)
      .lte('start_time', `${to}T23:59:59Z`)
      .limit(30)
  } else {
    query = query.gte('start_time', `${date}T00:00:00Z`).lte('start_time', `${date}T23:59:59Z`)
  }

  return query
}

export async function fetchEvent(id) {
  return supabase.from('events').select('*').eq('id', id).single()
}
