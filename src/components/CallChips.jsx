// ⬡ CallChips — the model's calls on a game as tap-to-add slip chips: the TOTAL first, then any
// team leans (ML / Run Line). One shared piece so every surface (Spotlight panel, CH2 game card, …)
// adds calls identically. Each chip builds a bare leg, then prices it from the FREE cached game-lines
// (cacheOnly=1, $0) exactly like the total does — the slip handles books from there.
import { decorate } from '../lib/betLinks'
import { teamLeanLines } from '../lib/teamLean'
import { NEON, NEON_T, MUTED, R } from './botShared.jsx'

// `game` is normalized: { away_team, home_team, away_abbr, home_abbr }. Works for both the Spotlight
// event row and the CH2 game object (caller maps its fields once).
const matchupOf = (g) => `${g.away_abbr}@${g.home_abbr}`

// TOTAL leg from the free synced over/under juice (zero credits) + per-book enrichment.
function totalLeg(game, ou) {
  const side = ou.lean === 'OVER' ? 'Over' : 'Under'
  const juice = ou.lean === 'OVER' ? ou.total?.overJuice : ou.total?.underJuice
  const matchup = matchupOf(game)
  return { pick: `${matchup} ${side} ${ou.total?.current ?? ''}`.trim(), odds: juice != null ? juice : -110, sport: 'MLB', event: matchup, book: null }
}

// Generic per-book enrichment from cached game-lines for a market + outcome matcher. $0 (cacheOnly).
async function enrich(game, token, marketKey, matchOutcome, leg) {
  if (!token) return leg
  try {
    const r = await fetch(`/api/game-lines?sport=MLB&away=${encodeURIComponent(game.away_team)}&home=${encodeURIComponent(game.home_team)}&cacheOnly=1`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return leg
    const j = await r.json()
    const mk = j?.markets?.[marketKey]
    if (!mk?.rows?.length) return leg
    const name = (mk.outcomes || []).find(matchOutcome)
    if (!name) return leg
    const byBook = {}, byBookLink = {}
    for (const row of mk.rows) {
      const pr = row.prices?.[name]; if (pr == null) continue
      byBook[row.book] = pr
      const dl = decorate(row.book, row.links?.[name]); if (dl) byBookLink[row.book] = dl
    }
    if (!Object.keys(byBook).length) return leg
    return { ...leg, odds: Object.values(byBook)[0], byBook, byBookLink }
  } catch { return leg }
}

async function pricedTotalLeg(game, ou, token) {
  const leg = totalLeg(game, ou)
  const re = ou.lean === 'OVER' ? /^o/i : /^u/i
  return enrich(game, token, 'totals', (n) => re.test(n), leg)
}

async function pricedTeamLeg(game, side, market, token) {
  const abbr = side === 'home' ? game.home_abbr : game.away_abbr
  const teamName = side === 'home' ? game.home_team : game.away_team
  const matchup = matchupOf(game)
  const leg = { pick: `${matchup} ${market === 'ml' ? `${abbr} ML` : `${abbr} -1.5`}`, odds: -110, sport: 'MLB', event: matchup, book: null }
  const mk = market === 'ml' ? 'h2h' : 'spreads'
  return enrich(game, token, mk, (n) => n === teamName || new RegExp(abbr, 'i').test(n), leg)
}

// Render the calls as tap-to-add chips. Renders nothing if there's no directional total.
export default function CallChips({ game, ou, onAddToSlip, token, style }) {
  if (!ou || (ou.lean !== 'OVER' && ou.lean !== 'UNDER') || ou.total?.current == null) return null
  const tl = teamLeanLines(ou.proj2?.bets, game.away_abbr, game.home_abbr)
  const chip = { fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, background: 'rgba(189,255,0,0.1)', border: `1px solid ${NEON}`, borderRadius: 6, padding: '3px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }
  const totalLabel = `${ou.lean === 'OVER' ? 'OVER' : 'UNDER'} ${ou.total.current}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, ...style }}>
      <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase' }}>ADD</span>
      <button onClick={async e => { e.stopPropagation(); onAddToSlip(await pricedTotalLeg(game, ou, token)) }} title="Add total to slip" style={chip}>+ {totalLabel}</button>
      {tl.map((ln) => (
        <button key={ln.market} onClick={async e => { e.stopPropagation(); onAddToSlip(await pricedTeamLeg(game, ln.side, ln.market === 'ML' ? 'ml' : 'rl', token)) }} title="Add to slip" style={chip}>+ {ln.label}</button>
      ))}
    </span>
  )
}
