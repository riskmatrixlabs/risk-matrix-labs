// Bet-slip photo → structured legs (OCR via Claude vision). Powers "Upload Pic" in Bet Matrix.
// Needs ANTHROPIC_API_KEY in env. Returns { legs: [{ pick, odds }] } parsed from the image.
import { requireAuth } from './_lib/auth.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'OCR not configured yet — add ANTHROPIC_API_KEY' })

  const { imageBase64, mediaType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ error: 'no image' })

  const prompt = `You are reading a screenshot of a sports betting slip. Extract EVERY leg/selection.
Return ONLY valid JSON: {"legs":[{"pick": string, "odds": number|null}]}.
- "pick": concise, e.g. "Aaron Judge Over 1.5 Hits", "Lakers ML", "Chiefs -3.5", "Over 8.5".
- "odds": the American odds for that leg as an integer (e.g. -120, 145) if shown, else null.
No prose, no markdown — JSON object only.`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })
    if (!r.ok) return res.status(502).json({ error: `vision ${r.status}`, detail: (await r.text().catch(() => '')).slice(0, 200) })
    const data = await r.json()
    const text = (data.content || []).map(c => c.text || '').join('').trim()
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json)
    const legs = (parsed.legs || []).filter(l => l && l.pick).map(l => ({ pick: String(l.pick).slice(0, 120), odds: Number(l.odds) || 0 }))
    return res.status(200).json({ legs })
  } catch (e) {
    return res.status(502).json({ error: 'parse failed', detail: String(e.message).slice(0, 200) })
  }
}
