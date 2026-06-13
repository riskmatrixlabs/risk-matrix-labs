// Shared retro UI primitives used by both LiveCenter (Insights) and MatrixBot (Bot tab).
// Kept tiny and dependency-light so either screen can import without circular refs.
import { useState } from 'react'

export const NEON   = '#BDFF00'
export const NEON_T = 'var(--neon-title)'
export const R      = 'Rajdhani, sans-serif'
export const MUTED  = 'var(--muted)'
export const CARD   = 'var(--card)'
export const BORDER = 'var(--border2)'
export const TEXT   = 'var(--text)'
export const DANGER = '#FF3B3B'

export const SPREAD_LABEL = { MLB: 'Run Line', NHL: 'Puck Line', NBA: 'Spread', WNBA: 'Spread', NFL: 'Spread' }

export const BOOK_NAMES = {
  pinnacle: 'Pinnacle', draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM',
  williamhill_us: 'Caesars', betfair_ex_uk: 'Betfair', betfair_ex_eu: 'Betfair', hardrockbet: 'Hard Rock',
}

export const fmtAm = (n) => (n > 0 ? `+${n}` : `${n}`)

export function Sparkline({ series, color }) {
  if (!series || series.length < 2) return null
  const min = Math.min(...series), max = Math.max(...series)
  const range = max - min || 1
  const w = 120, h = 28, pad = 3
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '26px', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function InfoLabel({ label, tip, center = false }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={center ? { textAlign: 'center' } : undefined}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {label}
        {tip && (
          <button
            type="button"
            aria-label="What does this mean?"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ width: '15px', height: '15px', flexShrink: 0, borderRadius: '50%', border: `1px solid ${open ? NEON_T : MUTED}`, background: open ? 'rgba(189,255,0,0.12)' : 'transparent', color: open ? NEON_T : MUTED, fontSize: '10px', fontWeight: 700, lineHeight: 1, fontFamily: 'Georgia, serif', fontStyle: 'italic', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >i</button>
        )}
      </span>
      {open && tip && (
        <div style={{ marginTop: '7px', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{tip}</div>
      )}
    </div>
  )
}
