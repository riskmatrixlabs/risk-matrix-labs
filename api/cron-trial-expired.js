import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { sendTrialExpired } from './_lib/emails.js'

// Called daily. Finds trials that expired in the last 24h (still marked trialing = never converted).
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  const now    = new Date()
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Find subscriptions still in 'trialing' status whose trial_end passed in last 24h
  const { data: rows, error } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end')
    .eq('status', 'trialing')
    .gte('trial_end', ago24h.toISOString())
    .lt('trial_end', now.toISOString())

  if (error) return res.status(500).json({ error: error.message })
  if (!rows?.length) return res.status(200).json({ sent: 0 })

  let sent = 0
  for (const row of rows) {
    const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id)
    if (!user?.email) continue
    await sendTrialExpired({ email: user.email }).catch(e =>
      console.error('[cron-trial-expired] send error uid:', user.id, e.message)
    )
    sent++
  }

  console.log(`[cron-trial-expired] sent=${sent}`)
  res.status(200).json({ sent })
}
