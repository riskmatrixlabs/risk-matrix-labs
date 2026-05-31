import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  'mailto:hello@riskmatrixlabs.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')

  if (error) return res.status(500).json({ error: error.message })
  if (!rows?.length) return res.status(200).json({ sent: 0 })

  const payload = JSON.stringify({
    title: 'Risk Matrix Labs 🎯',
    body:  "Don't forget to log today's session. Discipline is the edge.",
    url:   'https://www.riskmatrixlabs.com',
  })

  let sent = 0
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, payload)
      sent++
    } catch (err) {
      // Subscription expired — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
      }
    }
  }

  res.status(200).json({ sent })
}
