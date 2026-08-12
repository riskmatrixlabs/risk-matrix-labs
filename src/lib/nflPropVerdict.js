// NFL prop verdict — pure.
//
// ⚠️ SESSION-AUTHORED MODEL. Unlike the WNBA/NBA/NHL prop verdicts, this one is NOT built on a
// confirmed owner engine: docs/models/MODELS.md has NO NFL player-prop formula (its only NFL
// entry is the SIDE score, §5, itself a reconstruction). The weights and every input derivation
// below were authored in this session and are open to calibration — they are documented here so
// they can be replaced the moment an owner formula exists. No MODELS.md weight is touched.
//
// Weights (session-authored, sum 100):
//   Volume/Role 30 · Recent Form 20 · Matchup 20 · Game Script 15 · Line Value 15
// Volume leads because in football a prop cashes on OPPORTUNITY first (attempts / carries /
// targets); everything else re-rates that opportunity.
//
// HONEST-NULL CONTRACT: every input must have a real, documented derivation from observed data.
// Any missing / non-finite input → return null (no verdict). Never a neutral-constant filler.
//
// Input derivations (all 0–1):
//   volume     = clamp01(volumePerGame / REF_VOLUME_PER_GAME[market])
//                volumePerGame is the player's OBSERVED per-game opportunity for that market
//                (pass attempts, rush attempts, or targets) from the ESPN gamelog; the reference
//                is a documented workload scale (a featured player's season rate), not a stat.
//   recentForm = clamp01(0.5 + (last3Rate − seasonRate) / (2 × seasonRate))
//                LAST 3, not last 5: an NFL season is ~17 games, so five games is a third of it
//                — three is the shortest window that still averages out one freak game.
//   matchup    = clamp01(impliedTeamTotal / 30), impliedTeamTotal = oddsTotal/2 − teamSpread/2
//                The market's own implied points for THIS team is the opponent-defense proxy:
//                a defense the market expects to leak points prices the team's implied total up.
//                30 ≈ a near-ceiling NFL team total. Both inputs are synced, real odds.
//   gameScript = direction depends on the market. favoredness = clamp(−teamSpread / 14, −1..1).
//                A favored team runs to bleed clock; a trailing team throws.
//                  rush markets: 0.5 + favoredness/2   (favorite → up)
//                  pass/receiving markets: 0.5 − favoredness/2   (underdog → up)
//   lineValue  = clamp01(0.5 + evPct / 20) — from the prop's real de-vig edge.
//
// Projection = the mean of the two REAL observed rates (last-3 per game, season per game).
// Both are observations; the 50/50 blend is the session-authored part. Edge = projection − line.

const clamp01 = (n) => Math.max(0, Math.min(1, n))
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Documented per-game OPPORTUNITY reference for each modeled market (the denominator that turns
// a workload into a 0–1 role signal): ~35 pass attempts = a full-volume passing game;
// ~18 carries = a featured back; ~8 targets = a No.1 receiving option.
export const REF_VOLUME_PER_GAME = {
  player_pass_yds: 35,
  player_pass_tds: 35,
  player_rush_yds: 18,
  player_reception_yds: 8,
  player_receptions: 8,
}

// Markets that live in the PASSING game (script direction: underdog → more of it).
export const PASS_LEANING = new Set(['player_pass_yds', 'player_pass_tds', 'player_reception_yds', 'player_receptions'])

// Markets deliberately NOT modeled (no verdict, honestly): player_anytime_td / player_1st_td are
// yes/no scorer markets with no over/under line, so projection-vs-line has no meaning here;
// player_kicking_points has no per-game opportunity source in the gamelog we read.

// 0–100 score under the session-authored weights above. Rounded 2dp, null on any bad input.
export function nflPropScore({ volume, recentForm, matchup, gameScript, lineValue } = {}) {
  const inputs = [volume, recentForm, matchup, gameScript, lineValue]
  if (!inputs.every(Number.isFinite)) return null
  const score = volume * 30 + recentForm * 20 + matchup * 20 + gameScript * 15 + lineValue * 15
  return Math.round(score * 100) / 100
}

// Tier map — identical bounds to PHLT / WNBA / NBA / NHL: ≥75 A, ≥62 B, ≥50 C, else AVOID.
export function nflTier(score) {
  if (score >= 75) return { tier: 'A', label: 'Prime', color: 'green' }
  if (score >= 62) return { tier: 'B', label: 'Strong', color: 'blue' }
  if (score >= 50) return { tier: 'C', label: 'Caution', color: 'yellow' }
  return { tier: 'AVOID', label: 'Fade', color: 'red' }
}

// Model projection minus the posted line (same contract as the siblings' propEdge). Rounded 2dp.
function edgeOf(projected, line) {
  if (!Number.isFinite(projected) || !Number.isFinite(line)) return null
  return Math.round((projected - line) * 100) / 100
}

/**
 * Score one NFL player prop. Pure — the server assembles the inputs.
 * @param {string} market      odds-api market key
 * @param {number} volumePerGame  observed per-game attempts/carries/targets for that market
 * @param {number} last3Rate      observed stat per game, last 3 played games
 * @param {number} seasonRate     observed stat per game, all played games in the gamelog
 * @param {number} oddsTotal      synced game total
 * @param {number} teamSpread     synced spread for THIS player's team (negative = favored)
 * @param {number} evPct          the prop's de-vig edge %
 * @param {number} line           the posted prop line
 * @returns { score, tier, label, color, faded, fades, breakdown, projection, edge, market } | null
 */
export function nflPropVerdict({
  market = 'player_pass_yds',
  volumePerGame, last3Rate, seasonRate, oddsTotal, teamSpread, evPct, line,
} = {}) {
  const ref = REF_VOLUME_PER_GAME[market]
  if (!Number.isFinite(ref)) return null                                  // market not modeled
  const need = [volumePerGame, last3Rate, seasonRate, oddsTotal, teamSpread, evPct, line]
  if (!need.every(Number.isFinite)) return null                           // honest null — no filler
  if (seasonRate <= 0) return null                                        // recent form undefined
  if (oddsTotal <= 0) return null                                         // matchup proxy undefined

  const volume = clamp01(volumePerGame / ref)
  const recentForm = clamp01(0.5 + (last3Rate - seasonRate) / (2 * seasonRate))
  const impliedTeamTotal = oddsTotal / 2 - teamSpread / 2
  const matchup = clamp01(impliedTeamTotal / 30)
  const favoredness = clamp(-teamSpread / 14, -1, 1)
  const gameScript = PASS_LEANING.has(market)
    ? clamp01(0.5 - favoredness / 2)
    : clamp01(0.5 + favoredness / 2)
  const lineValue = clamp01(0.5 + evPct / 20)

  const score = nflPropScore({ volume, recentForm, matchup, gameScript, lineValue })
  if (score == null) return null

  const projection = Math.round(((last3Rate + seasonRate) / 2) * 100) / 100
  const edge = edgeOf(projection, line)
  if (edge == null) return null

  const t = nflTier(score)
  return {
    score,
    ...t,
    faded: t.tier === 'AVOID',
    fades: [],
    breakdown: {
      volume: Math.round(volume * 100), form: Math.round(recentForm * 100),
      matchup: Math.round(matchup * 100), script: Math.round(gameScript * 100),
      value: Math.round(lineValue * 100),
    },
    projection, edge, market,
  }
}
