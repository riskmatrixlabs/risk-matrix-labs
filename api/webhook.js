import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { sendWelcome, sendPaymentFailed, sendSubscriptionActivated, sendWinBack } from './_lib/emails.js'

// Disable body parsing — Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } }

// Lazy init — avoids module-level crash if env vars aren't available on cold start
function getClients() {
  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
  return { stripe, supabase }
}

// Read raw body from request stream — required for Stripe signature verification
// Handles both streaming (standard) and pre-buffered (some runtimes) bodies
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    // If body was already read/buffered by the runtime
    if (req.body) {
      if (Buffer.isBuffer(req.body)) return resolve(req.body)
      if (typeof req.body === 'string') return resolve(Buffer.from(req.body, 'utf8'))
      // Object — re-serialize (last resort, signature will likely fail but won't crash)
      return resolve(Buffer.from(JSON.stringify(req.body), 'utf8'))
    }
    // Stream-based reading
    const chunks = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
    // Safety timeout — resolve with empty buffer after 8s to avoid hanging
    setTimeout(() => resolve(Buffer.concat(chunks)), 8000)
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let stripe, supabase
  try {
    ;({ stripe, supabase } = getClients())
  } catch (initErr) {
    console.error('Webhook init error:', initErr.message)
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const sig     = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature error:', err.message, '| body length:', rawBody?.length, '| sig:', sig?.slice(0, 30))
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log('[webhook] event:', event.type)

  const obj = event.data.object

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = obj.metadata?.supabase_user_id
        console.log('[webhook] checkout.session.completed userId:', userId, 'customer:', obj.customer)
        if (!userId) { console.error('[webhook] No supabase_user_id in metadata'); break }
        const { error } = await supabase.from('subscriptions').upsert(
          { user_id: userId, stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription, status: 'trialing', updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        if (error) console.error('[webhook] upsert error (checkout):', error)
        if (obj.customer_email) {
          await sendWelcome({ email: obj.customer_email }).catch(e => console.error('[webhook] sendWelcome error:', e.message))
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const userId  = obj.metadata?.supabase_user_id
        console.log('[webhook]', event.type, 'userId:', userId, 'status:', obj.status)
        if (!userId) { console.error('[webhook] No supabase_user_id in subscription metadata'); break }
        const priceId = obj.items?.data?.[0]?.price?.id
        const plan    = planFromPriceId(priceId)

        // Trial → active conversion email
        const prevStatus = event.data.previous_attributes?.status
        if (prevStatus === 'trialing' && obj.status === 'active') {
          try {
            const customer = await stripe.customers.retrieve(obj.customer)
            if (customer.email) {
              await sendSubscriptionActivated({ email: customer.email, plan }).catch(e => console.error('[webhook] sendActivated error:', e.message))
            }
          } catch (e) { console.error('[webhook] retrieve customer error:', e.message) }
        }

        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id:                userId,
            stripe_customer_id:     obj.customer,
            stripe_subscription_id: obj.id,
            status:                 obj.status,
            plan,
            trial_end:              obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
            current_period_end:     obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
            updated_at:             new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        if (error) {
          console.error('[webhook] upsert error (subscription):', error)
          return res.status(500).json({ error: 'DB write failed — Stripe will retry' })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const userId = obj.metadata?.supabase_user_id
        console.log('[webhook] subscription.deleted userId:', userId)
        if (!userId) break
        const { error } = await supabase.from('subscriptions').upsert(
          { user_id: userId, stripe_customer_id: obj.customer, stripe_subscription_id: obj.id, status: 'canceled', current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        if (error) {
          console.error('[webhook] upsert error (deleted):', error)
          return res.status(500).json({ error: 'DB write failed — Stripe will retry' })
        }
        // Send win-back email
        try {
          const customer = await stripe.customers.retrieve(obj.customer)
          if (customer.email) {
            await sendWinBack({ email: customer.email }).catch(e =>
              console.error('[webhook] sendWinBack error:', e.message)
            )
          }
        } catch (e) { console.error('[webhook] winback lookup error:', e.message) }
        break
      }

      case 'invoice.payment_failed': {
        try {
          const sub    = await stripe.subscriptions.retrieve(obj.subscription)
          const userId = sub.metadata?.supabase_user_id
          console.log('[webhook] payment_failed userId:', userId)
          if (!userId) break
          const { error } = await supabase.from('subscriptions').upsert(
            { user_id: userId, stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription, status: 'past_due', updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
          if (error) console.error('[webhook] upsert error (payment_failed):', error)
          if (obj.customer_email) {
            await sendPaymentFailed({ email: obj.customer_email }).catch(e => console.error('[webhook] sendPaymentFailed error:', e.message))
          }
        } catch (e) { console.error('[webhook] payment_failed handler error:', e.message) }
        break
      }

      default:
        console.log('[webhook] unhandled event type:', event.type)
    }
  } catch (handlerErr) {
    console.error('[webhook] handler error for', event.type, ':', handlerErr.message)
    // Still return 200 so Stripe doesn't retry — log the error for investigation
  }

  res.status(200).json({ received: true })
}
