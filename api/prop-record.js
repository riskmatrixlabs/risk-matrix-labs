// PHLT prop track record (Plan A, record side). Read-only DB read over graded
// prop_results rows: overall W/L/P + win%, split by PHLT tier (A/B/C =
// Prime/Strong/Caution), plus today + yesterday (ET). Pushes are excluded from
// the win% denominator. Fail-soft: any error/no-db returns zeros at 200.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { requireAuth } from './_lib/auth.js'
import { tallyProps } from '../src/lib/propRecord.js'

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })
}
const etDate = (offDays = 0) => new Date(Date.now() - 4 * 3600e3 - offDays * 86400e3).toISOString().slice(0, 10)

const EMPTY = {
  overall: { w: 0, l: 0, p: 0, n: 0, winPct: null },
  byTier: { A: { w: 0, l: 0, p: 0, winPct: null }, B: { w: 0, l: 0, p: 0, winPct: null }, C: { w: 0, l: 0, p: 0, winPct: null } },
  byTierToday: { A: { w: 0, l: 0, p: 0 }, B: { w: 0, l: 0, p: 0 }, C: { w: 0, l: 0, p: 0 } },
  byTierYesterday: { A: { w: 0, l: 0, p: 0 }, B: { w: 0, l: 0, p: 0 }, C: { w: 0, l: 0, p: 0 } },
  today: { w: 0, l: 0, p: 0 },
  yesterday: { w: 0, l: 0, p: 0 },
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return
  res.setHeader('Cache-Control', 'no-store')

  const today = etDate(0), yesterday = etDate(1)
  const since = etDate(60)

  try {
    const sb = db()
    if (!sb) return res.status(200).json({ ok: false, ...EMPTY })

    const { data, error } = await sb.from('prop_results')
      .select('game_date, player, prop_market, lean, phlt_tier, result')
      .in('result', ['W', 'L', 'P'])
      .gte('game_date', since)
      .order('game_date', { ascending: false })
      .limit(5000)

    if (error) return res.status(200).json({ ok: false, ...EMPTY })

    const out = tallyProps(data || [], { today, yesterday })
    return res.status(200).json({ ok: true, ...out })
  } catch {
    return res.status(200).json({ ok: false, ...EMPTY })
  }
}
