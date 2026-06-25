// Single-flight lock for paid Odds-API pulls. When many viewers (or a cron + a viewer) hit the
// SAME game at once, only ONE worker should spend credits; the rest read the cache the winner
// writes. Self-expiring: a lock older than ttlMs is stale and reclaimable, so a crashed worker
// can never wedge a game permanently.
//
// FAIL-OPEN: a lock error must never hang the UI. On any error acquireLock returns true (better to
// allow a (possibly duplicate) paid pull than to block a legitimate scan), and releaseLock swallows.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
}

// Try to acquire the lock for `key`. Returns true if we won it (caller should spend), false if a
// FRESH lock is already held by someone else.
//
// Two-step, but safe: (1) reclaim any STALE row (locked_at older than ttlMs) by deleting it, then
// (2) INSERT a fresh row. The primary-key INSERT is the atomic arbiter — only ONE concurrent worker
// can insert `cache_key`; the rest get a duplicate-key error (code 23505) and lose the race (false).
// A held fresh lock survives step 1, so step 2 collides => the contender correctly backs off.
export async function acquireLock(supabase, key, ttlMs = 25000) {
  const db = supabase || client()
  if (!db || !key) return true // fail-open: no client / no key => allow the spend
  try {
    const staleBefore = new Date(Date.now() - ttlMs).toISOString()
    // Reclaim a stale lock (crashed worker) so games never wedge permanently.
    await db.from('scan_locks').delete().eq('cache_key', key).lt('locked_at', staleBefore)
    // Insert is the gate: PK conflict => someone else holds a fresh lock => we lose (false).
    const { error } = await db
      .from('scan_locks')
      .insert({ cache_key: key, locked_at: new Date().toISOString() })
      .select('cache_key')
    if (!error) return true                 // we inserted => we own the lock
    if (error.code === '23505') return false // fresh lock already held by another worker
    return true                              // any other error => fail-open (allow the spend)
  } catch {
    return true // fail-open: never block on a lock error
  }
}

// Release the lock. Best-effort; never throws.
export async function releaseLock(supabase, key) {
  const db = supabase || client()
  if (!db || !key) return
  try {
    await db.from('scan_locks').delete().eq('cache_key', key)
  } catch {
    /* best-effort */
  }
}
