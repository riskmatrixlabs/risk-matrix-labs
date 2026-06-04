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

// ── RML Logo wordmark ────────────────────────────────────────────────────────
function RMLLogo({ size = 'sm' }) {
  const boxSize = size === 'sm' ? 20 : 24
  const fontSize = size === 'sm' ? 9 : 11
  const textSize = size === 'sm' ? 11 : 13
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: boxSize, height: boxSize,
        background: NEON, borderRadius: '3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: R, fontSize, fontWeight: 900, color: BG, letterSpacing: '-0.5px' }}>RM</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: R, fontSize: textSize, fontWeight: 700, color: '#fff', letterSpacing: '0.12em' }}>RISK MATRIX</span>
        <span style={{ fontFamily: R, fontSize: 7, fontWeight: 600, color: NEON, letterSpacing: '0.2em', marginTop: '1px' }}>LABS</span>
      </div>
    </div>
  )
}

// ── User avatar pill (like Pikkit) ───────────────────────────────────────────
function UserBadge({ username, theme }) {
  const text = theme === 'dark' ? '#fff' : '#0A0A0A'
  const sub  = theme === 'dark' ? '#888' : '#666'
  const initials = (username || 'OP').slice(0, 2).toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Avatar circle */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `linear-gradient(135deg, ${NEON}33, ${NEON}11)`,
        border: `1.5px solid ${NEON}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: R, fontSize: 12, fontWeight: 700, color: NEON }}>{initials}</span>
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: R, fontSize: 12, fontWeight: 700, color: text }}>{username || 'Operator'}</div>
        <div style={{ fontFamily: R, fontSize: 9, color: sub, marginTop: '2px', letterSpacing: '0.06em' }}>riskmatrixlabs.com</div>
      </div>
    </div>
  )
}

// ── BET SHARE CARD ───────────────────────────────────────────────────────────
function BetShareCardInner({ bet, username, unitSize, bankIn, theme }) {
  const isDark = theme === 'dark'
  const bg     = isDark ? BG     : '#F0F0F0'
  const cardBg = isDark ? CARD   : '#FFFFFF'
  const text   = isDark ? '#FFF' : '#0A0A0A'
  const sub    = isDark ? '#888' : '#666'
  const border = isDark ? '#222' : '#DDD'

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
  const accentColor = bet?.result === 'W' ? NEON : bet?.result === 'L' ? RED : isOpen ? YELLOW : '#444'
  const statusLabel = isOpen ? 'PENDING' : bet?.result === 'W' ? 'WIN' : bet?.result === 'L' ? 'LOSS' : 'PUSH'
  const statusColor = isOpen ? YELLOW : bet?.result === 'W' ? NEON : bet?.result === 'L' ? RED : sub
  const statusBg    = isOpen ? 'rgba(245,166,35,0.12)' : bet?.result === 'W' ? 'rgba(189,255,0,0.08)' : bet?.result === 'L' ? 'rgba(255,59,59,0.08)' : 'transparent'
  const statusBorder= isOpen ? 'rgba(245,166,35,0.4)'  : bet?.result === 'W' ? 'rgba(189,255,0,0.25)'  : bet?.result === 'L' ? 'rgba(255,59,59,0.25)'  : border

  return (
    <div style={{ width: 360, background: bg, fontFamily: R, padding: 16, boxSizing: 'border-box' }}>

      {/* Pikkit-style header: user left, RML logo right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <UserBadge username={username} theme={theme} />
        <RMLLogo size="sm" />
      </div>

      {/* Card */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${accentColor}`, borderRadius: 4, overflow: 'hidden' }}>

        {/* Event label */}
        {(bet?.event || isLadder) && (
          <div style={{ padding: '8px 12px 0', fontSize: 9, color: sub, letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isLadder ? `PHLT™ LADDER · RUNG ${bet?.ladderId}` : bet?.event}
          </div>
        )}

        {/* Pick + value */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 4px', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: isOpen ? YELLOW : text, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLadder && isOpen ? `RUNG ${bet?.ladderId} · ${bet?.pick || 'TBD'}` : (bet?.pick || '—')}
            </div>
            {bet?.date && !isOpen && (
              <div style={{ fontSize: 9, color: sub, marginTop: 2 }}>{bet.date}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {isOpen ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: YELLOW, lineHeight: 1 }}>
                  {toWin > 0 ? `+${fmt$(toWin)}` : '—'}
                </div>
                <div style={{ fontSize: 8, color: sub, marginTop: 1, letterSpacing: '0.08em' }}>to win</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
                  {(pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar)}
                </div>
                <div style={{ fontSize: 8, color: sub, marginTop: 1, letterSpacing: '0.08em' }}>P&amp;L</div>
              </>
            )}
          </div>
        </div>

        {/* Status + meta */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', gap: 6, overflow: 'hidden' }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: statusColor, background: statusBg, border: `1px solid ${statusBorder}`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
            {statusLabel}
          </span>
          {bet?.book  && <span style={{ fontSize: 9, color: NEON, flexShrink: 0 }}>{bet.book}</span>}
          {bet?.sport && <span style={{ fontSize: 9, color: sub,  flexShrink: 0 }}>{bet.sport}</span>}
          {bet?.confidence > 0 && <span style={{ fontSize: 9, letterSpacing: '-1px', flexShrink: 0 }}>{'⭐'.repeat(bet.confidence)}</span>}
          <span style={{ fontFamily: R, fontSize: 9, fontWeight: 700, color: (bet?.odds || 0) > 0 ? NEON : text, marginLeft: 'auto', flexShrink: 0 }}>
            {fmtOdds(bet?.odds)}
          </span>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', borderTop: `1px solid ${border}` }}>
          {(isOpen ? [
            { label: 'STAKE',  val: bet?.stake > 0 ? fmt$(bet.stake) : '—', color: text },
            { label: 'TO WIN', val: toWin > 0 ? `+${fmt$(toWin)}` : '—',    color: NEON },
            { label: isLadder ? 'BANK' : 'UNITS',
              val: isLadder ? (bankIn != null ? fmt$(bankIn) : '—') : (bet?.units > 0 ? `${bet.units}u` : '—'),
              color: text },
          ] : [
            { label: 'ODDS',    val: fmtOdds(bet?.odds),                                          color: (bet?.odds || 0) > 0 ? NEON : text },
            { label: 'WAGERED', val: bet?.stake > 0 ? fmt$(bet.stake) : `${bet?.units || 0}u`,   color: text },
            { label: 'P&L',     val: (pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar),              color: pnlColor },
          ]).map(({ label, val, color }, idx, arr) => (
            <div key={label} style={{ flex: 1, padding: '6px 10px', borderRight: idx < arr.length - 1 ? `1px solid ${border}` : 'none' }}>
              <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.1em', color: sub, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, color: sub, letterSpacing: '0.06em' }}>Operate With Discipline 🛡️</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>riskmatrixlabs.com</span>
      </div>
    </div>
  )
}

// ── SESSION SHARE CARD ───────────────────────────────────────────────────────
function SessionShareCardInner({ stats, username, bankroll, masterBankroll, theme }) {
  const isDark = theme === 'dark'
  const bg     = isDark ? BG     : '#F0F0F0'
  const cardBg = isDark ? CARD   : '#FFFFFF'
  const text   = isDark ? '#FFF' : '#0A0A0A'
  const sub    = isDark ? '#888' : '#666'
  const border = isDark ? '#222' : '#DDD'

  const netPnl   = Number(stats?.netPnl$) || 0
  const pnlColor = netPnl >= 0 ? NEON : RED
  const roi      = ((Number(stats?.roi) || 0) * 100).toFixed(1)
  const wins     = stats?.wins || 0
  const losses   = stats?.losses || 0
  const winRate  = ((Number(stats?.winRate) || 0) * 100).toFixed(1)
  const total    = stats?.total || 0

  return (
    <div style={{ width: 360, background: bg, fontFamily: R, padding: 16, boxSizing: 'border-box' }}>

      {/* Header: user left, RML logo right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <UserBadge username={username} theme={theme} />
        <RMLLogo size="sm" />
      </div>

      {/* Big P&L card */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${pnlColor}`, borderRadius: 4, padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: sub, letterSpacing: '0.12em', marginBottom: 4 }}>SESSION P&amp;L</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
          {(netPnl >= 0 ? '+' : '') + fmt$(netPnl)}
        </div>
        <div style={{ fontSize: 10, color: sub, marginTop: 6 }}>
          ROI {roi}% &nbsp;·&nbsp; {wins}W {losses}L &nbsp;·&nbsp; {winRate}% WR
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'BANKROLL',   val: fmt$(masterBankroll || 0),               color: text },
          { label: 'TOTAL BETS', val: String(total),                           color: text },
          { label: 'NET UNITS',  val: fmtU(stats?.netPnlU || 0),              color: (stats?.netPnlU || 0) >= 0 ? NEON : RED },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: sub, letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, color: sub, letterSpacing: '0.06em' }}>Operate With Discipline 🛡️</span>
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
        width: isMobile ? '100%' : '420px',
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
