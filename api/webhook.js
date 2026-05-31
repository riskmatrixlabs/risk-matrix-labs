import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendWelcome, sendPaymentFailed, sendSubscriptionActivated } from './lib/emails.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Disable body parsing — Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } }

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function planFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_BETA_MONTHLY]: 'beta_monthly',
    [process.env.STRIPE_PRICE_BETA_YEARLY]:  'beta_yearly',
    [process.env.STRIPE_PRICE_PRO_MONTHLY]:  'pro_monthly',
    [process.env.STRIPE_PRICE_PRO_YEARLY]:   'pro_yearly',
  }
  return map[priceId] || 'unknown'
}

async function upsertSubscription(userId, data) {
  await supabase.from('subscriptions').upsert(
    { user_id: userId, ...data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig     = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const obj = event.data.object

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = obj.metadata?.supabase_user_id
      if (!userId) break
      await upsertSubscription(userId, {
        stripe_customer_id:      obj.customer,
        stripe_subscription_id:  obj.subscription,
        status: 'trialing',
      })
      if (obj.customer_email) {
        await sendWelcome({ email: obj.customer_email }).catch(console.error)
      }
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const userId = obj.metadata?.supabase_user_id
      if (!userId) break
      const priceId = obj.items?.data?.[0]?.price?.id
      const plan    = planFromPriceId(priceId)

      // Detect trial → active conversion
      const prevStatus = event.data.previous_attributes?.status
      if (prevStatus === 'trialing' && obj.status === 'active') {
        const customer = await stripe.customers.retrieve(obj.customer)
        if (customer.email) {
          await sendSubscriptionActivated({ email: customer.email, plan }).catch(console.error)
        }
      }

      await upsertSubscription(userId, {
        stripe_customer_id:     obj.customer,
        stripe_subscription_id: obj.id,
        status:                 obj.status,
        plan,
        trial_end:              obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
        current_period_end:     new Date(obj.current_period_end * 1000).toISOString(),
      })
      break
    }

    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.supabase_user_id
      if (!userId) break
      await upsertSubscription(userId, {
        stripe_customer_id:     obj.customer,
        stripe_subscription_id: obj.id,
        status: 'canceled',
        current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
      })
      break
    }

    case 'invoice.payment_failed': {
      const sub = await stripe.subscriptions.retrieve(obj.subscription)
      const userId = sub.metadata?.supabase_user_id
      if (!userId) break
      await upsertSubscription(userId, {
        stripe_customer_id:     obj.customer,
        stripe_subscription_id: obj.subscription,
        status: 'past_due',
      })
      if (obj.customer_email) {
        await sendPaymentFailed({ email: obj.customer_email }).catch(console.error)
      }
      break
    }
  }

  res.status(200).json({ received: true })
}
