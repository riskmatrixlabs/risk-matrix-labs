import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { userId, subscription } = req.body
    if (!userId || !subscription) return res.status(400).json({ error: 'Missing userId or subscription' })

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'Missing userId' })

    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
