import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { X, Download, Share2 } from 'lucide-react'

const NEON   = '#BDFF00'
const RED    = '#FF3B3B'
const YELLOW = '#F5A623'
const BG     = '#0A0A0A'
const CARD   = '#111111'
const R      = 'Rajdhani, sans-serif'

const fmt$ = (v, sign = false) => {
  const abs = Math.abs(v)
  const str = abs >= 1000
    ? '$' + (abs / 1000).toFixed(1) + 'k'
    : '$' + abs.toFixed(2)
  if (sign && v > 0) return '+' + str
  if (v < 0) return '-' + str
  return str
}
const fmtOdds = (v) => v > 0 ? `+${v}` : `${v}`
const fmtU    = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(2)}u`

// ── BET SHARE CARD (rendered off-screen, then captured) ─────────────────────
function BetShareCardInner({ bet, unitSize, bankIn, theme }) {
  const isDark  = theme === 'dark'
  const bg      = isDark ? BG : '#F5F5F5'
  const cardBg  = isDark ? CARD : '#FFFFFF'
  const text    = isDark ? '#FFFFFF' : '#0A0A0A'
  const sub     = isDark ? '#888888' : '#666666'
  const border  = isDark ? '#222222' : '#DDDDDD'

  const isOpen   = bet.result === 'Open'
  const isLadder = !!bet.ladder

  const toWin = bet.stake > 0 && bet.odds
    ? (bet.odds > 0 ? bet.stake * bet.odds / 100 : bet.stake * 100 / Math.abs(bet.odds))
    : 0

  const pnlDollar = isLadder
    ? bet.pnl
    : (bet.units > 0 && bet.stake > 0) ? bet.pnl * (bet.stake / bet.units) : bet.pnl * (unitSize || 20)

  const pnlColor    = pnlDollar > 0 ? NEON : pnlDollar < 0 ? RED : sub
  const accentColor = bet.result === 'W' ? NEON : bet.result === 'L' ? RED : isOpen ? YELLOW : sub
  const statusLabel = isOpen ? 'PENDING' : bet.result === 'W' ? 'WIN' : bet.result === 'L' ? 'LOSS' : 'PUSH'
  const statusColor = isOpen ? YELLOW : bet.result === 'W' ? NEON : bet.result === 'L' ? RED : sub

  return (
    <div style={{
      width: '360px',
      background: bg,
      fontFamily: R,
      padding: '16px',
      boxSizing: 'border-box',
    }}>
      {/* Header: RML logo + branding */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '20px', background: NEON, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 900, color: BG, letterSpacing: '-0.5px' }}>RM</span>
          </div>
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: text, letterSpacing: '0.15em' }}>RISK MATRIX</span>
        </div>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, color: NEON, letterSpacing: '0.15em' }}>riskmatrixlabs.com</span>
      </div>

      {/* Card */}
      <div style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        {/* Event */}
        {(bet.event || isLadder) && (
          <div style={{ padding: '8px 12px 0', fontSize: '9px', color: sub, letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isLadder ? `PHLT™ LADDER · RUNG ${bet.ladderId}` : bet.event}
          </div>
        )}

        {/* Pick + main value */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px 4px', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: isOpen ? YELLOW : text, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLadder && isOpen ? `RUNG ${bet.ladderId} · ${bet.pick || 'TBD'}` : (bet.pick || '—')}
            </div>
            {bet.date && !isOpen && (
              <div style={{ fontSize: '9px', color: sub, marginTop: '2px' }}>{bet.date}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {isOpen ? (
              <>
                <div style={{ fontSize: '18px', fontWeight: 700, color: YELLOW, lineHeight: 1 }}>
                  {toWin > 0 ? `+${fmt$(toWin)}` : '—'}
                </div>
                <div style={{ fontSize: '8px', color: sub, marginTop: '1px', letterSpacing: '0.08em' }}>to win</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '18px', fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
                  {(pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar)}
                </div>
                <div style={{ fontSize: '8px', color: sub, marginTop: '1px', letterSpacing: '0.08em' }}>P&amp;L</div>
              </>
            )}
          </div>
        </div>

        {/* Status + meta row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden' }}>
          <span style={{
            fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em',
            color: statusColor,
            background: isOpen ? 'rgba(245,166,35,0.12)' : bet.result === 'W' ? 'rgba(189,255,0,0.08)' : bet.result === 'L' ? 'rgba(255,59,59,0.08)' : 'transparent',
            border: `1px solid ${isOpen ? 'rgba(245,166,35,0.4)' : bet.result === 'W' ? 'rgba(189,255,0,0.25)' : bet.result === 'L' ? 'rgba(255,59,59,0.25)' : border}`,
            padding: '1px 6px', borderRadius: '4px', flexShrink: 0,
          }}>{statusLabel}</span>
          {bet.book  && <span style={{ fontSize: '9px', color: NEON, flexShrink: 0 }}>{bet.book}</span>}
          {bet.sport && <span style={{ fontSize: '9px', color: sub, flexShrink: 0 }}>{bet.sport}</span>}
          {bet.confidence > 0 && <span style={{ fontSize: '9px', letterSpacing: '-1px', flexShrink: 0 }}>{'⭐'.repeat(bet.confidence)}</span>}
          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: bet.odds > 0 ? NEON : text, marginLeft: 'auto', flexShrink: 0 }}>{fmtOdds(bet.odds)}</span>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', borderTop: `1px solid ${border}` }}>
          {isOpen ? [
            { label: 'STAKE',  val: bet.stake > 0 ? fmt$(bet.stake) : '—',       color: text },
            { label: 'TO WIN', val: toWin > 0 ? `+${fmt$(toWin)}` : '—',         color: NEON },
            { label: isLadder ? 'BANK' : 'UNITS', val: isLadder ? (bankIn != null ? fmt$(bankIn) : '—') : (bet.units > 0 ? `${bet.units}u` : '—'), color: text },
          ] : [
            { label: 'ODDS',    val: fmtOdds(bet.odds),                                                color: bet.odds > 0 ? NEON : text },
            { label: 'WAGERED', val: bet.stake > 0 ? fmt$(bet.stake) : `${bet.units}u`,               color: text },
            { label: 'P&L',     val: (pnlDollar >= 0 ? '+' : '') + fmt$(pnlDollar),                   color: pnlColor },
          ].map(({ label, val, color }, idx) => (
            <div key={label} style={{ flex: 1, padding: '6px 10px', borderRight: idx < 2 ? `1px solid ${border}` : 'none' }}>
              <div style={{ fontSize: '7px', fontWeight: 600, letterSpacing: '0.1em', color: sub, textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '8px', color: sub, letterSpacing: '0.06em' }}>Operate With Discipline 🛡️</span>
        <span style={{ fontSize: '8px', fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>riskmatrixlabs.com</span>
      </div>
    </div>
  )
}

// ── SESSION SHARE CARD ───────────────────────────────────────────────────────
function SessionShareCardInner({ stats, username, bankroll, masterBankroll, bets, theme }) {
  const isDark = theme === 'dark'
  const bg     = isDark ? BG : '#F5F5F5'
  const cardBg = isDark ? CARD : '#FFFFFF'
  const text   = isDark ? '#FFFFFF' : '#0A0A0A'
  const sub    = isDark ? '#888888' : '#666666'
  const border = isDark ? '#222222' : '#DDDDDD'

  const netPnl   = stats.netPnl$ || 0
  const pnlColor = netPnl >= 0 ? NEON : RED
  const roi      = ((stats.roi || 0) * 100).toFixed(1)

  return (
    <div style={{ width: '360px', background: bg, fontFamily: R, padding: '16px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '22px', height: '22px', background: NEON, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 900, color: BG, letterSpacing: '-0.5px' }}>RM</span>
          </div>
          <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: text, letterSpacing: '0.15em' }}>RISK MATRIX</span>
        </div>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, color: sub, letterSpacing: '0.1em' }}>{username}</span>
      </div>

      {/* Big P&L */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `3px solid ${pnlColor}`, borderRadius: '4px', padding: '14px 16px', marginBottom: '10px' }}>
        <div style={{ fontSize: '9px', color: sub, letterSpacing: '0.12em', marginBottom: '4px' }}>SESSION P&amp;L</div>
        <div style={{ fontSize: '32px', fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
          {(netPnl >= 0 ? '+' : '') + fmt$(netPnl)}
        </div>
        <div style={{ fontSize: '10px', color: sub, marginTop: '4px' }}>
          ROI {roi}% · {stats.wins}W {stats.losses}L · {(stats.winRate * 100).toFixed(1)}% WR
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'BANKROLL', val: fmt$(masterBankroll), color: text },
          { label: 'TOTAL BETS', val: String(stats.total), color: text },
          { label: 'NET UNITS', val: fmtU(stats.netPnlU), color: stats.netPnlU >= 0 ? NEON : RED },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ fontSize: '7px', fontWeight: 600, color: sub, letterSpacing: '0.1em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '8px', color: sub, letterSpacing: '0.06em' }}>Operate With Discipline 🛡️</span>
        <span style={{ fontSize: '8px', fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>riskmatrixlabs.com</span>
      </div>
    </div>
  )
}

// ── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function ShareCardModal({ mode, bet, stats, username, bankroll, masterBankroll, bets, unitSize, bankIn, onClose }) {
  const cardRef   = useRef(null)
  const [theme, setTheme]       = useState('dark')
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState('')   // 'sharing' | 'done' | 'error'

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const generateImage = async () => {
    if (!cardRef.current) return null
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      logging: false,
    })
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
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
        // Fallback: download
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
    } finally {
      setLoading(false)
    }
  }

  const isMobile = window.innerWidth < 768

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 400,
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #222',
        borderTop: `2px solid ${NEON}`,
        borderRadius: isMobile ? '12px 12px 0 0' : '4px',
        width: isMobile ? '100%' : '420px',
        maxHeight: isMobile ? '92vh' : '90vh',
        overflowY: 'auto',
        padding: '20px 18px 28px',
        boxSizing: 'border-box',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={14} color={NEON} />
            <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: NEON }}>
              {mode === 'session' ? 'SHARE SESSION' : 'SHARE BET'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* Dark / Light toggle */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {['dark', 'light'].map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
              padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
              background: theme === t ? NEON : 'transparent',
              color: theme === t ? BG : '#888',
              border: `1px solid ${theme === t ? NEON : '#333'}`,
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {/* Card preview — centered, scrollable */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #222' }}>
          <div ref={cardRef}>
            {mode === 'session' ? (
              <SessionShareCardInner
                stats={stats} username={username} bankroll={bankroll}
                masterBankroll={masterBankroll} bets={bets} theme={theme}
              />
            ) : (
              <BetShareCardInner bet={bet} unitSize={unitSize} bankIn={bankIn} theme={theme} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleDownload} disabled={loading} style={{
            fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
            padding: '10px 0', flex: 1, border: '1px solid #333', borderRadius: '2px',
            background: 'transparent', color: '#888', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            <Download size={12} /> Save Image
          </button>
          <button onClick={handleShare} disabled={loading} style={{
            fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
            padding: '10px 0', flex: 2, border: `1px solid ${NEON}`,
            borderRadius: '2px', background: loading ? 'rgba(189,255,0,0.08)' : 'rgba(189,255,0,0.12)',
            color: NEON, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            <Share2 size={12} />
            {loading ? 'Generating...' : canNativeShare ? 'Share via...' : 'Download Card'}
          </button>
        </div>

        {status === 'error' && (
          <div style={{ marginTop: '10px', textAlign: 'center', fontFamily: R, fontSize: '11px', color: RED }}>
            Something went wrong. Try Save Image instead.
          </div>
        )}
      </div>
    </div>
  )
}
