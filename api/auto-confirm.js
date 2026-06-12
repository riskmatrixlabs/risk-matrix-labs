import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

/**
 * Auto-confirms a newly created user's email server-side.
 * Only works for accounts created in the last 10 minutes — prevents abuse.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    )

    // Safety checks:
    // 1. Account must be < 10 minutes old
    // 2. Must not already be confirmed (prevents confirming hijacked/existing accounts)
    const { data: { user }, error: fetchErr } = await supabase.auth.admin.getUserById(userId)
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found' })

    const ageMs = Date.now() - new Date(user.created_at).getTime()
    if (ageMs > 10 * 60 * 1000) {
      return res.status(403).json({ error: 'Account too old for auto-confirm' })
    }

    if (user.email_confirmed_at) {
      // Already confirmed — nothing to do, not an error
      return res.status(200).json({ confirmed: true, already: true })
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ confirmed: true })
  } catch (err) {
    console.error('auto-confirm error:', err)
    return res.status(500).json({ error: err.message })
  }
}
