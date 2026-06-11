import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

function getClients() {
  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
  return { stripe, supabase }
}

/**
 * Fallback: look up subscription in Stripe by email,
 * write it to Supabase if found, return status.
 * Called client-side when getSubscription finds no DB record.
 * Requires valid JWT — identity comes from token, not body.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify caller — use their verified identity, never trust body values
  const user = await requireAuth(req, res)
  if (!user) return

  const userId = user.id
  const email  = req.body?.email || user.email  // allow alt email for cross-email lookup, but write only to verified user.id

  try {
    const { stripe, supabase } = getClients()

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer  = customers.data[0]
    if (!customer) return res.status(200).json({ active: false })

    // Get their subscriptions — prefer active/trialing over canceled
    const [activeSubs, allSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'active' }),
      stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'trialing' }),
    ])
    const sub = activeSubs.data[0] || allSubs.data[0] || (
      await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' })
    ).data[0]
    if (!sub) return res.status(200).json({ active: false })

    const active = ['active', 'trialing'].includes(sub.status)

    // Sync to Supabase so future lookups work
    const { error: upsertErr } = await supabase.from('subscriptions').upsert(
      {
        user_id:                userId,
        stripe_customer_id:     customer.id,
        stripe_subscription_id: sub.id,
        status:                 sub.status,
        trial_end:              sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_end:     sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at:             new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (upsertErr) console.error('sync-subscription upsert error:', upsertErr)

    return res.status(200).json({ active, status: sub.status })
  } catch (err) {
    console.error('sync-subscription error:', err)
    return res.status(500).json({ error: err.message })
  }
}
