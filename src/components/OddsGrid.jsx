// ⬡ OddsGrid — the Game-Center-style odds board: columns Run Line · Total · ML, one row per team,
// each cell a tappable button that drops that pick into the slip. FREE pre-game data (synced
// ESPN/DraftKings on the event: odds_ml_*, odds_spread_* points, and metadata juice). Honestly
// labeled PRE-GAME — true live, per-book odds is the paid Compare Books path.
import { NEON_T, MUTED, TEXT, R, BORDER, fmtAm } from './botShared.jsx'

const fmtLine = (v) => v == null ? null : (Number(v) > 0 ? `+${v}` : `${v}`)

export default function OddsGrid({ game, total, onAddToSlip, token, style }) {
  const g = game || {}
  if (g.odds_ml_away == null && g.odds_ml_home == null && g.odds_total == null) return null
  const meta = g.metadata || {}
  const tot = total ?? (g.odds_total != null ? (Number.isInteger(Number(g.odds_total)) ? Number(g.odds_total) - 0.5 : Number(g.odds_total)) : null)
  const matchup = `${g.away_abbr}@${g.home_abbr}`
  const grid = { display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr', gap: 5, alignItems: 'stretch' }
  const head = (txt) => <span style={{ fontFamily: R, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase', textAlign: 'center', alignSelf: 'center' }}>{txt}</span>
  const teamLabel = (abbr) => <span style={{ fontFamily: R, fontSize: 12, fontWeight: 700, color: TEXT, display: 'flex', alignItems: 'center' }}>{abbr}</span>

  const Cell = ({ line, juice, leg }) => {
    const tappable = !!onAddToSlip && line != null
    return (
      <div onClick={() => tappable && onAddToSlip(leg)}
        style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 42, cursor: tappable ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s' }}
        onMouseEnter={e => { if (tappable) { e.currentTarget.style.background = 'rgba(189,255,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(189,255,0,0.35)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = '#0d0d0d'; e.currentTarget.style.borderColor = BORDER }}>
        {line == null ? <span style={{ fontFamily: R, fontSize: 16, color: 'rgba(255,255,255,0.18)' }}>—</span> : (<>
          <span style={{ fontFamily: R, fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>{line}</span>
          {juice != null && <span style={{ fontFamily: R, fontSize: 11, fontWeight: 700, color: NEON_T, lineHeight: 1 }}>{fmtAm(Number(juice))}</span>}
        </>)}
      </div>
    )
  }

  const leg = (pick, odds) => ({ pick, odds: odds != null ? Number(odds) : -110, sport: 'MLB', event: matchup, book: null })

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}`, ...style }}>
      <div style={{ ...grid, marginBottom: 5 }}><span />{head('Run Line')}{head('Total')}{head('ML')}</div>
      {/* Away row */}
      <div style={{ ...grid, marginBottom: 5 }}>
        {teamLabel(g.away_abbr)}
        <Cell line={fmtLine(g.odds_spread_away)} juice={meta.spread_away_juice} leg={leg(`${matchup} ${g.away_abbr} ${fmtLine(g.odds_spread_away)}`, meta.spread_away_juice)} />
        <Cell line={tot != null ? `O ${tot}` : null} juice={meta.over_juice} leg={leg(`${matchup} Over ${tot}`, meta.over_juice)} />
        <Cell line={fmtLine(g.odds_ml_away)} leg={leg(`${matchup} ${g.away_abbr} ML`, g.odds_ml_away)} />
      </div>
      {/* Home row */}
      <div style={grid}>
        {teamLabel(g.home_abbr)}
        <Cell line={fmtLine(g.odds_spread_home)} juice={meta.spread_home_juice} leg={leg(`${matchup} ${g.home_abbr} ${fmtLine(g.odds_spread_home)}`, meta.spread_home_juice)} />
        <Cell line={tot != null ? `U ${tot}` : null} juice={meta.under_juice} leg={leg(`${matchup} Under ${tot}`, meta.under_juice)} />
        <Cell line={fmtLine(g.odds_ml_home)} leg={leg(`${matchup} ${g.home_abbr} ML`, g.odds_ml_home)} />
      </div>
      <div style={{ fontFamily: R, fontSize: 7, fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', textAlign: 'center', marginTop: 7 }}>Pre-game · odds by DraftKings · free</div>
    </div>
  )
}
