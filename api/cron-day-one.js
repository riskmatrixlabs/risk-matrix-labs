import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { sendDayOne } from './_lib/emails.js'

// Called daily. Finds users who signed up 23–25h ago and sends day-1 onboarding email.
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  const now     = new Date()
  const ago23h  = new Date(now.getTime() - 25 * 60 * 60 * 1000)
  const ago25h  = new Date(now.getTime() - 23 * 60 * 60 * 1000)

  // Get users created in the 23–25h window
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return res.status(500).json({ error: error.message })

  const targets = (users || []).filter(u => {
    const created = new Date(u.created_at)
    return created >= ago23h && created <= ago25h
  })

  let sent = 0
  for (const user of targets) {
    if (!user.email) continue
    await sendDayOne({ email: user.email }).catch(e =>
      console.error('[cron-day-one] send error uid:', user.id, e.message)
    )
    sent++
  }

  console.log(`[cron-day-one] sent=${sent}`)
  res.status(200).json({ sent })
}
