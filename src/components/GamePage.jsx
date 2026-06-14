// LAB — Game Page (OddsJam/Pikkit-style game browser detail).
// Fully self-contained: imports ONLY EventsPicker (the game switcher),
// propCategories, and botShared primitives. Does NOT import or touch
// MatrixBot.jsx or any CH2/LookChannel code.
import { useState, useEffect, useMemo } from 'react'
import EventsPicker from './EventsPicker.jsx'
import { NEON, NEON_T, R, MUTED, CARD, BORDER, TEXT, DANGER, SPREAD_LABEL, BOOK_NAMES, fmtAm } from './botShared.jsx'
import { categoriesForSport, groupPropsByCategory } from '../lib/propCategories.js'

// American odds → decimal, for "best price" sorting.
const toDecimal = (am) => {
  const n = Number(am)
  if (!Number.isFinite(n) || n === 0) return 0
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n)
}

const signedPt = (pt) => {
  const n = Number(pt)
  if (!Number.isFinite(n)) return ''
  return n > 0 ? `+${n}` : `${n}`
}

const bookLabel = (b) => BOOK_NAMES[b] || (b ? b.charAt(0).toUpperCase() + b.slice(1) : '')

// Resolve the two sides (away/home or Over/Under) of a game-lines market `cmp`.
function sidesFor(cmp, key, game) {
  const outcomes = cmp?.outcomes || []
  if (!outcomes.length) return []
  if (key === 'totals') {
    const over = outcomes.find(o => /^o/i.test(o))
    const under = outcomes.find(o => /^u/i.test(o))
    return [
      { name: over || outcomes[0], label: 'Over' },
      { name: under || outcomes[1], label: 'Under' },
    ].filter(s => s.name)
  }
  // h2h / spreads — away then home, matched by team name (case-insensitive).
  const byTeam = (team) => outcomes.find(o => o && team && o.toLowerCase() === String(team).toLowerCase())
  const away = byTeam(game?.away) || outcomes[0]
  const home = byTeam(game?.home) || outcomes[1]
  return [
    { name: away, label: away },
    { name: home, label: home },
  ].filter(s => s.name)
}

// Best price row for a given outcome name in a market.
function bestRowFor(cmp, name) {
  const rows = cmp?.rows || []
  const priced = rows.filter(r => r?.prices && r.prices[name] != null)
  if (!priced.length) return null
  const bestBook = cmp?.best?.[name]?.book
  if (bestBook) {
    const hit = priced.find(r => r.book === bestBook)
    if (hit) return hit
  }
  return [...priced].sort((a, b) => toDecimal(b.prices[name]) - toDecimal(a.prices[name]))[0]
}

const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap',
      padding: '7px 13px', borderRadius: '999px',
      fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
      background: active ? 'rgba(189,255,0,0.1)' : CARD,
      border: `1px solid ${active ? NEON : BORDER}`,
      color: active ? NEON_T : MUTED,
    }}
  >{children}</button>
)

