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
  // market tab: 'gamelines' | 'ml' | 'totals' | 'spread' | 'teamtotal'  OR category name for props
  const [tab, setTab] = useState('gamelines')
  // prop subtype filter (a marketLabel within the active category, e.g. "Hits"); null = all
  const [subtab, setSubtab] = useState(null)

  const [lines, setLines] = useState(null)
  const [segments, setSegments] = useState(null)
  const [teamTotals, setTeamTotals] = useState(null)
  const [linesLoading, setLinesLoading] = useState(true)
  const [linesErr, setLinesErr] = useState(null)

  const [props, setProps] = useState(null)
  const [propsLoading, setPropsLoading] = useState(true)
  const [propsErr, setPropsErr] = useState(null)

  const [confirm, setConfirm] = useState(null) // { pick, odds, book, link, byBook }

  const eid = game?.external_event_id

  useEffect(() => { setTab('gamelines'); setConfirm(null) }, [eid])
  // reset the prop subtype filter whenever the top tab changes
  useEffect(() => { setSubtab(null) }, [tab])

  // Fetch game lines.
  useEffect(() => {
    if (!game?.away || !game?.home) return
    let live = true
    setLinesLoading(true); setLinesErr(null)
    const url = `/api/game-lines?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}&eventId=${encodeURIComponent(eid || '')}&full=1`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (live) { setLines(j?.markets || {}); setSegments(j?.segments || null); setTeamTotals(j?.teamTotals || null) } })
      .catch(e => { if (live) { setLines({}); setSegments(null); setTeamTotals(null); setLinesErr(e.message || 'Failed to load') } })
      .finally(() => { if (live) setLinesLoading(false) })
    return () => { live = false }
  }, [eid, sport, token])

  // Fetch props.
  useEffect(() => {
    if (!game?.away || !game?.home) return
    let live = true
    setPropsLoading(true); setPropsErr(null)
    const url = `/api/scan-props?sport=${encodeURIComponent(sport)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}&full=1`
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

  // Footer: local start time + best-effort market/prop count.
  const startClock = (() => {
    try { return new Date(game?.commenceTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
    catch { return '' }
  })()
  const marketCount = ['h2h', 'spreads', 'totals'].filter(k => lines?.[k]).length
  const propCount = (props || []).length

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

  // Distinct subtype labels (marketLabels) within the active prop category, for the sub-tab row.
  const subtypesForActive = () => {
    if (!isPropTab) return []
    const rows = groupedProps[tab] || []
    const seen = []
    for (const r of rows) { const l = r.marketLabel || r.market; if (l && !seen.includes(l)) seen.push(l) }
    return seen
  }

  // ---- render helpers ----
  const renderProps = () => {
    let rows = groupedProps[tab] || []
    // filter to the selected subtype (marketLabel) when one is active
    if (subtab) rows = rows.filter(r => (r.marketLabel || r.market) === subtab)
    if (!rows.length) return <Empty>No {subtab || tab} props posted yet.</Empty>
    // Group by player+market+point into Over/Under pairs.
    const pairs = {}
    for (const r of rows) {
      const k = `${r.player}__${r.market}__${r.point}`
      ;(pairs[k] = pairs[k] || { player: r.player, marketLabel: r.marketLabel || r.market, point: r.point, team: r.team, pos: r.pos, sides: {} })
      pairs[k].sides[r.side === 'Under' ? 'Under' : 'Over'] = r
    }
    // Same player's lines group together, stable order.
    const cards = Object.values(pairs).sort((a, b) =>
      String(a.player || '').localeCompare(String(b.player || '')) ||
      String(a.marketLabel || '').localeCompare(String(b.marketLabel || ''))
    )
    const sideBtn = (p, sideName) => {
      const r = p.sides[sideName]
      const prefix = sideName === 'Under' ? 'u' : 'o'
      if (!r?.best) return (
        <div style={{ width: '72px', flexShrink: 0, textAlign: 'center', padding: '6px 4px', borderRadius: '8px', background: CARD, border: `1px solid ${BORDER}`, fontSize: '12px', color: MUTED, fontFamily: R }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.03em' }}>{prefix}{p.point}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: MUTED, marginTop: '2px' }}>—</div>
        </div>
      )
      const pickLabel = `${p.player} ${sideName} ${p.point} ${p.marketLabel}`.trim()
      return (
        <button
          onClick={() => openConfirm({ pick: pickLabel, odds: r.best.price, book: r.best.book, link: r.best.link, byBook: r.byBook })}
          style={{ position: 'relative', width: '72px', flexShrink: 0, cursor: 'pointer', textAlign: 'center', padding: '6px 4px', borderRadius: '8px', background: 'rgba(189,255,0,0.06)', border: `1px solid ${NEON}`, fontFamily: R }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.03em' }}>{prefix}{p.point}</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: NEON_T, marginTop: '2px' }}>{fmtAm(Number(r.best.price))}</div>
          <div style={{ fontSize: '9px', color: MUTED, marginTop: '1px' }}>{bookLabel(r.best.book)}</div>
          <BookGlyph />
        </button>
      )
    }
    const initial = (s) => (s ? String(s).trim().charAt(0).toUpperCase() : '?')
    return (
      <div>
        {/* right-aligned Over / Under column header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px', paddingRight: '2px' }}>
          {['Over', 'Under'].map(h => (
            <div key={h} style={{ width: '72px', textAlign: 'center', fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {cards.map((p, i) => {
          const sub = [p.team, p.pos].filter(Boolean).join(' · ')
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
              <span style={{
                flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: CARD, border: `1px solid ${BORDER}`,
                color: TEXT, fontSize: '13px', fontWeight: 700,
              }}>{initial(p.player)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: TEXT, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player}</div>
                {sub ? <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.03em' }}>{sub}</div> : null}
                <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginTop: '1px' }}>{p.marketLabel} {p.point}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{sideBtn(p, 'Over')}{sideBtn(p, 'Under')}</div>
            </div>
          )
        })}
      </div>
    )
  }

  const hasAnyLines = lines && (lines.h2h || lines.spreads || lines.totals)

  // Tiny rounded NEON glyph standing in for a sportsbook icon (reference look).
  const BookGlyph = () => (
    <span style={{
      position: 'absolute', right: '4px', bottom: '4px',
      width: '10px', height: '10px', borderRadius: '3px',
      background: NEON, opacity: 0.85,
    }} />
  )

  // One compact market cell (ML / Spread / Total) for a given team row.
  // `which` is 'away' | 'home' (drives Over vs Under on totals).
  const GridCell = ({ marketKey, which }) => {
    const cmp = lines?.[marketKey]
    // Resolve the outcome name + best price for this team's side of the market.
    let outcomeName = null
    let pt = null
    let label = '' // top text inside the cell
    let pickLabel = ''
    const teamName = which === 'away' ? game?.away : game?.home

    if (cmp) {
      if (marketKey === 'h2h') {
        outcomeName = teamName
        const sides = sidesFor(cmp, 'h2h', game)
        const hit = sides.find(s => String(s.name).toLowerCase() === String(teamName).toLowerCase())
        if (hit) outcomeName = hit.name
        pickLabel = `${teamName} ML`
      } else if (marketKey === 'spreads') {
        outcomeName = teamName
        const sides = sidesFor(cmp, 'spreads', game)
        const hit = sides.find(s => String(s.name).toLowerCase() === String(teamName).toLowerCase())
        if (hit) outcomeName = hit.name
      } else if (marketKey === 'totals') {
        const sides = sidesFor(cmp, 'totals', game)
        const want = which === 'away' ? 'Over' : 'Under'
        const hit = sides.find(s => s.label === want) || sides[which === 'away' ? 0 : 1]
        outcomeName = hit?.name
      }
    }

    const best = (cmp && outcomeName) ? bestRowFor(cmp, outcomeName) : null
    if (cmp && outcomeName && marketKey !== 'h2h') {
      pt = cmp.modalPoint?.[outcomeName] ?? best?.points?.[outcomeName]
    }

    if (marketKey === 'spreads' && best) {
      label = signedPt(pt)
      pickLabel = `${teamName} ${signedPt(pt)}`.trim()
    } else if (marketKey === 'totals' && best) {
      const prefix = which === 'away' ? 'o' : 'u'
      label = `${prefix}${pt ?? ''}`
      pickLabel = `${which === 'away' ? 'Over' : 'Under'} ${pt ?? ''}`.trim()
    }

    const am = best ? best.prices?.[outcomeName] : null
    const empty = am == null

    const cellStyle = {
      position: 'relative', width: '64px', flexShrink: 0,
      padding: '7px 6px', borderRadius: '8px',
      background: CARD, border: `1px solid ${BORDER}`,
      fontFamily: R, textAlign: 'center',
      cursor: empty ? 'default' : 'pointer',
      opacity: empty ? 0.5 : 1,
    }

    if (empty) {
      return (
        <div style={cellStyle}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: MUTED }}>—</div>
        </div>
      )
    }

    const link = best.links?.[outcomeName]
    return (
      <button
        onClick={() => openConfirm({ pick: pickLabel, odds: am, book: best.book, link, byBook: null })}
        style={cellStyle}
      >
        {label ? (
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.02em', marginBottom: '1px' }}>{label}</div>
        ) : null}
        <div style={{ fontSize: '13px', fontWeight: 700, color: TEXT }}>{fmtAm(Number(am))}</div>
        <BookGlyph />
      </button>
    )
  }

  // A large two-cell tappable card (used by Moneyline / Totals / Run Line / Team Total).
  // `top` is the small header line, `mid` the large price, `book` the book label.
  const BigCell = ({ top, mid, book, onClick, disabled }) => (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        position: 'relative', flex: 1, minWidth: 0,
        padding: '14px 10px 16px', borderRadius: '12px',
        background: disabled ? CARD : 'rgba(189,255,0,0.06)',
        border: `1px solid ${disabled ? BORDER : NEON}`,
        fontFamily: R, textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.05em', marginBottom: '6px', textTransform: 'uppercase' }}>{top}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: disabled ? MUTED : NEON_T, letterSpacing: '0.02em' }}>{mid}</div>
      {!disabled && book ? <div style={{ fontSize: '9px', color: MUTED, marginTop: '4px' }}>{bookLabel(book)}</div> : null}
      {!disabled && <BookGlyph />}
    </button>
  )

  // Visual-only point slider: a pill strip of point values centered on the modal point.
  // point slider is visual-only — alt-point odds aren't in our feed yet
  const PointSlider = ({ main }) => {
    const n = Number(main)
    if (!Number.isFinite(n)) return null
    const steps = [n - 2, n - 1, n, n + 1, n + 2]
    return (
      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', overflowX: 'auto', paddingBottom: '2px' }}>
          {steps.map((s, i) => {
            const active = i === 2
            return (
              // tapping a non-main point does nothing yet — we only have the main line in data
              <div key={i} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: '999px',
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em', fontFamily: R,
                background: active ? 'rgba(189,255,0,0.1)' : CARD,
                border: `1px solid ${active ? NEON : BORDER}`,
                color: active ? NEON_T : MUTED,
              }}>{s}</div>
            )
          })}
        </div>
        {/* View all is a non-functional placeholder — alt lines aren't in our feed yet */}
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>View all</div>
      </div>
    )
  }

  // MONEYLINE tab — two equal cells (away | home), best ML price each. Uses h2h market.
  const renderMoneylineTwoCell = () => {
    const cmp = lines?.h2h
    if (!cmp) return <Empty>Moneyline not posted yet.</Empty>
    const sides = sidesFor(cmp, 'h2h', game)
    if (!sides.length) return <Empty>Moneyline not posted yet.</Empty>
    const order = ['away', 'home'].map(which => {
      const team = which === 'away' ? game?.away : game?.home
      const hit = sides.find(s => String(s.name).toLowerCase() === String(team).toLowerCase())
      return { which, team: which === 'away' ? (game?.away_abbr || game?.away) : (game?.home_abbr || game?.home), name: hit?.name || team }
    })
    return (
      <div style={{ display: 'flex', gap: '10px' }}>
        {order.map(o => {
          const best = bestRowFor(cmp, o.name)
          const am = best ? best.prices?.[o.name] : null
          const empty = am == null
          return (
            <BigCell key={o.which} disabled={empty}
              top={o.team} mid={empty ? '—' : fmtAm(Number(am))} book={best?.book}
              onClick={() => openConfirm({ pick: `${o.team} ML`, odds: am, book: best.book, link: best.links?.[o.name], byBook: null })}
            />
          )
        })}
      </div>
    )
  }

  // TOTALS tab — Over/Under two cells + visual point slider.
  const renderTotalsTwoCell = () => {
    const cmp = lines?.totals
    if (!cmp) return <Empty>Totals not posted yet.</Empty>
    const sides = sidesFor(cmp, 'totals', game)
    if (!sides.length) return <Empty>Totals not posted yet.</Empty>
    const over = sides.find(s => s.label === 'Over') || sides[0]
    const under = sides.find(s => s.label === 'Under') || sides[1]
    const cellFor = (s, prefix, label) => {
      if (!s?.name) return <BigCell disabled top={label} mid="—" />
      const best = bestRowFor(cmp, s.name)
      const pt = cmp.modalPoint?.[s.name] ?? best?.points?.[s.name]
      const am = best ? best.prices?.[s.name] : null
      if (am == null) return <BigCell disabled top={`${prefix}${pt ?? ''}`} mid="—" />
      return (
        <BigCell top={`${prefix}${pt ?? ''}`} mid={fmtAm(Number(am))} book={best.book}
          onClick={() => openConfirm({ pick: `${label} ${pt ?? ''}`.trim(), odds: am, book: best.book, link: best.links?.[s.name], byBook: null })}
        />
      )
    }
    const mainPt = (over?.name && (cmp.modalPoint?.[over.name] ?? bestRowFor(cmp, over.name)?.points?.[over.name]))
    return (
      <div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {cellFor(over, 'o', 'Over')}
          {cellFor(under, 'u', 'Under')}
        </div>
        <PointSlider main={mainPt} />
      </div>
    )
  }

  // SPREAD / RUN LINE tab — away row + home row (signed point) + visual slider.
  const renderSpreadCells = () => {
    const cmp = lines?.spreads
    if (!cmp) return <Empty>{spreadLabel} not posted yet.</Empty>
    const sides = sidesFor(cmp, 'spreads', game)
    if (!sides.length) return <Empty>{spreadLabel} not posted yet.</Empty>
    const order = ['away', 'home'].map(which => {
      const team = which === 'away' ? game?.away : game?.home
      const teamLbl = which === 'away' ? (game?.away_abbr || game?.away) : (game?.home_abbr || game?.home)
      const hit = sides.find(s => String(s.name).toLowerCase() === String(team).toLowerCase())
      return { which, teamLbl, name: hit?.name || team }
    })
    let mainPt = null
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {order.map(o => {
            const best = bestRowFor(cmp, o.name)
            const pt = cmp.modalPoint?.[o.name] ?? best?.points?.[o.name]
            if (mainPt == null && Number.isFinite(Number(pt))) mainPt = Math.abs(Number(pt))
            const am = best ? best.prices?.[o.name] : null
            const empty = am == null
            return (
              <BigCell key={o.which} disabled={empty}
                top={`${o.teamLbl} ${signedPt(pt)}`} mid={empty ? '—' : fmtAm(Number(am))} book={best?.book}
                onClick={() => openConfirm({ pick: `${o.teamLbl} ${signedPt(pt)}`.trim(), odds: am, book: best.book, link: best.links?.[o.name], byBook: null })}
              />
            )
          })}
        </div>
        <PointSlider main={mainPt} />
      </div>
    )
  }

  // TEAM TOTAL tab — Over/Under per team, sourced from the ?full=1 `teamTotals` payload:
  //   { [teamName]: { over:{point,best:{book,price}}, under:{point,best:{book,price}} } }
  const renderTeamTotal = () => {
    if (!teamTotals || !Object.keys(teamTotals).length) return <Empty>Team totals not posted yet.</Empty>
    const section = (teamName, teamLbl) => {
      const tt = teamTotals[teamName]
      if (!tt || (!tt.over && !tt.under)) return <Empty>Team total not posted for {teamLbl}.</Empty>
      const cellFor = (side, prefix, label) => {
        const pt = side?.point
        const am = side?.best?.price
        if (am == null) return <BigCell disabled top={`${prefix}${pt ?? ''}`} mid="—" />
        return (
          <BigCell top={`${prefix}${pt ?? ''}`} mid={fmtAm(Number(am))} book={side.best.book}
            onClick={() => openConfirm({ pick: `${teamLbl} Team Total ${label} ${pt ?? ''}`.trim(), odds: am, book: side.best.book, link: null, byBook: null })}
          />
        )
      }
      return (
        <div style={{ display: 'flex', gap: '10px' }}>
          {cellFor(tt.over, 'o', 'Over')}
          {cellFor(tt.under, 'u', 'Under')}
        </div>
      )
    }
    return (
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Team Total — {game?.away_abbr || game?.away}</div>
        {section(game?.away, game?.away_abbr || game?.away)}
        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '16px 0 8px' }}>Team Total — {game?.home_abbr || game?.home}</div>
        {section(game?.home, game?.home_abbr || game?.home)}
      </div>
    )
  }

  // SEGMENT tabs (1st Inning / First 5 / First 7) — render whichever sub-markets the
  // segment payload carries (h2h / spreads / totals), reusing the base visual treatment.
  const SEG_NAMES = { '1st_1': '1st Inning', '1st_5': 'First 5', '1st_7': 'First 7' }
  const renderSegment = (segKey) => {
    const seg = segments?.[segKey]
    const segName = SEG_NAMES[segKey] || segKey
    if (!seg || (!seg.h2h && !seg.spreads && !seg.totals)) return <Empty>Not posted yet.</Empty>

    const blocks = []

    // h2h → two-cell Moneyline-style (away | home best price).
    if (seg.h2h) {
      const cmp = seg.h2h
      const sides = sidesFor(cmp, 'h2h', game)
      const order = ['away', 'home'].map(which => {
        const team = which === 'away' ? game?.away : game?.home
        const teamLbl = which === 'away' ? (game?.away_abbr || game?.away) : (game?.home_abbr || game?.home)
        const hit = sides.find(s => String(s.name).toLowerCase() === String(team).toLowerCase())
        return { which, teamLbl, name: hit?.name || team }
      })
      blocks.push(
        <div key="h2h" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Moneyline</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {order.map(o => {
              const best = bestRowFor(cmp, o.name)
              const am = best ? best.prices?.[o.name] : null
              const empty = am == null
              return (
                <BigCell key={o.which} disabled={empty}
                  top={o.teamLbl} mid={empty ? '—' : fmtAm(Number(am))} book={best?.book}
                  onClick={() => openConfirm({ pick: `${o.teamLbl} ML (${segName})`, odds: am, book: best.book, link: best.links?.[o.name], byBook: null })}
                />
              )
            })}
          </div>
        </div>
      )
    }

    // spreads → away/home signed-point cells.
    if (seg.spreads) {
      const cmp = seg.spreads
      const sides = sidesFor(cmp, 'spreads', game)
      const order = ['away', 'home'].map(which => {
        const team = which === 'away' ? game?.away : game?.home
        const teamLbl = which === 'away' ? (game?.away_abbr || game?.away) : (game?.home_abbr || game?.home)
        const hit = sides.find(s => String(s.name).toLowerCase() === String(team).toLowerCase())
        return { which, teamLbl, name: hit?.name || team }
      })
      blocks.push(
        <div key="spreads" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{spreadLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {order.map(o => {
              const best = bestRowFor(cmp, o.name)
              const pt = cmp.modalPoint?.[o.name] ?? best?.points?.[o.name]
              const am = best ? best.prices?.[o.name] : null
              const empty = am == null
              return (
                <BigCell key={o.which} disabled={empty}
                  top={`${o.teamLbl} ${signedPt(pt)}`} mid={empty ? '—' : fmtAm(Number(am))} book={best?.book}
                  onClick={() => openConfirm({ pick: `${o.teamLbl} ${signedPt(pt)} (${segName})`.trim(), odds: am, book: best.book, link: best.links?.[o.name], byBook: null })}
                />
              )
            })}
          </div>
        </div>
      )
    }

    // totals → Over/Under cells.
    if (seg.totals) {
      const cmp = seg.totals
      const sides = sidesFor(cmp, 'totals', game)
      const over = sides.find(s => s.label === 'Over') || sides[0]
      const under = sides.find(s => s.label === 'Under') || sides[1]
      const cellFor = (s, prefix, label) => {
        if (!s?.name) return <BigCell disabled top={label} mid="—" />
        const best = bestRowFor(cmp, s.name)
        const pt = cmp.modalPoint?.[s.name] ?? best?.points?.[s.name]
        const am = best ? best.prices?.[s.name] : null
        if (am == null) return <BigCell disabled top={`${prefix}${pt ?? ''}`} mid="—" />
        return (
          <BigCell top={`${prefix}${pt ?? ''}`} mid={fmtAm(Number(am))} book={best.book}
            onClick={() => openConfirm({ pick: `${label} ${pt ?? ''} (${segName})`.trim(), odds: am, book: best.book, link: best.links?.[s.name], byBook: null })}
          />
        )
      }
      blocks.push(
        <div key="totals" style={{ marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Total</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {cellFor(over, 'o', 'Over')}
            {cellFor(under, 'u', 'Under')}
          </div>
        </div>
      )
    }

    return <div>{blocks}</div>
  }

  // Compact OddsJam-style two-row grid: AWAY then HOME, each with ML/Spread/Total cells.
  const renderGameLinesGrid = () => {
    const rows = [
      { which: 'away', team: game?.away_abbr || game?.away, name: game?.away },
      { which: 'home', team: game?.home_abbr || game?.home, name: game?.home },
    ]
    const initial = (s) => (s ? String(s).trim().charAt(0).toUpperCase() : '?')
    return (
      <div style={{ marginBottom: '4px' }}>
        {/* column headers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingLeft: '2px' }}>
          <div style={{ flex: 1 }} />
          {['ML', spreadLabel, 'Total'].map(h => (
            <div key={h} style={{ width: '64px', flexShrink: 0, textAlign: 'center', fontSize: '9px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {rows.map(row => (
          <div key={row.which} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            {/* team identity */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{
                flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(189,255,0,0.1)', border: `1px solid ${NEON}`,
                color: NEON_T, fontSize: '12px', fontWeight: 700,
              }}>{initial(row.name)}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: TEXT, letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.team}</span>
            </div>
            <GridCell marketKey="h2h" which={row.which} />
            <GridCell marketKey="spreads" which={row.which} />
            <GridCell marketKey="totals" which={row.which} />
          </div>
        ))}
      </div>
    )
  }

  const renderLines = () => {
    if (linesLoading) return <Empty>Loading lines…</Empty>
    if (tab.startsWith('seg_')) return renderSegment(tab.slice(4))
    if (tab === 'teamtotal') return renderTeamTotal()
    if (!hasAnyLines) return <Empty>{linesErr ? `Could not load lines (${linesErr}).` : 'No game lines available.'}</Empty>
    if (tab === 'gamelines') {
      return renderGameLinesGrid()
    }
    if (tab === 'ml') return renderMoneylineTwoCell()
    if (tab === 'totals') return renderTotalsTwoCell()
    if (tab === 'spread') return renderSpreadCells()
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

      {/* matchup subtitle: sport + start time */}
      <div style={{ fontSize: '11px', color: MUTED, fontFamily: R, letterSpacing: '0.04em', marginBottom: '12px' }}>
        {sport}{game?.commenceTime ? ` · Today, ${new Date(game.commenceTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
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
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: isPropTab ? '8px' : '14px' }}>
        <Pill active={tab === 'gamelines'} onClick={() => setTab('gamelines')}>Game Lines</Pill>
        <Pill active={tab === 'ml'} onClick={() => setTab('ml')}>Moneyline</Pill>
        <Pill active={tab === 'totals'} onClick={() => setTab('totals')}>Totals</Pill>
        <Pill active={tab === 'spread'} onClick={() => setTab('spread')}>{spreadLabel}</Pill>
        <Pill active={tab === 'teamtotal'} onClick={() => setTab('teamtotal')}>Team Total</Pill>
        {segments?.['1st_1'] && <Pill active={tab === 'seg_1st_1'} onClick={() => setTab('seg_1st_1')}>1st Inning</Pill>}
        {segments?.['1st_5'] && <Pill active={tab === 'seg_1st_5'} onClick={() => setTab('seg_1st_5')}>First 5</Pill>}
        {segments?.['1st_7'] && <Pill active={tab === 'seg_1st_7'} onClick={() => setTab('seg_1st_7')}>First 7</Pill>}
      </div>

      {/* Prop subtype tabs (e.g. Hits / Bases / Outs / Earned Runs) — derived from the markets returned */}
      {isPropTab && subtypesForActive().length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
          <Pill active={!subtab} onClick={() => setSubtab(null)}>All</Pill>
          {subtypesForActive().map(s => (
            <Pill key={s} active={subtab === s} onClick={() => setSubtab(s)}>{s}</Pill>
          ))}
        </div>
      )}

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

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: '14px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`,
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: MUTED,
      }}>
        <span>{startClock ? `Today, ${startClock}` : 'Today'}</span>
        <span>{marketCount + propCount} markets</span>
      </div>
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
