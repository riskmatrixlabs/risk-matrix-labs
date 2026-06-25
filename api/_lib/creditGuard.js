// Credit circuit breaker. The owner's paid Odds-API key must NOT be drainable by traffic:
// we persist the last-known credits.remaining (returned on every provider fetch) into a single
// KV row, and refuse to spend below a hard floor.
//
// FAIL-OPEN is the contract for every guard here: unknown credits (null/undefined) or any DB
// error must NEVER block a legitimate scan. "Blocked" means ONLY "we know we're below the floor".
// A guard error means "don't crash, allow the scan" — never "hang the UI" or "throw".
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Hard stop: pause all paid pulls when known remaining credits fall below this.
export const CREDIT_FLOOR = 1000

// Pure floor check. Fail-OPEN on unknown credits: null/undefined remaining => false (don't block).
export function isBelowFloor(remaining, floor = CREDIT_FLOOR) {
  if (remaining == null) return false
  if (!Number.isFinite(remaining)) return false
  return remaining < floor
}

// Shared service-role client (same env + transport as scanStore). Returns null if env is missing.
function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
}

// Persist the last-known credit balance. No-op unless remaining is a finite number. Never throws.
export async function recordCredits(supabase, remaining) {
  if (!Number.isFinite(remaining)) return
  const db = supabase || client()
  if (!db) return
  try {
    // supabase-js does NOT throw on a failed write — it returns { error }. Check it explicitly,
    // otherwise a permission/constraint failure is swallowed silently (it was: a missing
    // service_role grant left the breaker frozen on its seed value — see migration + grants memory).
    const { error } = await db.from('odds_credit_state').upsert(
      { id: true, remaining, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    if (error) console.error('recordCredits write failed:', error.message)
  } catch (e) {
    console.error('recordCredits threw:', e?.message || e)
  }
}

// Read the last-known credit balance. Returns { remaining, updatedAt } or { remaining: null } on error.
export async function getKnownCredits(supabase) {
  const db = supabase || client()
  if (!db) return { remaining: null }
  try {
    const { data, error } = await db
      .from('odds_credit_state')
      .select('remaining, updated_at')
      .eq('id', true)
      .maybeSingle()
    if (error || !data) return { remaining: null }
    return { remaining: data.remaining ?? null, updatedAt: data.updated_at ?? null }
  } catch {
    return { remaining: null }
  }
}

// THE breaker. true ONLY when known remaining is a number AND below floor. Fail-OPEN: unknown
// credits or any error => false (allow the spend). Never throws.
export async function creditFloorBlocked(supabase, floor = CREDIT_FLOOR) {
  try {
    const { remaining } = await getKnownCredits(supabase)
    return isBelowFloor(remaining, floor)
  } catch {
    return false
  }
}
