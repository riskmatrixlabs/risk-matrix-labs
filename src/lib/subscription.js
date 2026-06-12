import { supabase } from './supabase'

const OWNER_EMAIL = 'michaeltejeda08@gmail.com'

/**
 * Returns subscription status for the current user.
 * 1. Checks Supabase subscriptions table by user_id (fast)
 * 2. If not found, calls /api/sync-subscription to look up by email in Stripe,
 *    sync the record to Supabase, and return the result.
 */
export async function getSubscription(user, token) {
  if (!user) return { active: false, sub: null }

  // Owner always gets in
  if (user.email === OWNER_EMAIL) return { active: true, sub: null, owner: true }

  // 1. Fast path — check Supabase
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!error && data) {
    const active = ['active', 'trialing'].includes(data.status)
    return { active, sub: data }
  }

  // 2. Fallback — sync from Stripe by email (8s timeout to prevent infinite loading)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch('/api/sync-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) },
      body: JSON.stringify({ email: user.email }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const result = await res.json()
    return { active: result.active ?? false, sub: null }
  } catch {
    return { active: false, sub: null }
  }
}
