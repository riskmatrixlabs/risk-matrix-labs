import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
export const signUpEmail = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signInEmail = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signInGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

export const signOut = () => supabase.auth.signOut()

export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

export const updatePassword = (newPassword) =>
  supabase.auth.updateUser({ password: newPassword })

export const getSession = () => supabase.auth.getSession()

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────

// Bets
export const fetchBets = (userId) =>
  supabase.from('bets').select('*').eq('user_id', userId).order('date', { ascending: true })

export const upsertBet = (bet, userId) =>
  supabase.from('bets').upsert({ ...betToRow(bet, userId) }, { onConflict: 'client_id,user_id' })

export const deleteBet = (clientId, userId) =>
  supabase.from('bets').delete().eq('client_id', String(clientId)).eq('user_id', userId)

export const deleteAllBets = (userId) =>
  supabase.from('bets').delete().eq('user_id', userId)

export const syncAllBets = (bets, userId) =>
  supabase.from('bets').upsert(
    bets.map(b => betToRow(b, userId)),
    { onConflict: 'client_id,user_id' }
  )

// Settings / session state
export const fetchSettings = (userId) =>
  supabase.from('user_settings').select('*').eq('user_id', userId).single()

export const upsertSettings = (userId, data) =>
  supabase.from('user_settings').upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

// Templates
export const fetchTemplates = (userId) =>
  supabase.from('templates').select('*').eq('user_id', userId).order('created_at', { ascending: false })

export const upsertTemplate = (template, userId) =>
  supabase.from('templates').upsert({ ...template, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'name,user_id' })

export const deleteTemplate = (name, userId) =>
  supabase.from('templates').delete().eq('name', name).eq('user_id', userId)

// ─── ROW TRANSFORMERS ─────────────────────────────────────────────────────────
export function betToRow(bet, userId) {
  return {
    client_id:    String(bet.id),
    user_id:      userId,
    date:         bet.date         || null,
    sport:        bet.sport        || null,
    book:         bet.book         || null,
    bet_type:     bet.betType      || 'Straight',
    event:        bet.event        || null,
    pick:         bet.pick         || null,
    odds:         bet.odds         ?? 0,
    units:        bet.units        ?? 0,
    stake:        bet.stake        ?? 0,
    result:       bet.result       || 'Open',
    pnl:          bet.pnl          ?? 0,
    ladder:       bet.ladder       ?? false,
    ladder_id:    bet.ladderId     ?? null,
    pull:         bet.pull         ?? false,
    pull_note:    bet.pullNote     || null,
    notes:        bet.notes        || null,
    updated_at:   new Date().toISOString(),
  }
}

export function rowToBet(row) {
  return {
    id:       row.client_id,
    date:     row.date,
    sport:    row.sport,
    book:     row.book,
    betType:  row.bet_type,
    event:    row.event,
    pick:     row.pick,
    odds:     row.odds,
    units:    row.units,
    stake:    row.stake,
    result:   row.result,
    pnl:      row.pnl,
    ladder:   row.ladder,
    ladderId: row.ladder_id,
    pull:     row.pull,
    pullNote: row.pull_note,
    notes:    row.notes,
  }
}
