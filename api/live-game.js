// On-demand single-game refresh — fetches one game's live data straight from ESPN.
// Called by the frontend while a live game detail is open, so the view updates in
// near real time without depending on the cron's cadence. Read-only, public.
import { SPORTS, etDateStr, mapStatus, buildLiveMeta } from './cron-sync-live.js'

export default async function handler(req, res) {
  const id  = String(req.query.id ?? '')
  const cfg = SPORTS.find(s => s.key === String(req.query.sport ?? '').toUpperCase())
  if (!id || !cfg) return res.status(400).json({ error: 'missing id or sport' })

  res.setHeader('Cache-Control', 'no-store')
  try {
    // Find the game in today's (or yesterday's, for late games) scoreboard — the
    // scoreboard carries per-inning linescores + status that buildLiveMeta needs.
    let ev, comp, home, away
    for (const dateStr of [etDateStr(0), etDateStr(-1)]) {
      const sbRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?dates=${dateStr}`)
      if (!sbRes.ok) continue
      const sb = await sbRes.json()
      ev = (sb.events ?? []).find(e => String(e.id) === id)
      if (!ev) continue
      comp = ev.competitions?.[0]
      home = comp?.competitors?.find(c => c.homeAway === 'home')
      away = comp?.competitors?.find(c => c.homeAway === 'away')
      if (comp && home && away) break
      ev = null
    }
    if (!ev || !comp || !home || !away) return res.status(200).json({ notFound: true })

    const status = mapStatus(comp.status?.type?.name, comp.status?.type?.detail)

    let metadata = {}
    const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/summary?event=${id}`)
    if (sumRes.ok) metadata = buildLiveMeta(await sumRes.json(), comp, away, home, cfg.key)

    return res.status(200).json({
      status,
      home_score: home.score != null && home.score !== '' ? parseInt(home.score) : null,
      away_score: away.score != null && away.score !== '' ? parseInt(away.score) : null,
      metadata,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
