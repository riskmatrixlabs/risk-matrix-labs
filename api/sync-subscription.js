import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Fallback: look up subscription in Stripe by email,
 * write it to Supabase if found, return status.
 * Called client-side when getSubscription finds no DB record.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId, email } = req.body
  if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email' })

  try {
    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) return res.status(200).json({ active: false })

    // Get their subscriptions
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 1,
      status: 'all',
    })
    const sub = subs.data[0]
    if (!sub) return res.status(200).json({ active: false })

    const active = ['active', 'trialing'].includes(sub.status)

    // Sync to Supabase so future lookups work
    await supabase.from('subscriptions').upsert(
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

    return res.status(200).json({ active, status: sub.status })
  } catch (err) {
    console.error('sync-subscription error:', err)
    return res.status(500).json({ error: err.message })
  }
}