export default function GamePage({ game, sport, token, onAddToSlip, onLogPosition, onSwitchGame, onBack }) {
  const cats = categoriesForSport(sport)
  const spreadLabel = SPREAD_LABEL[sport] || 'Spread'

  const [switcherOpen, setSwitcherOpen] = useState(false)
  // market tab: 'gamelines' | 'ml' | 'totals' | 'spread'  OR category name for props
  const [tab, setTab] = useState('gamelines')

  const [lines, setLines] = useState(null)
  const [linesLoading, setLinesLoading] = useState(true)
  const [linesErr, setLinesErr] = useState(null)

  const [props, setProps] = useState(null)
  const [propsLoading, setPropsLoading] = useState(true)
  const [propsErr, setPropsErr] = useState(null)

  const [confirm, setConfirm] = useState(null) // { pick, odds, book, link, byBook }

  const eid = game?.external_event_id

  useEffect(() => { setTab('gamelines'); setConfirm(null) }, [eid])

  // Fetch game lines.
  useEffect(() => {
    if (!game?.away || !game?.home) return
    let live = true
    setLinesLoading(true); setLinesErr(null)
    const url = `/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}&eventId=${encodeURIComponent(eid || '')}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (live) setLines(j?.markets || {}) })
      .catch(e => { if (live) { setLines({}); setLinesErr(e.message || 'Failed to load') } })
      .finally(() => { if (live) setLinesLoading(false) })
    return () => { live = false }
  }, [eid, sport, token])

  // Fetch props.
  useEffect(() => {
    if (!game?.away || !game?.home) return
    let live = true
    setPropsLoading(true); setPropsErr(null)
    const url = `/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => {
        if (!live) return
        const merged = [...(j?.edges || []), ...(j?.lineShopOnly || [])]
        setProps(merged)
      })
      .catch(e => { if (live) { setProps([]); setPropsErr(e.message || 'Failed to load') } })
      .finally(() => { if (live) setPropsLoading(false) })
    return () => { live = false }
  }, [eid, sport, token])

  const groupedProps = useMemo(
    () => groupPropsByCategory(props || [], sport),
    [props, sport]
  )

  const isPropTab = cats.includes(tab)
  const eventStr = `${game?.away} vs ${game?.home}`

  // ---- confirm flow callbacks ----
  const openConfirm = (payload) => setConfirm(payload)

  const doAddSlip = () => {
    if (!confirm) return
    onAddToSlip?.({
      pick: confirm.pick, odds: confirm.odds, book: confirm.book,
      link: confirm.link, byBook: confirm.byBook, sport,
      event: eventStr,
    })
    setConfirm(null)
  }

  const doLogOpen = () => {
    if (!confirm) return
    onLogPosition?.(
      {
        sport, away_team: game?.away, home_team: game?.home, league: sport,
        external_event_id: game?.external_event_id || '', start_time: game?.commenceTime,
      },
      { pick: confirm.pick, odds: confirm.odds, book: confirm.book }
    )
    if (confirm.link) window.open(confirm.link, '_blank', 'noopener,noreferrer')
    setConfirm(null)
  }

  // ---- render helpers ----
  // Render one market block (away/home or Over/Under rows of book prices).
  const renderMarket = (key, heading) => {
    const cmp = lines?.[key]
    if (!cmp) return null
    const sides = sidesFor(cmp, key, game)
    if (!sides.length) return null
    return (
      <div key={key} style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{heading}</div>
        {sides.map(side => {
          const cmpRows = cmp.rows || []
          const best = bestRowFor(cmp, side.name)
          const priced = cmpRows.filter(r => r?.prices && r.prices[side.name] != null)
          const pt = (key !== 'h2h')
            ? (cmp.modalPoint?.[side.name] ?? best?.points?.[side.name])
            : null
          // pick label
          let pickLabel
          if (key === 'h2h') pickLabel = `${side.label} ML`
          else if (key === 'spreads') pickLabel = `${side.label} ${signedPt(pt)}`
          else pickLabel = `${side.label} ${pt ?? ''}`.trim()

          return (
            <div key={side.name} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT, marginBottom: '6px', letterSpacing: '0.03em' }}>
                {key === 'totals' ? `${side.label} ${pt ?? ''}` : key === 'spreads' ? `${side.label} ${signedPt(pt)}` : side.label}
              </div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                {priced.length === 0 && <span style={{ fontSize: '11px', color: MUTED }}>No prices</span>}
                {priced.map(r => {
                  const am = r.prices[side.name]
                  const isBest = best && r.book === best.book
                  const link = r.links?.[side.name]
                  return (
                    <button
                      key={r.book}
                      onClick={() => openConfirm({ pick: pickLabel, odds: am, book: r.book, link, byBook: null })}
                      style={{
                        flexShrink: 0, cursor: 'pointer', textAlign: 'center', minWidth: '64px',
                        padding: '6px 8px', borderRadius: '8px',
                        background: isBest ? 'rgba(189,255,0,0.08)' : CARD,
                        border: `1px solid ${isBest ? NEON : BORDER}`,
                        fontFamily: R,
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginBottom: '2px' }}>
                        {bookLabel(r.book)}{r.sharp ? ' ◆' : ''}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isBest ? NEON_T : TEXT }}>
                        {isBest ? '✓ ' : ''}{fmtAm(Number(am))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderProps = () => {
    const rows = groupedProps[tab] || []
    if (!rows.length) return <Empty>No {tab.toLowerCase()} props available.</Empty>
    // Group by market + '__' + point into Over/Under pairs.
    const pairs = {}
    for (const r of rows) {
      const k = `${r.player}__${r.market}__${r.point}`
      ;(pairs[k] = pairs[k] || { player: r.player, marketLabel: r.marketLabel || r.market, point: r.point, sides: {} })
      pairs[k].sides[r.side === 'Under' ? 'Under' : 'Over'] = r
    }
    return Object.values(pairs).map((p, i) => (
      <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 12px', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT, letterSpacing: '0.03em', marginBottom: '2px' }}>{p.player}</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginBottom: '8px' }}>{p.marketLabel} {p.point}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Over', 'Under'].map(sideName => {
            const r = p.sides[sideName]
            if (!r?.best) return <div key={sideName} style={{ flex: 1, fontSize: '11px', color: MUTED, padding: '8px', textAlign: 'center' }}>—</div>
            const pickLabel = `${p.player} ${sideName} ${p.point} ${p.marketLabel}`.trim()
            return (
              <button
                key={sideName}
                onClick={() => openConfirm({ pick: pickLabel, odds: r.best.price, book: r.best.book, link: r.best.link, byBook: r.byBook })}
                style={{
                  flex: 1, cursor: 'pointer', textAlign: 'center', padding: '8px',
                  borderRadius: '8px', background: 'rgba(189,255,0,0.06)',
                  border: `1px solid ${NEON}`, fontFamily: R,
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>{sideName} · {bookLabel(r.best.book)}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: NEON_T, marginTop: '2px' }}>{fmtAm(Number(r.best.price))}</div>
              </button>
            )
          })}
        </div>
      </div>
    ))
  }

  const hasAnyLines = lines && (lines.h2h || lines.spreads || lines.totals)

  const renderLines = () => {
    if (linesLoading) return <Empty>Loading lines…</Empty>
    if (!hasAnyLines) return <Empty>{linesErr ? `Could not load lines (${linesErr}).` : 'No game lines available.'}</Empty>
    if (tab === 'gamelines') {
      return (
        <>
          {renderMarket('h2h', 'Moneyline')}
          {renderMarket('spreads', spreadLabel)}
          {renderMarket('totals', 'Totals')}
        </>
      )
    }
    if (tab === 'ml') return renderMarket('h2h', 'Moneyline') || <Empty>No moneyline.</Empty>
    if (tab === 'totals') return renderMarket('totals', 'Totals') || <Empty>No totals.</Empty>
    if (tab === 'spread') return renderMarket('spreads', spreadLabel) || <Empty>No {spreadLabel.toLowerCase()}.</Empty>
    return null
  }

  const renderBody = () => {
    if (isPropTab) {
      if (propsLoading) return <Empty>Loading props…</Empty>
      if (propsErr && !(props || []).length) return <Empty>Could not load props ({propsErr}).</Empty>
      return renderProps()
    }
    return renderLines()
  }

  return (
    <div style={{ width: '100%', fontFamily: R }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <button
          onClick={onBack}
          style={{ flexShrink: 0, cursor: 'pointer', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '7px 11px', fontFamily: R, fontSize: '12px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}
        >← Games</button>
        <button
          onClick={() => setSwitcherOpen(o => !o)}
          style={{ flex: 1, cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', fontFamily: R, fontSize: '16px', fontWeight: 700, color: TEXT, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
        >
          <span>{(game?.away_abbr || game?.away)} @ {(game?.home_abbr || game?.home)}</span>
          <span style={{ color: NEON_T, fontSize: '13px' }}>{switcherOpen ? '▴' : '▾'}</span>
        </button>
      </div>

      {switcherOpen && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
          <EventsPicker
            sport={sport}
            onPickSport={() => {}}
            onPickGame={(g) => { setSwitcherOpen(false); onSwitchGame?.(g) }}
            token={token}
          />
        </div>
      )}

      {/* Prop category tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '8px' }}>
        {cats.map(c => (
          <Pill key={c} active={tab === c} onClick={() => setTab(c)}>{c}</Pill>
        ))}
      </div>

      {/* Market tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
        <Pill active={tab === 'gamelines'} onClick={() => setTab('gamelines')}>Game Lines</Pill>
        <Pill active={tab === 'ml'} onClick={() => setTab('ml')}>Moneyline</Pill>
        <Pill active={tab === 'totals'} onClick={() => setTab('totals')}>Totals</Pill>
        <Pill active={tab === 'spread'} onClick={() => setTab('spread')}>{spreadLabel}</Pill>
      </div>

      {/* Confirm bar */}
      {confirm && (
        <div style={{ background: 'rgba(189,255,0,0.06)', border: `1px solid ${NEON}`, borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT, marginBottom: '8px', letterSpacing: '0.03em' }}>
            {confirm.pick} <span style={{ color: NEON_T }}>{fmtAm(Number(confirm.odds))}</span>
            <span style={{ color: MUTED, fontSize: '11px' }}> · {bookLabel(confirm.book)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={doAddSlip} style={{ flex: 1, cursor: 'pointer', padding: '9px', borderRadius: '8px', background: 'rgba(189,255,0,0.12)', border: `1px solid ${NEON}`, color: NEON_T, fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em' }}>+ Slip</button>
            <button onClick={doLogOpen} style={{ flex: 1, cursor: 'pointer', padding: '9px', borderRadius: '8px', background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em' }}>Log &amp; Open</button>
            <button onClick={() => setConfirm(null)} style={{ flexShrink: 0, cursor: 'pointer', padding: '9px 11px', borderRadius: '8px', background: 'transparent', border: `1px solid ${BORDER}`, color: DANGER, fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Body */}
      {renderBody()}
    </div>
  )
}

function Empty({ children }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 12px', fontSize: '12px', color: MUTED, letterSpacing: '0.04em', fontFamily: R }}>
      {children}
    </div>
  )
}
