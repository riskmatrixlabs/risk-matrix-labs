import { createClient } from '@supabase/supabase-js'
import { sendTrialEnding } from './_lib/emails.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Called daily by Vercel cron. Finds trials ending in ~3 days and sends one reminder.
export default async function handler(req, res) {
  // Protect with a secret so only Vercel cron can call it
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  const now      = new Date()
  const in3days  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const in4days  = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)

  // Find subscriptions trialing with trial_end in the 3-day window
  const { data: rows, error } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end')
    .eq('status', 'trialing')
    .gte('trial_end', in3days.toISOString())
    .lt('trial_end', in4days.toISOString())

  if (error) return res.status(500).json({ error: error.message })
  if (!rows?.length) return res.status(200).json({ sent: 0 })

  let sent = 0
  for (const row of rows) {
    // Look up user email from Supabase auth
    const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id)
    if (!user?.email) continue
    await sendTrialEnding({ email: user.email, trialEnd: row.trial_end }).catch(e => console.error('[cron-trial-reminder] send error uid:', user.id, e.message))
    sent++
  }

  res.status(200).json({ sent })
}
