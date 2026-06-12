import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Share2 } from 'lucide-react'

const NEON   = '#BDFF00'
const RED    = '#FF3B3B'
const YELLOW = '#F5A623'
const BG     = '#0A0A0A'
const R      = 'Rajdhani, sans-serif'

const fmt$ = (v) => {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  const str = abs >= 1000 ? '$' + (abs / 1000).toFixed(1) + 'k' : '$' + abs.toFixed(2)
  if (n < 0) return '-' + str
  return str
}
const fmtSigned$ = (v) => {
  const n = Number(v) || 0
  return (n >= 0 ? '+' : '') + fmt$(n)
}
const fmtOdds = (v) => {
  const n = Number(v) || 0
  return n > 0 ? `+${n}` : `${n}`
}
const fmtU = (v) => {
  const n = Number(v) || 0
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}u`
}
const today = () => {
  const d = new Date()
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`
}

// ── SESSION SHARE CARD — Pikkit-style horizontal ──────────────────────────────
function SessionShareCardInner({ stats, username, masterBankroll, unitSize, theme, showUnits }) {
  const isDark   = theme === 'dark'
  const outer    = isDark ? '#111111' : '#F0F0EE'
  const inner    = isDark ? '#1C1C1E' : '#FFFFFF'
  const text     = isDark ? '#FFFFFF' : '#0A0A0A'
  const sub      = isDark ? '#888'    : '#999'
  const border   = isDark ? '#2A2A2A' : '#E0E0DE'

  const netPnl   = Number(stats?.netPnl$) || 0
  const netPnlU  = Number(stats?.netPnlU) || 0
  const pnlColor = netPnl >= 0 ? NEON : RED
  const roi      = ((Number(stats?.roi) || 0) * 100).toFixed(1)
  const wins     = stats?.wins   || 0
  const losses   = stats?.losses || 0
  const winRate  = ((Number(stats?.winRate) || 0) * 100).toFixed(1)
  const total    = stats?.total  || 0

  const bigPnl   = showUnits ? fmtU(netPnlU) : fmtSigned$(netPnl)
  const pnlGlow  = isDark
    ? (netPnl >= 0 ? '0 0 16px rgba(189,255,0,0.5)' : '0 0 16px rgba(255,59,59,0.5)')
    : 'none'

  return (
    <div style={{
      width: 360,
      background: outer,
      fontFamily: R,
      boxSizing: 'border-box',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${border}`,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '11px 14px 9px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: '50%' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: text, letterSpacing: '0.04em' }}>{username || 'Operator'}</div>
            <div style={{ fontSize: 9, color: sub, letterSpacing: '0.06em', marginTop: 1 }}>Operator</div>
          </div>
        </div>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: text, letterSpacing: '0.04em' }}>Risk Matrix Labs</span>
        </div>
      </div>

      {/* ── Inner Content Card ── */}
      <div style={{
        margin: '0 10px',
        background: inner,
        borderRadius: 10,
        padding: '12px 13px',
        border: `1px solid ${border}`,
      }}>
        {/* Top row: title + big P&L */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: text, letterSpacing: '0.01em' }}>Session Summary</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 22, fontWeight: 900, color: pnlColor,
              lineHeight: 1, letterSpacing: '-0.02em',
              textShadow: pnlGlow,
            }}>{bigPnl}</div>
            <div style={{ fontSize: 8, color: sub, marginTop: 2, letterSpacing: '0.06em' }}>
              {showUnits ? 'net units' : 'net p&l'}
            </div>
          </div>
        </div>

        {/* Stat mini-cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {[
            { label: 'Record',   val: `${wins}W – ${losses}L`, accent: pnlColor },
            { label: 'Win Rate', val: `${winRate}%`,            accent: text },
            { label: 'ROI',      val: `${roi}%`,                accent: Number(roi) >= 0 ? pnlColor : RED },
            { label: 'Bets',     val: `${total}`,               accent: text },
            !showUnits
              ? { label: 'Bankroll', val: fmt$(masterBankroll || 0), accent: text }
              : { label: '1u =',     val: fmt$(unitSize || 0),        accent: NEON },
            showUnits
              ? { label: 'Net Units', val: fmtU(netPnlU), accent: pnlColor }
              : { label: 'Net P&L',   val: fmtSigned$(netPnl), accent: pnlColor },
          ].map(({ label, val, accent }) => (
            <div key={label} style={{
              background: isDark ? '#242424' : '#F0F0EE',
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '6px 8px',
            }}>
              <div style={{ fontSize: 6, color: sub, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: '-0.01em' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '8px 14px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 9, color: sub }}>Updated: {today()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: `${NEON}22`, border: `1.5px solid ${NEON}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 8, color: NEON, fontWeight: 900, lineHeight: 1 }}>✓</span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: NEON, letterSpacing: '0.08em' }}>Verified</span>
        </div>
      </div>
    </div>
  )
}

