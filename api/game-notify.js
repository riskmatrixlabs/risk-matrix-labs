import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'

// Per-user score-notification opt-in for a single game.
// GET    ?external_event_id=...            → { subscribed: bool }
// POST   { external_event_id, subscription } → ensure push sub saved + opt in
// DELETE { external_event_id }              → opt out
export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  if (req.method === 'GET') {
    const eventId = req.query?.external_event_id
    if (!eventId) return res.status(400).json({ error: 'Missing external_event_id' })
    const { data } = await supabase
      .from('game_notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('external_event_id', String(eventId))
      .maybeSingle()
    return res.status(200).json({ subscribed: !!data })
  }

  if (req.method === 'POST') {
    const { external_event_id, subscription } = req.body || {}
    if (!external_event_id) return res.status(400).json({ error: 'Missing external_event_id' })
    // Save/refresh the device push subscription if provided (so the cron can reach them).
    if (subscription) {
      await supabase.from('push_subscriptions')
        .upsert({ user_id: user.id, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    }
    const { error } = await supabase.from('game_notifications')
      .upsert({ user_id: user.id, external_event_id: String(external_event_id) }, { onConflict: 'user_id,external_event_id' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, subscribed: true })
  }

  if (req.method === 'DELETE') {
    const eventId = (req.body && req.body.external_event_id) || req.query?.external_event_id
    if (!eventId) return res.status(400).json({ error: 'Missing external_event_id' })
    await supabase.from('game_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('external_event_id', String(eventId))
    return res.status(200).json({ ok: true, subscribed: false })
  }

  res.status(405).end()
}
