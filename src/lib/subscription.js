import { supabase } from './supabase'

const OWNER_EMAIL = 'michaeltejeda08@gmail.com'

/**
 * Returns subscription status for the current user.
 * Returns { active: true } if owner, subscribed, or trialing.
 * Returns { active: false, sub: null } if no subscription or canceled.
 */
export async function getSubscription(user) {
  if (!user) return { active: false, sub: null }

  // Owner always gets in
  if (user.email === OWNER_EMAIL) return { active: true, sub: null, owner: true }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return { active: false, sub: null }

  const active = ['active', 'trialing'].includes(data.status)
  return { active, sub: data }
}
