import Stripe from 'stripe'
import { requireAuth } from './_lib/auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const TEAM_EMAILS = [
  'michaeltejeda08@gmail.com',
  'josiahteem@yahoo.com',
  'tremizy@gmail.com',
  'j.willey2489@gmail.com',
  'lauriesjeanpaul@gmail.com',
  'tjoel6788@gmail.com',
  'mmartinez2014@icloud.com',
  'ryancollado7@gmail.com',   // founder's younger brother — internal tester
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify caller identity from JWT — never trust userId/email from body
  const user = await requireAuth(req, res)
  if (!user) return

  const body = req.body || {}
  const { priceId, successUrl, cancelUrl, rewardfulReferral } = body

  // Use verified identity from token
  const userId = user.id
  const email  = user.email

  if (!priceId) {
    return res.status(400).json({ error: 'Missing priceId' })
  }

  // Team bypass — never charge team members
  if (TEAM_EMAILS.includes(email?.toLowerCase())) {
    return res.status(200).json({ bypass: true })
  }

  try {
    // Check if customer already exists in Stripe
    const existing = await stripe.customers.list({ email, limit: 1 })
    let customer = existing.data[0]

    if (!customer) {
      customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId, ...(rewardfulReferral && { referral: rewardfulReferral }) },
      })
    } else {
      // Always update metadata so supabase_user_id stays in sync
      await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, supabase_user_id: userId, ...(rewardfulReferral && { referral: rewardfulReferral }) },
      })
    }

    // Fetch price details so we can show the after-trial amount in the disclosure
    const price = await stripe.prices.retrieve(priceId)
    const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(0)}` : 'the plan amount'
    const interval = price.recurring?.interval === 'year' ? 'year' : 'month'

    // Trial end date (3 days from now) for disclosure
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 3)
    const trialEndFormatted = trialEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 3,
        metadata: { supabase_user_id: userId },
      },
      // FTC-compliant auto-renewal disclosure shown on the Stripe checkout page
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: `By confirming, you agree to the [Terms of Service](https://riskmatrixlabs.com/terms) and [Privacy Policy](https://riskmatrixlabs.com/privacy). Your 3-day free trial ends on ${trialEndFormatted}. After that, you will be charged ${amount}/${interval} until you cancel. Cancel anytime from your account settings.`,
        },
        submit: {
          message: `After your 3-day free trial ends on ${trialEndFormatted}, you'll be charged ${amount}/${interval}. Cancel anytime.`,
        },
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
