import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

export default async function handler(req, res) {
  // Verify caller — write/delete only their own push subscription
  const user = await requireAuth(req, res)
  if (!user) return

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  if (req.method === 'POST') {
    const { subscription } = req.body || {}
    if (!subscription) return res.status(400).json({ error: 'Missing subscription' })

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: user.id, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
