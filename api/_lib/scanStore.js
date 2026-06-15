// Server-side scan cache + credit guard for the +EV scan endpoint.
//
// WHY this exists: api/scan-edges.js called the provider on EVERY request (6 credits/call:
// 3 markets × 2 regions). Repeated scans of the same sport on the same day burned paid
// Odds-API credits for identical data. This store caches each (sport + today) result for a
// short TTL so re-scans cost 0 credits, and persists the last-known credits.remaining so we
// can pause scanning before we run the account dry.
//
// WHY Supabase (not an in-memory Map): Vercel is serverless — a module-level Map lives only
// inside ONE warm instance, so cache hits and the credit floor would be unreliable across
// concurrent/cold invocations. Every other api/ file already talks to Supabase with the same
// env vars (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), so we reuse that pattern. The store
// degrades gracefully: if the table is missing or Supabase errors, we treat it as a cache
// miss / unknown-credits and fall through to a normal (paid) scan rather than break the bot.
//
// Table (run as a migration if not present):
//   create table public.scan_cache (
//     key text primary key,                  -- "MLB:2026-06-13"
//     sport text not null,
//     payload jsonb not null,                -- full scan response shape
//     credits_remaining integer,             -- last known provider credits
//     scanned_at timestamptz not null default now()
//   );
//   -- service-role only; no RLS policies needed (server writes with the service key).
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const CREDIT_FLOOR = 200              // pause real scans below this many credits

// Pure helpers — unit-tested. No I/O.
export function cacheKey(sport, dateStr) {
  return `${String(sport).toUpperCase()}:${dateStr}`
}

// today's date as YYYY-MM-DD (UTC) — the scan key rolls over once per day.
export function todayStr(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

// is a stored scanned_at still within the TTL window?
export function isFresh(scannedAt, nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  if (!scannedAt) return false
  const t = new Date(scannedAt).getTime()
  if (Number.isNaN(t)) return false
  return nowMs - t < ttlMs
}

// should we refuse to spend credits given the last-known remaining balance?
// Unknown (null/undefined) credits => allow the scan (don't lock the bot out on a cold store).
export function isLowCredit(remaining, floor = CREDIT_FLOOR) {
  if (remaining == null) return false
  return remaining < floor
}

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
  )
}

// Read the cached row for (sport, date). Returns { payload, credits_remaining, scanned_at }
// or null on a miss / any error (degrade to a fresh scan).
export async function readScan(sport, dateStr) {
  const supabase = client()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('scan_cache')
      .select('payload, credits_remaining, scanned_at')
      .eq('key', cacheKey(sport, dateStr))
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

// The most recent known credit balance across any cached row — used for the floor check
// even when the current (sport, date) key is a miss.
export async function readLatestCredits() {
  const supabase = client()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('scan_cache')
      .select('credits_remaining')
      .not('credits_remaining', 'is', null)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data.credits_remaining
  } catch {
    return null
  }
}

// Persist a fresh scan result + the credits it left us with. Best-effort; never throws.
export async function writeScan(sport, dateStr, payload, creditsRemaining) {
  const supabase = client()
  if (!supabase) return
  try {
    await supabase.from('scan_cache').upsert(
      {
        key: cacheKey(sport, dateStr),
        sport: String(sport).toUpperCase(),
        payload,
        credits_remaining: creditsRemaining ?? null,
        scanned_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
  } catch {
    /* best-effort cache; ignore write failures */
  }
}

// ── Prop history (view-driven): snapshot best prop prices on each scan so props get a
// "since open" read like game lines. $0 extra credits — rides scans already paid for. ──
export async function capturePropSnapshots(rows) {
  const supabase = client()
  if (!supabase || !rows?.length) return
  try { await supabase.from('prop_history').insert(rows) } catch { /* best-effort */ }
}

// Earliest captured best price per (player|market|point|side) for one event = the "open".
export async function fetchPropOpens(eventId) {
  const supabase = client()
  if (!supabase || !eventId) return {}
  try {
    const { data } = await supabase
      .from('prop_history')
      .select('player, market, point, side, price, captured_at')
      .eq('external_event_id', String(eventId))
      .order('captured_at', { ascending: true })
    const out = {}
    for (const r of data || []) {
      const k = `${r.player}|${r.market}|${r.point}|${r.side}`
      if (!(k in out)) out[k] = r.price
    }
    return out
  } catch { return {} }
}