// ── BET SHARE CARD — Pikkit-style horizontal ──────────────────────────────────
function BetShareCardInner({ bet, username, unitSize, theme, showUnits }) {
  const isDark   = theme === 'dark'
  const outer    = isDark ? '#111111' : '#F0F0EE'
  const inner    = isDark ? '#1C1C1E' : '#FFFFFF'
  const text     = isDark ? '#FFFFFF' : '#0A0A0A'
  const sub      = isDark ? '#888'    : '#999'
  const border   = isDark ? '#2A2A2A' : '#E0E0DE'

  const isOpen   = bet?.result === 'Open'
  const isLadder = !!bet?.ladder

  const toWin = bet?.stake > 0 && bet?.odds
    ? (bet.odds > 0 ? bet.stake * bet.odds / 100 : bet.stake * 100 / Math.abs(bet.odds))
    : 0

  const pnlDollar = (() => {
    if (!bet) return 0
    if (isLadder) return Number(bet.pnl) || 0
    if (bet.units > 0 && bet.stake > 0) return (Number(bet.pnl) || 0) * (bet.stake / bet.units)
    return (Number(bet.pnl) || 0) * (unitSize || 20)
  })()
  const pnlUnits    = Number(bet?.pnl) || 0
  const statusLabel = isOpen ? 'PENDING' : bet?.result === 'W' ? 'WIN' : bet?.result === 'L' ? 'LOSS' : 'PUSH'
  const statusColor = isOpen ? YELLOW : bet?.result === 'W' ? NEON : bet?.result === 'L' ? RED : sub
  const pnlColor    = pnlDollar > 0 ? NEON : pnlDollar < 0 ? RED : (isOpen ? YELLOW : sub)

  const bigVal = showUnits
    ? (isOpen ? (bet?.units > 0 ? `${bet.units}u` : '—') : fmtU(pnlUnits))
    : (isOpen ? (toWin > 0 ? `+${fmt$(toWin)}` : '—') : ((pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar)))

  const subVal = showUnits
    ? fmtOdds(bet?.odds)
    : (isOpen ? 'to win' : statusLabel.toLowerCase())

  const pnlGlow = isDark
    ? `0 0 16px ${pnlColor}80`
    : 'none'

  const pickText = bet?.pick || '—'
  const detailText = [
    bet?.event,
    bet?.sport,
    bet?.book,
    isLadder ? `Ladder Rung ${bet?.ladderId}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{
      width: 360,
      background: outer,
      fontFamily: R,
      boxSizing: 'border-box',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${border}`,
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '11px 14px 9px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: '50%' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: text, letterSpacing: '0.04em' }}>{username || 'Operator'}</div>
            <div style={{ fontSize: 9, color: sub, letterSpacing: '0.06em', marginTop: 1 }}>Operator</div>
          </div>
        </div>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: text, letterSpacing: '0.04em' }}>Risk Matrix Labs</span>
        </div>
      </div>

      {/* ── Inner Content Card ── */}
      <div style={{
        margin: '0 10px',
        background: inner,
        borderRadius: 10,
        padding: '11px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10,
        border: `1px solid ${border}`,
      }}>
        {/* Status badge dot */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: `${statusColor}18`,
          border: `1.5px solid ${statusColor}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: statusColor }}>{
            isOpen ? '⏳' : bet?.result === 'W' ? '✓' : bet?.result === 'L' ? '✗' : '~'
          }</span>
        </div>

        {/* Pick + details + chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '0.01em', marginBottom: 5,
          }}>{pickText}</div>
          {/* Info chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              bet?.sport  ? { label: bet.sport }  : null,
              bet?.book   ? { label: bet.book }   : null,
              bet?.odds   ? { label: fmtOdds(bet.odds) } : null,
              !showUnits && bet?.stake > 0 ? { label: fmt$(bet.stake) } : null,
              showUnits && bet?.units > 0  ? { label: `${bet.units}u` } : null,
              isLadder ? { label: 'Ladder' } : null,
              bet?.date   ? { label: bet.date }   : null,
            ].filter(Boolean).map(({ label }) => (
              <span key={label} style={{
                fontSize: 8, fontWeight: 600, color: sub,
                background: isDark ? '#252525' : '#EBEBEB',
                border: `1px solid ${border}`,
                borderRadius: 4, padding: '2px 6px', letterSpacing: '0.04em',
              }}>{label}</span>
            ))}
          </div>
        </div>

        {/* Right: P&L + odds */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 20, fontWeight: 900, color: pnlColor,
            lineHeight: 1, letterSpacing: '-0.02em',
            textShadow: pnlGlow,
          }}>{bigVal}</div>
          <div style={{ fontSize: 9, color: sub, marginTop: 3, letterSpacing: '0.04em' }}>
            {fmtOdds(bet?.odds)}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '8px 14px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 9, color: sub }}>Updated: {bet?.date || today()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: `${NEON}22`, border: `1.5px solid ${NEON}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 8, color: NEON, fontWeight: 900, lineHeight: 1 }}>✓</span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: NEON, letterSpacing: '0.08em' }}>Verified</span>
        </div>
      </div>
    </div>
  )
}

// ── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function ShareCardModal({ mode, bet, stats, username, bankroll, masterBankroll, bets, unitSize = 0, bankIn, onClose }) {
  const cardRef  = useRef(null)
  const [theme,     setTheme]     = useState('dark')
  const [showUnits, setShowUnits] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [status,    setStatus]    = useState('')

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const generateImage = async () => {
    if (!cardRef.current) return null
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur()
      await new Promise(r => setTimeout(r, 50))
    }
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
        allowTaint: true,
      })
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    } catch (e) {
      console.error('html2canvas error:', e)
      return null
    }
  }

  const handleShare = async () => {
    setLoading(true)
    setStatus('sharing')
    try {
      const blob = await generateImage()
      if (!blob) throw new Error('no blob')
      const file = new File([blob], 'rml-bet.png', { type: 'image/png' })
      if (canNativeShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Risk Matrix Labs', text: 'Operate With Discipline 🛡️ riskmatrixlabs.com' })
        setStatus('done')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = mode === 'session' ? 'rml-session.png' : 'rml-bet.png'
        a.click()
        URL.revokeObjectURL(url)
        setStatus('done')
      }
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('error')
      else setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
    >
      <div style={{
        background: '#0F0F0F',
        border: '1px solid #1e1e1e',
        borderTop: `2px solid ${NEON}`,
        borderRadius: isMobile ? '14px 14px 0 0' : '4px',
        width: isMobile ? '100%' : '400px',
        maxHeight: isMobile ? '92vh' : '90vh',
        overflowY: 'auto',
        padding: '18px 18px 24px',
        boxSizing: 'border-box',
      }}>

        {/* ── Modal Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={13} color={NEON} />
            <span style={{ fontFamily: R, fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>
              {mode === 'session' ? 'SHARE SESSION' : 'SHARE BET'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['dark', 'light'].map(t => (
              <button key={t} onClick={() => setTheme(t)} style={{
                fontFamily: R, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                padding: '4px 13px', borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
                background: theme === t ? NEON : 'transparent',
                color: theme === t ? BG : '#555',
                border: `1px solid ${theme === t ? NEON : '#2a2a2a'}`,
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ label: '$', val: false }, { label: 'Units', val: true }].map(({ label, val }) => (
              <button key={label} onClick={() => setShowUnits(val)} style={{
                fontFamily: R, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                padding: '4px 11px', borderRadius: 2, cursor: 'pointer',
                background: showUnits === val ? 'rgba(189,255,0,0.1)' : 'transparent',
                color: showUnits === val ? NEON : '#555',
                border: `1px solid ${showUnits === val ? 'rgba(189,255,0,0.35)' : '#2a2a2a'}`,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── Card Preview ── */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          marginBottom: 14,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid #191919',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          <div ref={cardRef}>
            {mode === 'session' ? (
              <SessionShareCardInner stats={stats} username={username} masterBankroll={masterBankroll} unitSize={unitSize} theme={theme} showUnits={showUnits} />
            ) : (
              <BetShareCardInner bet={bet} username={username} unitSize={unitSize} theme={theme} showUnits={showUnits} />
            )}
          </div>
        </div>

        {/* ── Share Button ── */}
        <button onClick={handleShare} disabled={loading} style={{
          fontFamily: R, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          padding: '11px 0', width: '100%',
          border: `1px solid ${NEON}`,
          borderRadius: 2,
          background: loading ? 'rgba(189,255,0,0.04)' : 'rgba(189,255,0,0.1)',
          color: NEON, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          textTransform: 'uppercase',
        }}>
          <Share2 size={11} />
          {loading ? 'Generating...' : canNativeShare ? 'Share via...' : 'Download Card'}
        </button>

        {status === 'error' && (
          <div style={{ marginTop: 10, textAlign: 'center', fontFamily: R, fontSize: 11, color: RED }}>
            Something went wrong. Try again.
          </div>
        )}
      </div>
    </div>
  )
}
