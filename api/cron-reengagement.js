import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { sendReengagement } from './_lib/emails.js'

// Called daily. Finds active subscribers who haven't logged a bet in 14+ days.
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
  const ago14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Get active paying subscribers (not trialing, not canceled)
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'active')

  if (subErr) return res.status(500).json({ error: subErr.message })
  if (!subs?.length) return res.status(200).json({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    // Find their most recent bet
    const { data: recentBets } = await supabase
      .from('bets')
      .select('date')
      .eq('user_id', sub.user_id)
      .order('date', { ascending: false })
      .limit(1)

    const lastBet = recentBets?.[0]?.date ? new Date(recentBets[0].date) : null

    // Skip if they've logged a bet in the last 14 days
    if (lastBet && lastBet >= ago14d) continue

    // Skip if they've never logged a bet AND signed up less than 14 days ago
    if (!lastBet) {
      const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id)
      if (!user) continue
      if (new Date(user.created_at) >= ago14d) continue
      if (!user.email) continue
      await sendReengagement({ email: user.email }).catch(e =>
        console.error('[cron-reengagement] send error uid:', user.id, e.message)
      )
      sent++
      continue
    }

    const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id)
    if (!user?.email) continue
    await sendReengagement({ email: user.email }).catch(e =>
      console.error('[cron-reengagement] send error uid:', user.id, e.message)
    )
    sent++
  }

  console.log(`[cron-reengagement] sent=${sent}`)
  res.status(200).json({ sent })
}
