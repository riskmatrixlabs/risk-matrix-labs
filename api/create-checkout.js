import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const OWNER_EMAIL = 'michaeltejeda08@gmail.com'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Already parsed (Vercel auto-parse)
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    // Manual parse from raw stream
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { priceId, userId, email, successUrl, cancelUrl } = await parseBody(req)

  if (!priceId || !userId || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Owner bypass — never charge the owner
  if (email === OWNER_EMAIL) {
    return res.status(200).json({ bypass: true })
  }

  try {
    // Check if customer already exists in Stripe
    const existing = await stripe.customers.list({ email, limit: 1 })
    let customer = existing.data[0]

    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: userId },
      },
      success_url: successUrl || `${req.headers.origin}/?checkout=success`,
      cancel_url:  cancelUrl  || `${req.headers.origin}/?checkout=canceled`,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: userId },
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
