import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

/**
 * Verify the Bearer token from the Authorization header.
 * Returns { user } on success or sends a 401 and returns null.
 */
export async function requireAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim()
  if (!token) {
    res.status(401).json({ error: 'Unauthorized — missing token' })
    return null
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized — invalid token' })
    return null
  }

  return user
}
