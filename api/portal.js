import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify caller — derive customerId from their own subscription row, never trust body
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    )

    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (error || !sub?.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found' })
    }

    const returnUrl = req.body?.returnUrl || req.headers.origin || 'https://app.riskmatrixlabs.com'

    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: returnUrl,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Portal error:', err)
    res.status(500).json({ error: err.message })
  }
}
