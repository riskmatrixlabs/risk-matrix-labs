import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Download, Share2 } from 'lucide-react'

const NEON   = '#BDFF00'
const RED    = '#FF3B3B'
const YELLOW = '#F5A623'
const BG     = '#0A0A0A'
const CARD   = '#111111'
const R      = 'Rajdhani, sans-serif'

const fmt$ = (v, sign = false) => {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  const str = abs >= 1000 ? '$' + (abs / 1000).toFixed(1) + 'k' : '$' + abs.toFixed(2)
  if (sign && n > 0) return '+' + str
  if (n < 0) return '-' + str
  return str
}
const fmtOdds = (v) => {
  const n = Number(v) || 0
  return n > 0 ? `+${n}` : `${n}`
}
const fmtU = (v) => {
  const n = Number(v) || 0
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}u`
}

// ── RML Logo — centered, prominent ──────────────────────────────────────────
function RMLLogoCenter() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 44, height: 44, objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: R, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.14em' }}>RISK MATRIX LABS</span>
        <span style={{ fontFamily: R, fontSize: 7, fontWeight: 600, color: NEON, letterSpacing: '0.22em', marginTop: 3 }}>OPERATE WITH DISCIPLINE</span>
      </div>
    </div>
  )
}

// ── User badge ───────────────────────────────────────────────────────────────
function UserBadge({ username, theme }) {
  const isDark = theme === 'dark'
  const text   = isDark ? '#fff' : '#0A0A0A'
  const sub    = isDark ? '#666' : '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <img src="/brand/logos/logo-labs.png" alt="RML" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: R, fontSize: 11, fontWeight: 700, color: text }}>{username || 'Operator'}</div>
        <div style={{ fontFamily: R, fontSize: 8, color: sub, marginTop: 2, letterSpacing: '0.04em' }}>riskmatrixlabs.com</div>
      </div>
    </div>
  )
}

// ── BET SHARE CARD ───────────────────────────────────────────────────────────
function BetShareCardInner({ bet, username, unitSize, bankIn, theme }) {
  const isDark = theme === 'dark'
  const bg     = isDark ? '#0D0D0D' : '#F2F2F2'
  const cardBg = isDark ? '#141414' : '#FFFFFF'
  const text   = isDark ? '#FFF'    : '#0A0A0A'
  const sub    = isDark ? '#555'    : '#888'
  const border = isDark ? '#1E1E1E' : '#E0E0E0'

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

  const pnlColor    = pnlDollar > 0 ? NEON : pnlDollar < 0 ? RED : sub
  const accentColor = bet?.result === 'W' ? NEON : bet?.result === 'L' ? RED : isOpen ? YELLOW : '#333'
  const statusLabel = isOpen ? 'PENDING' : bet?.result === 'W' ? 'WIN ✓' : bet?.result === 'L' ? 'LOSS ✗' : 'PUSH'
  const statusColor = isOpen ? YELLOW : bet?.result === 'W' ? NEON : bet?.result === 'L' ? RED : sub

  return (
    <div style={{ width: 300, background: bg, fontFamily: R, boxSizing: 'border-box', overflow: 'hidden' }}>

      {/* Top accent bar */}
      <div style={{ height: 3, background: accentColor }} />

      {/* Logo header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${border}` }}>
        <RMLLogoCenter />
      </div>

      {/* Main content */}
      <div style={{ padding: '12px 14px' }}>

        {/* Event */}
        {(bet?.event || isLadder) && (
          <div style={{ fontSize: 8, color: sub, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isLadder ? `PHLT™ Ladder · Rung ${bet?.ladderId}` : bet?.event}
          </div>
        )}

        {/* Pick */}
        <div style={{ fontSize: 18, fontWeight: 700, color: isOpen ? YELLOW : text, lineHeight: 1.1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isLadder && isOpen ? `Rung ${bet?.ladderId} · ${bet?.pick || 'TBD'}` : (bet?.pick || '—')}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontFamily: R, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: statusColor, padding: '2px 6px', border: `1px solid ${statusColor}44`, borderRadius: 3 }}>
            {statusLabel}
          </span>
          <span style={{ fontFamily: R, fontSize: 9, fontWeight: 700, color: (bet?.odds || 0) > 0 ? NEON : text }}>{fmtOdds(bet?.odds)}</span>
          {bet?.sport && <span style={{ fontFamily: R, fontSize: 8, color: sub }}>{bet.sport}</span>}
          {bet?.book  && <span style={{ fontFamily: R, fontSize: 8, color: sub }}>{bet.book}</span>}
        </div>

        {/* Big P&L / to-win */}
        <div style={{ textAlign: 'center', padding: '10px 0 12px', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 8, color: sub, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            {isOpen ? 'To Win' : 'P&L'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: isOpen ? YELLOW : pnlColor }}>
            {isOpen
              ? (toWin > 0 ? `+${fmt$(toWin)}` : '—')
              : ((pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar))
            }
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(isOpen ? [
            { label: 'Stake',   val: bet?.stake > 0 ? fmt$(bet.stake) : '—' },
            { label: 'To Win',  val: toWin > 0 ? `+${fmt$(toWin)}` : '—' },
            { label: isLadder ? 'Bank' : 'Units', val: isLadder ? (bankIn != null ? fmt$(bankIn) : '—') : (bet?.units > 0 ? `${bet.units}u` : '—') },
          ] : [
            { label: 'Odds',    val: fmtOdds(bet?.odds) },
            { label: 'Wagered', val: bet?.stake > 0 ? fmt$(bet.stake) : `${bet?.units || 0}u` },
            { label: 'P&L',     val: (pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar) },
          ]).map(({ label, val }, idx, arr) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', paddingRight: idx < arr.length - 1 ? 1 : 0, borderRight: idx < arr.length - 1 ? `1px solid ${border}` : 'none' }}>
              <div style={{ fontSize: 7, color: sub, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: text }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <UserBadge username={username} theme={theme} />
        {bet?.date && <span style={{ fontSize: 8, color: sub }}>{bet.date}</span>}
      </div>
    </div>
  )
}

// ── SESSION SHARE CARD ───────────────────────────────────────────────────────
function SessionShareCardInner({ stats, username, bankroll, masterBankroll, theme }) {
  const isDark = theme === 'dark'
  const bg     = isDark ? '#0D0D0D' : '#F2F2F2'
  const cardBg = isDark ? '#141414' : '#FFFFFF'
  const text   = isDark ? '#FFF'    : '#0A0A0A'
  const sub    = isDark ? '#555'    : '#888'
  const border = isDark ? '#1E1E1E' : '#E0E0E0'

  const netPnl   = Number(stats?.netPnl$) || 0
  const pnlColor = netPnl >= 0 ? NEON : RED
  const roi      = ((Number(stats?.roi) || 0) * 100).toFixed(1)
  const wins     = stats?.wins || 0
  const losses   = stats?.losses || 0
  const winRate  = ((Number(stats?.winRate) || 0) * 100).toFixed(1)
  const total    = stats?.total || 0

  return (
    <div style={{ width: 300, background: bg, fontFamily: R, boxSizing: 'border-box', overflow: 'hidden' }}>

      {/* Top accent bar */}
      <div style={{ height: 3, background: pnlColor }} />

      {/* Logo header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${border}` }}>
        <RMLLogoCenter />
      </div>

      {/* Session label */}
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ fontSize: 8, color: sub, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Session P&amp;L</div>

        {/* Big P&L */}
        <div style={{ fontSize: 38, fontWeight: 700, color: pnlColor, lineHeight: 1, marginBottom: 4 }}>
          {(netPnl >= 0 ? '+' : '') + fmt$(netPnl)}
        </div>
        <div style={{ fontSize: 9, color: sub, marginBottom: 14 }}>
          {wins}W · {losses}L · {winRate}% WR · ROI {roi}%
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: border, marginBottom: 12 }} />

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Bankroll',   val: fmt$(masterBankroll || 0), color: text },
            { label: 'Total Bets', val: String(total),             color: text },
            { label: 'Net Units',  val: fmtU(stats?.netPnlU || 0), color: (stats?.netPnlU || 0) >= 0 ? NEON : RED },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: sub, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px 10px', borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <UserBadge username={username} theme={theme} />
        <span style={{ fontSize: 8, fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>riskmatrixlabs.com</span>
      </div>
    </div>
  )
}

// ── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function ShareCardModal({ mode, bet, stats, username, bankroll, masterBankroll, bets, unitSize, bankIn, onClose }) {
  const cardRef = useRef(null)
  const [theme,   setTheme]   = useState('dark')
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState('')

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const generateImage = async () => {
    if (!cardRef.current) return null
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
        await navigator.share({
          files: [file],
          title: 'Risk Matrix Labs',
          text: 'Operate With Discipline 🛡️ riskmatrixlabs.com',
        })
        setStatus('done')
      } else {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href    = url
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

  const handleDownload = async () => {
    setLoading(true)
    try {
      const blob = await generateImage()
      if (!blob) throw new Error('no blob')
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = mode === 'session' ? 'rml-session.png' : 'rml-bet.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 400,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#111',
        border: '1px solid #222',
        borderTop: `2px solid ${NEON}`,
        borderRadius: isMobile ? '14px 14px 0 0' : '4px',
        width: isMobile ? '100%' : '360px',
        maxHeight: isMobile ? '92vh' : '90vh',
        overflowY: 'auto',
        padding: '20px 18px 32px',
        boxSizing: 'border-box',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={14} color={NEON} />
            <span style={{ fontFamily: R, fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: NEON }}>
              {mode === 'session' ? 'SHARE SESSION' : 'SHARE BET'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Dark / Light toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['dark', 'light'].map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              fontFamily: R, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              padding: '5px 18px', borderRadius: 20, cursor: 'pointer',
              background: theme === t ? NEON : 'transparent',
              color: theme === t ? BG : '#888',
              border: `1px solid ${theme === t ? NEON : '#333'}`,
              transition: 'all 0.15s',
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {/* Card preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, borderRadius: 4, overflow: 'hidden', border: '1px solid #222' }}>
          <div ref={cardRef}>
            {mode === 'session' ? (
              <SessionShareCardInner
                stats={stats}
                username={username}
                bankroll={bankroll}
                masterBankroll={masterBankroll}
                theme={theme}
              />
            ) : (
              <BetShareCardInner
                bet={bet}
                username={username}
                unitSize={unitSize}
                bankIn={bankIn}
                theme={theme}
              />
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownload} disabled={loading} style={{
            fontFamily: R, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            padding: '11px 0', flex: 1,
            border: '1px solid #333', borderRadius: 2,
            background: 'transparent', color: '#888',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Download size={12} /> Save
          </button>
          <button onClick={handleShare} disabled={loading} style={{
            fontFamily: R, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            padding: '11px 0', flex: 2,
            border: `1px solid ${NEON}`, borderRadius: 2,
            background: loading ? 'rgba(189,255,0,0.06)' : 'rgba(189,255,0,0.12)',
            color: NEON,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Share2 size={12} />
            {loading ? 'Generating...' : canNativeShare ? 'Share via...' : 'Download Card'}
          </button>
        </div>

        {status === 'error' && (
          <div style={{ marginTop: 10, textAlign: 'center', fontFamily: R, fontSize: 11, color: RED }}>
            Something went wrong. Try Save instead.
          </div>
        )}
      </div>
    </div>
  )
}
