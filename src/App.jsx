import { useState, useMemo, useEffect, useCallback, useRef } from 'react'

// Polyfill for crypto.randomUUID — not available on iOS < 15.4
function genUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC 4122 v4 UUID using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
import { useSwipeable } from 'react-swipeable'
import { BetCard as UniBetCard, BetTicket as UniBetTicket } from './components/BetCard.jsx'
import UniSpotlightTicker from './components/SpotlightTicker.jsx'
import { normalizeBet } from './lib/betCard.js'
import { gradeBet } from './lib/gradeBet.js'
import { useMobile } from './hooks/useMobile'
import {
  supabase, signOut,
  fetchBets, syncAllBets, upsertBet, deleteBet as dbDeleteBet, deleteAllBets,
  fetchSettings, upsertSettings,
  fetchTemplates, upsertTemplate, deleteTemplate as dbDeleteTemplate,
  rowToBet, betToRow,
} from './lib/supabase'
import { matchBetToEvent, findEventForBet } from './lib/betMatch.js'
import { gradeBetResult } from './lib/gradeBetResult.js'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, LineChart, Line,
  PieChart, Pie, RadialBarChart, RadialBar, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Plus, Trash2, ChevronUp, ChevronDown, Sun, Moon, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Target, Crosshair, BarChart3, Lock, Zap, Wallet, ArrowUpRight, ArrowDownRight, Clock, Pencil, RotateCcw, CheckSquare, X, Minimize2, Flame, Calendar, Tag, Sliders, Share2, Copy, CheckCheck, Save, FolderOpen, FileDown, RefreshCcw, BookMarked, Upload, Handshake, Radio, Tv, Ticket } from 'lucide-react'
import PartnersPage from './components/PartnersPage'
import LiveCenter   from './components/LiveCenter'
import MatrixBot, { withLogos, normName } from './components/MatrixBot'
import PropBuilder from './components/PropBuilder.jsx'
import { fetchEvents as fetchBetEvents, isLiveEvent } from './lib/events.js'
import ShareCardModal from './components/ShareCardModal'
import { BOOK_NAMES } from './components/botShared.jsx'
import { booksForState, OFFSHORE, NATIONWIDE } from './lib/geoBooks'
import { placeLink, copyPickAndOpen, copyTextSync, deepLinksToBet } from './lib/betLinks'
import { gameKey, kCombos, slipEligibility, validRoundRobinCombos } from './lib/slipModes'

const getKeys = (userId) => ({
  LS_KEY:   `rml_session_v1_${userId}`,
  TMPL_KEY: `rml_templates_v1_${userId}`,
})

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Brand accents — same in both themes
const NEON   = '#BDFF00'
const NEON_T = 'var(--neon-title)' // neon for TEXT — dark olive in light mode, bright in dark
const RED    = '#FF3B3B'
const YELLOW = '#F5A623'

// Theme-adaptive tokens via CSS variables (used in inline styles)
const BG      = 'var(--bg)'
const CARD    = 'var(--card)'
const BORDER  = 'var(--border)'
const BORDER2 = 'var(--border2)'
const MUTED   = 'var(--muted)'

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const INITIAL_BETS = [
  // ── 15 settled regular bets (12W / 3L) — March 2025 ──
  { id: 1,  date: '2025-03-01', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Celtics vs Knicks',       pick: 'Celtics -5.5',    odds: -112, units: 1.0, stake: 20.00, result: 'W', pnl: +0.89 },
  { id: 2,  date: '2025-03-03', sport: 'NHL', book: 'FanDuel',    betType: 'Straight', event: 'Oilers vs Flames',        pick: 'Oilers ML',       odds: -125, units: 1.0, stake: 20.00, result: 'W', pnl: +0.80 },
  { id: 3,  date: '2025-03-04', sport: 'NBA', book: 'BetMGM',     betType: 'Straight', event: 'Thunder vs Clippers',     pick: 'Thunder -6',      odds: -108, units: 1.0, stake: 20.00, result: 'W', pnl: +0.93 },
  { id: 4,  date: '2025-03-05', sport: 'MLB', book: 'Caesars',    betType: 'Straight', event: 'Dodgers vs Padres',       pick: 'Dodgers -1.5',    odds: +125, units: 1.0, stake: 20.00, result: 'W', pnl: +1.25 },
  { id: 5,  date: '2025-03-06', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Pacers vs Heat',          pick: 'Pacers +4',       odds: -108, units: 1.5, stake: 30.00, result: 'W', pnl: +1.39 },
  { id: 6,  date: '2025-03-07', sport: 'MLB', book: 'FanDuel',    betType: 'Straight', event: 'Yankees vs Red Sox',      pick: 'Yankees ML',      odds: -130, units: 1.5, stake: 30.00, result: 'L', pnl: -1.50 },
  { id: 7,  date: '2025-03-08', sport: 'NBA', book: 'BetMGM',     betType: 'Straight', event: 'Bucks vs 76ers',          pick: 'Bucks -3',        odds: -110, units: 1.0, stake: 20.00, result: 'W', pnl: +0.91 },
  { id: 8,  date: '2025-03-10', sport: 'NHL', book: 'DraftKings', betType: 'Straight', event: 'Bruins vs Sabres',        pick: 'Bruins ML',       odds: -118, units: 1.0, stake: 20.00, result: 'W', pnl: +0.85 },
  { id: 9,  date: '2025-03-11', sport: 'NBA', book: 'Caesars',    betType: 'Straight', event: 'Nuggets vs Wolves',       pick: 'Nuggets -4.5',    odds: -112, units: 1.5, stake: 30.00, result: 'L', pnl: -1.50 },
  { id: 10, date: '2025-03-12', sport: 'MLB', book: 'FanDuel',    betType: 'Straight', event: 'Mets vs Phillies',        pick: 'Mets +115',       odds: +115, units: 1.0, stake: 20.00, result: 'W', pnl: +1.15 },
  { id: 11, date: '2025-03-13', sport: 'NBA', book: 'BetMGM',     betType: 'Straight', event: 'Cavs vs Magic',           pick: 'Cavs -7',         odds: -110, units: 1.0, stake: 20.00, result: 'W', pnl: +0.91 },
  { id: 12, date: '2025-03-14', sport: 'NHL', book: 'DraftKings', betType: 'Straight', event: 'Panthers vs Lightning',   pick: 'Panthers ML',     odds: -115, units: 1.0, stake: 20.00, result: 'W', pnl: +0.87 },
  { id: 13, date: '2025-03-17', sport: 'NBA', book: 'Caesars',    betType: 'Straight', event: 'Lakers vs Warriors',      pick: 'Over 226.5',      odds: -110, units: 1.5, stake: 30.00, result: 'L', pnl: -1.50 },
  { id: 14, date: '2025-03-19', sport: 'MLB', book: 'FanDuel',    betType: 'Straight', event: 'Braves vs Cubs',          pick: 'Braves -1.5',     odds: +118, units: 1.0, stake: 20.00, result: 'W', pnl: +1.18 },
  { id: 15, date: '2025-03-21', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Knicks vs Pacers',        pick: 'Knicks -3',       odds: -108, units: 1.0, stake: 20.00, result: 'W', pnl: +0.93 },
  // ── 3 open bets ──
  { id: 21, date: '2025-03-24', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Celtics vs Bucks',        pick: 'Celtics -6',      odds: -110, units: 1.5, stake: 30.00, result: 'Open', pnl: 0 },
  { id: 22, date: '2025-03-24', sport: 'MLB', book: 'FanDuel',    betType: 'Straight', event: 'Dodgers vs Giants',       pick: 'Dodgers ML',      odds: -138, units: 1.0, stake: 20.00, result: 'Open', pnl: 0 },
  { id: 23, date: '2025-03-24', sport: 'NHL', book: 'BetMGM',     betType: 'SGP',      event: 'Oilers vs Canucks',       pick: 'Oilers ML + Over 5.5', odds: +142, units: 0.5, stake: 10.00, result: 'Open', pnl: 0 },
  // ── PHLT™ Ladder — rungs 1-4 complete, rung 5 active, rung 6 pending ──
  { id: 101, date: '2025-03-10', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Knicks vs Nets',    pick: 'Knicks -4',     odds: -110, units: 1.0, stake: 20.00,  result: 'W',    pnl: +18.18,  ladder: true, ladderId: 1, ladderSession: 'demo', pull: false, pullNote: '' },
  { id: 102, date: '2025-03-13', sport: 'NHL', book: 'FanDuel',    betType: 'Straight', event: 'Oilers vs Kings',   pick: 'Oilers ML',     odds: -120, units: 1.9, stake: 38.00,  result: 'W',    pnl: +31.67,  ladder: true, ladderId: 2, ladderSession: 'demo', pull: true,  pullNote: 'Risk free from here — pull original stake' },
  { id: 103, date: '2025-03-17', sport: 'MLB', book: 'BetMGM',     betType: 'Straight', event: 'Dodgers vs Padres', pick: 'Dodgers -1.5',  odds: +135, units: 3.5, stake: 70.00,  result: 'W',    pnl: +94.50,  ladder: true, ladderId: 3, ladderSession: 'demo', pull: false, pullNote: '' },
  { id: 104, date: '2025-03-20', sport: 'NBA', book: 'Caesars',    betType: 'Straight', event: 'Thunder vs Mavs',   pick: 'Thunder -5',    odds: -115, units: 8.25, stake: 165.00, result: 'W',    pnl: +143.48, ladder: true, ladderId: 4, ladderSession: 'demo', pull: true,  pullNote: 'Pull profit — you are now playing with house money' },
  { id: 105, date: '2025-03-24', sport: 'NHL', book: 'DraftKings', betType: 'Straight', event: 'Panthers vs Bruins', pick: 'Panthers ML',  odds: -110, units: 15.5, stake: 310.00, result: 'Open', pnl: 0,       ladder: true, ladderId: 5, ladderSession: 'demo', pull: false, pullNote: '' },
  { id: 106, date: '2025-03-24', sport: 'NHL', book: 'DraftKings', betType: 'Straight', event: 'PHLT Ladder Rung 6', pick: 'TBD',          odds: -118, units: 0,  stake: 0,      result: 'Open', pnl: 0,       ladder: true, ladderId: 6, ladderSession: 'demo', pull: true,  pullNote: 'Bank majority — session complete' },
]

const DEFAULT_LADDER_IDS = [101, 102, 103, 104, 105, 106]
const LADDER_STARTING_BR = 0

// Proportional multipliers for each rung (relative to starting bankroll)
// Based on default template: 150, 175, 225, 300, 400, 600
const LADDER_RATIOS = [1, 175/150, 225/150, 300/150, 400/150, 600/150]

function scaleStake(starting, ratio) {
  // Round to nearest $5 for clean numbers
  return Math.max(5, Math.round(starting * ratio / 5) * 5)
}

const SPORTS  = ['ALL', 'NFL', 'NBA', 'MLB', 'NHL', 'CFB', 'Soccer', 'UFC/MMA', 'Boxing', 'Tennis', 'Golf', 'Other']
const ALL_SPORTS = ['NFL','NBA','MLB','NHL','CFB','Soccer','UFC/MMA','Boxing','Tennis','Golf','NCAA BB','NASCAR','Cricket','Rugby','Other']
const RESULTS = ['ALL', 'OPEN', 'W', 'L', 'P']

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt$ = (v, sign = false) => {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v > 0) return sign ? `+$${abs}` : `$${abs}`
  if (v < 0) return `-$${abs}`
  return `$${abs}`
}
const fmtU   = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(2)}u`
const fmtOdds = (v) => v > 0 ? `+${v}` : `${v}`

function calcStats(bets, bankroll, ladderSessionKey) {
  // Only settled bets count toward stats and bankroll
  const settled        = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
  const regular        = settled.filter(b => !b.ladder)   // unit-based bets
  const ladderSettled  = settled.filter(b => b.ladder)    // dollar-based pnl (ALL sessions — keep old P&L in bankroll)
  const unitSize       = bankroll > 0 ? bankroll / 100 : 1

  // Unit-based stats (regular bets only — used for bankroll math)
  const wins    = regular.filter(b => b.result === 'W')
  const losses  = regular.filter(b => b.result === 'L')
  const netUnits    = regular.reduce((s, b) => s + b.pnl, 0)
  const totalUnits  = regular.reduce((s, b) => s + b.units, 0)
  const unitsWon    = wins.reduce((s, b) => s + b.pnl, 0)
  const unitsLost   = losses.reduce((s, b) => s + Math.abs(b.pnl), 0)

  // Ladder net P&L in dollars — settled results DO affect bankroll (wins grow it, losses shrink it)
  const ladderNetDollars = ladderSettled.reduce((s, b) => s + b.pnl, 0)

  // Dollar P&L for a regular bet: use stake/units ratio (the actual $ per unit logged)
  const regularDollar = (b) =>
    (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * unitSize

  const regularNetDollars = regular.reduce((s, b) => s + regularDollar(b), 0)

  // Open stake: regular bets + ONLY the active ladder rung (lowest open ladderId in current session)
  // Future ladder rungs are placeholders — not deployed capital yet
  const openRegularStake  = bets.filter(b => b.result === 'Open' && !b.ladder)
                                .reduce((s, b) => s + (b.stake > 0 ? b.stake : b.units * unitSize), 0)
  const openLadderBets    = bets.filter(b => b.result === 'Open' && b.ladder && b.ladderSession === ladderSessionKey)
  const activeLadderRung0 = openLadderBets.length > 0
    ? openLadderBets.reduce((min, b) => (!min || (b.ladderId ?? 999) < (min.ladderId ?? 999)) ? b : min, null)
    : null
  const activeLadderStake = activeLadderRung0 ? (activeLadderRung0.stake > 0 ? activeLadderRung0.stake : activeLadderRung0.units * unitSize) : 0
  const openStakeTotal    = openRegularStake + activeLadderStake
  const currentBankroll   = bankroll + regularNetDollars + ladderNetDollars - openStakeTotal

  // Combined stats (all bets — regular + ladder together)
  const allWins   = settled.filter(b => b.result === 'W')
  const allLosses = settled.filter(b => b.result === 'L')
  const allWon$   = allWins.reduce((s, b)   => s + (b.ladder ? b.pnl          : regularDollar(b)), 0)
  const allLost$  = allLosses.reduce((s, b) => s + (b.ladder ? Math.abs(b.pnl): Math.abs(regularDollar(b))), 0)
  const avgWin$   = allWins.length   ? allWon$  / allWins.length   : 0
  const avgLoss$  = allLosses.length ? allLost$ / allLosses.length : 0

  const activeLadderRung = bets.filter(b => b.ladder && b.result === 'Open' && b.ladderSession === ladderSessionKey).sort((a,z) => a.ladderId - z.ladderId)[0] ?? null
  const openBets    = activeLadderRung
    ? [...bets.filter(b => b.result === 'Open' && !b.ladder), activeLadderRung]
    : bets.filter(b => b.result === 'Open' && !b.ladder)
  const openRisk$   = openBets.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const openUnits   = openBets.reduce((s, b) => s + b.units, 0)
  const largestWin$  = allWins.length   ? Math.max(...allWins.map(b => b.ladder ? b.pnl          : regularDollar(b))) : 0
  const largestLoss$ = allLosses.length ? Math.max(...allLosses.map(b => b.ladder ? Math.abs(b.pnl) : Math.abs(regularDollar(b)))) : 0
  const avgOdds     = settled.length ? settled.reduce((s, b) => s + b.odds, 0) / settled.length : 0
  const winRate     = (allWins.length + allLosses.length) > 0 ? allWins.length / (allWins.length + allLosses.length) : 0
  // All settled bets — ladder wins/losses count toward total P&L and ROI
  const totalRisked$  = settled.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const totalRiskedU  = unitSize > 0 ? totalRisked$ / unitSize : 0
  const netPnl$       = regularNetDollars + ladderNetDollars
  const netPnlU       = unitSize > 0 ? netPnl$ / unitSize : 0
  const roi           = totalRisked$ > 0 ? netPnl$ / totalRisked$ : 0
  return {
    currentBankroll, netUnits, totalUnits, unitsWon, unitsLost,
    wins: allWins.length, losses: allLosses.length, total: allWins.length + allLosses.length,
    largestWin: largestWin$, largestLoss: largestLoss$,
    avgWin$, avgLoss$, allWon$, allLost$,
    avgOdds, winRate, roi, unitSize,
    openBets: openBets.length, openRisk$, openUnits,
    totalRisked$, totalRiskedU,
    netPnl$, netPnlU,
    ladderNetDollars, activeLadderRung,
  }
}

function buildCurve(bets, bankroll) {
  const unitSize = bankroll / 100
  let running = bankroll
  const pts = [{ label: 'Start', value: bankroll }]
  // Only settled bets move the bankroll
  bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P').forEach((b, i) => {
    // Ladder bets store pnl in dollars already — regular bets store pnl in units
    const pnlDollar = b.ladder
      ? b.pnl
      : (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * unitSize
    running += pnlDollar
    pts.push({ label: `#${i + 1}`, value: +running.toFixed(2) })
  })
  return pts
}

// ─── TILT + RISK LOGIC ────────────────────────────────────────────────────────
function calcTilt(bets) {
  const settled = bets.filter(b => b.result === 'W' || b.result === 'L')
  if (!settled.length) return { level: 'GREEN', reasons: [] }

  // Count consecutive losses from the most recent bets
  let consecutive = 0
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].result === 'L') consecutive++
    else break
  }

  // Detect bet sizing up after a loss — only look at bets SINCE the last win
  // A win resets the chasing flag (operator corrected course)
  let chasingDetected = false
  const lastWinIdx = (() => {
    for (let i = settled.length - 1; i >= 0; i--) {
      if (settled[i].result === 'W') return i
    }
    return -1
  })()
  const recentBets = lastWinIdx >= 0 ? settled.slice(lastWinIdx) : settled
  for (let i = 1; i < recentBets.length; i++) {
    if (recentBets[i - 1].result === 'L' && recentBets[i].units > recentBets[i - 1].units) {
      chasingDetected = true
      break
    }
  }

  const reasons = []
  if (consecutive >= 3) reasons.push(`${consecutive} consecutive losses`)
  else if (consecutive === 2) reasons.push('2 losses in a row')
  if (chasingDetected) reasons.push('bet sizing increased after a loss')

  if (consecutive >= 3 || chasingDetected) return { level: 'RED', reasons }
  if (consecutive === 2) return { level: 'YELLOW', reasons }
  return { level: 'GREEN', reasons: [] }
}

function calcRisk(bets, masterBankroll, startingBankroll, riskSettings, ladderSessionKey) {
  const { maxRiskPerBetPct, maxRiskTodayPct, stopLossPct, profitLockPct, unitPct } = riskSettings

  // Unit size always derives from CURRENT (master) bankroll so it scales with your growth
  const unitSize = masterBankroll * ((unitPct || 1) / 100)

  // Open bets = your true live exposure right now (regular + active ladder rung only)
  const openBets        = bets.filter(b => b.result === 'Open' && !b.ladder)
  const openLadderBets  = bets.filter(b => b.result === 'Open' && b.ladder && b.ladderSession === ladderSessionKey)
  const activeLadderRung = openLadderBets.length > 0
    ? openLadderBets.reduce((min, b) => (!min || (b.ladderId ?? 999) < (min.ladderId ?? 999)) ? b : min, null)
    : null
  const openOnlyRisk   = openBets.reduce((s, b) => s + (b.stake > 0 ? b.stake : b.units * unitSize), 0)
  const ladderOpenRisk = activeLadderRung ? (activeLadderRung.stake > 0 ? activeLadderRung.stake : 0) : 0
  const totalOpenRisk  = openOnlyRisk + ladderOpenRisk
  const openCount      = openBets.length

  // All limits calculated from master bankroll (current value, not starting)
  const maxRiskPerBet$ = masterBankroll * (maxRiskPerBetPct / 100)
  const maxRiskCap$    = masterBankroll * (maxRiskTodayPct / 100)
  const remainingRisk$ = Math.max(0, maxRiskCap$ - totalOpenRisk)
  const currentRiskPct = masterBankroll > 0 ? (totalOpenRisk / masterBankroll) * 100 : 0
  const stopLoss$      = masterBankroll * (stopLossPct / 100)
  const profitLock$    = masterBankroll * (profitLockPct / 100)
  const health         = currentRiskPct <= 10 ? 'GOOD' : currentRiskPct <= 20 ? 'CAUTION' : 'DANGER'

  // Net gain/loss vs starting bankroll
  const gainLoss$      = masterBankroll - startingBankroll
  const gainLossPct    = startingBankroll > 0 ? ((masterBankroll - startingBankroll) / startingBankroll) * 100 : 0

  return {
    unitSize, maxRiskPerBet$, maxRiskCap$, totalOpenRisk, openCount,
    remainingRisk$, currentRiskPct, stopLoss$, profitLock$, health,
    gainLoss$, gainLossPct,
  }
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'

const cardStyle = {
  backgroundColor: 'var(--card)',
  border: `1px solid var(--border)`,
  borderTop: `1px solid var(--neon-border)`,
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--float-shadow)',
}

const inputStyle = {
  backgroundColor: 'var(--input-bg)',
  border: `1px solid var(--border2)`,
  borderRadius: 'var(--radius-xs)',
  color: 'var(--text)',
  fontFamily: R,
  fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em',
  padding: '5px 10px', width: '100%',
}

const btnStyle = (active = false, danger = false) => ({
  fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
  textTransform: 'uppercase', padding: '5px 12px',
  border: active  ? `1px solid rgba(189,255,0,0.6)`
        : danger  ? `1px solid rgba(255,59,59,0.4)`
        : `1px solid var(--border2)`,
  borderRadius: 'var(--radius-sm)',
  backgroundColor: active ? 'rgba(189,255,0,0.1)' : danger ? 'rgba(255,59,59,0.06)' : 'var(--card)',
  color: active ? NEON_T : danger ? 'rgba(255,59,59,0.7)' : 'var(--text-dim)',
  cursor: 'pointer',
  transition: 'all 0.15s',
})

const StatCard = ({ label, value, color, icon: Icon, sub }) => {
  const c = color || 'var(--text)'
  const glow = color === NEON ? 'var(--neon-glow)' : color === RED ? 'var(--red-glow)' : color === YELLOW ? '0 0 14px rgba(245,166,35,0.25)' : 'none'
  return (
    <div style={{ ...cardStyle, padding: '16px 18px 13px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
        {Icon && <Icon size={12} color={color === NEON ? NEON : color === YELLOW ? YELLOW : 'var(--muted)'} strokeWidth={2} />}
      </div>
      <span style={{ fontFamily: R, fontSize: '25px', fontWeight: 700, letterSpacing: '0.01em', color: c, lineHeight: 1, textShadow: glow }}>{value}</span>
      {sub && <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }}>{sub}</span>}
    </div>
  )
}

const SmallCard = ({ label, value, color, tip }) => {
  const c = color || 'var(--text-sub)'
  const glow = color === NEON ? '0 0 12px rgba(189,255,0,0.22)' : color === RED ? '0 0 10px rgba(255,59,59,0.18)' : 'none'
  return (
    <div style={{ ...cardStyle, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', lineHeight: 1, display: 'flex', alignItems: 'center' }}>{label}{tip && <InfoTip text={tip} />}</span>
      <span style={{ fontFamily: R, fontSize: '19px', fontWeight: 700, letterSpacing: '0.01em', color: c, lineHeight: 1, textShadow: glow }}>{value}</span>
    </div>
  )
}

const SectionLabel = ({ children, icon: Icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
    {Icon && <Icon size={11} color='var(--neon-accent)' strokeWidth={2} />}
    <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'var(--neon-accent)', textTransform: 'uppercase' }}>{children}</span>
    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--neon-border), transparent)' }} />
  </div>
)

function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        top: r.bottom + 6,
        left: Math.max(4, Math.min(r.left, window.innerWidth - 190)),
      })
    }
    setOpen(o => !o)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
      <button ref={btnRef} onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: '50%', width: '13px', height: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.65 }}>i</span>
      </button>
      {open && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '4px', padding: '7px 10px',
          width: '180px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.45 }}>{text}</div>
        </div>
      )}
    </span>
  )
}

const TiltBanner = ({ tilt, dismissed, onDismiss }) => {
  if (tilt.level === 'GREEN' || dismissed) return null
  const isRed = tilt.level === 'RED'
  const color  = isRed ? RED : YELLOW
  const bgColor = isRed ? 'rgba(255,59,59,0.08)' : 'rgba(245,166,35,0.08)'
  const border  = isRed ? 'rgba(255,59,59,0.4)'  : 'rgba(245,166,35,0.4)'
  const Icon    = isRed ? ShieldAlert : AlertTriangle
  const label   = isRed ? 'TILT WARNING — STOP AND REASSESS' : 'CAUTION — DISCIPLINE CHECK'
  return (
    <div style={{
      background: bgColor, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`,
      padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 6px',
      animation: 'slideDown 0.2s ease',
    }}>
      <Icon size={15} color={color} strokeWidth={2.5} />
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-dim)', marginLeft: '12px', letterSpacing: '0.06em' }}>
          {tilt.reasons.join(' · ')}
        </span>
      </div>
      <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color, opacity: 0.8 }}>
        {isRed ? 'DO NOT BET' : 'REVIEW SYSTEM'}
      </span>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center',
        opacity: 0.6,
      }} title="Dismiss until next bet change">
        <X size={13} />
      </button>
    </div>
  )
}

const BankrollTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card2)', border: `1px solid var(--border2)`, padding: '7px 11px', borderRadius: '2px' }}>
      <div style={{ fontFamily: R, fontSize: '12px', color: NEON_T, fontWeight: 700 }}>{fmt$(payload[0].value)}</div>
      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>{payload[0].payload.label}</div>
    </div>
  )
}

// ─── ADD BET MODAL ────────────────────────────────────────────────────────────
const BOOKS = ['DraftKings','FanDuel','BetMGM','Caesars','ESPN Bet','PointsBet','Barstool','BetRivers','WynnBET','Hard Rock','Other']

const EMPTY = {
  date: '', sport: 'NFL', book: '', betType: 'Straight', event: '', pick: '',
  odds: '', units: '', stake: '', result: 'Open', confidence: 0, legs: [],
}

// Bet types that are multiple correlated/combined legs on one ticket.
const MULTI_LEG_TYPES = ['Parlay', 'SGP', 'RR 2s', 'RR 3s']
const isMultiLegType = (t) => MULTI_LEG_TYPES.includes(t)

function profitFromOdds(stake, odds) {
  if (!stake || !odds || odds === 0) return 0
  return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
}

function AddBetModal({ onAdd, onClose, unitSize, initial, onDelete, token }) {
  const { isMobile } = useMobile()
  const [form, setForm] = useState(initial
    ? { ...initial, odds: String(initial.odds), units: String(initial.units), stake: String(initial.stake),
        legs: Array.isArray(initial.legs) ? initial.legs.map(l => ({ event: l.event || '', pick: l.pick || '', odds: l.odds == null ? '' : String(l.odds) })) : [] }
    : { ...EMPTY, date: new Date().toISOString().slice(0, 10) }
  )
  const isEdit = !!initial?.id

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const f   = (k)    => (e) => set(k, e.target.value)

  // ── Parlay leg editor ──
  const multiLeg = isMultiLegType(form.betType)
  const legs = form.legs || []
  const setLeg    = (i, k, v) => setForm(p => ({ ...p, legs: p.legs.map((l, j) => j === i ? { ...l, [k]: v } : l) }))
  const addLeg    = ()        => setForm(p => ({ ...p, legs: [...(p.legs || []), { event: '', pick: '', odds: '' }] }))
  const removeLeg = (i)       => setForm(p => ({ ...p, legs: p.legs.filter((_, j) => j !== i) }))
  // Switching bet type: seed 2 empty legs when entering a multi-leg type with none yet.
  const pickBetType = (t) => setForm(p => ({
    ...p, betType: t,
    legs: isMultiLegType(t) && (!p.legs || p.legs.length === 0) ? [{ event: '', pick: '', odds: '' }, { event: '', pick: '', odds: '' }] : p.legs,
  }))
  const cleanLegs = () => legs
    .map(l => ({ event: (l.event || '').trim(), pick: (l.pick || '').trim(), odds: parseInt(String(l.odds).replace(/[−–—]/g, '-').replace(/[^0-9-]/g, '')) || 0 }))
    .filter(l => l.pick || l.event)

  // Bidirectional: units ↔ stake
  const onUnitsChange = (e) => {
    const u = e.target.value
    set('units', u)
    if (unitSize && u !== '') set('stake', (parseFloat(u) * unitSize).toFixed(2))
  }
  const onStakeChange = (e) => {
    const s = e.target.value
    set('stake', s)
    if (unitSize && s !== '') set('units', (parseFloat(s) / unitSize).toFixed(2))
  }

  // Live preview calculations
  const odds    = parseInt(form.odds)   || 0
  const stake$  = parseFloat(form.stake) || 0
  const toWin   = profitFromOdds(stake$, odds)
  const payout  = stake$ + toWin
  const units   = parseFloat(form.units) || 0

  // Stake $ is primary: derive units from stake if both entered, so stored stake = exact $ typed
  const effectiveUnits = stake$ > 0 ? stake$ / unitSize : units
  const effectiveStake = stake$ > 0 ? stake$ : units * unitSize

  // Always calculate both scenarios regardless of result selection
  const potentialWin  = odds !== 0 ? (odds > 0 ? effectiveUnits * odds / 100 : effectiveUnits * 100 / Math.abs(odds)) : 0
  const potentialLoss = effectiveUnits

  const calcPnl = () => {
    // Ladder bets track dollar P&L (stake-based), not unit-based — keep the math correct on settle.
    if (form.ladder) {
      const profit = odds > 0 ? stake$ * odds / 100 : stake$ * 100 / Math.abs(odds)
      if (form.result === 'W') return profit
      if (form.result === 'L') return -stake$
      if (form.result === 'P') return 0
      return profit
    }
    const u = effectiveUnits
    const win  = odds > 0 ? u * odds / 100 : u * 100 / Math.abs(odds)
    const loss = u
    if (form.result === 'W') return win
    if (form.result === 'L') return -loss
    if (form.result === 'P') return 0
    return win
  }

  const submit = (e) => {
    e.preventDefault()
    const cl = multiLeg ? cleanLegs() : []
    // For a multi-leg ticket, the legs are the source of truth; the event/pick are derived from them.
    const eventOut = multiLeg ? `${cl.length}-Leg Parlay` : form.event
    const pickOut  = multiLeg ? cl.map(l => l.pick).filter(Boolean).join(' + ') : form.pick
    if (multiLeg) {
      if (!form.date || cl.length < 2 || !form.odds || (!form.units && !form.stake)) return
    } else if (!form.date || !form.event || !form.pick || !form.odds || (!form.units && !form.stake)) return
    onAdd({
      ...form,
      event: eventOut,
      pick:  pickOut,
      legs:  multiLeg ? cl.map(l => ({ pick: l.pick, odds: l.odds, event: l.event || null, sport: form.sport, book: form.book || null })) : null,
      odds,
      units: +effectiveUnits.toFixed(2),
      stake: +effectiveStake.toFixed(2),
      pnl:   +calcPnl().toFixed(2),
      id:    isEdit ? form.id : Date.now(),
    })
    onClose()
  }

  const FL = ({ label, children, hint }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase' }}>{label}</span>
        {hint && <span style={{ fontFamily: R, fontSize: '8px', color: 'rgba(189,255,0,0.4)', letterSpacing: '0.06em' }}>{hint}</span>}
      </div>
      {children}
    </label>
  )

  const autoStyle = { ...inputStyle, color: 'var(--muted)', fontStyle: 'italic', cursor: 'default', backgroundColor: 'var(--bg)' }

  const isDisabled = multiLeg
    ? (cleanLegs().length < 2 || !form.odds || (!form.units && !form.stake))
    : (!form.event || !form.pick || !form.odds || (!form.units && !form.stake))

  const SectionLabel = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--muted)', textTransform: 'uppercase' }}>{children}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )

  const bigInput = { ...inputStyle, fontSize: '16px', fontWeight: 700, padding: '12px 14px', height: '48px' }
  const mdInput  = { ...inputStyle, fontSize: '13px', padding: '10px 12px', height: '44px' }

  {
    // pill style helpers
    const pill = (active, color = NEON) => ({
      borderRadius: '20px', cursor: 'pointer', fontFamily: R, fontWeight: 700, fontSize: '11px',
      letterSpacing: '0.06em', padding: '9px 14px', whiteSpace: 'nowrap', transition: 'all 0.12s',
      border: `1px solid ${active ? color : 'var(--border2)'}`,
      background: active ? `${color}22` : 'var(--card2)',
      color: active ? color : 'var(--muted)',
      boxShadow: active ? `0 0 10px ${color}44` : 'none',
    })
    const card = { background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px' }
    const lbl = { fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase', marginBottom: '10px', display: 'block' }
    const scrollRow = { display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px', scrollbarWidth: 'none' }

    const TOP_SPORTS = ['NFL','NBA','MLB','NHL','CFB','Soccer','Other']
    const TOP_BOOKS  = ['DraftKings','FanDuel','BetMGM','Caesars','Hard Rock','Other']
    const BET_TYPES  = ['Straight','Player Prop','Parlay','SGP','RR 2s','RR 3s','Live Bet','Hedge']

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '10px' : '20px' }}>
       <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', maxHeight: isMobile ? '92dvh' : '88dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${NEON}`, boxShadow: '0 18px 55px rgba(0,0,0,0.75)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 16px 12px', borderBottom: `1px solid var(--border)`, borderTop: `3px solid ${NEON}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)' }}>
          <div>
            <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, letterSpacing: '0.2em', color: NEON_T }}>{isEdit ? '✎ EDIT BET' : '+ LOG BET'}</div>
            <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.08em', marginTop: '2px' }}>1u = {fmt$(unitSize)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid var(--border2)`, color: MUTED, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '6px 10px', borderRadius: '8px' }}>×</button>
        </div>

        {/* Scrollable form */}
        <form id="mbet" onSubmit={submit} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── DATE (top) + trash (edit only) ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase' }}>Date</span>
            <input type="date" value={form.date} onChange={f('date')}
              style={{ background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '20px', color: 'var(--muted)', fontFamily: R, fontSize: '11px', fontWeight: 700, padding: '7px 14px', outline: 'none' }} />
            {isEdit && onDelete && (
              <button type="button" onClick={() => { onDelete(form.id); onClose() }}
                style={{ marginLeft: 'auto', background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: '20px', color: RED, cursor: 'pointer', padding: '7px 11px', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em' }}>
                <Trash2 size={12} /> DELETE
              </button>
            )}
          </div>

          {/* ── RESULT CARD ── */}
          <div style={card}>
            <span style={lbl}>Result</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
              {[['Open','OPEN',YELLOW],['W','WIN',NEON],['L','LOSS',RED],['P','PUSH',MUTED]].map(([val, label, color]) => (
                <button key={val} type="button" onClick={() => set('result', val)} style={{
                  ...pill(form.result === val, color), padding: '13px 4px', textAlign: 'center',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── SIZE CARD ── */}
          <div style={card}>
            <span style={lbl}>Odds · Stake · Units</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {/* Odds with +/- toggle */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '10px', padding: '10px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED }}>ODDS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
                  <button type="button"
                    onClick={() => { const v = parseInt(form.odds) || 0; set('odds', v > 0 ? String(-v) : String(Math.abs(v) || 110)) }}
                    style={{ background: 'var(--card2)', border: `1px solid ${parseInt(form.odds) > 0 ? NEON : 'var(--border2)'}`, borderRadius: '6px', color: parseInt(form.odds) > 0 ? NEON_T : 'var(--muted)', fontFamily: R, fontSize: '11px', fontWeight: 700, padding: '2px 5px', cursor: 'pointer', flexShrink: 0 }}>
                    {parseInt(form.odds) > 0 ? '+' : '−'}
                  </button>
                  <input value={form.odds === '' ? '' : (form.odds === '+' || parseInt(form.odds) > 0 ? '+' : '−') + form.odds.replace(/[+-]/g, '')} onChange={e => {
                    // Normalize any unicode minus to ASCII so sign detection is reliable even
                    // though the displayed value uses a unicode '−'.
                    const raw = e.target.value.replace(/[−–—]/g, '-')
                    const digits = raw.replace(/[^0-9]/g, '')
                    // A typed +/- sets the sign explicitly; otherwise keep the current sign.
                    let neg
                    if (/-/.test(raw)) neg = true
                    else if (/\+/.test(raw)) neg = false
                    else neg = (form.odds !== '+' && parseInt(form.odds) < 0)
                    // Preserve a lone sign (no digits yet) so the next keystroke keeps the intent.
                    if (!digits) { set('odds', neg ? '-' : (/\+/.test(raw) ? '+' : '')); return }
                    set('odds', (neg ? '-' : '') + digits)
                  }} placeholder="−110" inputMode="text"
                    style={{ background: 'transparent', border: 'none', color: parseInt(form.odds) > 0 ? NEON_T : 'var(--text)', fontFamily: R, fontSize: '15px', fontWeight: 700, textAlign: 'center', width: '72px', outline: 'none', padding: 0 }} />
                </div>
              </div>
              {[
                { label: 'STAKE $', val: form.stake, onChange: onStakeChange, placeholder: fmt$(unitSize), color: 'var(--text)' },
                { label: 'UNITS', val: form.units, onChange: onUnitsChange, placeholder: '1.0', color: 'var(--text)' },
              ].map(({ label, val, onChange, placeholder, color }) => (
                <div key={label} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '10px', padding: '10px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: MUTED }}>{label}</span>
                  <input value={val} onChange={onChange} placeholder={placeholder} inputMode="decimal" type="number" step="any"
                    style={{ background: 'transparent', border: 'none', color, fontFamily: R, fontSize: '15px', fontWeight: 700, textAlign: 'center', width: '100%', outline: 'none', padding: 0 }} />
                </div>
              ))}
            </div>

            {/* P&L preview inline */}
            {(form.units || form.stake) && odds !== 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.2)`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: NEON_T }}>WIN</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>+{fmtU(potentialWin)}</div>
                    <div style={{ fontFamily: R, fontSize: '9px', color: NEON_T, opacity: 0.7 }}>+{fmt$(potentialWin * unitSize)}</div>
                  </div>
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(255,59,59,0.05)', border: `1px solid rgba(255,59,59,0.18)`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: RED }}>LOSS</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: RED }}>-{fmtU(potentialLoss)}</div>
                    <div style={{ fontFamily: R, fontSize: '9px', color: RED, opacity: 0.7 }}>-{fmt$(stake$ || potentialLoss * unitSize)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── MATCHUP / LEGS CARD ── */}
          {!multiLeg ? (
            form.betType === 'Player Prop' ? (
              <div style={{ padding: '4px 0' }}>
                <PropBuilder
                  sport={form.sport}
                  game={null}
                  token={token}
                  onChange={(prop) => setForm(p => ({
                    ...p,
                    event: prop?.event || '',
                    pick:  prop?.pick  || '',
                    odds:  prop?.odds != null ? String(prop.odds) : '',
                  }))}
                />
              </div>
            ) : (
            <div style={card}>
              <span style={lbl}>Matchup</span>
              <input value={form.event} onChange={f('event')} placeholder="Event  ·  e.g. Chiefs vs Raiders"
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '14px', padding: '11px 14px', outline: 'none', marginBottom: '8px' }} />
              <input value={form.pick} onChange={f('pick')} placeholder="Pick  ·  e.g. Chiefs -6.5"
                style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${form.pick ? NEON : 'var(--border2)'}`, borderRadius: '10px', color: form.pick ? NEON_T : 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '14px', fontWeight: form.pick ? 700 : 400, padding: '11px 14px', outline: 'none' }} />
            </div>
            )
          ) : (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ ...lbl, marginBottom: 0 }}>Legs · {form.betType}</span>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: legs.length >= 2 ? NEON_T : MUTED }}>{cleanLegs().length} ADDED</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {legs.map((leg, i) => (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: MUTED }}>LEG {i + 1}</span>
                      {legs.length > 2 && (
                        <button type="button" onClick={() => removeLeg(i)} style={{ background: 'none', border: 'none', color: RED, fontFamily: R, fontSize: '14px', lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={leg.pick} onChange={e => setLeg(i, 'pick', e.target.value)} placeholder="Pick  ·  Over 8.5"
                        style={{ flex: 2, minWidth: 0, background: 'var(--card2)', border: `1px solid ${leg.pick ? NEON : 'var(--border2)'}`, borderRadius: '8px', color: leg.pick ? NEON_T : 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '13px', fontWeight: leg.pick ? 700 : 400, padding: '9px 10px', outline: 'none' }} />
                      <input value={leg.odds} onChange={e => setLeg(i, 'odds', e.target.value)} placeholder="−110" inputMode="text"
                        style={{ width: '64px', flexShrink: 0, background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontFamily: R, fontSize: '13px', fontWeight: 700, textAlign: 'center', padding: '9px 4px', outline: 'none' }} />
                    </div>
                    <input value={leg.event} onChange={e => setLeg(i, 'event', e.target.value)} placeholder="Event  ·  Tigers vs Astros  (for logos)"
                      style={{ width: '100%', marginTop: '8px', background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '12px', padding: '8px 10px', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLeg} style={{ marginTop: '10px', width: '100%', background: 'var(--card2)', border: `1px dashed var(--border2)`, borderRadius: '10px', color: NEON_T, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', padding: '10px', cursor: 'pointer' }}>+ ADD LEG</button>
              <div style={{ fontFamily: R, fontSize: '8px', color: MUTED, letterSpacing: '0.04em', marginTop: '8px', lineHeight: 1.5 }}>Enter the combined ticket price in <b style={{ color: NEON_T }}>ODDS</b> above. Each leg's own price is optional.</div>
            </div>
          )}

          {/* ── SPORT CARD ── */}
          <div style={card}>
            <span style={lbl}>Sport</span>
            <div style={scrollRow}>
              {TOP_SPORTS.map(s => (
                <button key={s} type="button" onClick={() => set('sport', s)} style={pill(form.sport === s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* ── BOOK CARD ── */}
          <div style={card}>
            <span style={lbl}>Sportsbook</span>
            <div style={scrollRow}>
              {TOP_BOOKS.map(b => (
                <button key={b} type="button" onClick={() => set('book', b)} style={pill(form.book === b)}>{b}</button>
              ))}
            </div>
          </div>

          {/* ── BET TYPE CARD ── */}
          <div style={card}>
            <span style={lbl}>Bet Type</span>
            <div style={scrollRow}>
              {BET_TYPES.map(t => (
                <button key={t} type="button" onClick={() => pickBetType(t)} style={pill(form.betType === t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* ── CONFIDENCE CARD ── */}
          <div style={card}>
            <span style={lbl}>Confidence</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => set('confidence', form.confidence === n ? 0 : n)}
                  style={{ flex: 1, background: n <= (form.confidence||0) ? 'rgba(189,255,0,0.12)' : 'var(--bg)', border: `1px solid ${n <= (form.confidence||0) ? 'rgba(189,255,0,0.4)' : 'var(--border2)'}`, borderRadius: '10px', cursor: 'pointer', padding: '10px 0', fontSize: '18px', transition: 'all 0.12s' }}>⭐</button>
              ))}
            </div>
          </div>

          {/* runway so the last fields always clear the sticky footer (no field trapped under the CTA) */}
          <div style={{ height: '28px', flexShrink: 0 }} />
        </form>

        {/* Footer CTA */}
        <div style={{ flexShrink: 0, padding: '12px 16px', paddingBottom: `calc(env(safe-area-inset-bottom) + 12px)`, borderTop: `1px solid var(--border)`, background: 'var(--card2)', boxShadow: '0 -10px 20px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <button form="mbet" type="submit" style={{
            ...btnStyle(true), width: '100%', padding: '15px', fontSize: '13px', letterSpacing: '0.18em', borderRadius: '12px',
            opacity: isDisabled ? 0.4 : 1,
            boxShadow: isDisabled ? 'none' : '0 0 24px rgba(189,255,0,0.3)',
          }}>{isEdit ? '✓ SAVE CHANGES' : '+ LOG BET'}</button>
          <button type="button" onClick={onClose} style={{ ...btnStyle(), width: '100%', padding: '11px', fontSize: '11px', borderRadius: '12px' }}>Cancel</button>
        </div>
       </div>
      </div>
    )
  }
}

// ─── UNIVERSAL BET CARD ───────────────────────────────────────────────────────
function BetCard({ bet, onSettle, onEdit, onDelete, onShare, unitSize, bankIn, events = [], players = [], boxScores = {}, winPct = {} }) {
  // Resolve the matched event + its live box-score so dashboard cards light up the win-prob ring
  // and live stat bars exactly like CH3 Track (same withLogos arg order: norm, ev, players, boxStats, events, winPct).
  const normWithLogos = () => {
    const ev = findEventForBet(bet, events)
    return withLogos(normalizeBet(bet), ev || null, players, ev ? (boxScores[ev.external_event_id] || null) : null, events, winPct)
  }
  const grade = gradeBet(bet, events)                     // EV/CLV so the footer fills like CH3
  const isOpen   = bet.result === 'Open'
  const isLadder = !!bet.ladder

  // P&L in dollars
  const pnlDollar = isLadder
    ? bet.pnl
    : (bet.units > 0 && bet.stake > 0) ? bet.pnl * (bet.stake / bet.units) : bet.pnl * (unitSize || 1)

  // 🪜 ladder badge (preserves rung #). BANK tile shown only for ladder rows that pass bankIn.
  const badge = isLadder ? `🪜 RUNG ${bet.ladderId}` : null
  const n = normWithLogos()
  const editCb = onEdit ? () => onEdit(bet) : null

  return (<>
    <div style={{ marginBottom: '9px' }}>
      {n.kind === 'parlay'
        ? <UniBetTicket bet={n} grade={grade} pnl={isOpen ? null : pnlDollar} onEdit={editCb} badge={badge} />
        : <UniBetCard bet={n} grade={grade} pnl={isOpen ? null : pnlDollar} onEdit={editCb} badge={badge} bankIn={isLadder ? bankIn : null} />}
    </div>
    {isLadder && bet.result === 'W' && bet.pull && bet.pullNote && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-4px', marginBottom: '8px', padding: '8px 12px', background: 'rgba(189,255,0,0.06)', border: '1px solid rgba(189,255,0,0.2)', borderLeft: '3px solid rgba(189,255,0,0.6)', borderRadius: '4px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>💰</span>
        <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, letterSpacing: '0.06em' }}>{bet.pullNote}</span>
      </div>
    )}
  </>
  )
}

// ─── PHLT™ LADDER TRACKER ─────────────────────────────────────────────────────
function profitFromLadderOdds(stake, odds) {
  if (!stake || !odds || odds === 0) return 0
  return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
}

function LadderTracker({ bets, setBets, ladderStarting, setLadderStarting, ladderSessionKey, darkMode, unitSize = 20, masterBankroll = 1000, onEdit, onShare, onCloseSync, betEvents = [], betRosterPlayers = [], betBoxScores = {}, betWinPct = {} }) {
  const { isMobile } = useMobile()
  const [startInput, setStartInput] = useState(String(ladderStarting))
  const [editRow,    setEditRow]    = useState(null)

  // Auto-init ladderStarting from masterBankroll if not set (15% of master = session stake)
  useEffect(() => {
    if ((ladderStarting === 0 || ladderStarting === LADDER_STARTING_BR) && masterBankroll > 0) {
      const sessionStake = Math.max(5, Math.round(masterBankroll * 0.15 / 5) * 5)
      setLadderStarting(sessionStake)
      setStartInput(String(sessionStake))
    }
  }, [masterBankroll]) // eslint-disable-line

  // Ladder rows = current session only
  const rows = bets.filter(b => b.ladder && b.ladderSession === ladderSessionKey).sort((a, z) => a.ladderId - z.ladderId)

  const setRow = (id, k, v) => setBets(p => p.map(b => b.id === id ? { ...b, [k]: v } : b))

  const closeLadder = () => {
    // Close current session — auto-fill next session stake with final BR (PHLT formula compounds)
    const s = finalBankroll > 0 ? finalBankroll : ladderStarting
    const newKey = genUUID()
    setLadderStarting(s)
    setStartInput(String(s))
    setEditRow(null)
    onCloseSync?.(newKey, s, [])
  }

  const startSession = () => {
    // Generate 6 fresh rungs for the current session key with user-set stake
    const s    = ladderStarting > 0 ? ladderStarting : LADDER_STARTING_BR
    const base  = Date.now()
    const today = new Date().toISOString().slice(0, 10)
    const newRungs = [
      { id: base+1, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 1', pick: 'TBD', odds: -120, units: +(scaleStake(s, LADDER_RATIOS[0]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[0]), result: 'Open', pnl: 0, ladder: true, ladderId: 1, ladderSession: ladderSessionKey, pull: false, pullNote: '', confidence: 0 },
      { id: base+2, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 2', pick: 'TBD', odds: -115, units: +(scaleStake(s, LADDER_RATIOS[1]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[1]), result: 'Open', pnl: 0, ladder: true, ladderId: 2, ladderSession: ladderSessionKey, pull: true,  pullNote: 'Risk free from here — pull original stake', confidence: 0 },
      { id: base+3, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 3', pick: 'TBD', odds: -120, units: +(scaleStake(s, LADDER_RATIOS[2]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[2]), result: 'Open', pnl: 0, ladder: true, ladderId: 3, ladderSession: ladderSessionKey, pull: false, pullNote: '', confidence: 0 },
      { id: base+4, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 4', pick: 'TBD', odds: -110, units: +(scaleStake(s, LADDER_RATIOS[3]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[3]), result: 'Open', pnl: 0, ladder: true, ladderId: 4, ladderSession: ladderSessionKey, pull: true,  pullNote: 'Pull profit — you are now playing with house money', confidence: 0 },
      { id: base+5, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 5', pick: 'TBD', odds: -125, units: +(scaleStake(s, LADDER_RATIOS[4]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[4]), result: 'Open', pnl: 0, ladder: true, ladderId: 5, ladderSession: ladderSessionKey, pull: false, pullNote: '', confidence: 0 },
      { id: base+6, date: today, sport: 'MLB', book: 'Hard Rock', betType: 'Straight', event: 'PHLT Ladder Rung 6', pick: 'TBD', odds: -118, units: +(scaleStake(s, LADDER_RATIOS[5]) / unitSize).toFixed(2), stake: scaleStake(s, LADDER_RATIOS[5]), result: 'Open', pnl: 0, ladder: true, ladderId: 6, ladderSession: ladderSessionKey, pull: true,  pullNote: 'Bank majority — session complete', confidence: 0 },
    ]
    setBets(p => [...p, ...newRungs])
    setEditRow(null)
  }

  // Build rolling bankroll and computed values
  const computed = rows.reduce((acc, row) => {
    const prev    = acc.length ? acc[acc.length - 1] : null
    const bankIn  = prev ? prev.bankOut : ladderStarting
    const profit  = profitFromLadderOdds(row.stake, row.odds)
    const toWin   = profit
    const payout  = row.stake + profit
    const bankOut = row.result === 'W' ? (bankIn - row.stake + payout)
                  : row.result === 'L' ? (bankIn - row.stake)
                  : bankIn
    acc.push({ ...row, bankIn, toWin, payout, profit, bankOut })
    return acc
  }, [])

  const runActive     = computed.findIndex(r => r.result === 'Open')
  const totalProfit   = computed.filter(r => r.result === 'W').reduce((s, r) => s + r.profit, 0)
  const totalLost     = computed.filter(r => r.result === 'L').reduce((s, r) => s + r.stake, 0)
  const winsCount     = computed.filter(r => r.result === 'W').length
  const lossCount     = computed.filter(r => r.result === 'L').length
  const finalBankroll = computed.length ? computed[computed.length - 1].bankOut : ladderStarting

  const settleRow = (id, result) => {
    if (result === 'L') {
      const row = computed.find(r => r.id === id)
      if (row && row.stake > row.bankIn) {
        const ok = window.confirm(
          `This loss ($${row.stake.toFixed(2)}) exceeds your current ladder bank ($${row.bankIn.toFixed(2)}).\n\nThis would put your ladder bank negative. Are you sure?`
        )
        if (!ok) return
      }
    }
    setBets(p => p.map(b => {
      if (b.id !== id) return b
      const profit = profitFromLadderOdds(b.stake, b.odds)
      const pnl = result === 'W' ? +(profit.toFixed(2)) : result === 'L' ? -(b.stake) : 0
      return { ...b, result, pnl }
    }))
    setEditRow(null)
  }

  const addRung = () => {
    const last = rows[rows.length - 1]
    // New rung stake = last stake × 1.5, scaled from current starting bankroll, rounded to $5
    const newStake = last ? Math.round(last.stake * 1.5 / 5) * 5 : scaleStake(ladderStarting, 1)
    const newId    = Date.now()
    setBets(p => [...p, {
      id: newId, date: new Date().toISOString().slice(0, 10),
      sport: last?.sport || 'MLB', book: last?.book || 'Hard Rock', betType: 'Straight', event: `PHLT Ladder Rung ${rows.length + 1}`,
      pick: 'TBD', odds: -110, units: +(newStake / unitSize).toFixed(2), stake: newStake,
      result: 'Open', pnl: 0, ladder: true,
      ladderId: (last?.ladderId || 0) + 1, ladderSession: ladderSessionKey, pull: false, pullNote: '', confidence: 0,
    }])
  }

  const removeRung = (id) => rows.length > 1 && setBets(p => p.filter(b => b.id !== id))

  const iCell = (val, onChange, type = 'number', width = '70px', placeholder = '') => (
    <input
      type={type} value={val} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, width, padding: '3px 6px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Header bar */}
      <div style={{ ...cardStyle, padding: '14px 18px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? '10px' : 0 }}>
          <div>
            <div style={{ fontFamily: R, fontSize: isMobile ? '11px' : '13px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--neon-title)' }}>PHLT™ LADDER TRACKER</div>
            <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.14em', color: 'var(--neon-sub)', marginTop: '2px' }}>FUND EACH BET FROM PREVIOUS WINNINGS ONLY</div>
          </div>
          {/* Close session button always top-right on mobile */}
          {isMobile && (
            <button onClick={closeLadder} style={{
              ...btnStyle(), display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
              borderColor: 'rgba(255,59,59,0.35)', color: 'rgba(255,59,59,0.6)',
            }}>
              <RotateCcw size={11} /> Close
            </button>
          )}
        </div>

        {/* Controls + stats row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? '10px' : '16px' }}>
          {/* Starting Bankroll input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>Session Stake</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontFamily: R, fontSize: '11px', color: 'var(--muted)' }}>$</span>
              <input
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(startInput)
                  if (!isNaN(v) && v > 0) {
                    setLadderStarting(v)
                    setBets(prev => prev.map(b => {
                      if (!b.ladder || b.result !== 'Open') return b
                      const ratio = LADDER_RATIOS[(b.ladderId - 1)] ?? LADDER_RATIOS[LADDER_RATIOS.length - 1]
                      return { ...b, stake: scaleStake(v, ratio) }
                    }))
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                style={{ ...inputStyle, width: isMobile ? '90px' : '80px', padding: '4px 8px', fontSize: '13px', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: isMobile ? '10px' : '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'W / L',         value: `${winsCount} — ${lossCount}`,  color: 'var(--text)' },
              { label: 'Profit',        value: `+${fmt$(totalProfit)}`,         color: NEON_T },
              { label: 'Final BR',      value: fmt$(finalBankroll),             color: finalBankroll > ladderStarting ? NEON_T : RED },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontFamily: R, fontSize: isMobile ? '12px' : '14px', fontWeight: 700, color,
                  textShadow: color === NEON && darkMode ? '0 0 12px rgba(189,255,0,0.25)' : 'none' }}>{value}</div>
              </div>
            ))}
            {!isMobile && (
              <button onClick={closeLadder} style={{
                ...btnStyle(), display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                borderColor: 'rgba(255,59,59,0.35)', color: 'rgba(255,59,59,0.6)',
              }}>
                <RotateCcw size={11} /> Close Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ladder Rules */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4, 1fr)', gap: '6px' }}>
        {[
          { icon: Crosshair, text: 'Fund each bet from previous winnings only' },
          { icon: RotateCcw, text: 'Loss at any point — restart from Bet 1' },
          { icon: CheckSquare, text: 'Never skip a pull profit checkpoint' },
          { icon: Shield, text: 'Discipline over greed at every step' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon size={13} color='var(--neon-accent)' strokeWidth={2} />
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--muted)', lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* START SESSION — shown only when no ladder rungs exist */}
      {rows.length === 0 && (
        <div style={{ ...cardStyle, padding: '32px 24px', textAlign: 'center' }}>
          <Zap size={28} color='rgba(189,255,0,0.25)' strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>No Active Session</div>
          <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '20px' }}>
            Set your Ladder Starting amount above, then tap Start to generate your 6 rungs.
          </div>
          <button onClick={startSession} disabled={!(ladderStarting > 0)} style={{
            fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            padding: '12px 32px', borderRadius: '2px', cursor: ladderStarting > 0 ? 'pointer' : 'not-allowed',
            border: `1px solid rgba(189,255,0,${ladderStarting > 0 ? '0.5' : '0.2'})`,
            background: `rgba(189,255,0,${ladderStarting > 0 ? '0.1' : '0.03'})`,
            color: ladderStarting > 0 ? NEON_T : 'var(--muted)',
            boxShadow: ladderStarting > 0 ? '0 0 16px rgba(189,255,0,0.15)' : 'none',
          }}>
            ⚡ {ladderStarting > 0 ? 'Start Session' : 'Enter Session Stake Above'}
          </button>
        </div>
      )}

      {/* Ladder cards — all screen sizes */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {computed.map((row) => (
            <BetCard
              key={row.id}
              bet={{ ...row, pnl: row.result === 'W' ? row.profit : row.result === 'L' ? -row.stake : 0 }}
              onSettle={(id, r) => settleRow(id, r)}
              onEdit={onEdit}
              onDelete={rows.length > 1 ? removeRung : undefined}
              onShare={onShare}
              unitSize={unitSize}
              bankIn={row.bankIn}
              events={betEvents}
              players={betRosterPlayers}
              boxScores={betBoxScores}
              winPct={betWinPct}
            />
          ))}
          {/* Mobile footer */}
          <button onClick={addRung} style={{ ...btnStyle(false), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '10px' }}>
            <Plus size={12} /> Add Rung
          </button>
        </div>
      )}


    </div>
  )
}

// ─── ROUND ROBIN ENGINE ───────────────────────────────────────────────────────
function factorial(n) {
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}
function nCr(n, r) {
  if (r > n || r < 0) return 0
  return factorial(n) / (factorial(r) * factorial(n - r))
}
function toDecimal(odds) {
  if (!odds || odds === 0) return 1
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

// Generate all combinations of size r from array
function getCombos(arr, r) {
  const result = []
  const combo = []
  function recurse(start) {
    if (combo.length === r) { result.push([...combo]); return }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i])
      recurse(i + 1)
      combo.pop()
    }
  }
  recurse(0)
  return result
}

const EMPTY_LEG = { odds: '', result: 'TBD' }

function RREngine({ unitSize, darkMode, isDemo = false, token = null, floatPicks = null, onFloatConsumed, onAddToSlip }) {
  const { isMobile } = useMobile()
  const [slipMsg, setSlipMsg] = useState('')   // transient "added to slip" confirmation
  // Search the free slate to add picks (instead of typing every team by hand).
  const [slate, setSlate] = useState([])
  const [rrQuery, setRrQuery] = useState('')
  useEffect(() => {
    if (!token) return
    let cancel = false
    fetchBetEvents('mlb', 'today').then(({ data }) => { if (!cancel) setSlate(data || []) }).catch(() => {})
    return () => { cancel = true }
  }, [token])
  const rrMatches = rrQuery.trim().length >= 2
    ? slate.filter(e => `${e.away_team} ${e.home_team} ${e.away_abbr} ${e.home_abbr}`.toLowerCase().includes(rrQuery.toLowerCase())).slice(0, 6)
    : []
  const DEMO_LEGS = [
    { odds: '-120', result: 'W' },
    { odds: '-140', result: 'L' },
    { odds: '-160', result: 'W' },
  ]
  const [legs,         setLegs]         = useState(isDemo ? DEMO_LEGS : [{ ...EMPTY_LEG }, { ...EMPTY_LEG }, { ...EMPTY_LEG }])
  const [rrType,       setRrType]       = useState(2)
  const [stakeMode,    setStakeMode]    = useState(isDemo ? 'dollars' : 'units')
  const [stakeVal,     setStakeVal]     = useState(isDemo ? '30' : '1')
  const [showMBO,      setShowMBO]      = useState(false)  // Missed By One panel

  // Picks "floated" in from the bet slip — pre-fill the legs with real picks + their odds.
  useEffect(() => {
    if (floatPicks && floatPicks.length) {
      setLegs(floatPicks.map(p => ({ odds: p.odds != null ? String(p.odds) : '', result: 'TBD', pick: p.pick || '', event: p.event || '' })))
      setRrType(2)
      onFloatConsumed?.()
    }
  }, [floatPicks])

  const setLeg = (i, k, v) => setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  const addLeg    = () => legs.length < 10 && setLegs(p => [...p, { ...EMPTY_LEG }])
  // Add a pick from the slate search → fills the next empty leg (or appends), with the over line + free juice.
  const addPickFromSlate = (ev) => {
    const totalRaw = ev.odds_total != null ? Number(ev.odds_total) : null
    const total = (totalRaw != null && Number.isInteger(totalRaw)) ? totalRaw - 0.5 : totalRaw
    const over = ev.metadata?.over_juice
    const matchup = `${ev.away_abbr}@${ev.home_abbr}`
    const newLeg = { odds: over != null ? String(over) : '', result: 'TBD', pick: `${matchup} Over${total != null ? ' ' + total : ''}`, event: matchup }
    setLegs(prev => {
      const emptyIdx = prev.findIndex(l => !l.pick && (!l.odds || l.odds === ''))
      if (emptyIdx >= 0) return prev.map((l, i) => i === emptyIdx ? newLeg : l)
      return prev.length < 10 ? [...prev, newLeg] : prev
    })
    setRrQuery('')
  }
  const removeLeg = (i) => legs.length > 2  && setLegs(p => p.filter((_, idx) => idx !== i))

  const stakePerCombo = stakeMode === 'units'
    ? (parseFloat(stakeVal) || 0) * unitSize
    : (parseFloat(stakeVal) || 0)

  const validLegs  = legs.filter(l => l.odds !== '' && parseInt(l.odds) !== 0)
  const n          = validLegs.length
  const r          = Math.min(rrType, n)
  const totalCombos = n >= r ? nCr(n, r) : 0
  const totalRisk   = totalCombos * stakePerCombo

  // Build outcome matrix (pre-bet, using average odds)
  const decimalOdds = validLegs.map(l => toDecimal(parseInt(l.odds)))
  const avgDecimal  = decimalOdds.length ? decimalOdds.reduce((s, v) => s + v, 0) / decimalOdds.length : 1

  const outcomeMatrix = []
  for (let hits = 0; hits <= n; hits++) {
    const winningCombos  = nCr(hits, r)
    const estimatedPayout = winningCombos * stakePerCombo * Math.pow(avgDecimal, r)
    const estimatedPL     = estimatedPayout - totalRisk
    outcomeMatrix.push({ hits, winningCombos, payout: estimatedPayout, pl: estimatedPL })
  }

  const maxPayout  = outcomeMatrix[n]?.payout || 0
  const worstCase  = -totalRisk
  const breakEven  = outcomeMatrix.find(o => o.pl >= 0)
  const minHits    = breakEven?.hits ?? n

  // Exact result calculation when leg results are known
  const allCombos    = n >= r ? getCombos(validLegs.map((_, i) => i), r) : []
  const exactResults = allCombos.map(combo => {
    const allWin = combo.every(i => validLegs[i]?.result === 'W')
    const comboDecimal = combo.reduce((p, i) => p * toDecimal(parseInt(validLegs[i].odds)), 1)
    const payout = allWin ? stakePerCombo * comboDecimal : 0
    return { combo, win: allWin, payout }
  })
  const hasResults     = validLegs.some(l => l.result !== 'TBD')
  const exactTotal     = exactResults.reduce((s, c) => s + c.payout, 0)
  const exactPL        = exactTotal - totalRisk
  const exactWinCombos = exactResults.filter(c => c.win).length

  // Missed By One: what if the worst-leg result was W instead of L?
  const losses    = validLegs.filter(l => l.result === 'L')
  const mboWins   = validLegs.filter(l => l.result === 'W').length
  const mboResult = hasResults && losses.length === 1
    ? (() => {
        const hypothetical = validLegs.map(l => l.result === 'L' ? { ...l, result: 'W' } : l)
        const hypCombos    = getCombos(hypothetical.map((_, i) => i), r)
        const hypPayout    = hypCombos
          .filter(combo => combo.every(i => hypothetical[i].result === 'W'))
          .reduce((s, combo) => s + stakePerCombo * combo.reduce((p, i) => p * toDecimal(parseInt(hypothetical[i].odds)), 1), 0)
        return hypPayout - totalRisk
      })()
    : null

  const healthColor = (pl) => pl > 0 ? NEON_T : pl < 0 ? RED : YELLOW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── TOP ROW: Leg Inputs + Summary ── */}
      {/* Single column — the app room is ~580px, so a 2-col layout overflowed (summary cut off right). */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>

        {/* Leg Inputs */}
        <div style={{ ...cardStyle, padding: '18px 18px' }}>
          <SectionLabel icon={Target}>Round Robin Legs</SectionLabel>

          {/* RR Type + Stake */}
          {isMobile ? (
            /* Mobile: 2-row compact config */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>RR Type</span>
                <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                  {[2, 3, 4, 5].map(t => (
                    <button key={t} onClick={() => setRrType(t)} style={{ ...btnStyle(rrType === t), flex: 1, padding: '5px 0', fontSize: '12px', fontWeight: 700 }}>{t}s</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stake</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['units', 'dollars'].map(m => (
                    <button key={m} onClick={() => setStakeMode(m)} style={{ ...btnStyle(stakeMode === m), padding: '5px 10px', fontSize: '10px' }}>{m === 'units' ? 'Units' : '$'}</button>
                  ))}
                </div>
                <input value={stakeVal} onChange={e => setStakeVal(e.target.value)} placeholder={stakeMode === 'units' ? '1.0' : '10'} type="number" step="0.25" min="0"
                  style={{ ...inputStyle, flex: 1, padding: '5px 10px' }} />
                {stakeMode === 'units' && <span style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>1u={fmt$(unitSize)}</span>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '5px' }}>RR Type</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[2, 3, 4, 5].map(t => (
                    <button key={t} onClick={() => setRrType(t)} style={{ ...btnStyle(rrType === t), padding: '5px 10px', fontSize: '11px', fontWeight: 700 }}>{t}s</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '5px' }}>Stake Mode</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['units', 'dollars'].map(m => (
                    <button key={m} onClick={() => setStakeMode(m)} style={{ ...btnStyle(stakeMode === m), padding: '5px 10px', fontSize: '10px' }}>{m === 'units' ? 'Units' : '$'}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '5px' }}>
                  Stake / Combo {stakeMode === 'units' ? `(1u=${fmt$(unitSize)})` : ''}
                </div>
                <input value={stakeVal} onChange={e => setStakeVal(e.target.value)} placeholder={stakeMode === 'units' ? '1.0' : '10.00'} type="number" step="0.25" min="0"
                  style={{ ...inputStyle, padding: '5px 10px' }} />
              </div>
            </div>
          )}

          {/* Search the slate to add a pick (free) */}
          {token && (
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input value={rrQuery} onChange={e => setRrQuery(e.target.value)} placeholder="🔍 Search a team to add (free) — e.g. Yankees"
                style={{ ...inputStyle, width: '100%', padding: '8px 10px', fontSize: '12px' }} />
              {rrMatches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: '4px', background: 'var(--card)', border: `1px solid ${NEON}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  {rrMatches.map((ev, i) => {
                    const t = ev.odds_total != null ? (Number.isInteger(Number(ev.odds_total)) ? Number(ev.odds_total) - 0.5 : ev.odds_total) : null
                    return (
                      <button key={i} onClick={() => addPickFromSlate(ev)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 11px', border: 'none', borderBottom: i < rrMatches.length - 1 ? '1px solid var(--border)' : 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{ev.away_abbr}@{ev.home_abbr}</span>
                        <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>{t != null ? `O ${t}` : 'add'} +</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Leg rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {legs.map((leg, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '16px 1fr 56px 46px 20px' : '22px 1.6fr 96px 80px 26px',
                gap: '6px', alignItems: 'center',
                padding: '6px 8px',
                background: leg.result === 'W' ? 'rgba(189,255,0,0.04)' : leg.result === 'L' ? 'rgba(255,59,59,0.04)' : 'var(--card2)',
                border: `1px solid ${leg.result === 'W' ? 'rgba(189,255,0,0.2)' : leg.result === 'L' ? 'rgba(255,59,59,0.15)' : 'var(--border)'}`,
                borderRadius: '2px',
              }}>
                <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</span>
                <input
                  value={leg.pick || ''}
                  onChange={e => setLeg(i, 'pick', e.target.value)}
                  placeholder={isMobile ? 'Team / pick' : 'Team / pick (e.g. NYM Over 9.5)'}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', fontWeight: 700, minWidth: 0 }}
                />
                <input
                  value={leg.odds}
                  onChange={e => setLeg(i, 'odds', e.target.value)}
                  placeholder="-110"
                  inputMode="text"
                  title={leg.odds && parseInt(leg.odds) !== 0 ? `payout ${fmt$(stakePerCombo * toDecimal(parseInt(leg.odds)))}` : 'odds'}
                  style={{ ...inputStyle, padding: '5px 4px', fontSize: '12px', textAlign: 'center' }}
                />
                <select
                  value={leg.result}
                  onChange={e => setLeg(i, 'result', e.target.value)}
                  style={{ ...inputStyle, padding: '4px 6px', fontSize: '10px', fontWeight: 700,
                    color: leg.result === 'W' ? NEON_T : leg.result === 'L' ? RED : 'var(--muted)' }}
                >
                  <option value="TBD">TBD</option>
                  <option value="W">W</option>
                  <option value="L">L</option>
                  <option value="P">P</option>
                </select>
                <button onClick={() => removeLeg(i)} style={{
                  background: 'none', border: 'none', cursor: legs.length > 2 ? 'pointer' : 'default',
                  color: legs.length > 2 ? 'rgba(255,59,59,0.3)' : 'var(--border2)',
                  display: 'flex', alignItems: 'center', padding: '2px',
                }}
                  onMouseEnter={e => legs.length > 2 && (e.currentTarget.style.color = RED)}
                  onMouseLeave={e => e.currentTarget.style.color = legs.length > 2 ? 'rgba(255,59,59,0.3)' : 'var(--border2)'}
                ><Trash2 size={11} /></button>
              </div>
            ))}

            <button onClick={addLeg} style={{
              ...btnStyle(false), display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '5px', padding: '7px', width: '100%', marginTop: '2px',
              opacity: legs.length >= 10 ? 0.3 : 1,
            }}>
              <Plus size={11} /> Add Leg
            </button>

            {/* Send these legs to the bet slip → build Straight/Parlay/SGP/Round Robin there (0 tokens) */}
            {onAddToSlip && (() => {
              const ready = legs.filter(l => l.pick && l.pick.trim() && l.odds !== '' && parseInt(l.odds) !== 0)
              return (
                <button onClick={() => {
                    if (!ready.length) { setSlipMsg('Add a pick + odds first'); setTimeout(() => setSlipMsg(''), 2500); return }
                    ready.forEach(l => onAddToSlip({ pick: l.pick.trim(), odds: Number(l.odds) || 0, sport: 'MLB', event: l.event || '' }))
                    setSlipMsg(`✓ Added ${ready.length} to slip`); setTimeout(() => setSlipMsg(''), 3000)
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px', width: '100%', marginTop: '6px', borderRadius: '8px', border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  🎟 Add to Slip
                </button>
              )
            })()}
            {slipMsg && <div style={{ textAlign: 'center', fontFamily: R, fontSize: '10px', color: NEON_T, marginTop: '6px' }}>{slipMsg}</div>}
          </div>
        </div>

        {/* Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Key Metrics */}
          <div style={{ ...cardStyle, padding: '18px 18px' }}>
            <SectionLabel icon={BarChart3}>RR Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
              {[
                { label: 'Combos',     value: totalCombos || '—',                       color: 'var(--text)' },
                { label: 'Total Risk', value: totalRisk ? fmt$(totalRisk) : '—',         color: totalRisk > 0 ? RED : 'var(--text)' },
                { label: 'Max Payout', value: maxPayout ? fmt$(maxPayout) : '—',         color: NEON_T },
                { label: 'Max Profit', value: maxPayout ? fmt$(maxPayout - totalRisk) : '—', color: NEON_T },
                { label: 'Worst Case', value: totalRisk ? `-${fmt$(totalRisk)}` : '—',   color: RED },
                { label: 'Min Hits +', value: totalCombos ? `${minHits} / ${n}` : '—',  color: YELLOW },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '10px 12px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                  <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Break-even hit rate bar */}
            {n > 0 && totalCombos > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>Break-even Hit Rate<InfoTip text="The minimum win rate needed across all legs for this round robin to be profitable at these odds." /></span>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON_T }}>
                    {n > 0 ? `${minHits} / ${n} legs (${(minHits / n * 100).toFixed(0)}%)` : '—'}
                  </span>
                </div>
                <div style={{ height: '5px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', transition: 'width 0.4s',
                    width: `${n > 0 ? (minHits / n) * 100 : 0}%`,
                    background: NEON, boxShadow: '0 0 8px rgba(189,255,0,0.35)',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Live result (when results entered) */}
          {hasResults && (
            <div style={{ ...cardStyle, padding: '16px 18px', borderTop: `2px solid ${exactPL >= 0 ? NEON : RED}` }}>
              <SectionLabel icon={Zap}>Live Result</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Combos Won', value: `${exactWinCombos} / ${totalCombos}`, color: 'var(--text)' },
                  { label: 'Returned',   value: fmt$(exactTotal), color: exactTotal > 0 ? NEON_T : 'var(--muted)' },
                  { label: 'Net P / L',  value: fmt$(exactPL, true), color: healthColor(exactPL) },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '10px 12px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                    <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color,
                      textShadow: color === NEON ? 'var(--neon-glow)' : color === RED ? 'var(--red-glow)' : 'none' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missed By One */}
          {hasResults && mboResult !== null && (
            <div style={{ ...cardStyle, padding: '14px 18px', borderTop: `2px solid ${YELLOW}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={13} color={YELLOW} strokeWidth={2} />
                <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', color: YELLOW, textTransform: 'uppercase' }}>Missed By One</span>
              </div>
              <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.5 }}>
                If your 1 losing leg had won, your result would be{' '}
                <span style={{ fontWeight: 700, color: mboResult >= 0 ? NEON_T : RED }}>
                  {mboResult >= 0 ? '+' : ''}{fmt$(mboResult)}
                </span>{' '}
                instead of{' '}
                <span style={{ fontWeight: 700, color: RED }}>{fmt$(exactPL, true)}</span>.
              </div>
              <div style={{ marginTop: '6px', fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em' }}>
                Round robins reduce all-or-nothing parlay risk — this is why.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── COMBOS BUILT — the actual parlays the RR generates (your place / Novig-rebuild list) ── */}
      {n >= 2 && n >= rrType && totalCombos > 0 && (
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionLabel icon={Target}>Combos Built — {totalCombos} × {r}-leg parlay{totalCombos === 1 ? '' : 's'}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '320px', overflowY: 'auto' }}>
            {allCombos.map((combo, idx) => {
              const cd = combo.reduce((p, i) => p * toDecimal(parseInt(validLegs[i].odds) || 0), 1)
              const am = cd >= 2 ? `+${Math.round((cd - 1) * 100)}` : `${Math.round(-100 / (cd - 1))}`
              const payout = stakePerCombo * cd
              const picks = combo.map(i => validLegs[i].pick || `Leg ${i + 1}`)
              const addCombo = () => {
                if (!onAddToSlip) return
                combo.forEach(i => onAddToSlip({ pick: validLegs[i].pick || `Leg ${i + 1}`, odds: Number(validLegs[i].odds) || 0, sport: 'MLB', event: validLegs[i].event || '' }))
                setSlipMsg(`✓ Combo #${idx + 1} added to slip`); setTimeout(() => setSlipMsg(''), 3000)
              }
              return (
                <div key={idx} onClick={onAddToSlip ? addCombo : undefined} title={onAddToSlip ? 'Tap to add this combo to your slip' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '2px', cursor: onAddToSlip ? 'pointer' : 'default' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, color: 'var(--muted)', marginRight: '6px' }}>#{idx + 1}</span>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{picks.join('  +  ')}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON_T }}>{am}</span>
                    <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt$(stakePerCombo)} → {fmt$(payout)}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '8px' }}>{onAddToSlip ? 'Tap any combo to add it to your slip · ' : ''}Each row is one parlay to place — exactly what to build on Novig (no auto-RR there).</div>
          {slipMsg && <div style={{ textAlign: 'center', fontFamily: R, fontSize: '10px', color: NEON_T, marginTop: '6px' }}>{slipMsg}</div>}
        </div>
      )}

      {/* ── OUTCOME MATRIX ── */}
      {n > 0 && totalCombos > 0 && (
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionLabel icon={BarChart3}>Outcome Matrix — {n}-leg RR {rrType}s · {fmt$(stakePerCombo)}/combo</SectionLabel>

          {isMobile ? (
            /* Mobile: compact card rows */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {outcomeMatrix.map(({ hits, winningCombos, payout, pl }) => {
                const isBreakEven = hits === minHits
                const isMax       = hits === n
                const plColor     = pl > 0 ? NEON_T : pl < 0 ? RED : YELLOW
                return (
                  <div key={hits} style={{
                    display: 'grid', gridTemplateColumns: '52px 1fr 80px 80px',
                    gap: '6px', alignItems: 'center',
                    padding: '8px 10px',
                    background: isMax ? 'rgba(189,255,0,0.04)' : isBreakEven ? 'rgba(245,166,35,0.04)' : 'var(--card2)',
                    border: `1px solid ${isMax ? 'rgba(189,255,0,0.15)' : isBreakEven ? 'rgba(245,166,35,0.15)' : 'var(--border)'}`,
                    borderRadius: '2px',
                  }}>
                    <div>
                      <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: hits === 0 ? RED : isMax ? NEON_T : 'var(--text)', lineHeight: 1 }}>{hits}/{n}</div>
                      <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '1px' }}>legs</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isBreakEven && hits > 0 && <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, color: YELLOW, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.08em' }}>MIN</span>}
                      {isMax && <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, color: NEON_T, background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.2)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.08em' }}>MAX</span>}
                      {winningCombos > 0 && <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{winningCombos} combo{winningCombos > 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: payout > 0 ? 'var(--text-sub)' : 'var(--muted)' }}>{payout > 0 ? fmt$(payout) : '—'}</div>
                      <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)' }}>return</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: plColor, textShadow: pl > 0 ? 'var(--neon-glow)' : pl < 0 ? 'var(--red-glow)' : 'none' }}>{pl > 0 ? '+' : ''}{fmt$(pl)}</div>
                      <div style={{ fontFamily: R, fontSize: '7px', color: plColor, opacity: 0.7 }}>{pl > 0 ? 'profit' : pl < 0 ? 'loss' : 'even'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop: full table */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border)` }}>
                    {['Legs Correct', 'Winning Combos', 'Est. Return', 'Est. P / L', 'Result'].map(h => (
                      <th key={h} style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', padding: '8px 14px', textAlign: h === 'Legs Correct' || h === 'Winning Combos' ? 'center' : 'right', background: 'var(--card)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outcomeMatrix.map(({ hits, winningCombos, payout, pl }) => {
                    const isBreakEven = hits === minHits
                    const isMax       = hits === n
                    return (
                      <tr key={hits} style={{ borderBottom: `1px solid var(--border)`, backgroundColor: isMax ? 'rgba(189,255,0,0.04)' : isBreakEven ? 'rgba(245,166,35,0.04)' : 'transparent' }}>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'center', color: hits === 0 ? RED : hits === n ? NEON_T : 'var(--text)' }}>
                          {hits} / {n}
                          {isBreakEven && hits > 0 && <span style={{ fontFamily: R, fontSize: '8px', color: YELLOW, marginLeft: '6px', letterSpacing: '0.1em' }}>MIN</span>}
                          {isMax && <span style={{ fontFamily: R, fontSize: '8px', color: NEON_T, marginLeft: '6px', letterSpacing: '0.1em' }}>MAX</span>}
                        </td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, padding: '9px 14px', textAlign: 'center', color: winningCombos > 0 ? NEON_T : 'var(--muted)' }}>{winningCombos > 0 ? winningCombos : '—'}</td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'right', color: payout > 0 ? 'var(--text)' : 'var(--muted)' }}>{payout > 0 ? fmt$(payout) : '—'}</td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'right', color: pl > 0 ? NEON_T : pl < 0 ? RED : YELLOW, textShadow: pl > 0 ? 'var(--neon-glow)' : pl < 0 ? 'var(--red-glow)' : 'none' }}>{pl > 0 ? '+' : ''}{fmt$(pl)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '2px', color: pl > 0 ? NEON_T : pl < 0 ? RED : YELLOW, background: pl > 0 ? 'rgba(189,255,0,0.07)' : pl < 0 ? 'rgba(255,59,59,0.07)' : 'rgba(245,166,35,0.07)', border: `1px solid ${pl > 0 ? 'rgba(189,255,0,0.2)' : pl < 0 ? 'rgba(255,59,59,0.2)' : 'rgba(245,166,35,0.2)'}` }}>
                            {pl > 0 ? 'PROFIT' : pl < 0 ? 'LOSS' : 'BREAK EVEN'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '8px', fontFamily: R, fontSize: '8px', color: 'var(--muted)', letterSpacing: '0.1em' }}>
            ESTIMATES BASED ON AVERAGE LEG ODDS · ENTER RESULTS ABOVE FOR EXACT CALCULATION
          </div>
        </div>
      )}

      {/* Empty state */}
      {n === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
          <Target size={14} color='rgba(189,255,0,0.3)' strokeWidth={1.5} />
          <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>Enter odds above to generate RR summary &amp; outcome matrix</span>
        </div>
      )}

    </div>
  )
}

// ─── ANALYTICS HELPERS (outside component — no re-mount bugs) ────────────────
function BreakRow({ label, wins, total, pnl, darkMode }) {
  const wr = total > 0 ? wins / total : 0
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span style={{ fontFamily: R, fontSize: '11px', color: 'var(--muted)' }}>{wins}W – {total - wins}L</span>
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: wr >= 0.525 ? NEON_T : 'var(--text-sub)' }}>
            {total > 0 ? (wr * 100).toFixed(0) : 0}%
          </span>
          <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, minWidth: '52px', textAlign: 'right',
            color: pnl >= 0 ? NEON_T : RED,
            textShadow: pnl >= 0 && darkMode ? '0 0 8px rgba(189,255,0,0.2)' : 'none' }}>
            {(pnl >= 0 ? '+' : '') + fmt$(pnl)}
          </span>
        </div>
      </div>
      <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${wr * 100}%`,
          background: wr >= 0.525 ? NEON : 'var(--border2)', borderRadius: '2px', transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

const ATip = ({ active, payload, label: tLabel, fmt: fmtFn }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--border2)', padding: '10px 14px', borderRadius: '2px', fontFamily: R }}>
      {fmtFn ? fmtFn(payload, tLabel) : (
        <>
          <div style={{ fontSize: '14px', fontWeight: 700, color: payload[0].value >= 0 ? NEON_T : RED }}>{fmtU(payload[0].value)}</div>
          {tLabel && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{tLabel}</div>}
        </>
      )}
    </div>
  )
}

// ─── ANALYTICS PANEL ─────────────────────────────────────────────────────────
function AnalyticsPanel({ bets, stats, masterBankroll, ladderStarting = 0, darkMode, onSettle, onEdit, onShare, betEvents = [], betRosterPlayers = [], betBoxScores = {}, betWinPct = {} }) {
  const { isMobile, isTablet } = useMobile()
  const g = (d, t, m) => isMobile ? m : isTablet ? t : d
  const [chartView,      setChartView]      = useState('cumulative')
  const [analyticspill,  setAnalyticsPill]  = useState('curve')
  const [showUnits,      setShowUnits]      = useState(false)

  const settled = bets.filter(b => b.result === 'W' || b.result === 'L')

  // Per-bet cumulative curve
  let runCum = 0
  const betCurve = [{ n: 0, value: 0, pick: 'Start' }]
  settled.forEach((b, i) => {
    runCum += b.pnl
    betCurve.push({ n: i + 1, value: +runCum.toFixed(2), pick: b.pick || b.event, result: b.result })
  })

  // Daily
  const dailyMap = {}
  settled.forEach(b => {
    const day = b.date?.slice(0, 10) || 'N/A'
    if (!dailyMap[day]) dailyMap[day] = { day: day.slice(5), pnl: 0, bets: 0, wins: 0 }
    dailyMap[day].pnl += b.pnl; dailyMap[day].bets++
    if (b.result === 'W') dailyMap[day].wins++
  })
  const daily = Object.values(dailyMap).sort((a, z) => a.day.localeCompare(z.day))
  daily.forEach(d => { d.wr = d.bets > 0 ? +(d.wins / d.bets * 100).toFixed(1) : 0 })

  // Monthly (for win rate chart)
  const monthlyMap = {}
  settled.forEach(b => {
    const mo = b.date?.slice(0, 7) || 'N/A'
    if (!monthlyMap[mo]) monthlyMap[mo] = { month: mo.slice(5), pnl: 0, bets: 0, wins: 0, cumPnl: 0 }
    monthlyMap[mo].pnl += b.pnl; monthlyMap[mo].bets++
    if (b.result === 'W') monthlyMap[mo].wins++
  })
  const monthly = Object.values(monthlyMap).sort((a, z) => a.month.localeCompare(z.month))
  let cum = 0
  monthly.forEach(m => { cum += m.pnl; m.cumPnl = +cum.toFixed(2); m.wr = m.bets > 0 ? +(m.wins / m.bets * 100).toFixed(1) : 0 })

  // Bet type
  const _pnl$ = (b) => b.ladder ? b.pnl : (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * (stats?.unitSize || 20)
  const typeMap = {}
  settled.forEach(b => {
    const t = b.betType || 'Straight'
    if (!typeMap[t]) typeMap[t] = { type: t, pnl: 0, bets: 0, wins: 0 }
    typeMap[t].pnl += _pnl$(b); typeMap[t].bets++
    if (b.result === 'W') typeMap[t].wins++
  })
  const byType = Object.values(typeMap).sort((a, z) => z.bets - a.bets)

  // Book — group by book, "No Book" if none selected
  const bookMap = {}
  settled.forEach(b => {
    const bk = b.book || 'No Book'
    if (!bookMap[bk]) bookMap[bk] = { book: bk, pnl: 0, bets: 0, wins: 0 }
    bookMap[bk].pnl += _pnl$(b); bookMap[bk].bets++
    if (b.result === 'W') bookMap[bk].wins++
  })
  const byBook = Object.values(bookMap).sort((a, z) => z.bets - a.bets)

  // Streaks
  const streaks = []
  let cur = null
  settled.forEach(b => {
    if (!cur || cur.result !== b.result) { cur = { result: b.result, count: 1 }; streaks.push(cur) }
    else cur.count++
  })
  const maxW = Math.max(0, ...streaks.filter(s => s.result === 'W').map(s => s.count))
  const maxL = Math.max(0, ...streaks.filter(s => s.result === 'L').map(s => s.count))
  const curStreak = streaks.length ? streaks[streaks.length - 1] : null
  const profitFactor = stats.allLost$ > 0 ? (stats.allWon$ / stats.allLost$).toFixed(2) : '∞'

  const chartViews = [
    { id: 'cumulative', label: '📈 Cumulative P&L' },
    { id: 'daily',      label: '📅 Daily Bars' },
    { id: 'winrate',    label: '🎯 Win Rate' },
  ]

  const pillBtn = (id, label, state, setState) => {
    const active = state === id
    return (
      <button key={id} onClick={() => setState(s => s === id ? null : id)} style={{
        flexShrink: 0, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
        border: `1px solid ${active ? NEON : 'var(--border2)'}`,
        background: active ? NEON : 'var(--card2)',
        color: active ? '#000' : 'var(--muted)',
        boxShadow: active ? `0 0 10px rgba(189,255,0,0.3)` : 'none',
        transition: 'all 0.12s',
      }}>{label}</button>
    )
  }

  const chartPanel = (
    <div style={{ ...cardStyle, padding: '14px 14px 10px' }}>
      {isMobile && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chartViews.map(v => (
            <button key={v.id} onClick={() => setChartView(v.id)} style={{
              flexShrink: 0, fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: '2px', cursor: 'pointer',
              border: `1px solid ${chartView === v.id ? NEON : 'var(--border2)'}`,
              background: chartView === v.id ? 'rgba(189,255,0,0.1)' : 'var(--card2)',
              color: chartView === v.id ? NEON_T : 'var(--muted)',
            }}>{v.label.replace(/^.+? /, '')}</button>
          ))}
        </div>
      )}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <SectionLabel>Performance Chart</SectionLabel>
          <div style={{ display: 'flex', gap: '5px' }}>
            {chartViews.map(v => (
              <button key={v.id} onClick={() => setChartView(v.id)} style={{ ...btnStyle(chartView === v.id), padding: '5px 14px', fontSize: '10px' }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 240}>
        {chartView === 'cumulative' ? (
          <AreaChart data={betCurve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={NEON} stopOpacity={0.2} />
                <stop offset="95%" stopColor={NEON} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aGradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={RED} stopOpacity={0.15} />
                <stop offset="95%" stopColor={RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="n" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}u`} width={42} />
            <Tooltip content={<ATip fmtFn={(p) => (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: p[0].value >= 0 ? NEON_T : RED }}>{fmtU(p[0].value)} cumulative</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Bet #{p[0].payload.n} · {p[0].payload.pick}</div>
              </div>
            )} />} />
            <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="value" stroke={betCurve[betCurve.length - 1]?.value >= 0 ? NEON : RED} strokeWidth={2.5}
              fill={betCurve[betCurve.length - 1]?.value >= 0 ? 'url(#aGrad)' : 'url(#aGradRed)'}
              dot={false} activeDot={{ r: 4, fill: NEON, strokeWidth: 0 }} />
          </AreaChart>
        ) : chartView === 'daily' ? (
          <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="day" tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)', fontWeight: 700 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}u`} width={42} />
            <Tooltip content={<ATip fmtFn={(p) => (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: p[0].value >= 0 ? NEON_T : RED }}>{fmtU(p[0].value)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{p[0].payload.bets} bets · {p[0].payload.wins}W</div>
              </div>
            )} />} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {daily.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? NEON : RED} opacity={0.88} />)}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontFamily: R, fontSize: 11, fill: 'var(--muted)', fontWeight: 700 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={42} domain={[0, 100]} />
            <Tooltip content={<ATip fmtFn={(p) => (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: parseFloat(p[0].value) >= 52.5 ? NEON_T : RED }}>{p[0].value}% WR</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{p[0].payload.bets} bets</div>
              </div>
            )} />} />
            <ReferenceLine y={52.5} stroke={NEON} strokeDasharray="4 4" strokeOpacity={0.45}
              label={{ value: '52.5% target', position: 'insideTopRight', fill: NEON, fontSize: 9, fontFamily: R }} />
            <Line type="monotone" dataKey="wr" stroke={YELLOW} strokeWidth={2.5}
              dot={{ r: 4, fill: YELLOW, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Always visible: Net Units + ROI */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
        <button onClick={() => setShowUnits(v => !v)} style={{
          fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
          padding: '3px 10px', borderRadius: '100px', cursor: 'pointer',
          border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)', color: NEON_T,
        }}>{showUnits ? 'u → $' : '$ → u'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div onClick={() => setShowUnits(v => !v)} style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.netPnlU >= 0 ? NEON : RED}`, cursor: 'pointer' }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>{showUnits ? 'Net Units' : 'Net P&L'}<InfoTip text="Total profit/loss across all settled bets. Tap to toggle between dollars and units." /></div>
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: stats.netPnlU >= 0 ? NEON_T : RED, lineHeight: 1 }}>
            {showUnits ? fmtU(stats.netPnlU) : fmt$(stats.netPnl$, true)}
          </div>
          <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.total} settled · tap to toggle</div>
        </div>
        <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.roi >= 0 ? NEON : RED}` }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>ROI<InfoTip text="Return on investment across all settled bets. Total P&L ÷ total dollars risked." /></div>
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: stats.roi >= 0 ? NEON_T : RED, lineHeight: 1 }}>{stats.roi >= 0 ? '+' : ''}{(stats.roi * 100).toFixed(1)}%</div>
          <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>profit factor {profitFactor}</div>
        </div>
      </div>

      {/* Pills */}
      <div className="analytics-pills">
        {[
          ['curve',   'P&L Curve',  'cumulative'],
          ['monthly', 'Daily',      'daily'],
          ['winrate', 'Win Rate',   'winrate'],
        ].map(([id, label, view]) => {
          const active = analyticspill === id
          return (
            <button key={id} onClick={() => { setAnalyticsPill(s => s === id ? null : id); setChartView(view) }} style={{
              flexShrink: 0, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
              border: `1px solid ${active ? NEON : 'var(--border2)'}`,
              background: active ? NEON : 'var(--card2)',
              color: active ? '#000' : 'var(--muted)',
              boxShadow: active ? `0 0 10px rgba(189,255,0,0.3)` : 'none',
              transition: 'all 0.12s',
            }}>{label}</button>
          )
        })}
        {pillBtn('bytype', 'By Type', analyticspill, setAnalyticsPill)}
        {pillBtn('kelly',  'Kelly',   analyticspill, setAnalyticsPill)}
      </div>

      {/* Sub-panel */}
      {(analyticspill === 'curve' || analyticspill === 'monthly' || analyticspill === 'winrate') && chartPanel}
      {/* Note: 'monthly' pill now opens daily bars — chartView set to 'daily' in onClick */}

      {analyticspill === 'bytype' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ ...cardStyle, padding: '12px 14px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Bet Type</div>
            {byType.length === 0
              ? <div style={{ fontFamily: R, fontSize: '12px', color: 'var(--muted)' }}>No settled bets yet</div>
              : byType.map(t => <BreakRow key={t.type} label={t.type} wins={t.wins} total={t.bets} pnl={t.pnl} darkMode={darkMode} />)}
          </div>
          <div style={{ ...cardStyle, padding: '12px 14px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>By Book</div>
            {byBook.length === 0
              ? <div style={{ fontFamily: R, fontSize: '12px', color: 'var(--muted)' }}>No book data</div>
              : byBook.map(b => <BreakRow key={b.book} label={b.book} wins={b.wins} total={b.bets} pnl={b.pnl} darkMode={darkMode} />)}
          </div>
        </div>
      )}

      {analyticspill === 'kelly' && (
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>Kelly Criterion · -110<InfoTip text="Mathematically optimal bet size for your edge. Use ½ Kelly to reduce variance." /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[0.52, 0.54, 0.56, 0.58, 0.60].map(wr => {
              const b = 100 / 110
              const k = (b * wr - (1 - wr)) / b
              const isYours = Math.abs(wr - stats.winRate) < 0.015
              return (
                <div key={wr} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', padding: '8px 10px',
                  background: isYours ? 'rgba(189,255,0,0.06)' : 'var(--card2)',
                  border: `1px solid ${isYours ? 'rgba(189,255,0,0.3)' : 'var(--border)'}`, borderRadius: '2px' }}>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: isYours ? NEON_T : 'var(--text-sub)' }}>
                    {(wr * 100).toFixed(0)}% WR{isYours ? ' ←' : ''}
                  </span>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON_T }}>{(k * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>{fmt$(masterBankroll * k / 2)} ½K</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Always-visible bottom stat chips */}
      {!analyticspill && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px' }}>
          {[
            { label: 'Win Streak', value: maxW ? `${maxW}W` : '—', color: NEON_T, tip: 'Your longest consecutive winning streak. Useful for tracking hot runs and variance.' },
            { label: 'Loss Streak', value: maxL ? `${maxL}L` : '—', color: RED, tip: 'Your longest consecutive losing streak. High numbers may signal tilt or bad line shopping.' },
            { label: 'Profit Factor', value: profitFactor, color: parseFloat(profitFactor) >= 1 ? NEON_T : RED, tip: 'Total won ÷ total lost. Above 1.0 = profitable. Below 1.0 = losing money overall.' },
            { label: 'Avg Win',  value: stats.wins   ? (showUnits ? `+${(stats.avgWin$ / stats.unitSize).toFixed(2)}u`   : fmt$(stats.avgWin$))            : '—', color: NEON_T, tip: 'Average dollar (or unit) amount won per winning bet.' },
            { label: 'Avg Loss', value: stats.losses ? (showUnits ? `-${(stats.avgLoss$ / stats.unitSize).toFixed(2)}u`  : `-${fmt$(stats.avgLoss$)}`)       : '—', color: RED, tip: 'Average dollar (or unit) amount lost per losing bet.' },
            { label: 'Avg Odds', value: fmtOdds(Math.round(stats.avgOdds)), color: 'var(--text)', tip: 'Average American odds across all settled bets. Tracks line quality over time.' },
          ].map(({ label, value, color, tip }) => (
            <SmallCard key={label} label={label} value={value} color={color} tip={tip} />
          ))}
        </div>
      )}

      {/* Live Open Bets — always at the bottom */}
      {(() => {
        const regularOpen = bets.filter(b => b.result === 'Open' && !b.ladder)
        const ladderRows  = bets.filter(b => b.ladder).sort((a, z) => a.ladderId - z.ladderId)
        const ladderBankIn = ladderRows.reduce((acc, row) => {
          const prev   = acc[acc.length - 1]
          const bIn    = prev ? prev.bankOut : (ladderStarting || masterBankroll * 0.15)
          const profit = row.odds > 0 ? row.stake * row.odds / 100 : row.stake * 100 / Math.abs(row.odds || 1)
          const bankOut = row.result === 'W' ? bIn - row.stake + row.stake + profit
                        : row.result === 'L' ? bIn - row.stake : bIn
          acc.push({ id: row.id, bankIn: bIn, bankOut })
          return acc
        }, [])
        const bankInMap = Object.fromEntries(ladderBankIn.map(r => [r.id, r.bankIn]))
        const activeRung = ladderRows.filter(b => b.result === 'Open').slice(0, 1)
        const openBets = [...regularOpen, ...activeRung].slice(0, 8)
        if (!openBets.length) return null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
              ● Live — {openBets.length} Open
            </div>
            {openBets.map(b => (
              <BetCard
                key={b.id}
                bet={b}
                onSettle={onSettle}
                onEdit={onEdit}
                onShare={onShare}
                unitSize={stats.unitSize}
                bankIn={bankInMap[b.id]}
                events={betEvents}
                players={betRosterPlayers}
                boxScores={betBoxScores}
                winPct={betWinPct}
              />
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── SESSION RECAP ────────────────────────────────────────────────────────────
function calcDisciplineScore(bets, stats, tilt, riskSettings, masterBankroll) {
  let score = 0
  const reasons = []

  // +20: No tilt
  if (tilt.level === 'GREEN') { score += 20; reasons.push({ label: 'No tilt detected', pts: 20, pass: true }) }
  else if (tilt.level === 'YELLOW') { score += 10; reasons.push({ label: 'Minor tilt warning', pts: 10, pass: false }) }
  else { score += 0; reasons.push({ label: 'Tilt warning active', pts: 0, pass: false }) }

  // +20: Bet sizing within limits
  const unitSize = masterBankroll / 100
  const maxBetUnit = masterBankroll * (riskSettings.maxRiskPerBetPct / 100)
  const settled = bets.filter(b => b.result === 'W' || b.result === 'L')
  const oversized = settled.filter(b => (b.stake || b.units * unitSize) > maxBetUnit)
  if (oversized.length === 0) { score += 20; reasons.push({ label: 'All bets within size limits', pts: 20, pass: true }) }
  else { score += 0; reasons.push({ label: `${oversized.length} bet(s) over size limit`, pts: 0, pass: false }) }

  // +20: Not chasing (no bet up after loss)
  let chasing = false
  for (let i = 1; i < settled.length; i++) {
    if (settled[i - 1].result === 'L' && (settled[i].stake || settled[i].units * unitSize) > (settled[i - 1].stake || settled[i - 1].units * unitSize)) {
      chasing = true; break
    }
  }
  if (!chasing) { score += 20; reasons.push({ label: 'No chasing detected', pts: 20, pass: true }) }
  else { score += 0; reasons.push({ label: 'Bet size increased after loss', pts: 0, pass: false }) }

  // +20: Daily risk under cap
  const totalRisk = bets.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const dailyCap  = masterBankroll * (riskSettings.maxRiskTodayPct / 100)
  if (totalRisk <= dailyCap) { score += 20; reasons.push({ label: 'Daily risk within cap', pts: 20, pass: true }) }
  else { score += 0; reasons.push({ label: 'Daily risk cap exceeded', pts: 0, pass: false }) }

  // +20: Win rate >= 50%
  if (stats.total >= 3) {
    if (stats.winRate >= 0.5) { score += 20; reasons.push({ label: `Win rate ${(stats.winRate * 100).toFixed(0)}% ≥ 50%`, pts: 20, pass: true }) }
    else { score += Math.round(stats.winRate * 40); reasons.push({ label: `Win rate ${(stats.winRate * 100).toFixed(0)}% below 50%`, pts: Math.round(stats.winRate * 40), pass: false }) }
  } else {
    score += 10; reasons.push({ label: 'Not enough bets to grade WR', pts: 10, pass: true })
  }

  return { score: Math.min(100, score), reasons }
}

function sessionGrade(score, stats) {
  if (score >= 90 && stats.winRate >= 0.55)  return { grade: 'A', color: '#BDFF00', label: 'Elite Discipline' }
  if (score >= 75 && stats.winRate >= 0.50)  return { grade: 'B', color: '#BDFF00', label: 'Strong Session' }
  if (score >= 60)                            return { grade: 'C', color: '#F5A623', label: 'Average — Room to Improve' }
  if (score >= 40)                            return { grade: 'D', color: '#FF6B35', label: 'Needs Work' }
  return                                             { grade: 'F', color: '#FF3B3B', label: 'Restart From Scratch' }
}

const MOODS = ['Focused 🎯', 'Confident 💪', 'Neutral 😐', 'Cautious 🧐', 'Frustrated 😤', 'Tilted 🔥']
const STYLES = [
  { id: 'conservative', label: 'Conservative', icon: '🛡️', desc: '1-2% unit, max 3 bets/day, straight bets only, high confidence',   color: '#BDFF00' },
  { id: 'balanced',     label: 'Balanced',     icon: '⚖️',  desc: '2-3% unit, mix of straights and small parlays, 4-6 bets/day',      color: '#F5A623' },
  { id: 'aggressive',   label: 'Aggressive',   icon: '⚡',  desc: '3-5% unit, RR bets, higher volume, accept more variance',          color: '#FF3B3B' },
]
const CHECKLIST = [
  { id: 'system',    label: 'I followed my betting system for every bet' },
  { id: 'sizing',    label: 'All bets were within my unit sizing rules' },
  { id: 'chasing',   label: 'I did NOT chase losses at any point' },
  { id: 'emotions',  label: 'I was not betting on emotion or frustration' },
  { id: 'research',  label: 'I had a clear reason / edge for each bet' },
  { id: 'limits',    label: 'I respected my daily stop loss and profit lock' },
  { id: 'pullcheck', label: 'I honored all pull profit checkpoints on the ladder' },
  { id: 'impulse',   label: 'I did not place any impulse or last-minute bets' },
  { id: 'lines',     label: 'I shopped lines and got the best available odds' },
  { id: 'sober',     label: 'I was in a clear, focused state of mind' },
  { id: 'plan',      label: 'I had a pre-session plan before placing any bets' },
  { id: 'review',    label: 'I reviewed my recent performance before betting' },
  { id: 'journal',   label: 'I documented my reasoning for each bet today' },
]

function SessionRecap({ bets, stats, tilt, masterBankroll, riskSettings, darkMode }) {
  const { isMobile, isTablet } = useMobile()
  const g = (d, t, m) => isMobile ? m : isTablet ? t : d
  const [mood,         setMood]         = useState('')
  const [wentWell,     setWentWell]     = useState('')
  const [improve,      setImprove]      = useState('')
  const [lesson,       setLesson]       = useState('')
  const [trigger,      setTrigger]      = useState('')
  const [style,        setStyle]        = useState('balanced')
  const [showAllChecks,setShowAllChecks]= useState(false)
  const [checks,       setChecks]       = useState({})
  const [sessionPill,  setSessionPill]  = useState('checklist')
  const [gradeOverride,setGradeOverride]= useState(null)

  const { score, reasons } = useMemo(
    () => calcDisciplineScore(bets, stats, tilt, riskSettings, masterBankroll),
    [bets, stats, tilt, riskSettings, masterBankroll]
  )

  // Grade color always follows the DISPLAYED grade (override or auto)
  const gradeColorMap = { A: NEON, B: NEON, C: '#F5A623', D: '#FF6B35', F: RED }

  const { grade, label: gradeLabel } = sessionGrade(score, stats)
  const displayGrade      = gradeOverride || grade
  const gradeColor        = gradeColorMap[displayGrade]   // always tracks displayed grade
  const gradeColorAlpha   = displayGrade === 'A' || displayGrade === 'B'
    ? 'rgba(189,255,0,0.35)' : `${gradeColor}55`

  const toggleCheck = (id) => setChecks(p => ({ ...p, [id]: !p[id] }))
  const checksPassed = CHECKLIST.filter(c => checks[c.id]).length
  const allChecked   = checksPassed === CHECKLIST.length

  const scoreColor = score >= 80 ? NEON : score >= 60 ? '#F5A623' : score >= 40 ? '#FF6B35' : RED

  const pillBtn = (id, label) => {
    const active = sessionPill === id
    return (
      <button key={id} onClick={() => setSessionPill(s => s === id ? null : id)} style={{
        flexShrink: 0, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
        border: `1px solid ${active ? NEON : 'var(--border2)'}`,
        background: active ? NEON : 'var(--card2)',
        color: active ? '#000' : 'var(--muted)',
        boxShadow: active ? `0 0 10px rgba(189,255,0,0.3)` : 'none',
        transition: 'all 0.12s',
      }}>{label}</button>
    )
  }

  const gradeCard = (
    <div style={{ ...cardStyle, padding: '12px 14px', borderTop: `2px solid ${gradeColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Session Grade<InfoTip text="A–F grade based on your process this session: checklist completion, bet sizing discipline, tilt control, and stop/lock adherence. Not based on results." /></div>
          <div style={{ fontFamily: R, fontSize: '40px', fontWeight: 700, lineHeight: 1, color: gradeColor }}>{displayGrade}</div>
          <div style={{ fontFamily: R, fontSize: '9px', color: gradeColor, marginTop: '3px', opacity: 0.8 }}>{gradeOverride ? {A:'Elite',B:'Strong',C:'Average',D:'Needs Work',F:'Restart'}[gradeOverride] : gradeLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Discipline<InfoTip text="Discipline Score™ (0–100): measures how well you followed your process — checklist, bet sizing, tilt control, stop loss, and profit lock. High score = you operated correctly, regardless of results." /></div>
          <div style={{ fontFamily: R, fontSize: '32px', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score}</div>
          <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>/100</div>
        </div>
      </div>
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '10px' }}>
        <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: '2px', transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', justifyContent: 'center' }}>
        {['A','B','C','D','F'].map(g => (
          <button key={g} onClick={() => setGradeOverride(gradeOverride === g ? null : g)} style={{
            fontFamily: R, fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '2px', cursor: 'pointer',
            border: `1px solid ${displayGrade === g ? gradeColor : 'var(--border2)'}`,
            background: displayGrade === g ? `${gradeColor}18` : 'var(--card)',
            color: displayGrade === g ? gradeColor : 'var(--muted)',
          }}>{g}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {gradeCard}

      {/* Pills */}
      <div className="analytics-pills">
        {['checklist','structure','recap','breakdown'].map((id, i) =>
          pillBtn(id, ['Checklist','Structure','Recap','Breakdown'][i])
        )}
      </div>

      {/* Checklist panel */}
      {sessionPill === 'checklist' && (
        <div style={{ ...cardStyle, padding: '12px 14px', maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>Pre-Bet Checklist</div>
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: allChecked ? NEON_T : 'var(--muted)' }}>{checksPassed}/{CHECKLIST.length} {allChecked ? '✓' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(showAllChecks ? CHECKLIST : CHECKLIST.slice(0, 6)).map(({ id, label }) => {
              const checked = !!checks[id]
              return (
                <button key={id} onClick={() => toggleCheck(id)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                  background: checked ? 'rgba(189,255,0,0.06)' : 'var(--card2)',
                  border: `1px solid ${checked ? 'rgba(189,255,0,0.3)' : 'var(--border)'}`, transition: 'all 0.15s',
                }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${checked ? NEON : 'var(--border2)'}`, background: checked ? 'rgba(189,255,0,0.15)' : 'var(--card)' }}>
                    {checked && <span style={{ color: NEON_T, fontSize: '9px', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: checked ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => setShowAllChecks(v => !v)} style={{ marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase' }}>
            {showAllChecks ? '▲ Show Less' : `▼ Show All ${CHECKLIST.length}`}
          </button>
          {allChecked && (
            <div style={{ marginTop: '10px', padding: '9px 12px', background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.3)', borderRadius: '2px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, letterSpacing: '0.1em' }}>🛡️ FULL DISCIPLINE — YOU ARE IN CONTROL</span>
            </div>
          )}
        </div>
      )}

      {/* Structure panel */}
      {sessionPill === 'structure' && (
        <div style={{ ...cardStyle, padding: '12px 14px', maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
          <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Bet Structure</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {STYLES.map(s => {
              const active = style === s.id
              return (
                <button key={s.id} onClick={() => setStyle(s.id)} style={{
                  padding: '10px 12px', borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                  background: active ? `${s.color}10` : 'var(--card2)',
                  border: `1px solid ${active ? `${s.color}50` : 'var(--border)'}`,
                  borderLeft: active ? `3px solid ${s.color}` : '3px solid transparent', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: active ? s.color : 'var(--text)' }}>{s.icon} {s.label}</span>
                    {active && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, color: s.color, letterSpacing: '0.12em' }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', lineHeight: 1.4 }}>{s.desc}</div>
                </button>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '2px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--neon-accent)', textTransform: 'uppercase', marginBottom: '6px' }}>
              {style === 'conservative' ? '🛡️ Conservative Rules' : style === 'balanced' ? '⚖️ Balanced Rules' : '⚡ Aggressive Rules'}
            </div>
            {(style === 'conservative'
              ? ['Max 1-2 bets per day','Straight bets only','Minimum -130 odds or better','Never bet > 2u per play','Stop after 2 losses in a day']
              : style === 'balanced'
              ? ['4-6 bets per day max','Straights + small parlays OK','Mix of favorites and dogs','Max 3u on any single play','Reset after hitting stop loss']
              : ['7+ bets per day allowed','RR bets and parlays welcome','Chase value at any odds','Larger units when confident','Aggressive profit targets']
            ).map(rule => (
              <div key={rule} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                <span style={{ color: style === 'conservative' ? NEON_T : style === 'balanced' ? YELLOW : RED, fontSize: '9px' }}>▸</span>
                <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)' }}>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recap panel */}
      {sessionPill === 'recap' && (
        <div style={{ ...cardStyle, padding: '12px 14px', maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>Today's Recap</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {MOODS.map(m => (
                <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={{
                  fontFamily: R, fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '2px', cursor: 'pointer',
                  border: `1px solid ${mood === m ? 'rgba(189,255,0,0.5)' : 'var(--border2)'}`,
                  background: mood === m ? 'rgba(189,255,0,0.08)' : 'var(--card)',
                  color: mood === m ? NEON_T : 'var(--text-dim)', transition: 'all 0.12s',
                }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '✅ What went well?', val: wentWell, set: setWentWell, placeholder: 'Stayed disciplined, hit 3/4 legs...' },
              { label: '🔧 What needs work?', val: improve, set: setImprove, placeholder: 'Avoided chasing that late bet...' },
              { label: '⚡ What triggered bad bets?', val: trigger, set: setTrigger, placeholder: 'Frustration after loss 2...' },
              { label: '🎓 Main lesson', val: lesson, set: setLesson, placeholder: 'Trust the process...' },
            ].map(({ label, val, set, placeholder }) => (
              <div key={label}>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <textarea value={val} onChange={e => set(e.target.value)} placeholder={placeholder} rows={2}
                  style={{ ...inputStyle, resize: 'vertical', padding: '8px 10px', fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: '1.5', fontWeight: 400 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown panel */}
      {sessionPill === 'breakdown' && (
        <div style={{ ...cardStyle, padding: '12px 14px', maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }}>
          <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Score Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {reasons.map(({ label, pts, pass }) => (
              <div key={label} style={{ padding: '9px 11px', background: 'var(--card2)',
                border: `1px solid ${pass ? 'rgba(189,255,0,0.18)' : 'rgba(255,59,59,0.18)'}`, borderRadius: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', lineHeight: 1.3, flex: 1 }}>{label}</span>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: pass ? NEON_T : RED, marginLeft: '8px' }}>{pts > 0 ? `+${pts}` : '0'}</span>
                </div>
                <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pts}%`, background: pass ? NEON : RED, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function loadSession(userId) {
  try {
    const { LS_KEY } = getKeys(userId)
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App({ user, session, subStatus, isDemo = false }) {
  const { isMobile, isTablet, isLandscape } = useMobile()
  // g(desktop, tablet, mobile) — grid-template-columns helper
  const g = (d, t, m) => isMobile ? m : isTablet ? t : d
  const pad = isMobile ? '10px' : '8px'

  const { LS_KEY, TMPL_KEY } = getKeys(isDemo ? 'demo' : user.id)
  const saved          = useRef(loadSession(isDemo ? 'demo' : user.id))
  const [syncing,      setSyncing]      = useState(false)
  const [cloudSynced,  setCloudSynced]  = useState(false)
  const [syncError,    setSyncError]    = useState(null)
  const userId  = user?.id
  const token   = session?.access_token

  const [darkMode,       setDarkMode]       = useState(saved.current?.darkMode       ?? true)
  const [tiltDismissed,  setTiltDismissed]  = useState(isDemo)
  const [ladderStarting,  setLadderStarting]  = useState(isDemo ? 20 : (saved.current?.ladderStarting ?? LADDER_STARTING_BR))
  const [ladderSessionKey, setLadderSessionKey] = useState(() => isDemo ? 'demo' : (saved.current?.ladderSessionKey ?? genUUID()))
  const [bets,           setBets]           = useState(isDemo ? INITIAL_BETS : (saved.current?.bets ?? []))
  const [bankroll,       setBankroll]       = useState(isDemo ? 1000 : (saved.current?.bankroll ?? 0))
  const [username,       setUsername]       = useState(isDemo ? 'OPERATOR' : (saved.current?.username ?? 'OPERATOR'))
  const [sportFilter,  setSportFilter]  = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  // Today+yesterday events (FREE, Supabase) so bet-log cards resolve real team logos via withLogos.
  const [betEvents, setBetEvents] = useState([])
  useEffect(() => {
    let on = true
    const SP = ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL']
    // Poll every 60s (was a one-time fetch): live scores must stay current so the dashboard bet cards'
    // live total bars + win-prob reflect the in-progress game — exactly like CH3 Track already polls.
    // Without this the dashboard held the score AS OF page load, so live tracking never updated.
    const load = () => Promise.all(SP.flatMap(s => [fetchBetEvents(s, 'today'), fetchBetEvents(s, 'yesterday')]))
      .then(rs => { if (on) setBetEvents(rs.flatMap(r => r?.data || [])) })
      .catch(() => {})
    load()
    const t = setInterval(load, 60000)
    return () => { on = false; clearInterval(t) }
  }, [])
  // Roster map for bet-log player-prop headshots: name→headshot across all active sports.
  const [betRosterPlayers, setBetRosterPlayers] = useState([])
  useEffect(() => {
    if (!token) return
    let on = true
    const SP = ['MLB', 'NBA', 'NHL', 'WNBA']
    Promise.all(SP.map(s =>
      fetch(`/api/player-search?all=1&sport=${encodeURIComponent(s)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .catch(() => [])
    )).then(arrs => {
      if (!on) return
      const all = arrs.flat()
      setBetRosterPlayers(all.map(p => ({ norm: normName(p.player || ''), headshot: p.headshot || null })).filter(p => p.norm))
    })
    return () => { on = false }
  }, [token])
  // Live box-score stats for dashboard bet cards (win-prob ring + live stat bars) — mirrors
  // CH3 TrackChannel: one fetch per live matched game, refreshed every 60s. Free (ESPN summary,
  // 0 Odds-API credits), keyed by event id. Finished (FT/AOT) games also fetched so the bar
  // locks in the settled final stat instead of going blank.
  const [betBoxScores, setBetBoxScores] = useState({})
  const [betWinPct, setBetWinPct] = useState({})   // event_id → { home, away } live game-winner prob (ML rings)
  const liveBetGameKeys = useMemo(() => {
    const set = new Set()
    for (const b of bets || []) {
      if (b.result !== 'Open') continue
      const ev = findEventForBet(b, betEvents)
      const hasBox = ev && (isLiveEvent(ev) || ev.status === 'FT' || ev.status === 'AOT')
      if (hasBox && ev.external_event_id) set.add(`${(b.sport || ev.sport || 'MLB')}|${ev.external_event_id}`)
    }
    return [...set]
  }, [bets, betEvents])
  useEffect(() => {
    if (!liveBetGameKeys.length) { setBetBoxScores({}); setBetWinPct({}); return }
    let live = true
    const load = () => Promise.all(liveBetGameKeys.map(k => {
      const [sp, id] = k.split('|')
      return fetch(`/api/box-score?sport=${encodeURIComponent(sp)}&id=${encodeURIComponent(id)}`)
        .then(r => r.ok ? r.json() : null).then(j => [id, j || {}]).catch(() => [id, {}])
    })).then(pairs => {
      if (!live) return
      setBetBoxScores(Object.fromEntries(pairs.map(([id, j]) => [id, j.players || {}])))
      setBetWinPct(Object.fromEntries(pairs.map(([id, j]) => [id, j.winPct || null])))
    })
    load()
    const t = setInterval(load, 60000)
    return () => { live = false; clearInterval(t) }
  }, [liveBetGameKeys.join(',')])
  const [sortCol,      setSortCol]      = useState('date')
  const [sortDir,      setSortDir]      = useState('desc')
  const [showAdd,      setShowAdd]      = useState(false)
  const [showShare,    setShowShare]    = useState(false)
  const [shareCopied,  setShareCopied]  = useState(false)
  const [shareCardBet, setShareCardBet] = useState(null)   // null = closed, 'session' = session card, bet obj = bet card
  const [editingBet,   setEditingBet]   = useState(null)
  const [tab,          setTab]          = useState(isDemo ? 'overview' : (saved.current?.tab ?? 'overview'))
  const [botView,      setBotView]      = useState('tv')   // which view the Matrix Bot opens on: 'tv' (default) | 'board' (via Analyze Bet door)
  const [initialBet,   setInitialBet]   = useState(null)
  const [riskSettings, setRiskSettings] = useState(saved.current?.riskSettings ?? {
    maxRiskPerBetPct: 3,
    maxRiskTodayPct:  10,
    stopLossPct:      10,
    profitLockPct:    20,
    unitPct:          1,
  })

  const [saveStatus,   setSaveStatus]   = useState(null)  // 'saved' | 'saving' | null
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [templates,    setTemplates]    = useState(() => { try { return JSON.parse(localStorage.getItem(TMPL_KEY) || '[]') } catch { return [] } }) // TMPL_KEY now user-specific via getKeys above
  const [showTemplates,setShowTemplates]= useState(false)

  const [showWelcome,  setShowWelcome]  = useState(false)
  const [onboardStep,  setOnboardStep]  = useState(1)
  const [welcomeBr,    setWelcomeBr]    = useState('')
  const [showHelp,     setShowHelp]     = useState(false)
  const [showMore,     setShowMore]     = useState(false)
  const [settingsPill, setSettingsPill] = useState(null)
  const [showCancelSurvey, setShowCancelSurvey] = useState(false)
  const [cancelReason,     setCancelReason]     = useState(null)
  const [portalPending,    setPortalPending]    = useState(false)
  const [overviewSection, setOverviewSection] = useState('limits')
  const [analyticsShowUnits, setAnalyticsShowUnits] = useState(false)
  const [betLogShowAll,   setBetLogShowAll]   = useState(false)

  // NPS prompt
  const [showNPS,        setShowNPS]        = useState(false)
  const [npsScore,       setNpsScore]       = useState(null)
  const [npsSubmitted,   setNpsSubmitted]   = useState(false)
  // Testimonial prompt
  const [showTestimonial, setShowTestimonial] = useState(false)
  // Changelog / What's New
  const CHANGELOG_VERSION = 'v2.6'
  const [showChangelog,  setShowChangelog]  = useState(false)
  const changelogUnseen = (() => { try { return localStorage.getItem('rml_changelog_seen') !== CHANGELOG_VERSION } catch { return false } })()

  // Open Stripe billing portal — shared helper used by all Manage Billing buttons
  const openBillingPortal = async () => {
    setPortalPending(true)
    try {
      const res  = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ returnUrl: window.location.href }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Could not open billing portal. Please try again.')
    } catch { alert('Connection error. Please try again.') }
    setPortalPending(false)
  }

  // Tab order for swipe navigation
  const TAB_ORDER = ['overview', 'ladder', 'bet log', 'analytics', 'rr engine', 'session', 'partners']
  const swipeHandlers = {}  // disabled — conflicts with vertical scroll on mobile
  const [pushEnabled,  setPushEnabled]  = useState(false)
  const [pushLoading,  setPushLoading]  = useState(false)

  // Check if push is already enabled on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub)
        })
      })
    }
  }, [])

  const [masterBrInput,    setMasterBrInput]    = useState('')
  const [masterBrFocused,  setMasterBrFocused]  = useState(false)
  const [masterBrOverride, setMasterBrOverride] = useState(isDemo ? null : (saved.current?.masterBrOverride ?? null))

  const _stats = useMemo(() => calcStats(bets, bankroll, ladderSessionKey), [bets, bankroll, ladderSessionKey])
  const curve  = useMemo(() => buildCurve(bets, bankroll), [bets, bankroll])
  const tilt   = useMemo(() => {
    const result = calcTilt(bets)
    // Auto-clear dismissed state when tilt resolves (win clears the flag)
    if (result.level === 'GREEN') setTiltDismissed(false)
    return result
  }, [bets])

  // Master Bankroll = manual override OR auto-follows P/L from bets
  const masterBankroll = masterBrOverride !== null ? masterBrOverride : _stats.currentBankroll

  // Unit size flows from masterBankroll (grows/shrinks with your balance)
  const stats = useMemo(() => {
    const unitSize = masterBankroll > 0 ? masterBankroll * (riskSettings.unitPct ?? 2) / 100 : 1
    return {
      ..._stats,
      unitSize,
      netPnlU:      unitSize > 0 ? _stats.netPnl$      / unitSize : 0,
      totalRiskedU: unitSize > 0 ? _stats.totalRisked$ / unitSize : 0,
    }
  }, [_stats, masterBankroll, riskSettings.unitPct])

  const risk  = useMemo(() => calcRisk(bets, masterBankroll, bankroll, riskSettings, ladderSessionKey), [bets, masterBankroll, bankroll, riskSettings, ladderSessionKey])
  const setRS = (k) => (e) => setRiskSettings(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))

  const applyMasterBr = () => {
    if (!masterBrFocused) return  // input was never focused — don't touch state
    setMasterBrFocused(false)
    const v = parseFloat(masterBrInput)
    if (!isNaN(v) && v > 0) {
      const hasSettled = bets.some(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
      if (!hasSettled) {
        // Initial setup: master bankroll becomes the starting bankroll, then auto-follows
        setBankroll(v)
        setMasterBrOverride(null)
      } else {
        // Has bet history: treat as manual balance correction
        setMasterBrOverride(v)
      }
    } else {
      setMasterBrOverride(null)
    }
  }

  // ── Auto-save to localStorage whenever key state changes ──
  useEffect(() => {
    if (isDemo) return // never overwrite real user data with demo data
    const payload = { bets, username, ladderStarting, ladderSessionKey, bankroll, masterBrOverride, riskSettings, darkMode, tab }
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
  }, [bets, bankroll, masterBrOverride, username, ladderStarting, ladderSessionKey, riskSettings, darkMode, tab])

  // ── Reset the Matrix Bot to its default TV view whenever we leave the Bot tab,
  //    so only the "Analyze Bet" door lands it on the board. ──
  useEffect(() => { if (tab !== 'bot') setBotView('tv') }, [tab])

  // ── On first load: pull data from Supabase if user is logged in ──
  useEffect(() => {
    if (!userId || isDemo) return
    ;(async () => {
      setSyncing(true)
      try {
        // Ensure the Supabase client has the current session (fixes 403 on API calls)
        if (session?.access_token) {
          await supabase.auth.setSession({
            access_token:  session.access_token,
            refresh_token: session.refresh_token,
          })
        }
        console.log('[RML] load — userId:', userId, '| token present:', !!token, '| token prefix:', token?.slice(0,20))
        // Load bets, settings, and templates from cloud in parallel — all three are independent
        // queries so there is no reason to await them sequentially. This cuts the initial cloud
        // round-trip from ~3 serial Supabase calls down to 1 (they all resolve together).
        const [
          { data: betRows,  error: betErr  },
          { data: settings, error: settErr },
          { data: tmplRows },
        ] = await Promise.all([
          fetchBets(userId, token),
          fetchSettings(userId, token),
          fetchTemplates(userId, token),
        ])

        const localSave = loadSession(userId)
        const localBets = localSave?.bets || []
        // Onboarding decision is deferred until AFTER settings load — a returning user with a
        // saved bankroll but no bets must NOT be re-onboarded (was the "re-onboards every sign-in"
        // bug: the gate keyed only off bets + a localStorage flag that dies on sign-out / new device).
        let cloudBetsEmpty = false

        if (betErr) {
          console.error('[RML] fetchBets error:', betErr)
          // Cloud failed — use localStorage so data isn't lost
          if (localBets.length > 0) {
            setBets(localBets)
            console.log('[RML] loaded bets from localStorage fallback:', localBets.length)
          }
        } else if (betRows?.length > 0) {
          const cloudBets = betRows.map(rowToBet)
          // Merge: add any localStorage bets not present in cloud (by id)
          const cloudIds = new Set(cloudBets.map(b => String(b.id)))
          const orphans  = localBets.filter(b => !cloudIds.has(String(b.id)))
          const merged   = [...cloudBets, ...orphans]
          if (orphans.length > 0) {
            console.log('[RML] merged', orphans.length, 'local-only bets into cloud data — will up-sync')
          }
          setBets(merged)
        } else {
          // Cloud empty — check localStorage before deciding anything
          if (localBets.length > 0) {
            // User had data locally (e.g. session expired mid-session) — restore it
            setBets(localBets)
            console.log('[RML] restored bets from localStorage (cloud was empty):', localBets.length)
          } else {
            // No bets anywhere — candidate for onboarding, but only if they have NO cloud
            // settings either (decided after settings load below).
            cloudBetsEmpty = true
          }
        }

        // A cloud settings row = this account has used the app before → never re-onboard it,
        // regardless of bets or this device's localStorage.
        const hasCloudSettings = !!settings
        if (settErr && settErr.code !== 'PGRST116') {
          console.error('[RML] fetchSettings error:', settErr)
          // Cloud failed — fall back to localStorage settings
          const localSaveSett = loadSession(userId)
          if (localSaveSett) {
            if (localSaveSett.ladderStarting) setLadderStarting(localSaveSett.ladderStarting)
            if (localSaveSett.bankroll != null) setBankroll(localSaveSett.bankroll)
            if (localSaveSett.masterBrOverride != null) setMasterBrOverride(localSaveSett.masterBrOverride)
            if (localSaveSett.username)       setUsername(localSaveSett.username)
            if (localSaveSett.riskSettings)   setRiskSettings(localSaveSett.riskSettings)
            if (localSaveSett.darkMode !== undefined) setDarkMode(localSaveSett.darkMode)
          }
        } else if (settings) {
          if (settings.ladder_starting)     setLadderStarting(settings.ladder_starting)
          if (settings.ladder_session_key)  setLadderSessionKey(settings.ladder_session_key)
          if (settings.bankroll != null)    setBankroll(settings.bankroll)   // 0 is a valid (reset) bankroll — don't ignore it
          setMasterBrOverride(settings.master_br_override ?? null)
          if (settings.username)            setUsername(settings.username)
          if (settings.risk_settings)       setRiskSettings(settings.risk_settings)
          if (settings.dark_mode !== undefined) setDarkMode(settings.dark_mode)
        } else {
          // No cloud settings — try localStorage
          const localSaveSett = loadSession(userId)
          if (localSaveSett) {
            if (localSaveSett.ladderStarting) setLadderStarting(localSaveSett.ladderStarting)
            if (localSaveSett.bankroll != null) setBankroll(localSaveSett.bankroll)
            if (localSaveSett.masterBrOverride != null) setMasterBrOverride(localSaveSett.masterBrOverride)
            if (localSaveSett.username)       setUsername(localSaveSett.username)
            if (localSaveSett.riskSettings)   setRiskSettings(localSaveSett.riskSettings)
            if (localSaveSett.darkMode !== undefined) setDarkMode(localSaveSett.darkMode)
          }
        }

        // Onboarding gate (deferred): show the welcome ONLY for a genuinely new account —
        // no bets (cloud + local) AND no cloud settings row AND not already welcomed on this device.
        if (cloudBetsEmpty && !hasCloudSettings && !localStorage.getItem(`rml_welcomed_v1_${userId}`)) {
          setShowWelcome(true)
        }

        // Apply templates (fetched in parallel above alongside bets + settings)
        if (tmplRows?.length > 0) {
          setTemplates(tmplRows.map(r => ({ name: r.name, date: r.created_at?.slice(0,10), bankroll: r.bankroll, username: r.username, riskSettings: r.risk_settings })))
        }
      } catch (err) {
        console.error('[RML] cloud load failed:', err)
      } finally {
        setSyncing(false)
        setCloudSynced(true)
      }
    })()
  }, [userId])

  // Guard: timestamp until which we ignore realtime events (our own saves)
  const realtimeIgnoreUntil = useRef(0)
  // Guard: when true, suppress the OUTBOUND bets auto-sync upsert. Set during reset/delete
  // so a stale debounced `syncAllBets(oldBets)` can't re-create rows we just deleted from
  // the cloud (syncAllBets is upsert-only — see supabase.js — so a stale snapshot resurrects).
  const syncSuspendedRef = useRef(false)

  // ── Auto-sync bets to Supabase (debounced 2s) ──
  useEffect(() => {
    if (!userId || !cloudSynced) return
    const t = setTimeout(() => {
      if (syncSuspendedRef.current) return // reset/delete in flight — don't resurrect rows
      realtimeIgnoreUntil.current = Date.now() + 5000 // ignore own save's realtime echo
      syncAllBets(bets, userId, token).then(({ error }) => {
        if (error) {
          console.error('[RML] syncAllBets error:', error)
          setSyncError(`Bets sync failed: ${error.message || error.code || 'unknown'}`)
        } else {
          setSyncError(null)
        }
      })
    }, 2000)
    return () => clearTimeout(t)
  }, [bets, userId, cloudSynced, token])

  // ── Realtime subscription — sync bets from other devices ──
  useEffect(() => {
    if (!userId || !cloudSynced || !token) return
    supabase.auth.setSession({ access_token: token, refresh_token: session?.refresh_token || '' })
    const channel = supabase
      .channel(`bets:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `user_id=eq.${userId}`,
      }, () => {
        // Skip if this is our own write (within 1s of our last sync)
        if (Date.now() < realtimeIgnoreUntil.current) return
        fetchBets(userId, token).then(({ data, error }) => {
          if (error) return
          const incoming = (data || []).map(rowToBet)
          // Only update if the data actually changed (avoids stomping local state with identical data)
          setBets(current => {
            const curIds  = current.map(b => `${b.id}:${b.result}:${b.pnl}`).sort().join(',')
            const newIds  = incoming.map(b => `${b.id}:${b.result}:${b.pnl}`).sort().join(',')
            if (curIds === newIds) return current // identical — no update needed
            return incoming
          })
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, cloudSynced, token])

  // ── Realtime subscription — sync settings from other devices ──
  useEffect(() => {
    if (!userId || !cloudSynced || !token) return
    const settCh = supabase
      .channel(`settings:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`,
      }, () => {
        if (Date.now() < realtimeIgnoreUntil.current) return // own save, skip
        fetchSettings(userId, token).then(({ data, error }) => {
          if (error || !data) return
          if (data.bankroll)            setBankroll(data.bankroll)
          if (data.ladder_starting)    setLadderStarting(data.ladder_starting)
          if (data.ladder_session_key) setLadderSessionKey(data.ladder_session_key)
          setMasterBrOverride(data.master_br_override ?? null)
          if (data.username)           setUsername(data.username)
          if (data.risk_settings)      setRiskSettings(data.risk_settings)
          if (data.dark_mode !== undefined) setDarkMode(data.dark_mode)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(settCh) }
  }, [userId, cloudSynced, token])

  // ── Auto-sync settings to Supabase (debounced 2s) ──
  useEffect(() => {
    if (!userId || !cloudSynced) return
    const t = setTimeout(() => {
      upsertSettings(userId, {
        bankroll, master_br_override: masterBrOverride, ladder_starting: ladderStarting,
        ladder_session_key: ladderSessionKey, username,
        risk_settings: riskSettings, dark_mode: darkMode,
      }, token).then(({ error }) => {
        if (error) {
          console.error('[RML] upsertSettings error:', error)
          setSyncError(prev => prev || `Settings sync failed: ${error.message || error.code || 'unknown'}`)
        }
      })
    }, 2000)
    return () => clearTimeout(t)
  }, [bankroll, masterBrOverride, ladderStarting, ladderSessionKey, username, riskSettings, darkMode, userId, cloudSynced, token])

  // ── Force localStorage save + Supabase sync before tab close ──
  // This catches bets added within the 2s debounce window before the user closes the tab.
  const betsRef           = useRef(bets)
  const userIdRef         = useRef(userId)
  const tokenRef          = useRef(token)
  const cloudSyncedRef    = useRef(cloudSynced)
  useEffect(() => { betsRef.current        = bets       }, [bets])
  useEffect(() => { userIdRef.current      = userId     }, [userId])
  useEffect(() => { tokenRef.current       = token      }, [token])
  useEffect(() => { cloudSyncedRef.current = cloudSynced }, [cloudSynced])

  useEffect(() => {
    if (!userId || isDemo) return
    const handleUnload = () => {
      const uid  = userIdRef.current
      const tok  = tokenRef.current
      const b    = betsRef.current
      const cs   = cloudSyncedRef.current
      if (!uid || !cs || !b?.length) return
      // keepalive:true survives tab close on mobile Safari
      try {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/bets`, {
          method:    'POST',
          keepalive: true,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${tok}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Prefer':        'resolution=merge-duplicates',
          },
          body: JSON.stringify(b.map(bet => betToRow(bet, uid))),
        })
      } catch (_) {}
    }
    window.addEventListener('pagehide', handleUnload)
    return () => window.removeEventListener('pagehide', handleUnload)
  }, [userId, isDemo])

  // ── Close user menu on outside click ──
  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e) => {
      if (!e.target.closest('[data-user-menu]')) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  // ── Close help panel on outside click ──
  useEffect(() => {
    if (!showHelp) return
    const handler = (e) => {
      if (!e.target.closest('[data-help-panel]') && !e.target.closest('[data-help-btn]')) setShowHelp(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showHelp])

  // ── Manual save ──
  const saveSession = useCallback(() => {
    setSaveStatus('saving')
    const payload = { bets, username, ladderStarting, ladderSessionKey, bankroll, masterBrOverride, riskSettings, darkMode }
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
    setTimeout(() => setSaveStatus('saved'), 400)
    setTimeout(() => setSaveStatus(null), 2400)
  }, [bets, bankroll, masterBrOverride, username, ladderStarting, riskSettings, darkMode])

  // ── Reliable delete: clear cloud FIRST, only drop from local if the cloud delete confirms.
  //    Supabase returns { error } (it does NOT throw on RLS/failure), so we must check it —
  //    otherwise a failed delete silently leaves the row to resurrect on next reload. ──
  const deleteBetReliable = useCallback(async (id) => {
    if (userId && cloudSyncedRef.current) {
      syncSuspendedRef.current = true                  // block any in-flight stale upsert during the delete
      realtimeIgnoreUntil.current = Date.now() + 5000
      const { error } = await dbDeleteBet(String(id), userId, tokenRef.current)
      if (error) {
        syncSuspendedRef.current = false
        setSyncError(`Delete failed: ${error.message || error.code || 'unknown'}. Bet kept — try again.`)
        return false   // keep it in local so the UI matches the cloud
      }
      setSyncError(null)
      setBets(b => b.filter(x => x.id !== id))
      // re-enable outbound sync after the setBets-triggered effect has cancelled the stale timer
      setTimeout(() => { syncSuspendedRef.current = false }, 100)
      return true
    }
    setBets(b => b.filter(x => x.id !== id))
    return true
  }, [userId])

  // ── Reset session ── (clear cloud bets FIRST and verify before wiping local state)
  const resetSession = useCallback(async () => {
    if (!window.confirm('Reset everything to zero? All bets and data will be cleared. This cannot be undone.')) return
    syncSuspendedRef.current = true                      // block any in-flight stale upsert BEFORE we delete
    if (userId && cloudSyncedRef.current) {
      realtimeIgnoreUntil.current = Date.now() + 10000   // ignore the delete echo while we reset
      const { error } = await deleteAllBets(userId, tokenRef.current)
      if (error) {
        syncSuspendedRef.current = false
        setSyncError(`Reset failed: ${error.message || error.code || 'unknown'}. Nothing was cleared — try again.`)
        return   // abort: don't wipe local while the cloud still has the data (it would resurrect)
      }
      setSyncError(null)
    }
    localStorage.removeItem(LS_KEY)
    setBets([])
    // re-enable outbound sync once the empty state has settled (stale timer cancelled by the effect re-run)
    setTimeout(() => { syncSuspendedRef.current = false }, 100)
    setBankroll(0)
    setMasterBrOverride(null)
    setMasterBrInput('')
    setUsername('OPERATOR')
    setLadderStarting(LADDER_STARTING_BR)
    setRiskSettings({ maxRiskPerBetPct: 3, maxRiskTodayPct: 10, stopLossPct: 10, profitLockPct: 20, unitPct: 2 })
    // the settings auto-sync (debounced) pushes bankroll=0 etc. to the cloud right after this.
  }, [userId, token])

  // Bets-only reset — clears tracked bets but KEEPS bankroll/settings ("New Bankroll, keep history").
  // Same sync-suppression guard as resetSession so the cloud copy can't resurrect the deleted bets.
  const resetBetsOnly = useCallback(async () => {
    if (!window.confirm('Clear your tracked bets? Your bankroll and settings are kept. This cannot be undone.')) return false
    syncSuspendedRef.current = true
    if (userId && cloudSyncedRef.current) {
      realtimeIgnoreUntil.current = Date.now() + 10000
      const { error } = await deleteAllBets(userId, tokenRef.current)
      if (error) {
        syncSuspendedRef.current = false
        setSyncError(`Reset failed: ${error.message || error.code || 'unknown'}. Nothing was cleared — try again.`)
        return false
      }
      setSyncError(null)
    }
    setBets([])   // local session auto-save persists empty bets but keeps bankroll/settings
    setTimeout(() => { syncSuspendedRef.current = false }, 100)
    return true
  }, [userId, token])

  // ── Save template ──
  const saveTemplate = useCallback(() => {
    const name = window.prompt('Template name:', `${username} Setup`)
    if (!name) return
    const tmpl = { name, date: new Date().toLocaleDateString(), riskSettings, bankroll, username }
    const updated = [...templates.filter(t => t.name !== name), tmpl]
    setTemplates(updated)
    try { localStorage.setItem(TMPL_KEY, JSON.stringify(updated)) } catch {}
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(null), 2000)
  }, [templates, riskSettings, bankroll, username])

  // ── Load template ──
  const loadTemplate = useCallback((tmpl) => {
    setRiskSettings(tmpl.riskSettings)
    setBankroll(tmpl.bankroll)
    setUsername(tmpl.username)
    setShowTemplates(false)
  }, [])

  // ── Delete template ──
  const deleteTemplate = useCallback((name) => {
    const updated = templates.filter(t => t.name !== name)
    setTemplates(updated)
    try { localStorage.setItem(TMPL_KEY, JSON.stringify(updated)) } catch {}
  }, [templates])

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const exportable = bets.filter(b => !b.ladder)
    if (!exportable.length) { alert('No bets to export yet.'); return }
    const headers = ['Date','Sport','Book','Bet Type','Event','Pick','Odds','Units','Stake','Result','P&L (units)','P&L ($)','Confidence','Notes']
    const rows = bets
      .filter(b => !b.ladder)
      .map(b => [
        b.date, b.sport, b.book || '', b.betType, b.event, b.pick,
        b.odds, b.units, b.stake,
        b.result, b.pnl.toFixed(2), (b.pnl * (bankroll / 100)).toFixed(2),
        b.confidence || 0, (b.notes || '').replace(/,/g, ';'),
      ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `rml-bets-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [bets, bankroll])

  // ── Export PDF (print-to-PDF via formatted print window) ──
  const exportPDF = useCallback(() => {
    const settled = bets.filter(b => b.result === 'W' || b.result === 'L')
    const unitSize = bankroll / 100
    const currentBr = bankroll + settled.reduce((s, b) => s + b.pnl, 0) * unitSize
    const winRate   = settled.length ? settled.filter(b => b.result === 'W').length / settled.length : 0
    const netUnits  = settled.reduce((s, b) => s + b.pnl, 0)
    const roi       = stats.totalUnits > 0 ? netUnits / stats.totalUnits : 0

    const html = `<!DOCTYPE html><html>
<head>
  <title>Risk Matrix Labs — Session Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0A0A0A; color:#e8e8e8; font-family:'Rajdhani',sans-serif; padding:32px; }
    h1  { color:#BDFF00; font-size:28px; letter-spacing:0.2em; margin-bottom:4px; }
    h2  { color:#BDFF00; font-size:13px; letter-spacing:0.28em; margin:24px 0 10px; opacity:0.7; text-transform:uppercase; }
    .sub { color:rgba(189,255,0,0.5); font-size:10px; letter-spacing:0.3em; margin-bottom:24px; }
    .grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:16px; }
    .card { background:#0d0d0d; border:1px solid #1e1e1e; border-top:1px solid rgba(189,255,0,0.25); padding:12px 14px; }
    .card .lbl { font-size:8px; letter-spacing:0.2em; color:rgba(255,255,255,0.32); text-transform:uppercase; margin-bottom:6px; }
    .card .val { font-size:22px; font-weight:700; }
    .green { color:#BDFF00; text-shadow:0 0 12px rgba(189,255,0,0.3); }
    .red   { color:#FF3B3B; }
    table  { width:100%; border-collapse:collapse; font-size:11px; }
    th     { background:#0d0d0d; padding:8px 10px; text-align:left; font-size:8px; letter-spacing:0.18em; color:rgba(255,255,255,0.32); text-transform:uppercase; border-bottom:1px solid #1e1e1e; }
    td     { padding:8px 10px; border-bottom:1px solid #1e1e1e; }
    .footer{ margin-top:32px; text-align:center; color:rgba(189,255,0,0.3); font-size:10px; letter-spacing:0.22em; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  <h1>RISK MATRIX DASHBOARD</h1>
  <div class="sub">SESSION REPORT · ${new Date().toLocaleDateString()} · OPERATOR: ${username}</div>

  <h2>Session Overview</h2>
  <div class="grid">
    <div class="card"><div class="lbl">Starting Bankroll</div><div class="val">$${bankroll.toFixed(2)}</div></div>
    <div class="card"><div class="lbl">Current Bankroll</div><div class="val ${currentBr >= bankroll ? 'green' : 'red'}">$${currentBr.toFixed(2)}</div></div>
    <div class="card"><div class="lbl">Total P / L</div><div class="val ${netUnits >= 0 ? 'green' : 'red'}">${netUnits >= 0 ? '+' : ''}${(netUnits * unitSize).toFixed(2)}</div></div>
    <div class="card"><div class="lbl">Win Rate</div><div class="val ${winRate >= 0.525 ? 'green' : 'red'}">${(winRate * 100).toFixed(1)}%</div></div>
    <div class="card"><div class="lbl">ROI</div><div class="val ${roi >= 0 ? 'green' : 'red'}">${roi >= 0 ? '+' : ''}${(roi * 100).toFixed(2)}%</div></div>
  </div>

  <div class="grid">
    <div class="card"><div class="lbl">Total Bets</div><div class="val">${settled.length}</div></div>
    <div class="card"><div class="lbl">Wins</div><div class="val green">${settled.filter(b=>b.result==='W').length}</div></div>
    <div class="card"><div class="lbl">Losses</div><div class="val red">${settled.filter(b=>b.result==='L').length}</div></div>
    <div class="card"><div class="lbl">Units Won</div><div class="val green">+${settled.filter(b=>b.result==='W').reduce((s,b)=>s+b.pnl,0).toFixed(2)}u</div></div>
    <div class="card"><div class="lbl">Units Lost</div><div class="val red">${settled.filter(b=>b.result==='L').reduce((s,b)=>s+b.pnl,0).toFixed(2)}u</div></div>
  </div>

  <h2>Bet Log</h2>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Sport</th><th>Book</th><th>Pick</th><th>Odds</th><th>Stake</th><th>Result</th><th>P&L</th></tr></thead>
    <tbody>
      ${settled.map((b,i) => `
        <tr>
          <td>${i+1}</td>
          <td>${b.date||'—'}</td>
          <td>${b.sport||'—'}</td>
          <td>${b.book||'—'}</td>
          <td>${b.pick||b.event||'—'}</td>
          <td>${b.odds>0?'+':''}${b.odds}</td>
          <td>$${(b.stake||0).toFixed(2)}</td>
          <td style="color:${b.result==='W'?'#BDFF00':'#FF3B3B'}">${b.result}</td>
          <td style="color:${b.pnl>=0?'#BDFF00':'#FF3B3B'}">${b.pnl>=0?'+':''}${b.pnl.toFixed(2)}u</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">RISK MATRIX LABS © 2025 · OPERATE WITH DISCIPLINE</div>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (w) { w.document.write(html); w.document.close() }
  }, [bets, bankroll, username, stats])

  const filtered = useMemo(() => {
    const activeRungId = bets.filter(x => x.ladder && x.result === 'Open' && x.ladderSession === ladderSessionKey).sort((a,z) => a.ladderId - z.ladderId)[0]?.id
    // Show: non-ladder bets, settled ladder bets, and only the active rung of current session
    let b = bets.filter(x => !x.ladder || x.result !== 'Open' || x.id === activeRungId)
    if (sportFilter  !== 'ALL')   b = b.filter(x => x.sport  === sportFilter)
    if (resultFilter === 'OPEN')  b = b.filter(x => x.result === 'Open')
    else if (resultFilter !== 'ALL') b = b.filter(x => x.result === resultFilter)
    b.sort((a, z) => {
      let av = a[sortCol], zv = z[sortCol]
      if (typeof av === 'string') { av = av.toLowerCase(); zv = zv.toLowerCase() }
      return sortDir === 'asc' ? (av > zv ? 1 : -1) : (av < zv ? 1 : -1)
    })
    return b
  }, [bets, sportFilter, resultFilter, sortCol, sortDir])

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const settleBet = (id, result) => {
    setBets(prev => {
      const next = prev.map(b => {
        if (b.id !== id) return b
        let pnl
        if (b.ladder) {
          const profit = b.odds > 0 ? b.stake * (b.odds / 100) : b.stake * (100 / Math.abs(b.odds))
          pnl = result === 'W' ? +profit.toFixed(2) : result === 'L' ? -b.stake : 0
        } else {
          pnl = result === 'W'
            ? (b.odds > 0 ? b.units * b.odds / 100 : b.units * 100 / Math.abs(b.odds))
            : result === 'L' ? -b.units : 0
          pnl = +pnl.toFixed(2)
        }
        return { ...b, result, pnl }
      })
      // Immediate upsert — don't wait for debounce
      if (userId && cloudSyncedRef.current) {
        const settled = next.find(b => b.id === id)
        if (settled) {
          realtimeIgnoreUntil.current = Date.now() + 5000
          upsertBet(settled, userId, tokenRef.current).then(({ error }) => {
            if (error) console.error('[RML] settleBet upsert error:', error)
          }).catch(e => console.error('[RML] settleBet upsert threw:', e))
        }
      }
      return next
    })
  }

  // ── AUTO-SETTLE (S65) — grade Open bets from their game's final score and persist. This was the
  // long-planned "Phase 4" that never shipped: bets only ever settled manually, so the record/operator
  // never tracked on their own. For each Open straight bet whose matched event is FINAL, gradeBetResult
  // returns W/L/P (or null when it can't grade — parlays, ladder-TBD picks, non-final games → left Open),
  // and we route it through the existing settleBet (which computes pnl + upserts). Idempotent: once a bet
  // is settled it's no longer 'Open', so it won't be re-graded.
  const autoSettleTried = useRef(new Set())
  useEffect(() => {
    if (!betEvents.length || !bets.length) return
    for (const b of bets) {
      if (b.result !== 'Open' || autoSettleTried.current.has(b.id)) continue
      const ev = findEventForBet(b, betEvents)
      if (!ev) continue
      const r = gradeBetResult(b, ev)
      if (r === 'W' || r === 'L' || r === 'P') {
        autoSettleTried.current.add(b.id)
        settleBet(b.id, r)
      }
    }
  }, [bets, betEvents])


  const sportBkdn = useMemo(() => {
    const map = {}
    bets.forEach(b => {
      if (!map[b.sport]) map[b.sport] = { sport: b.sport, pnl: 0, bets: 0 }
      map[b.sport].pnl += b.pnl
      map[b.sport].bets++
    })
    return Object.values(map).sort((a, z) => z.bets - a.bets)
  }, [bets])

  // NPS: show after 7 days for subscribed users, once only
  useEffect(() => {
    if (isDemo) return
    const done = (() => { try { return localStorage.getItem('rml_nps_done') === '1' } catch { return true } })()
    if (done) return
    const isSubscribed = subStatus?.active || subStatus?.sub?.status === 'trialing'
    if (!isSubscribed) return
    const signupMs = user?.created_at ? new Date(user.created_at).getTime() : 0
    if (Date.now() - signupMs < 7 * 24 * 60 * 60 * 1000) return
    const t = setTimeout(() => setShowNPS(true), 4000)
    return () => clearTimeout(t)
  }, [subStatus, user, isDemo])

  // Testimonial: show after 10 settled bets, once only
  useEffect(() => {
    if (isDemo) return
    const done = (() => { try { return localStorage.getItem('rml_testimonial_shown') === '1' } catch { return true } })()
    if (done) return
    const settledCount = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P').length
    if (settledCount < 10) return
    try { localStorage.setItem('rml_testimonial_shown', '1') } catch {}
    const t = setTimeout(() => setShowTestimonial(true), 1500)
    return () => clearTimeout(t)
  }, [bets, isDemo])

  const roi = stats.roi
  const up  = v => v >= 0

  const handleLogPosition = (event, { pick = '', odds = '' } = {}) => {
    const gameDate = event.start_time ? event.start_time.slice(0, 10) : new Date().toISOString().slice(0, 10)
    setInitialBet({
      date:    gameDate,
      sport:   event.sport,
      event:   `${event.away_team} vs ${event.home_team}`,
      betType: 'Straight',
      book:    '',
      pick,
      odds:    odds !== '' ? String(odds) : '',
      units:   '',
      stake:   '',
      result:  'Open',
      pnl:     0,
      notes:   `Live Center — ${event.league} · ${event.external_event_id}`,
    })
    setShowAdd(true)
  }

  // ── In-app BET SLIP (parlay builder) — additive; straight logging is untouched ──
  const [slip, setSlip] = useState([])           // legs: [{ pick, odds, book?, sport?, event? }]
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipStake, setSlipStake] = useState('')
  const [slipStakes, setSlipStakes] = useState({})   // per-leg stake for Straights mode, keyed by pick
  const [straightsExp, setStraightsExp] = useState(new Set())   // per-single "show more books" toggle, keyed by pick
  const [rrFloat, setRrFloat] = useState(null)   // picks "floated" from the slip into the RR Engine
  const legStakeOf = (l) => Number(slipStakes[l.pick] ?? slipStake) || 0
  const [slipMode, setSlipMode] = useState('parlay')      // 'straights' | 'parlay' | 'sgp' | 'rr'
  const [rrSize, setRrSize]     = useState(2)             // round-robin combo size (by 2s/3s…)
  const [rrStake, setRrStake]   = useState('')           // per-combo stake for round robin
  const [sgpStakes, setSgpStakes] = useState({})         // per-game SGP stake, keyed by game
  const [sgpOdds, setSgpOdds]   = useState({})           // per-game SGP odds OVERRIDE (book's real number), keyed by game
  const [showOutRegion, setShowOutRegion] = useState(false) // expand the "not in your region" list
  const [slipOff, setSlipOff] = useState(() => new Set())  // picks toggled OFF (kept in slip, excluded from bet)
  // Hand-off confirmation: a link can't pre-fill a sportsbook slip, so when the operator taps a book
  // we copy the exact pick + flash "pick copied — paste into <book> search" so the expectation is honest.
  const [copyToast, setCopyToast] = useState(null)   // { book, pick, lands, logged } | null
  const placeOn = (bookKey, pickText, deepLink, logged = false) => {
    const lands = deepLinksToBet(bookKey, deepLink)
    if (!lands) copyTextSync(pickText)   // only needed for app-open-only books; best-effort, non-intrusive
    setCopyToast({ book: BOOK_NAMES[bookKey] || bookKey, pick: pickText, lands, logged })
    setTimeout(() => setCopyToast(null), lands ? 4500 : 8000)
  }
  const toggleLeg = (pick) => setSlipOff(s => { const n = new Set(s); n.has(pick) ? n.delete(pick) : n.add(pick); return n })
  const [ocrBusy, setOcrBusy] = useState(false)
  const photoRef = useRef(null)
  const onBetSlipPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setOcrBusy(true); setSlipOpen(true)
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f) })
      const resp = await fetch('/api/parse-betslip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` }, body: JSON.stringify({ imageBase64: b64, mediaType: f.type || 'image/jpeg' }) })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert(j.error || 'Could not read slip'); return }
      ;(j.legs || []).forEach(l => addToSlip({ pick: l.pick, odds: l.odds }))
    } catch { alert('Could not read photo') } finally { setOcrBusy(false) }
  }
  const addToSlip = (leg) => {
    if (!leg?.pick) return
    // Accumulate into the slip; do NOT auto-open the drawer. Auto-opening dropped a
    // full-screen tap-to-close overlay over the board, so the next prop tap just closed
    // the drawer instead of adding — making it feel like only one leg could be added.
    // The neon FAB badge ticks up as feedback; the user opens the drawer when ready.
    setSlip(p => p.some(l => l.pick === leg.pick) ? p : [...p, { pick: leg.pick, odds: Number(leg.odds) || 0, book: leg.book || null, link: leg.link || null, byBook: leg.byBook || null, byBookLink: leg.byBookLink || null, evPct: leg.evPct ?? null, consensus: leg.consensus ?? null, sport: leg.sport || null, event: leg.event || null }])
  }
  const removeLeg = (i) => setSlip(p => p.filter((_, idx) => idx !== i))

  // Fill the next open TBD ladder rung with a slip leg's CONTENT (pick · odds · book · event).
  // Stake stays formula-driven (the rung's funding-from-winnings amount is untouched). Returns true if filled.
  const addToLadder = (leg) => {
    if (!leg?.pick) return false
    const rungs = bets.filter(b => b.ladder && b.ladderSession === ladderSessionKey && b.result === 'Open')
      .sort((a, z) => (a.ladderId ?? 999) - (z.ladderId ?? 999))
    const target = rungs.find(b => !b.pick || b.pick === 'TBD')
    if (!target) { alert('No open ladder rung to fill. Open Dashboard → Ladder and add a rung first.'); return false }
    const updated = { ...target, pick: leg.pick, odds: Number(leg.odds) || target.odds, book: leg.book || target.book, event: leg.event || target.event, sport: leg.sport || target.sport, betType: 'Straight' }
    setBets(p => p.map(b => b.id === target.id ? updated : b))
    if (userId && cloudSyncedRef.current) {
      realtimeIgnoreUntil.current = Date.now() + 5000
      upsertBet(updated, userId, tokenRef.current).then(({ error }) => { if (error) console.error('[RML] addToLadder upsert:', error) }).catch(e => console.error('[RML] addToLadder threw:', e))
    }
    return true
  }
  const addAllToLadder = () => {
    // Single pass (setBets batches — can't call addToLadder in a loop): match slip legs to open TBD rungs in order.
    const rungs = bets.filter(b => b.ladder && b.ladderSession === ladderSessionKey && b.result === 'Open' && (!b.pick || b.pick === 'TBD'))
      .sort((a, z) => (a.ladderId ?? 999) - (z.ladderId ?? 999))
    if (!rungs.length) { alert('No open ladder rungs to fill. Open Dashboard → Ladder and add rungs first.'); return }
    const n = Math.min(rungs.length, slip.length)
    const updates = []
    for (let i = 0; i < n; i++) {
      const leg = slip[i], t = rungs[i]
      updates.push({ ...t, pick: leg.pick, odds: Number(leg.odds) || t.odds, book: leg.book || t.book, event: leg.event || t.event, sport: leg.sport || t.sport, betType: 'Straight' })
    }
    const byId = Object.fromEntries(updates.map(u => [u.id, u]))
    setBets(p => p.map(b => byId[b.id] || b))
    if (userId && cloudSyncedRef.current) {
      realtimeIgnoreUntil.current = Date.now() + 8000
      updates.forEach(u => upsertBet(u, userId, tokenRef.current).catch(() => {}))
    }
    setSlip(p => p.slice(n)); setSlipOpen(false)
    if (slip.length > n) alert(`Filled ${n} rung(s). ${slip.length - n} pick(s) left — no more open rungs.`)
  }
  const amToDec = (a) => a == null ? 1 : (a > 0 ? 1 + a / 100 : 1 + 100 / -a)
  const decToAm = (d) => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1))
  const enabledLegs = () => slip.filter(l => !slipOff.has(l.pick))
  const slipComboOdds = () => decToAm(enabledLegs().reduce((acc, l) => acc * amToDec(Number(l.odds) || 0), 1))
  const commitBet = (b) => {
    setBets(p => [...p, b])
    if (userId && cloudSyncedRef.current) {
      realtimeIgnoreUntil.current = Date.now() + 5000
      upsertBet(b, userId, tokenRef.current).then(({ error }) => { if (error) console.error('[RML] parlay upsert error:', error) }).catch(e => console.error('[RML] parlay upsert threw:', e))
    }
  }
  const logParlay = (stake) => {
    const legs = enabledLegs()
    if (legs.length < 1) return
    const stk = Number(stake) || 0
    const mkUnits = () => (stats.unitSize ? stk / stats.unitSize : 0)
    if (slipMode === 'straights') {
      // log each enabled leg as its own straight bet — each with ITS OWN stake (falls back to the shared field)
      legs.forEach((l, i) => {
        const legStk = legStakeOf(l)
        commitBet({
          id: Date.now() + i,
          date: new Date().toISOString().slice(0, 10),
          sport: l.sport || '',
          book: l.book || '',
          betType: 'Straight',
          event: l.event || '',
          pick: l.pick,
          odds: Number(l.odds) || 0,
          units: stats.unitSize ? legStk / stats.unitSize : 0,
          stake: legStk,
          result: 'Open',
          pnl: 0,
          legs: null,
          notes: 'In-app bet slip (straight)',
        })
      })
    } else {
      const isP = legs.length >= 2
      const odds = isP ? decToAm(legs.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1)) : (Number(legs[0].odds) || 0)
      commitBet({
        id: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        sport: legs[0]?.sport || '',
        book: isP ? '' : (legs[0].book || ''),
        betType: isP ? 'Parlay' : 'Straight',
        event: isP ? `${legs.length}-Leg Parlay` : (legs[0].event || ''),
        pick: isP ? legs.map(l => l.pick).join('  +  ') : legs[0].pick,
        odds,
        units: mkUnits(),
        stake: stk,
        result: 'Open',
        pnl: 0,
        legs: isP ? legs.map(l => ({ pick: l.pick, odds: Number(l.odds) || 0, book: l.book || null, sport: l.sport || null, event: l.event || null })) : null,
        notes: 'In-app bet slip',
      })
    }
    setSlip([]); setSlipOff(new Set()); setSlipStakes({}); setStraightsExp(new Set()); setSlipOpen(false)
  }
  // Tap a book in the slip → LOG the play to the tracker (book = the one tapped) AND open the book.
  // oneLeg set (straights row) → log just that leg; else log the whole ticket (single or parlay).
  const placeAndLog = (bookKey, deepLink, oneLeg = null) => {
    const legs = oneLeg ? [oneLeg] : enabledLegs()
    if (!legs.length) return
    const date = new Date().toISOString().slice(0, 10)
    const isP = !oneLeg && slipMode === 'parlay' && legs.length >= 2
    let pickText
    if (isP) {
      const odds = decToAm(legs.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1))
      const stk = Number(slipStake) || 0
      pickText = legs.map(l => l.pick).join('  +  ')
      commitBet({ id: Date.now(), date, sport: legs[0]?.sport || '', book: bookKey, betType: 'Parlay', event: `${legs.length}-Leg Parlay`, pick: pickText, odds, units: stats.unitSize ? stk / stats.unitSize : 0, stake: stk, result: 'Open', pnl: 0, legs: legs.map(l => ({ pick: l.pick, odds: Number(l.odds) || 0, book: bookKey, sport: l.sport || null, event: l.event || null })), notes: 'Slip → placed on book' })
    } else {
      legs.forEach((l, i) => {
        const legStk = (slipMode === 'straights' || oneLeg) ? legStakeOf(l) : (Number(slipStake) || 0)
        commitBet({ id: Date.now() + i, date, sport: l.sport || '', book: bookKey, betType: 'Straight', event: l.event || '', pick: l.pick, odds: Number(l.odds) || 0, units: stats.unitSize ? legStk / stats.unitSize : 0, stake: legStk, result: 'Open', pnl: 0, legs: null, notes: 'Slip → placed on book' })
      })
      pickText = legs.map(l => l.pick).join('  +  ')
    }
    placeOn(bookKey, pickText, deepLink, true)
    if (oneLeg) { setSlip(p => p.filter(x => x.pick !== oneLeg.pick)); setSlipOff(s => { const n = new Set(s); n.delete(oneLeg.pick); return n }); setSlipStakes(s => { const n = { ...s }; delete n[oneLeg.pick]; return n }) }
    else { setSlip([]); setSlipOff(new Set()); setSlipStakes({}); setStraightsExp(new Set()); setSlipOpen(false) }
  }
  // ── 4-way slip: Same Game Parlay + Round Robin (pure helpers in src/lib/slipModes.js) ──
  // Log one game's same-game parlay → a Parlay bet (odds = book override if entered, else naive EST).
  const logSgpGroup = (key, legs) => {
    if (legs.length < 2) return
    const stk = Number(sgpStakes[key]) || 0
    const naive = decToAm(legs.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1))
    const ov = sgpOdds[key]
    const odds = (ov != null && ov !== '') ? Number(ov) : naive
    commitBet({
      id: Date.now(), date: new Date().toISOString().slice(0, 10), sport: legs[0]?.sport || '',
      book: legs[0]?.book || '', betType: 'Parlay', event: legs[0]?.event || `${legs.length}-Leg SGP`,
      pick: legs.map(l => l.pick).join('  +  '), odds, units: stats.unitSize ? stk / stats.unitSize : 0,
      stake: stk, result: 'Open', pnl: 0,
      legs: legs.map(l => ({ pick: l.pick, odds: Number(l.odds) || 0, book: l.book || null, sport: l.sport || null, event: l.event || null })),
      notes: 'Same Game Parlay',
    })
    setSlip(p => p.filter(x => !legs.some(l => l.pick === x.pick)))
    setSgpStakes(s => { const n = { ...s }; delete n[key]; return n })
  }
  // Log a round robin → one Parlay bet per combo of size rrSize (each combo same per-combo stake).
  const logRoundRobin = () => {
    const legs = enabledLegs()
    const size = Math.min(rrSize, slipEligibility(legs).maxRrSize)   // can't exceed # of games
    const cs = validRoundRobinCombos(legs, size)   // cross-game combos only (excludes same-game pairs)
    if (!cs.length) return
    const per = Number(rrStake) || 0
    const date = new Date().toISOString().slice(0, 10)
    cs.forEach((combo, i) => {
      const odds = decToAm(combo.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1))
      commitBet({
        id: Date.now() + i, date, sport: combo[0]?.sport || '', book: '', betType: 'Parlay',
        event: `Round Robin (by ${rrSize}s)`, pick: combo.map(l => l.pick).join('  +  '), odds,
        units: stats.unitSize ? per / stats.unitSize : 0, stake: per, result: 'Open', pnl: 0,
        legs: combo.map(l => ({ pick: l.pick, odds: Number(l.odds) || 0, book: l.book || null, sport: l.sport || null, event: l.event || null })),
        notes: `Round Robin (by ${rrSize}s)`,
      })
    })
    setSlip([]); setSlipOff(new Set()); setSlipStakes({}); setRrStake(''); setSlipOpen(false)
  }

  // Share the slip — native share sheet (text + best deep link), clipboard fallback.
  const shareSlip = async () => {
    const legs = enabledLegs()
    if (!legs.length) return
    const am = (a) => (Number(a) || 0) > 0 ? `+${a}` : `${a}`
    const lines = legs.map(l => `• ${l.pick} ${am(l.odds)}${l.book ? ` (${BOOK_NAMES[l.book] || l.book})` : ''}`)
    const isP = slipMode === 'parlay' && legs.length >= 2
    const head = isP ? `${legs.length}-Leg Parlay ${am(slipComboOdds())}` : (legs.length > 1 ? `${legs.length} Straights` : legs[0].pick)
    const text = `🎟 ${head}\n${lines.join('\n')}\n\nvia Risk Matrix Labs`
    const url = legs.find(l => l.link)?.link || 'https://app.riskmatrixlabs.com'
    try {
      if (navigator.share) await navigator.share({ title: 'Risk Matrix Labs', text, url })
      else { await navigator.clipboard.writeText(`${text}\n${url}`); alert('Slip copied to clipboard') }
    } catch { /* user cancelled share — ignore */ }
  }

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em',
      color: sortCol === col ? NEON_T : MUTED, textTransform: 'uppercase',
      padding: '10px 13px', textAlign: right ? 'right' : 'left',
      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: CARD,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        {label}
        {sortCol === col ? (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />) : null}
      </span>
    </th>
  )

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', fontFamily: R, overflowX: 'hidden', maxWidth: isMobile ? '100vw' : '580px', margin: isMobile ? '0' : '0 auto', boxShadow: isMobile ? 'none' : '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.5)' }}>
      {/* ── BET MATRIX (slip + line shopper) — persistent launcher on Game Center · Dashboard · Matrix Bot ── */}
      {(tab === 'live' || tab === 'bot' || ['overview', 'analytics', 'ladder', 'bet log', 'rr engine', 'session', 'partners'].includes(tab)) && (() => {
        const combo = slipComboOdds()
        const stk = Number(slipStake) || 0
        const payout = stk > 0 ? stk * amToDec(combo) : 0
        return (
          <>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onBetSlipPhoto} />
            {copyToast && (
              <div onClick={() => setCopyToast(null)} style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: isMobile ? 'calc(78px + env(safe-area-inset-bottom))' : '78px', zIndex: 300, maxWidth: 'calc(100vw - 28px)', background: '#0A0A0A', border: `1px solid ${NEON}`, borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', cursor: 'pointer' }}>
                <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: NEON_T }}>{copyToast.logged ? '✓ Logged to tracker · ' : ''}Opening {copyToast.book} →</div>
                {copyToast.lands ? (
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--text-sub)', marginTop: '3px', lineHeight: 1.4 }}>Your bet is loaded on the slip — just confirm your stake.</div>
                ) : (
                  <>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--text-sub)', marginTop: '3px', lineHeight: 1.4 }}>{copyToast.book} opens the app only — search this (copied):</div>
                    <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px', wordBreak: 'break-word' }}>{copyToast.pick}</div>
                  </>
                )}
              </div>
            )}
            {slipOpen && <div onClick={() => setSlipOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)' }} />}
            <div style={{ position: 'fixed', bottom: isMobile ? 'calc(62px + env(safe-area-inset-bottom))' : '20px', left: isMobile ? '10px' : '16px', zIndex: 10001, display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-start', maxWidth: 'calc(100vw - 20px)', pointerEvents: 'none' }}>
              {/* FAB — bottom-left corner */}
              <button onClick={() => setSlipOpen(o => !o)} title="Bet Matrix slip"
                style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '52px', minWidth: '52px', padding: slip.length ? '0 17px' : '0', borderRadius: '999px', border: 'none', background: NEON, boxShadow: '0 6px 20px rgba(189,255,0,0.35)', cursor: 'pointer', fontFamily: R }}>
                <Ticket size={22} color="#0A0A0A" strokeWidth={2.2} />
                {slip.length > 0 && <span style={{ fontSize: '15px', fontWeight: 700, color: '#0A0A0A' }}>{slip.length}</span>}
              </button>
              {/* panel — centered on screen (easier on the eyes than the corner) */}
              {slipOpen && (
                <div style={{ pointerEvents: 'auto', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10002, width: '360px', maxWidth: 'calc(100vw - 24px)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--card)', border: `1px solid ${NEON}`, borderRadius: '14px', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'rgba(189,255,0,0.06)' }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: NEON_T, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎟 Bet Matrix{slip.length ? ` · ${slip.length}` : ''}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => photoRef.current?.click()} disabled={ocrBusy} title="Read a bet-slip photo into legs (OCR)"
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T, cursor: ocrBusy ? 'wait' : 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>{ocrBusy ? '…' : '📷'}</button>
                      <button onClick={() => { setBotView('board'); setTab('bot') }} title="Analyze a play in Channel 2 — your slip stays parked"
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>📊</button>
                      {slip.length > 0 && <button onClick={shareSlip} title="Share this slip"
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${NEON}`, background: 'transparent', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1 }}>➦</button>}
                      <button onClick={() => setSlipOpen(false)} title="Close" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '16px', fontWeight: 700, lineHeight: 1 }}>✕</button>
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px 14px', maxHeight: '70vh', overflowY: 'auto' }}>
                  {ocrBusy && <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON_T, textAlign: 'center', padding: '6px 0 10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Reading slip…</div>}
                  {slip.length === 0 && <div style={{ fontFamily: R, fontSize: '12px', color: MUTED, textAlign: 'center', padding: '6px 0 2px' }}>No legs yet — tap a price to add one, or upload a slip photo (📷 Pic).</div>}

                  {slip.length > 0 && (() => {
                    const fmt = (a) => `${(Number(a) || 0) > 0 ? '+' : ''}${a}`
                    const enabled = slip.filter(l => !slipOff.has(l.pick))
                    // group enabled legs by game → drives Same Game Parlay + Round Robin eligibility
                    const { groups: gGroups, sgpGroups, sgpOk, oneLegPerGame, rrOk, maxRrSize } = slipEligibility(enabled)
                    // fall back to Parlay if the active tab isn't valid for the current slip
                    // Round Robin lives in the RR Engine (Float to RR / Add to Slip), not the slip tabs.
                    const mode = (slipMode === 'rr') ? 'parlay' : (slipMode === 'sgp' && !sgpOk) ? 'parlay' : slipMode
                    const isStraights = mode === 'straights'
                    const stk = Number(slipStake) || 0
                    let userState = ''; try { userState = localStorage.getItem('rml_state') || '' } catch {}
                    const allowed = booksForState(userState)
                    const inRegion = (bk) => !allowed || allowed.includes(bk) || OFFSHORE.includes(bk) || NATIONWIDE.includes(bk)
                    const comboDec = enabled.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1)
                    const payoutVal = isStraights
                      ? enabled.reduce((s, l) => s + legStakeOf(l) * amToDec(Number(l.odds) || 0), 0)
                      : (stk > 0 ? stk * comboDec : 0)
                    const lbl = { fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEON_T, opacity: 0.85, marginTop: '12px', marginBottom: '4px' }
                    const bestForLeg = (l) => {
                      const ents = l.byBook ? Object.entries(l.byBook).filter(([bk]) => inRegion(bk)) : []
                      // No per-book shopping data (e.g. a Spotlight lean) → fall back to the leg's book,
                      // else the operator's home-state book so "place on <book>" still resolves.
                      if (!ents.length) return { book: l.book || (allowed && allowed[0]) || null, odds: Number(l.odds) || 0 }
                      return ents.reduce((b, [bk, od]) => (!b || amToDec(od) > amToDec(b.odds)) ? { book: bk, odds: od } : b, null)
                    }
                    return (
                      <>
                        {/* 4-way bet slip: Straight · Parlay · Same Game · Round Robin (like the books) */}
                        <div style={{ display: 'flex', gap: '3px', margin: '2px 0 4px', background: 'var(--bg)', borderRadius: '9px', padding: '3px' }}>
                          {[['straights', 'Straight', true], ['parlay', 'Parlay', true], ['sgp', 'Same Game', sgpOk]].map(([k, label, ok]) => (
                            <button key={k} disabled={!ok} onClick={() => ok && setSlipMode(k)} title={!ok ? (k === 'rr' ? 'Round Robin needs ≥3 legs, one per game' : 'Same Game needs 2+ legs from one game') : ''}
                              style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.35, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', border: 'none', background: mode === k ? NEON : 'transparent', color: mode === k ? '#0A0A0A' : MUTED }}>{label}</button>
                          ))}
                        </div>
                        <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, opacity: 0.7, marginBottom: '10px', textAlign: 'center' }}>
                          {mode === 'sgp' ? 'Same Game Parlay — combines legs from one game (odds = estimate, edit to the book’s number)'
                            : mode === 'rr' ? 'Round Robin — every combo of your legs as its own parlay'
                            : mode === 'straights' ? 'Each leg logged as its own straight bet'
                            : 'All legs as one combined parlay ticket'}
                        </div>

                        {/* PARLAY: combined price across books, best to PLACE ON */}
                        {mode === 'parlay' && (() => {
                          const shop = enabled.filter(l => l.byBook && Object.keys(l.byBook).length)
                          if (!shop.length) return null
                          const total = shop.length
                          const books = [...new Set(shop.flatMap(l => Object.keys(l.byBook)))]
                          const rows = books.map(bk => {
                            const covered = shop.filter(l => l.byBook[bk] != null)
                            const cDec = covered.reduce((a, l) => a * amToDec(l.byBook[bk]), 1)
                            return { book: bk, n: covered.length, odds: covered.length === total ? decToAm(cDec) : null, region: inRegion(bk) }
                          })
                          // Always offer the operator's home-state book (Hard Rock/FL) to place on — estimated combined from the consensus leg odds when the feed has no HR price.
                          for (const hb of (allowed || [])) { if (!rows.some(r => r.book === hb)) { const estDec = shop.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1); rows.push({ book: hb, n: total, odds: decToAm(estDec), region: true, est: true }) } }
                          // Pin the operator's home-state book(s) (e.g. Hard Rock in FL) to the top.
                          const homeBooks = new Set(allowed || [])
                          const avail = rows.filter(r => r.n === total && r.region).sort((a, b) => {
                            const ha = homeBooks.has(a.book) ? 1 : 0, hb = homeBooks.has(b.book) ? 1 : 0
                            if (ha !== hb) return hb - ha
                            return amToDec(b.odds) - amToDec(a.odds)
                          })
                          const missing = rows.filter(r => r.n > 0 && r.n < total && r.region).sort((a, b) => b.n - a.n)
                          const region = rows.filter(r => !r.region && r.n > 0).sort((a, b) => amToDec(b.odds) - amToDec(a.odds))
                          // A single-leg "parlay" CAN deep-link to that one selection (use its per-book
                          // feed link). A true multi-leg parlay has no single deep link → homepage/app.
                          const soleLeg = enabled.length === 1 ? enabled[0] : null
                          // ONLY this book's own deep link — never another book's link. Missing → null,
                          // so placeLink falls back to the book's app-open link (opens the app).
                          const soleDeep = (bk) => soleLeg ? (soleLeg.byBookLink?.[bk] || null) : null
                          const bookRow = (r, faded, best) => (
                            <a key={r.book} href={placeLink(r.book, soleDeep(r.book)) || '#'} target="_blank" rel="noopener noreferrer" onClick={() => placeAndLog(r.book, soleDeep(r.book))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px', marginTop: '7px', borderRadius: '11px', border: `1px solid ${best ? NEON : 'var(--border)'}`, background: best ? 'rgba(189,255,0,0.08)' : 'transparent', textDecoration: 'none', opacity: faded ? 0.45 : 1 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                {best && <span style={{ color: NEON_T, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em' }}>PLACE ON</span>}
                                <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{BOOK_NAMES[r.book] || r.book}</span>
                                {r.est && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>EST</span>}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                {r.odds != null && <span className="tv-glow" style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: r.est ? MUTED : NEON_T }}>{r.est ? '~' : ''}{fmt(r.odds)}</span>}
                                <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: MUTED }}>{r.n}/{total}</span>
                                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: best ? NEON : 'rgba(189,255,0,0.14)', color: best ? '#0A0A0A' : NEON_T, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>→</span>
                              </span>
                            </a>
                          )
                          return (
                            <div style={{ marginBottom: '4px' }}>
                              <div style={{ ...lbl, color: MUTED, opacity: 0.7 }}>Tap a book → logs it to your tracker + opens the book</div>
                              {avail.length > 0 && <><div style={lbl}>✓ Best book · all {total} legs</div>{avail.map((r, i) => bookRow(r, false, i === 0))}</>}
                              {missing.length > 0 && <><div style={lbl}>Missing some legs</div>{missing.map(r => bookRow(r))}</>}
                              {region.length > 0 && <><div style={lbl}>Not in your region</div>{(showOutRegion ? region : region.slice(0, 2)).map(r => bookRow(r, true))}{region.length > 2 && (
                                <button onClick={() => setShowOutRegion(v => !v)} style={{ width: '100%', marginTop: '7px', padding: '9px', borderRadius: '9px', border: '1px solid var(--border)', background: 'transparent', color: MUTED, cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{showOutRegion ? 'Show less ▴' : `+${region.length - 2} more ▾`}</button>
                              )}</>}
                            </div>
                          )
                        })()}

                        {/* STRAIGHTS: each single gets its OWN stake + its OWN book list (choose like the parlay tab) */}
                        {isStraights && (
                          <div style={{ marginBottom: '4px' }}>
                            <div style={lbl}>Each bet · your stake + choose a book</div>
                            {enabled.length === 0 && <div style={{ fontFamily: R, fontSize: '11px', color: MUTED, padding: '6px 0' }}>All legs off — toggle one on below.</div>}
                            {enabled.map((l, i) => {
                              const ls = legStakeOf(l)
                              const homeBooks = new Set(allowed || [])
                              let rows = Object.keys(l.byBook || {}).map(bk => ({ book: bk, odds: l.byBook[bk], region: inRegion(bk), link: l.byBookLink?.[bk] }))
                              if (!rows.length) { const b = bestForLeg(l); if (b.book) rows = [{ book: b.book, odds: b.odds, region: true, link: l.link }] }
                              // Always offer the operator's home-state book(s) (e.g. Hard Rock in FL) — even when the odds feed didn't carry a price.
                              // Use the consensus line odds as an ESTIMATE (est:true) so there's a number to see; marked + never "best".
                              for (const hb of (allowed || [])) { if (!rows.some(r => r.book === hb)) rows.push({ book: hb, odds: Number(l.odds) || null, region: true, link: l.byBookLink?.[hb] || null, est: true }) }
                              // Real feed prices first (best on top), then estimated home book(s).
                              const inReg = rows.filter(r => r.region).sort((a, b) => { const pa = (a.odds != null && !a.est) ? 1 : 0, pb = (b.odds != null && !b.est) ? 1 : 0; if (pa !== pb) return pb - pa; return (amToDec(b.odds) || 0) - (amToDec(a.odds) || 0) })
                              const outReg = rows.filter(r => !r.region && r.odds != null).sort((a, b) => amToDec(b.odds) - amToDec(a.odds))
                              const exp = straightsExp.has(l.pick)
                              const bestOdds = (inReg.find(r => r.odds != null)?.odds ?? Number(l.odds)) || 0
                              const bookRow = (r, best) => (
                                <a key={r.book} href={placeLink(r.book, r.link) || '#'} target="_blank" rel="noopener noreferrer" onClick={() => placeAndLog(r.book, r.link, l)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', marginTop: '6px', borderRadius: '9px', border: `1px solid ${best ? NEON : 'var(--border)'}`, background: best ? 'rgba(189,255,0,0.08)' : 'transparent', textDecoration: 'none' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{best && <span style={{ color: NEON_T, fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em' }}>BEST</span>}<span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{BOOK_NAMES[r.book] || r.book}</span>{r.est && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>EST</span>}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: r.odds != null ? (r.est ? MUTED : NEON_T) : MUTED }}>{r.odds != null ? `${r.est ? '~' : ''}${fmt(r.odds)}` : '—'}</span><span style={{ width: '22px', height: '22px', borderRadius: '50%', background: best ? NEON : 'rgba(189,255,0,0.14)', color: best ? '#0A0A0A' : NEON_T, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>→</span></span>
                                </a>
                              )
                              return (
                                <div key={i} style={{ padding: '11px 12px', marginTop: '8px', borderRadius: '11px', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.pick}</span>
                                    <input value={slipStakes[l.pick] ?? ''} onChange={e => setSlipStakes(s => ({ ...s, [l.pick]: e.target.value }))} inputMode="decimal" placeholder="$ stake" style={{ width: '80px', padding: '8px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: R, fontSize: '14px', fontWeight: 700, outline: 'none', textAlign: 'center', flexShrink: 0 }} />
                                  </div>
                                  <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginTop: '5px' }}>{ls > 0 ? <>${ls.toFixed(0)} → <span style={{ color: NEON_T, fontWeight: 700 }}>${(ls * amToDec(bestOdds)).toFixed(2)}</span> · </> : null}tap a book → logs it + opens the book</div>
                                  {inReg.map((r, idx) => bookRow(r, idx === 0 && r.odds != null))}
                                  {outReg.length > 0 && exp && <><div style={{ ...lbl, fontSize: '8px', marginTop: '8px', opacity: 0.7 }}>Not in your region</div>{outReg.map(r => bookRow(r, false))}</>}
                                  {outReg.length > 0 && <button onClick={() => setStraightsExp(s => { const n = new Set(s); n.has(l.pick) ? n.delete(l.pick) : n.add(l.pick); return n })} style={{ width: '100%', marginTop: '6px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: MUTED, cursor: 'pointer', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{exp ? 'Show less ▴' : `+${outReg.length} more books ▾`}</button>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* SAME GAME PARLAY: one card per game with 2+ legs; odds = naive EST, editable to book's */}
                        {mode === 'sgp' && (
                          <div style={{ marginBottom: '4px' }}>
                            <div style={lbl}>Same Game Parlays</div>
                            {sgpGroups.map(([key, legs]) => {
                              const naive = decToAm(legs.reduce((a, l) => a * amToDec(Number(l.odds) || 0), 1))
                              const ov = sgpOdds[key]
                              const shownOdds = (ov != null && ov !== '') ? Number(ov) : naive
                              const stk = Number(sgpStakes[key]) || 0
                              const pay = stk > 0 ? stk * amToDec(shownOdds) : 0
                              return (
                                <div key={key} style={{ padding: '11px 12px', marginTop: '8px', borderRadius: '11px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>{legs[0]?.event || 'Same Game'}</div>
                                  {legs.map((l, i) => (
                                    <div key={i} style={{ fontFamily: R, fontSize: '11px', color: MUTED, marginBottom: '3px' }}>• {l.pick} <span style={{ color: NEON_T }}>{fmt(l.odds)}</span></div>
                                  ))}
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                    <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>SGP odds</span>
                                    <input value={ov ?? ''} onChange={e => setSgpOdds(s => ({ ...s, [key]: e.target.value }))} inputMode="numeric" placeholder={`${fmt(naive)} EST`} style={{ width: '92px', padding: '7px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: R, fontSize: '13px', fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                                    <input value={sgpStakes[key] ?? ''} onChange={e => setSgpStakes(s => ({ ...s, [key]: e.target.value }))} inputMode="decimal" placeholder="$ stake" style={{ width: '78px', padding: '7px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: R, fontSize: '13px', fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                                  </div>
                                  <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginTop: '6px' }}>{(ov == null || ov === '') ? 'estimate — edit to the book’s SGP price · ' : ''}{pay > 0 ? <>→ <span style={{ color: NEON_T, fontWeight: 700 }}>${pay.toFixed(2)}</span></> : null}</div>
                                  <button onClick={() => logSgpGroup(key, legs)} style={{ width: '100%', marginTop: '8px', padding: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Log {legs.length}-Leg SGP</button>
                                </div>
                              )
                            })}
                            {gGroups.some(([, ls]) => ls.length === 1) && <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, marginTop: '8px' }}>Legs that are the only one from their game aren’t shown here — add 2+ from the same game to build an SGP.</div>}
                          </div>
                        )}

                        {/* legs — each with an on/off toggle (keep a leg but leave it out) */}
                        <div style={{ ...lbl, color: MUTED }}>Your legs · {enabled.length}/{slip.length} on</div>
                        {slip.map((l, i) => { const off = slipOff.has(l.pick); const bf = bestForLeg(l); return (
                          <div key={i} style={{ padding: '9px 0', borderTop: '1px solid var(--border)', opacity: off ? 0.4 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                <button onClick={() => toggleLeg(l.pick)} title={off ? 'Include leg' : 'Exclude leg'} style={{ flexShrink: 0, width: '34px', height: '20px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: off ? 'var(--border)' : NEON, position: 'relative', padding: 0 }}>
                                  <span style={{ position: 'absolute', top: '2px', left: off ? '2px' : '16px', width: '16px', height: '16px', borderRadius: '50%', background: '#0A0A0A', transition: 'left 0.15s ease' }} />
                                </button>
                                <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.pick}</span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: NEON_T }}>{fmt(l.odds)}</span>
                                <button onClick={() => removeLeg(i)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: '15px', fontWeight: 700 }}>✕</button>
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px', paddingLeft: '43px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                <span style={{ fontFamily: R, fontSize: '10px', color: MUTED }}>best: {BOOK_NAMES[bf.book] || bf.book || '—'}{bf.odds ? ` ${fmt(bf.odds)}` : ''}</span>
                                {l.evPct != null && <span title={l.consensus ? 'consensus edge (de-vig avg of all books)' : 'edge vs sharp (Pinnacle)'} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, padding: '1px 5px', borderRadius: '5px', border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)' }}>{l.consensus ? '~' : '+'}{Number(l.evPct).toFixed(1)}% edge</span>}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {/* Per-leg ladder only in Straights — a parlay is one ticket (use "Add all to Ladder" at the bottom). */}
                                {isStraights && <button onClick={() => { if (addToLadder(l)) removeLeg(i) }} title="Send this pick to the next ladder rung" style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: '#F5A623', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: '5px', padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}>🪜 → Ladder</button>}
                                {l.link && <a href={l.link} target="_blank" rel="noopener noreferrer" onClick={() => placeOn(l.book || 'your book', l.pick, l.link)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, textDecoration: 'none' }}>Open →</a>}
                              </span>
                            </div>
                          </div>
                        )})}

                        {/* stake + log — singles enter their own stake per row above; parlay uses one stake.
                            SGP & Round Robin log from their own cards above, so hide this generic footer there. */}
                        {(mode === 'parlay' || mode === 'straights') && <>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                          {isStraights
                            ? <span style={{ flex: 1, fontFamily: R, fontSize: '11px', color: MUTED }}>Enter each bet’s stake above ↑</span>
                            : <input value={slipStake} onChange={e => setSlipStake(e.target.value)} inputMode="decimal" placeholder="Stake $"
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: R, fontSize: '15px', fontWeight: 700, outline: 'none' }} />}
                          {payoutVal > 0 && <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: NEON_T, whiteSpace: 'nowrap' }}>{isStraights ? 'total ' : ''}→ ${payoutVal.toFixed(2)}</span>}
                        </div>
                        <button onClick={addAllToLadder} style={{ width: '100%', marginTop: '10px', padding: '11px', borderRadius: '8px', border: '1px solid rgba(245,166,35,0.5)', background: 'rgba(245,166,35,0.1)', color: '#F5A623', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🪜 Add all to Ladder</button>
                        {enabled.length >= 2 && (
                          <button onClick={() => { setRrFloat(enabled.map(l => ({ pick: l.pick, odds: l.odds, event: l.event }))); setSlipOpen(false); setTab('rr engine') }} style={{ width: '100%', marginTop: '8px', padding: '11px', borderRadius: '8px', border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)', color: NEON_T, cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🎲 Float to RR — see all combo results</button>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button onClick={() => { setSlip([]); setSlipStake(''); setSlipStakes({}); setStraightsExp(new Set()); setSlipOff(new Set()) }} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: MUTED, cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Clear</button>
                          <button onClick={() => { logParlay(slipStake); setSlipStake('') }} disabled={!enabled.length} style={{ flex: 1, padding: '13px', borderRadius: '8px', border: 'none', cursor: enabled.length ? 'pointer' : 'not-allowed', opacity: enabled.length ? 1 : 0.5, background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{isStraights ? `Log ${enabled.length} Straight${enabled.length === 1 ? '' : 's'}` : enabled.length >= 2 ? `Log ${enabled.length}-Leg Parlay` : 'Log Bet'}</button>
                        </div>
                        </>}
                      </>
                    )
                  })()}
                  </div>
                </div>
              )}
            </div>
          </>
        )
      })()}

      {showAdd && <AddBetModal initial={initialBet} onAdd={b => {
        setBets(p => {
          // GA4: fire bet_logged on first real bet only
          if (p.filter(x => !x.ladder).length === 0) {
            try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'bet_logged' }) } catch {}
          }
          return [...p, b]
        })
        if (userId && cloudSyncedRef.current) {
          realtimeIgnoreUntil.current = Date.now() + 5000
          upsertBet(b, userId, tokenRef.current).then(({ error }) => {
            if (error) console.error('[RML] addBet upsert error:', error)
          }).catch(e => console.error('[RML] addBet upsert threw:', e))
        }
      }} onClose={() => { setShowAdd(false); setInitialBet(null) }} unitSize={stats.unitSize} token={token} />}

      {/* CANCEL SURVEY MODAL */}
      {showCancelSurvey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '28px 24px', maxWidth: '380px', width: '100%' }}>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em', color: '#555', marginBottom: '10px', textTransform: 'uppercase' }}>Before you go</div>
            <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.06em', color: '#fff', marginBottom: '6px' }}>What's not working?</div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', lineHeight: 1.6 }}>Your feedback directly shapes what we build next.</div>
            {[
              'Too expensive right now',
              'Missing a feature I need',
              "Don't use it enough to justify it",
              'Something broke or didn\'t work',
            ].map(reason => (
              <button key={reason} onClick={() => setCancelReason(reason)} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: '6px',
                borderRadius: '6px', cursor: 'pointer', fontFamily: I, fontSize: '13px',
                background: cancelReason === reason ? 'rgba(189,255,0,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${cancelReason === reason ? 'rgba(189,255,0,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: cancelReason === reason ? '#BDFF00' : '#aaa', transition: 'all 0.15s',
              }}>{reason}</button>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowCancelSurvey(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'transparent', color: '#555', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Stay
              </button>
              <button onClick={() => { setShowCancelSurvey(false); openBillingPortal() }} style={{ flex: 2, padding: '10px', borderRadius: '6px', border: '1px solid #444', background: 'rgba(255,255,255,0.05)', color: '#888', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {portalPending ? 'Opening...' : 'Continue to Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NPS MODAL ── */}
      {showNPS && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--card2)', border: '1px solid var(--border2)', borderTop: `2px solid ${NEON}`, borderRadius: 'var(--radius)', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            {!npsSubmitted ? (
              <>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase', marginBottom: '6px' }}>Quick Question</div>
                <div style={{ fontFamily: I, fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '20px', lineHeight: 1.4 }}>How likely are you to recommend Risk Matrix Labs to a friend?</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setNpsScore(n)} style={{ flex: '0 0 auto', width: '36px', height: '36px', borderRadius: '4px', border: npsScore === n ? `2px solid ${NEON}` : '1px solid var(--border2)', background: npsScore === n ? 'rgba(189,255,0,0.1)' : 'var(--card)', color: npsScore === n ? NEON_T : 'var(--text-dim)', fontFamily: R, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: R, fontSize: '8px', letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '16px' }}>
                  <span>Not likely</span><span>Extremely likely</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setShowNPS(false); try { localStorage.setItem('rml_nps_done', '1') } catch {} }} style={{ flex: 1, padding: '9px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Skip</button>
                  <button disabled={npsScore === null} onClick={() => { try { localStorage.setItem('rml_nps_done', '1') } catch {}; setNpsSubmitted(true) }} style={{ flex: 2, padding: '9px', borderRadius: '4px', border: 'none', background: npsScore !== null ? NEON : 'var(--border)', color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: npsScore !== null ? 'pointer' : 'not-allowed', opacity: npsScore !== null ? 1 : 0.4 }}>Submit</button>
                </div>
              </>
            ) : npsScore >= 9 ? (
              <>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase', marginBottom: '6px' }}>You're a Promoter 🔥</div>
                <div style={{ fontFamily: I, fontSize: '14px', color: 'var(--text)', marginBottom: '16px', lineHeight: 1.5 }}>Thank you! Would you share RML on X? It helps us reach more operators.</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowNPS(false)} style={{ flex: 1, padding: '9px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Maybe Later</button>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I've been using Risk Matrix Labs to manage my bankroll and it's a game changer. Try it free → riskmatrixlabs.com")}`} target="_blank" rel="noreferrer" onClick={() => setShowNPS(false)} style={{ flex: 2, padding: '9px', borderRadius: '4px', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Share on X →</a>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase', marginBottom: '6px' }}>Thanks for the Feedback</div>
                <div style={{ fontFamily: I, fontSize: '14px', color: 'var(--text)', marginBottom: '8px', lineHeight: 1.5 }}>
                  {npsScore <= 6 ? "We're sorry to hear that. What could we improve?" : "Glad you're finding value. Anything we could do better?"}
                </div>
                <textarea placeholder="Optional — your thoughts help us improve..." style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: '4px', color: 'var(--text)', fontFamily: I, fontSize: '13px', padding: '10px', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px' }} />
                <button onClick={() => setShowNPS(false)} style={{ marginTop: '12px', width: '100%', padding: '9px', borderRadius: '4px', border: 'none', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TESTIMONIAL MODAL ── */}
      {showTestimonial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--card2)', border: '1px solid var(--border2)', borderTop: `2px solid ${NEON}`, borderRadius: 'var(--radius)', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase', marginBottom: '6px' }}>10 Bets Logged 🎯</div>
            <div style={{ fontFamily: I, fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.4 }}>How's the system working for you?</div>
            <div style={{ fontFamily: I, fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px', lineHeight: 1.5 }}>If RML is helping you operate with more discipline, sharing it helps others find it — and helps us keep building.</div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                "Using <span style={{ color: NEON_T }}>@RiskMatrixLabs</span> to manage my bankroll. Game changer for any serious operator. Try it free → riskmatrixlabs.com"
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowTestimonial(false)} style={{ flex: 1, padding: '9px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Not Now</button>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Using @RiskMatrixLabs to manage my bankroll. Game changer for any serious operator. Try it free → riskmatrixlabs.com')}`} target="_blank" rel="noreferrer" onClick={() => setShowTestimonial(false)} style={{ flex: 2, padding: '9px', borderRadius: '4px', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Share on X →</a>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGELOG / WHAT'S NEW MODAL ── */}
      {showChangelog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setShowChangelog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card2)', border: '1px solid var(--border2)', borderTop: `2px solid ${NEON}`, borderRadius: 'var(--radius)', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON_T, textTransform: 'uppercase' }}>What's New</div>
                <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.1em', marginTop: '2px' }}>v2.6 — June 2026</div>
              </div>
              <button onClick={() => setShowChangelog(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>
            {[
              { icon: '🔄', title: 'Ladder Session Keys', desc: 'Each ladder run gets a unique session ID. "Close Session" starts fresh without deleting any history. Bankroll math stays perfect.' },
              { icon: '📧', title: 'Full Email Sequence', desc: 'Day 1 activation email, trial expired nudge, win-back on cancel, re-engagement for inactive subscribers — all automated.' },
              { icon: '📊', title: 'GA4 Funnel Events', desc: 'trial_started, subscribed, bet_logged, churned — full funnel visibility in Google Analytics.' },
              { icon: '💸', title: 'Referral Earn Banner', desc: 'Active subscribers see a one-time banner with their Rewardful link. Earn 30% recurring on every referral.' },
              { icon: '🗓', title: 'Annual Upgrade Nudge', desc: 'Monthly subscribers see a savings prompt after 30 days. Switch to $149/yr and save $199.' },
              { icon: '📋', title: 'Cancel Exit Survey', desc: 'Before billing portal opens, a 4-reason survey captures why subscribers cancel.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '3px' }}>{title}</div>
                  <div style={{ fontFamily: I, fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setShowChangelog(false)} style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '4px', border: 'none', background: NEON, color: '#0A0A0A', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>Got It</button>
          </div>
        </div>
      )}

      {/* SHARE SESSION CARD MODAL */}
      {showShare && (
        <ShareCardModal
          mode="session"
          stats={stats}
          username={username}
          bankroll={bankroll}
          masterBankroll={masterBankroll}
          unitSize={stats.unitSize}
          bets={bets}
          onClose={() => setShowShare(false)}
        />
      )}

      {shareCardBet && shareCardBet !== 'session' && (
        <ShareCardModal
          mode="bet"
          bet={shareCardBet}
          username={username}
          unitSize={stats.unitSize}
          bankIn={shareCardBet?._bankIn}
          onClose={() => setShareCardBet(null)}
        />
      )}
      {editingBet && (
        <AddBetModal
          initial={editingBet}
          onAdd={updated => {
            setBets(p => p.map(b => b.id === updated.id ? updated : b))
            setEditingBet(null)
            if (userId && cloudSyncedRef.current) {
              realtimeIgnoreUntil.current = Date.now() + 5000
              upsertBet(updated, userId, tokenRef.current).then(({ error }) => {
                if (error) console.error('[RML] editBet upsert error:', error)
              }).catch(e => console.error('[RML] editBet upsert threw:', e))
            }
          }}
          onClose={() => setEditingBet(null)}
          onDelete={deleteBetReliable}
          unitSize={stats.unitSize}
          token={token}
        />
      )}

      {/* ONBOARDING FLOW */}
      {showWelcome && (() => {
        const finishOnboarding = (useSampleData) => {
          if (useSampleData) {
            setBets(INITIAL_BETS)
            setBankroll(1000)
            setMasterBrOverride(null)
          } else {
            setBets([])
          }
          localStorage.setItem(`rml_welcomed_v1_${userId}`, '1')
          setShowWelcome(false)
          setOnboardStep(1)
        }
        const STEPS = [
          {
            pill: '01 / 03',
            title: 'Set Your Bankroll',
            desc: 'Your bankroll is the foundation. Every unit size, risk limit, and ladder rung is calculated from this number.',
            content: (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Starting Bankroll ($)</label>
                <input type="number" placeholder="e.g. 500" value={welcomeBr} onChange={e => setWelcomeBr(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat(welcomeBr); if (!isNaN(v) && v > 0) { setBankroll(v); setOnboardStep(2) } } }}
                  style={{ ...inputStyle, fontSize: '18px', fontWeight: 700, padding: '10px 14px', width: '100%', boxSizing: 'border-box' }} />
              </div>
            ),
            primary: { label: 'Set Bankroll →', action: () => { const v = parseFloat(welcomeBr); if (!isNaN(v) && v > 0) { setBankroll(v); setOnboardStep(2) } } },
            secondary: { label: 'Explore with sample data', action: () => { setBankroll(1000); setWelcomeBr('1000'); setOnboardStep(2) } },
          },
          {
            pill: '02 / 03',
            title: 'How the System Works',
            desc: null,
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
                {[
                  { tab: 'Game Center', icon: '🎯', desc: 'Live odds, EV-graded bets, and line movement. Scan today\'s slate for edges — wins and misses graded in public.' },
                  { tab: 'Matrix Bot', icon: '🤖', desc: 'Player props and model leans, grouped by player. Build a slip and check the consensus edge before you place it.' },
                  { tab: 'Analytics', icon: '📊', desc: 'Your command center — P&L curve, unit sizes, risk limits, Discipline Score™.' },
                  { tab: 'Bet Log', icon: '📝', desc: 'Log every position. Hit Log Bet → fill in the details → settle when it lands.' },
                  { tab: 'Ladder', icon: '🪜', desc: 'The PHLT™ system — fund each rung only from previous winnings. Principal stays protected.' },
                ].map(({ tab, icon, desc }) => (
                  <div key={tab} style={{ display: 'flex', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: NEON_T, marginBottom: '2px' }}>{tab}</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ),
            primary: { label: 'Got it →', action: () => setOnboardStep(3) },
            secondary: null,
          },
          {
            pill: '03 / 03',
            title: "You're Ready to Operate",
            desc: 'Scan the slate in Game Center, build a slip in Matrix Bot, then log your positions. Discipline compounds — one session at a time.',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                {[
                  '✓  Set your unit % in Analytics → Settings',
                  '✓  Log every bet — wins and losses',
                  '✓  Complete the pre-session checklist before placing bets',
                  '✓  Grade every session honestly',
                  '✓  Never chase. Never skip the process.',
                ].map(item => (
                  <div key={item} style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--text-sub)', lineHeight: 1.6 }}>{item}</div>
                ))}
              </div>
            ),
            primary: { label: bankroll > 0 ? "Let's Operate →" : "Set Bankroll First", action: () => { if (bankroll > 0) finishOnboarding(false); else setOnboardStep(1) } },
            secondary: { label: 'Explore sample data', action: () => finishOnboarding(true) },
          },
        ]
        const step = STEPS[onboardStep - 1]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ ...cardStyle, width: '100%', maxWidth: '480px', padding: '28px 30px', borderTop: `2px solid ${NEON}` }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: '28px' }} />
                  <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>Risk Matrix Labs</div>
                </div>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, background: 'rgba(189,255,0,0.08)', border: `1px solid rgba(189,255,0,0.2)`, borderRadius: '3px', padding: '3px 8px' }}>{step.pill}</div>
              </div>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                {[1,2,3].map(n => (
                  <div key={n} style={{ height: '2px', flex: 1, borderRadius: '2px', background: n <= onboardStep ? NEON : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                ))}
              </div>

              <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)', marginBottom: '8px' }}>{step.title}</div>
              {step.desc && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: '20px' }}>{step.desc}</p>}
              {!step.desc && <div style={{ marginBottom: '16px' }} />}

              {step.content}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={step.primary.action}
                  style={{ flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '12px', border: `1px solid ${NEON}`, borderRadius: '2px', background: NEON, color: '#0A0A0A', cursor: 'pointer' }}>
                  {step.primary.label}
                </button>
                {step.secondary && (
                  <button onClick={step.secondary.action}
                    style={{ flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '12px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    {step.secondary.label}
                  </button>
                )}
              </div>

              {onboardStep > 1 && (
                <button onClick={() => setOnboardStep(s => s - 1)}
                  style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'var(--muted)' }}>
                  ← Back
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* HELP PANEL */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowHelp(false)} />
          <div data-help-panel style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '340px',
            background: 'var(--card2)', borderLeft: `1px solid var(--border2)`, borderTop: `2px solid ${NEON}`,
            overflowY: 'auto', padding: '22px 22px 40px',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
            animation: 'slideRight 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T }}>HELP &amp; GUIDE</span>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Subscription status */}
            {subStatus?.sub && (
              <div style={{ background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.2)`, borderRadius: '2px', padding: '10px 14px', marginBottom: '18px' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Subscription</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {subStatus.sub.plan || 'Pro'}
                  </span>
                  <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '2px',
                    background: subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.15)' : 'rgba(189,255,0,0.1)',
                    color: subStatus.sub.status === 'trialing' ? YELLOW : NEON_T,
                    border: `1px solid ${subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.4)' : 'rgba(189,255,0,0.3)'}`,
                  }}>
                    {subStatus.sub.status === 'trialing' ? 'Trialing' : 'Active'}
                  </span>
                </div>
                {subStatus.sub.status === 'trialing' && subStatus.sub.trial_end && (
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                    Trial ends {new Date(subStatus.sub.trial_end * 1000).toLocaleDateString()}
                  </div>
                )}
                {subStatus.sub.status === 'active' && subStatus.sub.current_period_end && (
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                    Next billing {new Date(subStatus.sub.current_period_end * 1000).toLocaleDateString()}
                  </div>
                )}
                {subStatus.sub.stripe_customer_id && (
                  <button
                    onClick={() => { setCancelReason(null); setShowCancelSurvey(true) }}
                    style={{ marginTop: '10px', width: '100%', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer' }}
                  >
                    Manage Billing →
                  </button>
                )}
              </div>
            )}
            {subStatus?.owner && (
              <div style={{ background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.2)`, borderRadius: '2px', padding: '8px 14px', marginBottom: '18px' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON_T }}>OWNER ACCOUNT — FULL ACCESS</span>
              </div>
            )}

            {/* Quick Start */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Quick Start</div>
              {[
                'Scan today\'s slate → Game Center for live odds & edges',
                'Build a slip & check props → Matrix Bot',
                'Set your starting bankroll in the header',
                'Log your first bet → Bet Log → LOG BET',
                'Check your discipline → Session tab after each session',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON_T, flexShrink: 0, width: '16px' }}>{i + 1}.</span>
                  <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.5, letterSpacing: '0.03em' }}>{step}</span>
                </div>
              ))}
            </div>

            {/* Tab Guide */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Tab Guide</div>
              {[
                ['Game Center', 'Live odds, EV-graded bets, line movement — slate scan'],
                ['Matrix Bot', 'Player props & model leans, grouped by player'],
                ['Analytics', 'Command center — stats, risk panel, BR limits'],
                ['Ladder', 'PHLT™ Ladder — step-by-step session roadmap'],
                ['Bet Log', 'Log, edit, settle, and filter all your bets'],
                ['Overview', 'P&L curve, ROI, Kelly Criterion, book breakdown'],
                ['RR Engine', 'Round Robin calculator & Missed By One tool'],
                ['Session', 'Discipline score, grade, mood journal & recap'],
              ].map(([tab, desc]) => (
                <div key={tab} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '7px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: 'var(--text)', flexShrink: 0, minWidth: '68px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tab}</span>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>

            {/* PHLT Ladder */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>PHLT™ Ladder</div>
              {[
                'Each rung stakes a calculated amount based on your starting bankroll',
                'Pull checkpoints let you lock in profit before climbing the next rung',
                'Complete all 6 rungs to bank the majority — session complete',
              ].map((pt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '7px' }}>
                  <span style={{ color: NEON_T, flexShrink: 0, marginTop: '1px' }}>·</span>
                  <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.5, letterSpacing: '0.03em' }}>{pt}</span>
                </div>
              ))}
            </div>

            {/* Session Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Session Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={() => { setShowHelp(false); setShowTemplates(true) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: 'var(--card)', border: `1px solid var(--border2)`, borderRadius: '2px', cursor: 'pointer', color: 'var(--text-sub)', textAlign: 'left' }}>
                  <BookMarked size={12} strokeWidth={2} /> Templates
                </button>
                <button onClick={() => { exportPDF(); setShowHelp(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: 'var(--card)', border: `1px solid var(--border2)`, borderRadius: '2px', cursor: 'pointer', color: 'var(--text-sub)', textAlign: 'left' }}>
                  <FileDown size={12} strokeWidth={2} /> Export PDF
                </button>
                <button onClick={() => { exportCSV(); setShowHelp(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: 'var(--card)', border: `1px solid var(--border2)`, borderRadius: '2px', cursor: 'pointer', color: 'var(--text-sub)', textAlign: 'left' }}>
                  <FileDown size={12} strokeWidth={2} /> Export CSV
                </button>
                {settingsPill === 'reset'
                  ? <div style={{ background: 'rgba(255,59,59,0.06)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: '2px', padding: '10px 14px' }}>
                      <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', marginBottom: '8px' }}>Erase all bets, bankroll → $0, wipe cloud data?</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { resetSession(); setSettingsPill(null); setShowHelp(false) }} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '6px 14px', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', border: '1px solid rgba(255,59,59,0.5)', background: 'rgba(255,59,59,0.1)', color: RED }}>Yes, Reset</button>
                        <button onClick={() => setSettingsPill(null)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '6px 14px', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', border: '1px solid var(--border2)', background: 'var(--card)', color: 'var(--muted)' }}>Cancel</button>
                      </div>
                    </div>
                  : <button onClick={() => setSettingsPill('reset')} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: 'rgba(255,59,59,0.05)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: '2px', cursor: 'pointer', color: 'rgba(255,59,59,0.7)', textAlign: 'left' }}>
                      <RefreshCcw size={12} strokeWidth={2} /> Reset All Data
                    </button>}
              </div>
            </div>

            {/* Session Reminders */}
            {'Notification' in window && 'serviceWorker' in navigator && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON_T, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Session Reminders</div>
                <p style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.5, margin: '0 0 12px', letterSpacing: '0.03em' }}>
                  Get a daily push notification at 8pm to log your session.
                </p>
                <button
                  disabled={pushLoading}
                  onClick={async () => {
                    setPushLoading(true)
                    try {
                      if (pushEnabled) {
                        // Unsubscribe
                        const reg = await navigator.serviceWorker.ready
                        const sub = await reg.pushManager.getSubscription()
                        if (sub) await sub.unsubscribe()
                        await fetch('/api/push-subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
                        setPushEnabled(false)
                      } else {
                        // Subscribe
                        const perm = await Notification.requestPermission()
                        if (perm !== 'granted') { setPushLoading(false); return }
                        const reg = await navigator.serviceWorker.ready
                        const sub = await reg.pushManager.subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
                        })
                        await fetch('/api/push-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ subscription: sub.toJSON() }) })
                        setPushEnabled(true)
                      }
                    } catch {}
                    setPushLoading(false)
                  }}
                  style={{
                    width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px',
                    border: pushEnabled ? `1px solid rgba(255,59,59,0.4)` : `1px solid rgba(189,255,0,0.5)`,
                    borderRadius: '2px',
                    background: pushEnabled ? 'rgba(255,59,59,0.08)' : 'rgba(189,255,0,0.1)',
                    color: pushEnabled ? 'rgba(255,59,59,0.8)' : NEON,
                    cursor: pushLoading ? 'wait' : 'pointer',
                  }}
                >
                  {pushLoading ? 'Working...' : pushEnabled ? 'Disable Reminders' : 'Enable Session Reminders'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{
        backgroundColor: 'var(--bg)', borderBottom: `1px solid var(--border)`,
        padding: isMobile ? '10px 12px' : '13px 28px',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        position: 'sticky', top: 0, zIndex: 100, gap: isMobile ? '10px' : 0,
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: isMobile ? '36px' : '50px' }} />
            <div>
              <div style={{ fontFamily: R, fontWeight: 700, fontSize: isMobile ? '13px' : '16px', letterSpacing: isMobile ? '0.22em' : '0.12em', color: 'var(--neon-title)', lineHeight: 1, textShadow: 'var(--neon-glow)', whiteSpace: 'nowrap' }}>RISK MATRIX LABS</div>
              <div style={{ fontFamily: R, fontWeight: 500, fontSize: '8px', letterSpacing: '0.32em', color: 'var(--neon-sub)', marginTop: '3px' }}>OPERATE WITH DISCIPLINE</div>
            </div>
          </div>
          {/* Mobile: theme + user in logo row */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {cloudSynced && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(189,255,0,0.6)', textTransform: 'uppercase' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: NEON, display: 'inline-block', boxShadow: '0 0 5px rgba(189,255,0,0.8)', animation: 'pulseDot 2s infinite' }} />
                  Live
                </span>
              )}
              <button onClick={() => { setShowChangelog(true); try { localStorage.setItem('rml_changelog_seen', CHANGELOG_VERSION) } catch {} }} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid var(--border2)`, backgroundColor: 'var(--card)', cursor: 'pointer' }} title="What's New">
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--neon-sub)' }}>NEW</span>
                {changelogUnseen && <span style={{ position: 'absolute', top: '5px', right: '5px', width: '5px', height: '5px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 5px rgba(255,59,59,0.7)', animation: 'pulseDot 1.4s ease infinite' }} />}
              </button>
              <button onClick={() => setDarkMode(d => !d)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid var(--border2)`, backgroundColor: 'var(--card)', cursor: 'pointer' }}>
                {darkMode ? <Sun size={14} color={NEON_T} strokeWidth={2} /> : <Moon size={14} color='var(--text-sub)' strokeWidth={2} />}
              </button>
              {user && (
                <div data-user-menu style={{ position: 'relative' }}>
                  <button onClick={() => setUserMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '5px 8px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <Lock size={10} color={NEON_T} strokeWidth={2} />
                  </button>
                  {userMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--card2)', border: `1px solid var(--border2)`, borderTop: `2px solid ${NEON}`, borderRadius: '2px', minWidth: '220px', zIndex: 500, padding: '6px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      <div style={{ padding: '8px 16px 10px', borderBottom: `1px solid var(--border)` }}>
                        <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Signed in as</div>
                        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{user.email}</div>
                      </div>
                      {/* Display name — mobile */}
                      <div style={{ padding: '10px 16px', borderBottom: `1px solid var(--border)` }}>
                        <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Display Name</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            key={username}
                            defaultValue={username}
                            placeholder="Your name"
                            maxLength={24}
                            onKeyDown={e => { if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) { setUsername(val); setUserMenuOpen(false) } } }}
                            style={{ flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text)', background: 'var(--card)', border: `1px solid var(--border2)`, borderRadius: '2px', padding: '5px 8px', outline: 'none' }}
                            id="username-input-mobile"
                          />
                          <button
                            onClick={() => { const el = document.getElementById('username-input-mobile'); const val = el?.value?.trim(); if (val) { setUsername(val); setUserMenuOpen(false) } }}
                            style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', padding: '5px 10px', border: `1px solid ${NEON}`, borderRadius: '2px', background: 'rgba(189,255,0,0.1)', color: NEON, cursor: 'pointer' }}
                          >Save</button>
                        </div>
                      </div>
                      {subStatus?.sub && (
                        <div style={{ padding: '8px 16px', borderBottom: `1px solid var(--border)` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subStatus.sub.plan || 'Pro'}</span>
                            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: '2px',
                              background: subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.15)' : 'rgba(189,255,0,0.1)',
                              color: subStatus.sub.status === 'trialing' ? YELLOW : NEON_T,
                              border: `1px solid ${subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.4)' : 'rgba(189,255,0,0.3)'}`,
                            }}>
                              {subStatus.sub.status === 'trialing' ? 'Trialing' : 'Active'}
                            </span>
                          </div>
                          {subStatus.sub.status === 'trialing' && subStatus.sub.trial_end && (
                            <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>
                              Trial ends {new Date(subStatus.sub.trial_end * 1000).toLocaleDateString()}
                            </div>
                          )}
                          {subStatus.sub.stripe_customer_id && (
                            <button
                              onClick={async () => {
                                setUserMenuOpen(false)
                                try {
                                  const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ returnUrl: window.location.href }) })
                                  const { url } = await res.json()
                                  if (url) window.location.href = url
                                } catch {}
                              }}
                              style={{ marginTop: '8px', width: '100%', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer', textAlign: 'center' }}
                            >
                              Manage Billing →
                            </button>
                          )}
                        </div>
                      )}
                      <button onClick={async () => { setUserMenuOpen(false); await signOut() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,59,0.7)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,59,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <X size={11} strokeWidth={2.5} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: isMobile ? '8px' : '8px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>

          {/* ── DESKTOP NAV: Live | ? | Theme | NEW | OPERATOR | Share ── */}
          {!isMobile && <>

            {/* Live indicator */}
            {cloudSynced && (
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(189,255,0,0.6)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, display: 'inline-block', boxShadow: '0 0 6px rgba(189,255,0,0.8)', animation: 'pulseDot 2s infinite' }} />
                Live
              </span>
            )}

            {/* Help / ? */}
            <button data-help-btn onClick={() => setShowHelp(h => !h)} title="Help & Guide"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: showHelp ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, backgroundColor: showHelp ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: showHelp ? NEON_T : 'var(--text-dim)' }}>?</span>
            </button>

            {/* Theme toggle */}
            <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light Mode' : 'Dark Mode'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid var(--border2)`, backgroundColor: 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              {darkMode ? <Sun size={14} color={NEON_T} strokeWidth={2} /> : <Moon size={14} color='var(--text-sub)' strokeWidth={2} />}
            </button>

            {/* NEW / Changelog */}
            <button onClick={() => { setShowChangelog(true); try { localStorage.setItem('rml_changelog_seen', CHANGELOG_VERSION) } catch {} }} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '34px', padding: '0 10px', borderRadius: '2px', border: '1px solid var(--border2)', backgroundColor: 'var(--card)', cursor: 'pointer', flexShrink: 0 }} title="What's New">
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--neon-sub)' }}>NEW</span>
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted)' }}>v2.6</span>
              {changelogUnseen && <span style={{ position: 'absolute', top: '5px', right: '5px', width: '5px', height: '5px', borderRadius: '50%', background: '#FF3B3B', boxShadow: '0 0 5px rgba(255,59,59,0.7)', animation: 'pulseDot 1.4s ease infinite' }} />}
            </button>

            {/* OPERATOR / User menu */}
            {user && (
              <div data-user-menu style={{ position: 'relative' }}>
                <button onClick={() => setUserMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '5px 10px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer', maxWidth: '180px' }} title="Account">
                  <Lock size={10} color={NEON_T} strokeWidth={2} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{username}</span>
                </button>
                {userMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--card2)', border: `1px solid var(--border2)`, borderTop: `2px solid ${NEON}`, borderRadius: '2px', minWidth: '220px', zIndex: 500, padding: '6px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div style={{ padding: '8px 16px 10px', borderBottom: `1px solid var(--border)` }}>
                      <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Signed in as</div>
                      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{user.email}</div>
                    </div>
                    {/* Display name */}
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid var(--border)` }}>
                      <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Display Name</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          key={username}
                          defaultValue={username}
                          placeholder="Your name"
                          maxLength={24}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = e.target.value.trim()
                              if (val) { setUsername(val); setUserMenuOpen(false) }
                            }
                          }}
                          style={{
                            flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700,
                            letterSpacing: '0.04em', color: 'var(--text)',
                            background: 'var(--card)', border: `1px solid var(--border2)`,
                            borderRadius: '2px', padding: '5px 8px', outline: 'none',
                          }}
                          id="username-input"
                        />
                        <button
                          onClick={() => {
                            const el = document.getElementById('username-input')
                            const val = el?.value?.trim()
                            if (val) { setUsername(val); setUserMenuOpen(false) }
                          }}
                          style={{
                            fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                            padding: '5px 10px', border: `1px solid ${NEON}`, borderRadius: '2px',
                            background: 'rgba(189,255,0,0.1)', color: NEON, cursor: 'pointer',
                          }}
                        >Save</button>
                      </div>
                    </div>
                    {/* Subscription info in user menu */}
                    {subStatus?.sub && (
                      <div style={{ padding: '8px 16px', borderBottom: `1px solid var(--border)` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subStatus.sub.plan || 'Pro'}</span>
                          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: '2px',
                            background: subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.15)' : 'rgba(189,255,0,0.1)',
                            color: subStatus.sub.status === 'trialing' ? YELLOW : NEON_T,
                            border: `1px solid ${subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.4)' : 'rgba(189,255,0,0.3)'}`,
                          }}>
                            {subStatus.sub.status === 'trialing' ? 'Trialing' : 'Active'}
                          </span>
                        </div>
                        {subStatus.sub.status === 'trialing' && subStatus.sub.trial_end && (
                          <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>
                            Trial ends {new Date(subStatus.sub.trial_end * 1000).toLocaleDateString()}
                          </div>
                        )}
                        {subStatus.sub.status === 'active' && subStatus.sub.current_period_end && (
                          <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>
                            Next billing {new Date(subStatus.sub.current_period_end * 1000).toLocaleDateString()}
                          </div>
                        )}
                        {subStatus.sub.stripe_customer_id && (
                          <button
                            onClick={async () => {
                              setUserMenuOpen(false)
                              try {
                                const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ returnUrl: window.location.href }) })
                                const { url } = await res.json()
                                if (url) window.location.href = url
                              } catch {}
                            }}
                            style={{ marginTop: '8px', width: '100%', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer', textAlign: 'center' }}
                          >
                            Manage Billing →
                          </button>
                        )}
                      </div>
                    )}
                    <button onClick={async () => { setUserMenuOpen(false); await signOut() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,59,0.7)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,59,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <X size={11} strokeWidth={2.5} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Share — rightmost */}
            <button onClick={() => setShowShare(true)} title="Share session stats"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', padding: '6px 12px', border: `1px solid rgba(189,255,0,0.4)`, borderRadius: '2px', background: 'rgba(189,255,0,0.08)', color: NEON_T, cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0 }}>
              <Share2 size={12} strokeWidth={2} /> Share
            </button>
          </>}

          {/* ── MOBILE NAV ── */}
          {/* ── MOBILE: utility buttons (share · ?) then the two DOORS (Game Center · Matrix Bot) ── */}
          {isMobile && (
            <button onClick={() => setShowShare(true)} title="Share session stats" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid rgba(189,255,0,0.4)`, background: 'rgba(189,255,0,0.08)', cursor: 'pointer', flexShrink: 0 }}>
              <Share2 size={13} color={NEON_T} strokeWidth={2} />
            </button>
          )}
          {isMobile && (
            <button data-help-btn onClick={() => setShowHelp(h => !h)} title="Help & Guide"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: showHelp ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, background: showHelp ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: showHelp ? NEON_T : 'var(--text-dim)' }}>?</span>
            </button>
          )}
          {isMobile && (
            <button onClick={() => setTab('live')} title="Game Center"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', height: '34px', padding: '0 9px', borderRadius: '2px', border: tab === 'live' ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, background: tab === 'live' ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, display: 'inline-block', boxShadow: '0 0 6px rgba(189,255,0,0.8)', animation: 'pulseDot 2s infinite', flexShrink: 0 }} />
              <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tab === 'live' ? NEON_T : 'var(--text-dim)', whiteSpace: 'nowrap' }}>Game Center</span>
            </button>
          )}
          {isMobile && (
            <button onClick={() => setTab('overview')} title="Dashboard"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', height: '34px', padding: '0 9px', borderRadius: '2px', border: tab === 'overview' ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, background: tab === 'overview' ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', lineHeight: 1 }}>📊</span>
              <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tab === 'overview' ? NEON_T : 'var(--text-dim)', whiteSpace: 'nowrap' }}>Dashboard</span>
            </button>
          )}
          {isMobile && (
            <button onClick={() => setTab('bot')} title="Matrix EV Bot"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', height: '34px', padding: '0 9px', borderRadius: '2px', border: tab === 'bot' ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, background: tab === 'bot' ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <Tv size={12} color={tab === 'bot' ? NEON_T : 'var(--text-dim)'} strokeWidth={2} />
              <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tab === 'bot' ? NEON_T : 'var(--text-dim)', whiteSpace: 'nowrap' }}>Matrix Bot</span>
            </button>
          )}
        </div>
      </header>

      {/* TABS — desktop only: 3-pillar primary + dashboard secondary (matches mobile's 3 doors) */}
      {!isMobile && (() => {
        const DASH = ['overview', 'analytics', 'ladder', 'bet log', 'rr engine', 'session', 'partners']
        const inDash = DASH.includes(tab)
        const primary = [['live', 'Game Center'], ['__dash__', 'Dashboard'], ['bot', 'Matrix Bot']]
        const sub = [['overview', 'Analytics'], ['analytics', 'Overview'], ['ladder', 'Ladder'], ['bet log', 'Bet Log'], ['rr engine', 'RR Engine'], ['session', 'Session'], ['partners', 'Partners']]
        const activePrimary = (t) => t === '__dash__' ? inDash : tab === t
        return (
          <>
            <div style={{ borderBottom: `1px solid var(--border)`, display: 'flex', justifyContent: 'center', gap: '4px', backgroundColor: 'var(--bg)', padding: '0 12px' }}>
              {primary.map(([t, label]) => (
                <button key={t} onClick={() => setTab(t === '__dash__' ? 'overview' : t)} style={{
                  fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                  padding: '13px 22px', background: 'none', border: 'none', cursor: 'pointer',
                  color: activePrimary(t) ? NEON_T : 'var(--text-dim)',
                  borderBottom: activePrimary(t) ? `2px solid ${NEON}` : '2px solid transparent', marginBottom: '-1px',
                  transition: 'color 0.15s', textShadow: activePrimary(t) && darkMode ? '0 0 14px rgba(189,255,0,0.3)' : 'none',
                }}>{label}</button>
              ))}
            </div>
            {inDash && (
              <div style={{ borderBottom: `1px solid var(--border)`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '5px', backgroundColor: 'var(--card)', padding: '8px 12px' }}>
                {sub.map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '6px 13px', borderRadius: '100px', cursor: 'pointer',
                    border: `1px solid ${tab === t ? NEON : 'var(--border2)'}`,
                    background: tab === t ? 'rgba(189,255,0,0.1)' : 'transparent',
                    color: tab === t ? NEON_T : 'var(--text-dim)', transition: 'all 0.12s',
                  }}>{label}</button>
                ))}
              </div>
            )}
          </>
        )
      })()}

      {/* TILT BANNER — sticky on mobile so it doesn't scroll away */}
      <div style={isMobile && tilt.level !== 'GREEN' && !tiltDismissed ? {
        position: 'sticky', top: 0, zIndex: 99, padding: `0 ${pad}`,
      } : { padding: `6px ${pad} 0` }}>
        <TiltBanner tilt={tilt} dismissed={tiltDismissed} onDismiss={() => setTiltDismissed(true)} />
      </div>


      {/* CONTENT */}
      <div {...(isMobile ? swipeHandlers : {})}
        className={isMobile ? 'content-with-bottom-nav' : ''}
        style={{ paddingTop: isMobile ? '8px' : '4px', paddingLeft: isMobile ? '10px' : pad, paddingRight: isMobile ? '10px' : pad, overflowX: 'hidden', width: '100%', boxSizing: 'border-box', animation: 'tabIn 0.18s ease', touchAction: 'pan-y' }}
        key={tab}
      >

      {/* REFERRAL EARN BANNER — shown once to active subscribers, dismissible */}
      {(() => {
        const dismissed = (() => { try { return localStorage.getItem('rml_ref_banner_dismissed') === '1' } catch { return true } })()
        const isActive  = subStatus?.active && subStatus?.sub?.status === 'active'
        if (!isActive || dismissed || isDemo) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.2)', borderRadius: 'var(--radius)', padding: '11px 14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', align: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>💸</span>
              <div>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#BDFF00', textTransform: 'uppercase' }}>Earn 30% recurring</div>
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>Share your link — earn every month they stay subscribed.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <a href="https://risk-matrix-labs.getrewardful.com/signup" target="_blank" rel="noreferrer" style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: '4px', background: '#BDFF00', color: '#0A0A0A', textDecoration: 'none', cursor: 'pointer' }}>Get Link</a>
              <button onClick={() => { try { localStorage.setItem('rml_ref_banner_dismissed', '1') } catch {} }} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 10px', borderRadius: '4px', border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )
      })()}

      {/* ANNUAL UPGRADE NUDGE — shown to monthly subscribers after 30 days, dismissible */}
      {(() => {
        const dismissed    = (() => { try { return localStorage.getItem('rml_annual_dismissed') === '1' } catch { return true } })()
        const isMonthly    = subStatus?.sub?.plan?.includes('monthly')
        const isActive     = subStatus?.active && subStatus?.sub?.status === 'active'
        const signupMs     = (() => { try { return user?.created_at ? new Date(user.created_at).getTime() : 0 } catch { return 0 } })()
        const over30days   = Date.now() - signupMs > 30 * 24 * 60 * 60 * 1000
        if (!isActive || !isMonthly || dismissed || isDemo || !over30days) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'rgba(96,180,255,0.05)', border: '1px solid rgba(96,180,255,0.2)', borderRadius: 'var(--radius)', padding: '11px 14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>🗓</span>
              <div>
                <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#60B4FF', textTransform: 'uppercase' }}>Save $199/yr — Switch to Annual</div>
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>$149/yr instead of $348/yr. Same full access. Lock it in.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => { setCancelReason(null); setShowCancelSurvey(true) }} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: '4px', background: '#60B4FF', color: '#0A0A0A', border: 'none', cursor: 'pointer' }}>Switch</button>
              <button onClick={() => { try { localStorage.setItem('rml_annual_dismissed', '1') } catch {} }} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 10px', borderRadius: '4px', border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )
      })()}

      {/* ⬡ Spotlight — unified across pillars; on Dashboard a tap jumps to Game Center */}
      {['overview', 'analytics', 'ladder', 'bet log', 'rr engine', 'session', 'partners'].includes(tab) && (
        <div style={{ marginBottom: '10px' }}>
          <UniSpotlightTicker token={token} onOpen={() => setTab('live')} onAddToSlip={addToSlip} />
        </div>
      )}

      {/* OPEN BETS LIVE BANNER — overview tab */}
      {tab === 'overview' && stats.openBets > 0 && (
        <div onClick={() => setTab('bet log')} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: 'var(--radius)', padding: '11px 16px', marginBottom: '10px',
          cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: YELLOW, animation: 'pulseDot 1.4s ease infinite' }} />
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: YELLOW, textTransform: 'uppercase' }}>
              {stats.openBets} Live {stats.openBets === 1 ? 'Bet' : 'Bets'}
            </span>
            <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {fmt$(stats.openRisk$)} at risk
            </span>
          </div>
          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: YELLOW, opacity: 0.7 }}>VIEW →</span>
        </div>
      )}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && <>

          {/* ══ MOBILE OVERVIEW — pill-nav command center ══ */}
          {isMobile ? (
            <>
              {/* ══ MOBILE HOME — stats always visible + 5 sub-panel pills ══ */}

              {/* ── Master Bankroll — single editable top card ── */}
              <div style={{ ...cardStyle, padding: '12px 14px', marginBottom: '6px', borderTop: `2px solid ${(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON : RED}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>Master Bankroll<InfoTip text="Your current bankroll = starting bankroll + all settled P&L. Click the number to manually override it." /></div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {masterBrOverride !== null && <button onClick={() => { setMasterBrOverride(null); setMasterBrInput('') }} style={{ fontFamily: R, fontSize: '7px', color: YELLOW, background: 'none', border: `1px solid rgba(245,166,35,0.35)`, borderRadius: '2px', cursor: 'pointer', padding: '0 4px' }}>↺ AUTO</button>}
                    <span style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>1u = <strong style={{ color: 'var(--text)' }}>{fmt$(stats.unitSize)}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, lineHeight: 1, color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED }}>$</span>
                    <input value={masterBrFocused ? masterBrInput : masterBankroll.toFixed(2)}
                      onFocus={() => { setMasterBrFocused(true); setMasterBrInput(masterBankroll.toFixed(2)) }}
                      onChange={e => setMasterBrInput(e.target.value)} onBlur={applyMasterBr}
                      onKeyDown={e => e.key === 'Enter' && applyMasterBr()}
                      style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, lineHeight: 1, background: 'none', border: 'none', padding: 0, width: '100%', cursor: 'text', color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED }} />
                  </div>
                  <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED, whiteSpace: 'nowrap' }}>
                    {(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '+' : ''}{fmt$(masterBankroll - bankroll)}
                  </div>
                </div>
                <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>
                  {bankroll > 0
                    ? `started ${fmt$(bankroll)} · ${(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '+' : ''}${((masterBankroll - bankroll) / bankroll * 100).toFixed(1)}% all time`
                    : 'set your starting bankroll below ↓'}
                </div>
              </div>

              {(() => {
                const pills = [
                  { id: 'limits',      label: 'BR Limits' },
                  { id: 'exposure',    label: 'Risk Exposure', dot: risk.health !== 'GOOD' ? (risk.health === 'CAUTION' ? YELLOW : RED) : null },
                  { id: 'riskset',     label: 'Risk Settings' },
                  { id: 'bytype',      label: 'By Type' },
                  { id: 'curve',       label: 'BR Curve' },
                  { id: 'performance', label: 'Performance' },
                ]
                return (
                  <div className="analytics-pills" style={{ marginBottom: '8px' }}>
                    {pills.map(({ id, label, dot }) => {
                      const active = overviewSection === id
                      return (
                        <button key={id} onClick={() => setOverviewSection(s => s === id ? null : id)} style={{
                          flexShrink: 0, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                          padding: '6px 14px', borderRadius: '100px', cursor: 'pointer', position: 'relative',
                          border: `1px solid ${active ? NEON : 'var(--border2)'}`,
                          background: active ? NEON : 'var(--card2)',
                          color: active ? '#000' : 'var(--muted)',
                          boxShadow: active ? `0 0 10px rgba(189,255,0,0.3)` : 'none',
                          transition: 'all 0.12s',
                        }}>
                          {label}
                          {dot && !active && <span style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '50%', background: dot }} />}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}

              {/* ── Active sub-panel ── */}

              {overviewSection === 'bytype' && (() => {
                const settledAll = bets.filter(b => b.result === 'W' || b.result === 'L')
                const tMap = {}; const bMap = {}; const sMap = {}
                const pnlDollar = (b) => b.ladder ? b.pnl : (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * stats.unitSize
                settledAll.forEach(b => {
                  const t = b.betType || 'Other'; const bk = b.book || 'No Book'; const sp = b.sport || 'Other'
                  const d = pnlDollar(b)
                  if (!tMap[t]) tMap[t] = { label: t, pnl: 0, bets: 0, wins: 0 }
                  if (!bMap[bk]) bMap[bk] = { label: bk, pnl: 0, bets: 0, wins: 0 }
                  if (!sMap[sp]) sMap[sp] = { label: sp, pnl: 0, bets: 0, wins: 0 }
                  tMap[t].pnl += d; tMap[t].bets++; if (b.result === 'W') tMap[t].wins++
                  bMap[bk].pnl += d; bMap[bk].bets++; if (b.result === 'W') bMap[bk].wins++
                  sMap[sp].pnl += d; sMap[sp].bets++; if (b.result === 'W') sMap[sp].wins++
                })
                const rows = (map) => Object.values(map).sort((a,z) => z.bets - a.bets)
                const tRows = Object.values(tMap).sort((a,z) => z.bets - a.bets)
                const bRows = Object.values(bMap).sort((a,z) => z.bets - a.bets)
                const sRows = Object.values(sMap).sort((a,z) => z.bets - a.bets)
                // By Confidence
                const cMap = {}
                settledAll.filter(b => b.confidence > 0).forEach(b => {
                  const key = '⭐'.repeat(b.confidence)
                  const d = pnlDollar(b)
                  if (!cMap[key]) cMap[key] = { label: key, pnl: 0, bets: 0, wins: 0, _n: b.confidence }
                  cMap[key].pnl += d; cMap[key].bets++; if (b.result === 'W') cMap[key].wins++
                })
                const cRows = Object.values(cMap).sort((a,z) => a._n - z._n)
                const Section = ({ title, items }) => items.length === 0 ? null : (
                  <div style={{ ...cardStyle, padding: '10px 12px', marginBottom: '6px' }}>
                    <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</div>
                    {items.map(row => {
                      const wr = row.bets > 0 ? (row.wins / row.bets * 100).toFixed(0) : 0
                      return (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
                            <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>{row.bets} bets · {wr}% WR</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: row.pnl >= 0 ? NEON_T : RED }}>{row.pnl >= 0 ? '+' : ''}{fmt$(row.pnl)}</div>
                            <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>{row.wins}W – {row.bets - row.wins}L</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
                return (
                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <Section title="By Bet Type" items={tRows} />
                    <Section title="By Book" items={bRows} />
                    <Section title="By Sport" items={sRows} />
                    <Section title="By Confidence" items={cRows} />
                    {settledAll.length === 0 && <div style={{ ...cardStyle, padding: '20px', textAlign: 'center', fontFamily: R, fontSize: '11px', color: 'var(--muted)' }}>No settled bets yet</div>}
                  </div>
                )
              })()}

              {overviewSection === 'curve' && (
                <div style={{ ...cardStyle, padding: '14px 14px 10px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <SectionLabel icon={BarChart3}>Bankroll Curve</SectionLabel>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Start: <strong style={{ color: 'var(--text)' }}>{fmt$(bankroll)}</strong></span>
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Now: <strong style={{ color: up(masterBankroll-bankroll) ? NEON_T : RED }}>{fmt$(masterBankroll)}</strong></span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gradm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={NEON} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                      <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${Math.round(v)}`} width={42} />
                      <Tooltip content={<BankrollTip />} />
                      <ReferenceLine y={bankroll} stroke="var(--border2)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="value" stroke={NEON} strokeWidth={2} fill="url(#gradm)" dot={false} activeDot={{ r: 4, fill: NEON, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {overviewSection === 'performance' && (
                <div style={{ ...cardStyle, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <SectionLabel icon={Target}>Performance</SectionLabel>
                  {[
                    { label: 'Win Rate',   val: stats.winRate,                              target: 0.525, disp: `${(stats.winRate*100).toFixed(1)}%` },
                    { label: 'ROI',        val: Math.min(1, Math.max(0, roi+0.3)/0.6),      target: 0.5,   disp: `${(roi*100).toFixed(1)}%` },
                    { label: 'Discipline', val: Math.min(1, stats.total/30),                target: 0.8,   disp: `${Math.round(Math.min(1,stats.total/30)*100)}/100` },
                  ].map(({ label, val, target, disp }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
                        <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: val >= target ? NEON_T : 'var(--text-sub)' }}>{disp}</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100,val*100)}%`, background: val >= target ? NEON : 'var(--border2)', borderRadius: '2px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid var(--border)`, paddingTop: '10px' }}>
                    <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Unit Sizes</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px' }}>
                      {[[1,'1u'],[2,'2u'],[3,'3u']].map(([m,l]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                          <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{l}</span>
                          <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * m)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {overviewSection === 'exposure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ ...cardStyle, padding: '12px 14px', borderTop: `2px solid ${risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {risk.health === 'GOOD' ? <ShieldCheck size={20} color={NEON_T} strokeWidth={2} /> : risk.health === 'CAUTION' ? <AlertTriangle size={20} color={YELLOW} strokeWidth={2} /> : <ShieldAlert size={20} color={RED} strokeWidth={2} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: risk.health === 'GOOD' ? NEON_T : risk.health === 'CAUTION' ? YELLOW : RED }}>
                        {risk.health === 'GOOD' ? 'BANKROLL HEALTHY' : risk.health === 'CAUTION' ? 'USE CAUTION' : 'DANGER ZONE'}
                      </div>
                      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '2px', display: 'flex', alignItems: 'center' }}>Tilt<InfoTip text="Tilt is detected after 3+ straight losses or abnormal bet sizing. Red = stop immediately." />: <span style={{ color: tilt.level === 'GREEN' ? NEON_T : tilt.level === 'YELLOW' ? YELLOW : RED, fontWeight: 700, marginLeft: '4px' }}>{tilt.level === 'GREEN' ? 'IN CONTROL' : tilt.level === 'YELLOW' ? 'WATCH YOURSELF' : 'STOP BETTING'}</span></div>
                    </div>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: risk.health === 'GOOD' ? NEON_T : risk.health === 'CAUTION' ? YELLOW : RED }}>{risk.currentRiskPct.toFixed(1)}%</div>
                  </div>
                  <div style={{ ...cardStyle, padding: '10px 14px' }}>
                    <div style={{ height: '7px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, risk.currentRiskPct * 5)}%`, background: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED, borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: R, fontSize: '8px', color: NEON_T }}>SAFE 0–10%</span>
                      <span style={{ fontFamily: R, fontSize: '8px', color: YELLOW }}>CAUTION</span>
                      <span style={{ fontFamily: R, fontSize: '8px', color: RED }}>DANGER 20%+</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {(() => {
                      const openOnlyRisk = bets.filter(b => b.result === 'Open' && !b.ladder).reduce((s, b) => s + (b.stake || b.units * stats.unitSize), 0)
                      const ladderStake  = stats.activeLadderRung ? stats.activeLadderRung.stake : 0
                      const totalRisk    = openOnlyRisk + ladderStake
                      return [
                        { label: 'Max Per Bet',   value: fmt$(risk.maxRiskPerBet$), sub: `${riskSettings.maxRiskPerBetPct}% of bankroll`, color: 'var(--text)' },
                        { label: 'Daily Cap',     value: fmt$(risk.maxRiskCap$),    sub: `${riskSettings.maxRiskTodayPct}% cap`,          color: 'var(--text)' },
                        { label: '⚡ Ladder',     value: fmt$(ladderStake),          sub: stats.activeLadderRung ? `rung ${stats.activeLadderRung.ladderId} active` : '', color: stats.activeLadderRung ? YELLOW : 'var(--text)' },
                        { label: 'Open Bet Risk', value: fmt$(openOnlyRisk),         sub: openOnlyRisk > 0 ? `${bets.filter(b=>b.result==='Open'&&!b.ladder).length} bets pending` : '', color: openOnlyRisk > 0 ? YELLOW : 'var(--text)' },
                        { label: 'Total Risk',    value: fmt$(totalRisk),             sub: masterBankroll > 0 ? `${((totalRisk / masterBankroll) * 100).toFixed(1)}% of bankroll` : '', color: totalRisk > 0 ? RED : 'var(--text)' },
                        ]
                    })().map(({ label, value, sub, color }) => (
                      <div key={label} style={{ ...cardStyle, padding: '9px 11px' }}>
                        <div style={{ fontFamily: R, fontSize: '7px', letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                        <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '1px' }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overviewSection === 'limits' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '60vh', overflowY: 'auto' }}>
                  {/* Stop Loss + Profit Lock — derived from masterBankroll */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ padding: '10px 12px', border: `1px solid rgba(255,59,59,0.3)`, background: 'rgba(255,59,59,0.05)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontFamily: R, fontSize: '9px', color: RED, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px', display: 'flex', alignItems: 'center' }}>Stop Loss<InfoTip text="If your bankroll drops by this amount today, stop betting. Protects against tilt and bad runs." /></div>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: RED }}>-{fmt$(risk.stopLoss$)}</div>
                      <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>{riskSettings.stopLossPct ?? 10}% · walk away</div>
                    </div>
                    <div style={{ padding: '10px 12px', border: `1px solid rgba(189,255,0,0.28)`, background: 'rgba(189,255,0,0.05)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontFamily: R, fontSize: '9px', color: NEON_T, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px', display: 'flex', alignItems: 'center' }}>Profit Lock<InfoTip text="Once you're up this amount, protect your gains. Consider stopping or reducing bet size." /></div>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: NEON_T }}>+{fmt$(risk.profitLock$)}</div>
                      <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>{riskSettings.profitLockPct ?? 20}% · protect gains</div>
                    </div>
                  </div>
                  {/* Unit reference — flows from masterBankroll via stats.unitSize */}
                  <div style={{ ...cardStyle, padding: '10px 12px' }}>
                    <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Unit Reference · {riskSettings.unitPct ?? 2}% per unit · 1u = {fmt$(stats.unitSize)}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px' }}>
                      {[['0.5u',0.5],['1u',1],['2u',2],['3u',3],['4u',4],['5u',5]].map(([label,mult]) => (
                        <div key={label} style={{ padding: '4px 8px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{label}</span>
                          <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * mult)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {overviewSection === 'riskset' && (
                <div style={{ ...cardStyle, padding: '14px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '12px' }}>
                    {[
                      { label: 'CONSERVATIVE', vals: { unitPct:1,maxRiskPerBetPct:2,maxRiskTodayPct:6,stopLossPct:8,profitLockPct:15 }, color: NEON_T },
                      { label: 'BALANCED',     vals: { unitPct:2,maxRiskPerBetPct:3,maxRiskTodayPct:10,stopLossPct:10,profitLockPct:20 }, color: YELLOW },
                      { label: 'AGGRESSIVE',   vals: { unitPct:3,maxRiskPerBetPct:5,maxRiskTodayPct:15,stopLossPct:15,profitLockPct:25 }, color: RED },
                    ].map(({ label, vals, color }) => (
                      <button key={label} onClick={() => setRiskSettings(vals)} style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', padding: '9px 4px', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', border: `1px solid ${color === NEON ? 'rgba(189,255,0,0.4)' : color === YELLOW ? 'rgba(245,166,35,0.4)' : 'rgba(255,59,59,0.4)'}`, background: color === NEON ? 'rgba(189,255,0,0.07)' : color === YELLOW ? 'rgba(245,166,35,0.07)' : 'rgba(255,59,59,0.07)', color }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Unit Size',   key: 'unitPct',          desc: 'per unit',  tip: 'Your standard bet size as a % of bankroll. 2% is conservative. 1u = this % × bankroll.' },
                      { label: 'Max Bet',     key: 'maxRiskPerBetPct', desc: 'per bet',   tip: 'Max you can risk on a single bet. Prevents oversizing on any one play.' },
                      { label: 'Daily Max',   key: 'maxRiskTodayPct',  desc: 'daily cap', tip: 'Total risk cap for the day. Once hit, no more bets — regardless of confidence.' },
                      { label: 'Stop Loss',   key: 'stopLossPct',      desc: 'walk away', tip: 'If your bankroll drops by this % today, stop betting. Hard rule — no exceptions.' },
                      { label: 'Profit Lock', key: 'profitLockPct',    desc: 'lock in',   tip: 'Once up by this % on the day, protect your gains. Reduce size or stop.' },
                    ].map(({ label, key, desc, tip }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', display: 'flex', alignItems: 'center' }}>{label}<InfoTip text={tip} /></div>
                          <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>{desc} · {fmt$(masterBankroll * (riskSettings[key]/100))}</div>
                        </div>
                        <input type="number" min="0" max="100" step="0.5" value={riskSettings[key]} onChange={setRS(key)}
                          style={{ ...inputStyle, width: '50px', padding: '5px 6px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }} />
                        <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* ── Stat cards row 2: Open Risk + Total P/L ── */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                <button onClick={() => setAnalyticsShowUnits(v => !v)} style={{
                  fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                  padding: '3px 10px', borderRadius: '100px', cursor: 'pointer',
                  border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)', color: NEON_T,
                }}>{analyticsShowUnits ? 'u → $' : '$ → u'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: stats.openBets > 0 ? `2px solid ${YELLOW}` : undefined }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Total Risk<InfoTip text="Total dollars at risk across all open (pending) bets right now." /></div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: stats.openBets > 0 ? YELLOW : 'var(--text)', lineHeight: 1 }}>{fmt$(stats.openRisk$)}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.openBets > 0 ? `${stats.openBets} pending` : 'none open'}</div>
                </div>
                <div onClick={() => setAnalyticsShowUnits(v => !v)} style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${up(stats.netPnl$) ? NEON : RED}`, cursor: 'pointer' }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>{analyticsShowUnits ? 'Net Units' : 'Total P / L'}<InfoTip text="Total profit/loss across all settled bets. Tap to toggle between dollars and units." /></div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: up(stats.netPnl$) ? NEON_T : RED, lineHeight: 1 }}>
                    {analyticsShowUnits ? fmtU(stats.netPnlU) : fmt$(stats.netPnl$, true)}
                  </div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>tap to toggle</div>
                </div>
              </div>

              {/* ── ROI + W/L + Win Rate in one row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${up(roi) ? NEON : RED}` }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>ROI<InfoTip text="Return on units risked across all settled bets." /></div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: up(roi) ? NEON_T : RED, lineHeight: 1 }}>{roi >= 0 ? '+' : ''}{(roi * 100).toFixed(1)}%</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.total} bets</div>
                </div>
                <div style={{ ...cardStyle, padding: '10px 12px' }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>W / L<InfoTip text="Your win-loss record across all settled bets. Wins — Losses." /></div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stats.wins} — {stats.losses}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>record</div>
                </div>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.winRate >= 0.525 ? NEON : 'transparent'}` }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Win Rate<InfoTip text="52.5% is breakeven at -110 odds. Above is profitable." /></div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: stats.winRate >= 0.525 ? NEON_T : 'var(--text)', lineHeight: 1 }}>{(stats.winRate * 100).toFixed(1)}%</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>target 52.5%</div>
                </div>
              </div>


              {/* ── 8 small stat chips ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', marginBottom: '10px', marginTop: '2px' }}>
                <SmallCard label="Won"  value={analyticsShowUnits ? `+${(stats.allWon$ / stats.unitSize).toFixed(1)}u`  : fmt$(stats.allWon$)}        color={NEON_T} tip="Total dollars (or units) won across all settled winning bets." />
                <SmallCard label="Lost" value={analyticsShowUnits ? `-${(stats.allLost$ / stats.unitSize).toFixed(1)}u` : `-${fmt$(stats.allLost$)}`}  color={RED} tip="Total dollars (or units) lost across all settled losing bets." />
                <SmallCard label="Avg Odds"   value={fmtOdds(Math.round(stats.avgOdds))} tip="Average American odds across all settled bets. Tracks line quality over time." />
                <SmallCard label="Settled"    value={String(stats.total)} tip="Total number of bets graded (won or lost). Excludes pending bets." />
                <SmallCard label="Best Win"   value={stats.wins   ? fmt$(stats.largestWin)  : '—'} color={NEON_T} tip="Your single largest winning bet in dollars." />
                <SmallCard label="Worst Loss" value={stats.losses ? fmt$(stats.largestLoss) : '—'} color={RED} tip="Your single largest losing bet in dollars." />
                <SmallCard label="Risked"     value={`${stats.totalRiskedU.toFixed(1)}u`} tip="Total units risked across all settled bets. 1 unit = your standard bet size." />
                <SmallCard label="Unit $"     value={fmt$(stats.unitSize)} tip="Your current unit size in dollars. Calculated as unit % × current bankroll." />
              </div>

            </>
          ) : (
            /* ══ DESKTOP OVERVIEW — mirrors mobile ══ */
            <>
          {/* ── Master Bankroll card — same as mobile ── */}
          <div style={{ ...cardStyle, padding: '14px 18px', marginBottom: '8px', borderTop: `2px solid ${(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON : RED}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>Master Bankroll<InfoTip text="Your current bankroll = starting bankroll + all settled P&L. Click the number to manually override it." /></div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {masterBrOverride !== null && <button onClick={() => { setMasterBrOverride(null); setMasterBrInput('') }} style={{ fontFamily: R, fontSize: '8px', color: YELLOW, background: 'none', border: `1px solid rgba(245,166,35,0.35)`, borderRadius: '2px', cursor: 'pointer', padding: '1px 6px' }}>↺ AUTO</button>}
                <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>1u = <strong style={{ color: 'var(--text)' }}>{fmt$(stats.unitSize)}</strong></span>
                <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>Start: <strong style={{ color: 'var(--text)' }}>{fmt$(bankroll)}</strong></span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, lineHeight: 1, color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED, textShadow: darkMode && (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '0 0 20px rgba(189,255,0,0.25)' : 'none' }}>$</span>
                <input value={masterBrFocused ? masterBrInput : masterBankroll.toFixed(2)}
                  onFocus={() => { setMasterBrFocused(true); setMasterBrInput(masterBankroll.toFixed(2)) }}
                  onChange={e => setMasterBrInput(e.target.value)} onBlur={applyMasterBr}
                  onKeyDown={e => e.key === 'Enter' && applyMasterBr()}
                  style={{ fontFamily: R, fontSize: '36px', fontWeight: 700, lineHeight: 1, background: 'none', border: 'none', padding: 0, width: '100%', cursor: 'text', color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED, textShadow: darkMode && (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '0 0 20px rgba(189,255,0,0.25)' : 'none' }} />
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: (masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? NEON_T : RED }}>
                  {(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '+' : ''}{fmt$(masterBankroll - bankroll)}
                </div>
                <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                  {bankroll > 0 ? `${(masterBrOverride !== null ? masterBrOverride >= bankroll : stats.netPnl$ >= 0) ? '+' : ''}${((masterBankroll - bankroll) / bankroll * 100).toFixed(1)}% all time` : 'set starting bankroll'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Pills — same as mobile ── */}
          {(() => {
            const pills = [
              { id: 'limits',      label: 'BR Limits' },
              { id: 'exposure',    label: 'Risk Exposure', dot: risk.health !== 'GOOD' ? (risk.health === 'CAUTION' ? YELLOW : RED) : null },
              { id: 'riskset',     label: 'Risk Settings' },
              { id: 'bytype',      label: 'By Type' },
              { id: 'curve',       label: 'BR Curve' },
              { id: 'performance', label: 'Performance' },
            ]
            return (
              <div className="analytics-pills" style={{ marginBottom: '10px' }}>
                {pills.map(({ id, label, dot }) => {
                  const active = overviewSection === id
                  return (
                    <button key={id} onClick={() => setOverviewSection(s => s === id ? null : id)} style={{
                      flexShrink: 0, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '7px 18px', borderRadius: '100px', cursor: 'pointer', position: 'relative',
                      border: `1px solid ${active ? NEON : 'var(--border2)'}`,
                      background: active ? NEON : 'var(--card2)',
                      color: active ? '#000' : 'var(--muted)',
                      boxShadow: active ? `0 0 12px rgba(189,255,0,0.3)` : 'none',
                      transition: 'all 0.12s',
                    }}>
                      {label}
                      {dot && !active && <span style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '50%', background: dot }} />}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Sub-panels (desktop wider layout) ── */}
          {overviewSection === 'bytype' && (() => {
            const settledAll = bets.filter(b => b.result === 'W' || b.result === 'L')
            const tMap = {}; const bMap = {}; const sMap = {}; const cMap = {}
            const pnlDollar = (b) => b.ladder ? b.pnl : (b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * stats.unitSize
            settledAll.forEach(b => {
              const t = b.betType || 'Other'; const bk = b.book || 'No Book'; const sp = b.sport || 'Other'
              const d = pnlDollar(b)
              if (!tMap[t])  tMap[t]  = { label: t,  pnl: 0, bets: 0, wins: 0 }
              if (!bMap[bk]) bMap[bk] = { label: bk, pnl: 0, bets: 0, wins: 0 }
              if (!sMap[sp]) sMap[sp] = { label: sp, pnl: 0, bets: 0, wins: 0 }
              tMap[t].pnl  += d; tMap[t].bets++;  if (b.result === 'W') tMap[t].wins++
              bMap[bk].pnl += d; bMap[bk].bets++; if (b.result === 'W') bMap[bk].wins++
              sMap[sp].pnl += d; sMap[sp].bets++; if (b.result === 'W') sMap[sp].wins++
              if (b.confidence > 0) {
                const key = '⭐'.repeat(b.confidence)
                if (!cMap[key]) cMap[key] = { label: key, pnl: 0, bets: 0, wins: 0, _n: b.confidence }
                cMap[key].pnl += d; cMap[key].bets++; if (b.result === 'W') cMap[key].wins++
              }
            })
            const BySection = ({ title, items }) => items.length === 0 ? null : (
              <div style={{ ...cardStyle, padding: '12px 14px' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
                {items.map(row => {
                  const wr = row.bets > 0 ? (row.wins / row.bets * 100).toFixed(0) : 0
                  return (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{row.label}</div>
                        <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{row.bets} bets · {wr}% WR</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: row.pnl >= 0 ? NEON_T : RED }}>{row.pnl >= 0 ? '+' : ''}{fmt$(row.pnl)}</div>
                        <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{row.wins}W – {row.bets - row.wins}L</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
            const tRows = Object.values(tMap).sort((a,z) => z.bets - a.bets)
            const bRows = Object.values(bMap).sort((a,z) => z.bets - a.bets)
            const sRows = Object.values(sMap).sort((a,z) => z.bets - a.bets)
            const cRows = Object.values(cMap).sort((a,z) => a._n - z._n)
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' }}>
                <BySection title="By Bet Type"    items={tRows} />
                <BySection title="By Book"        items={bRows} />
                <BySection title="By Sport"       items={sRows} />
                <BySection title="By Confidence"  items={cRows} />
                {settledAll.length === 0 && <div style={{ ...cardStyle, padding: '24px', textAlign: 'center', fontFamily: R, fontSize: '11px', color: 'var(--muted)', gridColumn: '1/-1' }}>No settled bets yet</div>}
              </div>
            )
          })()}

          {overviewSection === 'curve' && (
            <div style={{ ...cardStyle, padding: '16px 18px 12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <SectionLabel icon={BarChart3}>Bankroll Curve</SectionLabel>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Start: <strong style={{ color: 'var(--text)' }}>{fmt$(bankroll)}</strong></span>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Now: <strong style={{ color: up(masterBankroll-bankroll) ? NEON_T : RED }}>{fmt$(masterBankroll)}</strong></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={46} />
                  <Tooltip content={<BankrollTip />} />
                  <ReferenceLine y={bankroll} stroke="var(--border2)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="value" stroke={NEON} strokeWidth={2} fill="url(#gradd)" dot={false} activeDot={{ r: 4, fill: NEON, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {overviewSection === 'performance' && (
            <div style={{ ...cardStyle, padding: '16px 18px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SectionLabel icon={Target}>Performance</SectionLabel>
                {[
                  { label: 'Win Rate',   val: stats.winRate,                              target: 0.525, disp: `${(stats.winRate*100).toFixed(1)}%` },
                  { label: 'ROI',        val: Math.min(1, Math.max(0, roi+0.3)/0.6),      target: 0.5,   disp: `${(roi*100).toFixed(1)}%` },
                  { label: 'Discipline', val: Math.min(1, stats.total/30),                target: 0.8,   disp: `${Math.round(Math.min(1,stats.total/30)*100)}/100` },
                ].map(({ label, val, target, disp }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
                      <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: val >= target ? NEON_T : 'var(--text-sub)' }}>{disp}</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100,val*100)}%`, background: val >= target ? NEON : 'var(--border2)', borderRadius: '2px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Unit Reference</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px' }}>
                  {[['0.5u',0.5],['1u',1],['2u',2],['3u',3],['4u',4],['5u',5]].map(([l,m]) => (
                    <div key={l} style={{ padding: '7px 10px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>{l}</span>
                      <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * m)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {overviewSection === 'exposure' && (
            <div style={{ ...cardStyle, padding: '16px 18px', marginBottom: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '12px', borderRadius: '2px', background: risk.health === 'GOOD' ? 'rgba(189,255,0,0.05)' : risk.health === 'CAUTION' ? 'rgba(245,166,35,0.05)' : 'rgba(255,59,59,0.05)', border: `1px solid ${risk.health === 'GOOD' ? 'rgba(189,255,0,0.22)' : risk.health === 'CAUTION' ? 'rgba(245,166,35,0.25)' : 'rgba(255,59,59,0.25)'}` }}>
                    {risk.health === 'GOOD' ? <ShieldCheck size={18} color={NEON_T} strokeWidth={2} /> : risk.health === 'CAUTION' ? <AlertTriangle size={18} color={YELLOW} strokeWidth={2} /> : <ShieldAlert size={18} color={RED} strokeWidth={2} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: risk.health === 'GOOD' ? NEON_T : risk.health === 'CAUTION' ? YELLOW : RED }}>{risk.health === 'GOOD' ? 'BANKROLL HEALTHY' : risk.health === 'CAUTION' ? 'USE CAUTION' : 'DANGER ZONE'}</div>
                      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '2px', display: 'flex', alignItems: 'center' }}>Tilt<InfoTip text="Tilt is detected after 3+ straight losses or abnormal bet sizing. Red = stop immediately." />: <span style={{ color: tilt.level === 'GREEN' ? NEON_T : tilt.level === 'YELLOW' ? YELLOW : RED, fontWeight: 700, marginLeft: '4px' }}>{tilt.level === 'GREEN' ? 'IN CONTROL' : tilt.level === 'YELLOW' ? 'WATCH YOURSELF' : 'STOP BETTING'}</span></div>
                    </div>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: risk.health === 'GOOD' ? NEON_T : risk.health === 'CAUTION' ? YELLOW : RED }}>{risk.currentRiskPct.toFixed(1)}%</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { label: 'Max Per Bet', value: fmt$(risk.maxRiskPerBet$), sub: `${riskSettings.maxRiskPerBetPct}% of bankroll` },
                      { label: 'Daily Cap',   value: fmt$(risk.maxRiskCap$),    sub: `${riskSettings.maxRiskTodayPct}% cap` },
                      { label: '⚡ Ladder',   value: stats.activeLadderRung ? fmt$(stats.activeLadderRung.stake) : fmt$(0), sub: stats.activeLadderRung ? `rung ${stats.activeLadderRung.ladderId} active` : 'no active rung', color: stats.activeLadderRung ? YELLOW : 'var(--text)' },
                      (() => { const openOnlyRisk = bets.filter(b => b.result === 'Open' && !b.ladder).reduce((s, b) => s + (b.stake || b.units * stats.unitSize), 0); return { label: 'Open Bet Risk', value: fmt$(openOnlyRisk), sub: openOnlyRisk > 0 ? `${bets.filter(b=>b.result==='Open'&&!b.ladder).length} bets pending` : 'none open', color: openOnlyRisk > 0 ? YELLOW : 'var(--text)' }; })(),
                      (() => { const openOnlyRisk = bets.filter(b => b.result === 'Open' && !b.ladder).reduce((s, b) => s + (b.stake || b.units * stats.unitSize), 0); const ladderStake = stats.activeLadderRung ? stats.activeLadderRung.stake : 0; const totalRisk = openOnlyRisk + ladderStake; return { label: 'Total Risk', value: fmt$(totalRisk), sub: masterBankroll > 0 ? `${((totalRisk / masterBankroll) * 100).toFixed(1)}% of bankroll` : '', color: totalRisk > 0 ? RED : 'var(--text)' }; })(),
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={{ padding: '9px 11px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                        <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                        <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', marginTop: '2px' }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ padding: '10px 12px', background: 'rgba(255,59,59,0.05)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: '2px', marginBottom: '8px' }}>
                    <div style={{ fontFamily: R, fontSize: '9px', color: RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Stop Loss<InfoTip text="If your bankroll drops by this amount today, stop betting. Protects against tilt and bad runs." /></div>
                    <div style={{ fontFamily: R, fontSize: '24px', fontWeight: 700, color: RED }}>-{fmt$(risk.stopLoss$)}</div>
                    <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>walk away trigger</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.28)', borderRadius: '2px' }}>
                    <div style={{ fontFamily: R, fontSize: '9px', color: NEON_T, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Profit Lock<InfoTip text="Once you're up this amount, protect your gains. Consider stopping or reducing bet size." /></div>
                    <div style={{ fontFamily: R, fontSize: '24px', fontWeight: 700, color: NEON_T }}>+{fmt$(risk.profitLock$)}</div>
                    <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>protect your gains</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {overviewSection === 'limits' && (
            <div style={{ ...cardStyle, padding: '16px 18px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <SectionLabel icon={Wallet}>Bankroll Limits</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                  {[
                    { label: 'Stop Loss',   value: fmt$(risk.stopLoss$),    sub: `${riskSettings.stopLossPct}% — walk away`, color: RED,          tip: 'If your bankroll drops by this amount today, stop betting. Hard rule — no exceptions.' },
                    { label: 'Profit Lock', value: fmt$(risk.profitLock$),  sub: `${riskSettings.profitLockPct}% — lock in`,  color: NEON_T,       tip: 'Once you\'re up this amount, protect your gains. Reduce size or stop.' },
                    { label: 'Max Per Bet', value: fmt$(risk.maxRiskPerBet$), sub: `${riskSettings.maxRiskPerBetPct}% per bet`, color: 'var(--text)', tip: 'Max you can risk on a single bet. Prevents oversizing on any one play.' },
                    { label: 'Daily Max',   value: fmt$(risk.maxRiskCap$),  sub: `${riskSettings.maxRiskTodayPct}% daily cap`, color: 'var(--text)', tip: 'Total risk cap for the day. Once hit, no more bets — regardless of confidence.' },
                  ].map(({ label, value, sub, color, tip }) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                      <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>{label}{tip && <InfoTip text={tip} />}</div>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', marginTop: '2px' }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Unit Reference</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px' }}>
                  {[['0.5u',0.5],['1u',1],['2u',2],['3u',3],['4u',4],['5u',5]].map(([l,m]) => (
                    <div key={l} style={{ padding: '7px 10px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)' }}>{l}</span>
                      <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * m)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {overviewSection === 'riskset' && (
            <div style={{ ...cardStyle, padding: '16px 18px', marginBottom: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '14px' }}>
                {[
                  { label: 'CONSERVATIVE', vals: { unitPct:1,maxRiskPerBetPct:2,maxRiskTodayPct:6,stopLossPct:8,profitLockPct:15 }, color: NEON_T },
                  { label: 'BALANCED',     vals: { unitPct:2,maxRiskPerBetPct:3,maxRiskTodayPct:10,stopLossPct:10,profitLockPct:20 }, color: YELLOW },
                  { label: 'AGGRESSIVE',   vals: { unitPct:3,maxRiskPerBetPct:5,maxRiskTodayPct:15,stopLossPct:15,profitLockPct:25 }, color: RED },
                ].map(({ label, vals, color }) => (
                  <button key={label} onClick={() => setRiskSettings(vals)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '9px 4px', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', border: `1px solid ${color === NEON ? 'rgba(189,255,0,0.4)' : color === YELLOW ? 'rgba(245,166,35,0.4)' : 'rgba(255,59,59,0.4)'}`, background: color === NEON ? 'rgba(189,255,0,0.07)' : color === YELLOW ? 'rgba(245,166,35,0.07)' : 'rgba(255,59,59,0.07)', color }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Unit Size',   key: 'unitPct',          desc: 'per 1 unit', tip: 'Your standard bet size as a % of bankroll. 2% is conservative. 1u = this % × bankroll.' },
                  { label: 'Max Bet',     key: 'maxRiskPerBetPct', desc: 'per bet',    tip: 'Max you can risk on a single bet. Prevents oversizing on any one play.' },
                  { label: 'Daily Max',   key: 'maxRiskTodayPct',  desc: 'daily cap',  tip: 'Total risk cap for the day. Once hit, no more bets — regardless of confidence.' },
                  { label: 'Stop Loss',   key: 'stopLossPct',      desc: 'walk away',  tip: 'If your bankroll drops by this % today, stop betting. Hard rule — no exceptions.' },
                  { label: 'Profit Lock', key: 'profitLockPct',    desc: 'lock in',    tip: 'Once up by this % on the day, protect your gains. Reduce size or stop.' },
                ].map(({ label, key, desc, tip }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', display: 'flex', alignItems: 'center' }}>{label}<InfoTip text={tip} /></div>
                      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>{desc} · {fmt$(masterBankroll * (riskSettings[key]/100))}</div>
                    </div>
                    <input type="number" min="0" max="100" step="0.5" value={riskSettings[key]} onChange={setRS(key)}
                      style={{ ...inputStyle, width: '54px', padding: '5px 6px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }} />
                    <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Always-visible stat rows (same as mobile) ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button onClick={() => setAnalyticsShowUnits(v => !v)} style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', padding: '3px 12px', borderRadius: '100px', cursor: 'pointer', border: `1px solid ${NEON}`, background: 'rgba(189,255,0,0.08)', color: NEON_T }}>{analyticsShowUnits ? 'u → $' : '$ → u'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div style={{ ...cardStyle, padding: '12px 14px', borderTop: stats.openBets > 0 ? `2px solid ${YELLOW}` : undefined }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Total Risk<InfoTip text="Total dollars at risk across all open (pending) bets right now." /></div>
              <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: stats.openBets > 0 ? YELLOW : 'var(--text)', lineHeight: 1 }}>{fmt$(stats.openRisk$)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>{stats.openBets > 0 ? `${stats.openBets} pending` : 'none open'}</div>
            </div>
            <div onClick={() => setAnalyticsShowUnits(v => !v)} style={{ ...cardStyle, padding: '12px 14px', borderTop: `2px solid ${up(stats.netPnl$) ? NEON : RED}`, cursor: 'pointer' }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>{analyticsShowUnits ? 'Net Units' : 'Total P / L'}<InfoTip text="Total profit/loss across all settled bets. Tap to toggle between dollars and units." /></div>
              <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: up(stats.netPnl$) ? NEON_T : RED, lineHeight: 1 }}>{analyticsShowUnits ? fmtU(stats.netPnlU) : fmt$(stats.netPnl$, true)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '3px' }}>tap to toggle</div>
            </div>
          </div>

          {/* ── ROI + W/L + Win Rate ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${up(roi) ? NEON : RED}` }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>ROI<InfoTip text="Return on units risked across all settled bets." /></div>
              <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: up(roi) ? NEON_T : RED, lineHeight: 1 }}>{roi >= 0 ? '+' : ''}{(roi * 100).toFixed(1)}%</div>
              <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.total} bets</div>
            </div>
            <div style={{ ...cardStyle, padding: '10px 12px' }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>W / L<InfoTip text="Your win-loss record across all settled bets. Wins — Losses." /></div>
              <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stats.wins} — {stats.losses}</div>
              <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>record</div>
            </div>
            <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.winRate >= 0.525 ? NEON : 'transparent'}` }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Win Rate<InfoTip text="52.5% is breakeven at -110 odds." /></div>
              <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: stats.winRate >= 0.525 ? NEON_T : 'var(--text)', lineHeight: 1 }}>{(stats.winRate * 100).toFixed(1)}%</div>
              <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>target 52.5%</div>
            </div>
          </div>

          {/* ── 8 small chips in 4+4 rows (matches mobile) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '6px' }}>
            <SmallCard label="Won"          value={analyticsShowUnits ? `+${(stats.allWon$ / stats.unitSize).toFixed(1)}u` : fmt$(stats.allWon$)} color={NEON_T} tip="Total dollars (or units) won across all settled winning bets." />
            <SmallCard label="Lost"         value={analyticsShowUnits ? `-${(stats.allLost$ / stats.unitSize).toFixed(1)}u` : `-${fmt$(stats.allLost$)}`} color={RED} tip="Total dollars (or units) lost across all settled losing bets." />
            <SmallCard label="Avg Odds"     value={fmtOdds(Math.round(stats.avgOdds))} tip="Average American odds across all settled bets. Tracks line quality over time." />
            <SmallCard label="Settled"      value={String(stats.total)} tip="Total number of bets graded (won or lost). Excludes pending bets." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            <SmallCard label="Best Win"     value={stats.wins ? fmt$(stats.largestWin) : '—'} color={NEON_T} tip="Your single largest winning bet in dollars." />
            <SmallCard label="Worst Loss"   value={stats.losses ? fmt$(stats.largestLoss) : '—'} color={RED} tip="Your single largest losing bet in dollars." />
            <SmallCard label="Risked"       value={`${stats.totalRiskedU.toFixed(1)}u`} tip="Total units risked across all settled bets. 1 unit = your standard bet size." />
            <SmallCard label="Unit $"       value={fmt$(stats.unitSize)} tip="Your current unit size in dollars. Calculated as unit % × current bankroll." />
          </div>
            </>
          )}
        </>}

        {/* ── BET LOG ── */}
        {tab === 'bet log' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase', marginRight: '3px' }}>🏟️ Sport</span>
                <select
                  value={sportFilter}
                  onChange={e => setSportFilter(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '4px 28px 4px 10px', fontSize: '11px', fontWeight: 700,
                    color: sportFilter !== 'ALL' ? NEON_T : 'var(--text-sub)',
                    border: sportFilter !== 'ALL' ? `1px solid rgba(189,255,0,0.5)` : `1px solid var(--border2)`,
                    backgroundImage: 'none', cursor: 'pointer' }}
                >
                  <option value="ALL">All Sports</option>
                  {['NFL','NBA','MLB','NHL','CFB','Soccer','UFC/MMA','Boxing','Tennis','Golf','NCAA BB','NASCAR','Cricket','Rugby','Other'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!['ALL','NFL','NBA','MLB','NHL','CFB','Soccer','UFC/MMA','Boxing','Tennis','Golf','NCAA BB','NASCAR','Cricket','Rugby','Other'].includes(sportFilter) && (
                    <option value={sportFilter}>{sportFilter}</option>
                  )}
                </select>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase', marginLeft: '10px', marginRight: '3px' }}>Result</span>
                {RESULTS.map(r => <button key={r} onClick={() => setResultFilter(r)} style={{
                  ...btnStyle(resultFilter === r),
                  color: resultFilter === r ? NEON_T
                    : r === 'OPEN' ? (resultFilter === r ? NEON : YELLOW)
                    : r === 'W'    ? 'rgba(189,255,0,0.55)'
                    : r === 'L'    ? 'rgba(255,59,59,0.55)'
                    : 'var(--text-sub)',
                  borderColor: r === 'OPEN' && resultFilter !== r ? 'rgba(245,166,35,0.35)' : undefined,
                }}>{r}{r === 'OPEN' && stats.openBets > 0 ? ` (${stats.openBets})` : ''}</button>)}
              </div>
              <button onClick={() => setShowAdd(true)} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Plus size={11} /> LOG BET
              </button>
            </div>

            {/* ── Bet card view ── */}
            <div>
                {(betLogShowAll ? filtered : filtered.slice(0, 10)).map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    onSettle={settleBet}
                    onEdit={setEditingBet}
                    onDelete={deleteBetReliable}
                    onShare={setShareCardBet}
                    unitSize={stats.unitSize}
                    events={betEvents}
                    players={betRosterPlayers}
                    boxScores={betBoxScores}
                    winPct={betWinPct}
                  />
                ))}
                {filtered.length === 0 && (
                  <div style={{ ...cardStyle, padding: '40px 20px', textAlign: 'center' }}>
                    {bets.length === 0 ? (
                      <div>
                        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text)', marginBottom: '8px' }}>NO BETS LOGGED YET</div>
                        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.08em', marginBottom: '16px' }}>Track your first bet to start building your edge.</div>
                        <button onClick={() => setShowAdd(true)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '9px 20px', border: `1px solid ${NEON}`, borderRadius: '2px', background: 'rgba(189,255,0,0.1)', color: NEON_T, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Plus size={11} /> Log Your First Bet
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.12em' }}>NO BETS MATCH FILTERS</span>
                    )}
                  </div>
                )}
                {filtered.length > 10 && (
                  <button onClick={() => setBetLogShowAll(v => !v)} style={{
                    width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    background: 'none', border: `1px solid var(--border2)`, borderRadius: '2px',
                    color: 'var(--muted)', cursor: 'pointer', padding: '10px', marginBottom: '6px',
                  }}>
                    {betLogShowAll ? '▲ Show Less' : `▼ Show ${filtered.length - 10} More`}
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>{filtered.length} BETS</span>
                  {filtered.filter(b => b.result === 'Open').length > 0 && (
                    <span style={{ fontFamily: R, fontSize: '9px', color: YELLOW, letterSpacing: '0.1em', fontWeight: 700 }}>
                      {filtered.filter(b => b.result === 'Open').length} OPEN · {fmt$(filtered.filter(b => b.result === 'Open').reduce((s, b) => s + (b.stake || 0), 0))} AT RISK
                    </span>
                  )}
                  <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>
                    NET: <span style={{ color: filtered.filter(b => b.result !== 'Open').reduce((s, b) => s + b.pnl, 0) >= 0 ? NEON : RED, fontWeight: 700 }}>
                      {(() => { const net = filtered.filter(b => b.result !== 'Open').reduce((s, b) => s + ((b.units > 0 && b.stake > 0) ? b.pnl * (b.stake / b.units) : b.pnl * stats.unitSize), 0); return (net >= 0 ? '+' : '') + fmt$(net) })()}
                    </span>
                  </span>
                </div>
            </div>
          </div>
        )}

        {/* ── LADDER ── */}
        {tab === 'ladder' && <LadderTracker bets={bets} setBets={setBets} ladderStarting={ladderStarting} setLadderStarting={setLadderStarting} ladderSessionKey={ladderSessionKey} darkMode={darkMode} unitSize={stats.unitSize} masterBankroll={masterBankroll} betEvents={betEvents} betRosterPlayers={betRosterPlayers} betBoxScores={betBoxScores} betWinPct={betWinPct} onEdit={setEditingBet} onShare={setShareCardBet}
          onCloseSync={(newKey, newStarting, newRungs) => {
            // No deletes — update session key so ladder tab shows fresh session, upsert new rungs
            setLadderSessionKey(newKey)
            upsertSettings(userId, { ladder_session_key: newKey, ladder_starting: newStarting }, token)
            if (newRungs?.length) Promise.all(newRungs.map(b => upsertBet(b, userId, token)))
          }}
        />}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && <AnalyticsPanel bets={bets} stats={stats} masterBankroll={masterBankroll} ladderStarting={ladderStarting} darkMode={darkMode} betEvents={betEvents} betRosterPlayers={betRosterPlayers} betBoxScores={betBoxScores} betWinPct={betWinPct} onSettle={settleBet} onEdit={setEditingBet} onShare={setShareCardBet} />}

        {/* ══ RR ENGINE ══ */}
        {tab === 'rr engine' && <RREngine unitSize={stats.unitSize} darkMode={darkMode} isDemo={isDemo} token={token} floatPicks={rrFloat} onFloatConsumed={() => setRrFloat(null)} onAddToSlip={addToSlip} />}
        {tab === 'session' && <SessionRecap bets={bets} stats={stats} tilt={tilt} masterBankroll={masterBankroll} riskSettings={riskSettings} darkMode={darkMode} />}
        {tab === 'partners' && <PartnersPage darkMode={darkMode} isMobile={isMobile} />}
        {tab === 'live' && <LiveCenter onLogPosition={handleLogPosition} onAddToSlip={addToSlip} bets={bets} token={token} unitSize={masterBankroll * ((riskSettings.unitPct || 1) / 100)} />}
        {tab === 'bot'  && <MatrixBot initialView={botView} onLogPosition={handleLogPosition} onAddToSlip={addToSlip} bets={bets} token={token} unitSize={masterBankroll * ((riskSettings.unitPct || 1) / 100)} bankroll={masterBankroll}
          sportFilter={sportFilter} resultFilter={resultFilter} setSportFilter={setSportFilter} setResultFilter={setResultFilter} goToBetLog={() => setTab('bet log')} onResetBets={resetBetsOnly} isDemo={isDemo} ladderSessionKey={ladderSessionKey} />}

      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <>
          {/* More sheet backdrop */}
          {showMore && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowMore(false)} />
          )}

          {/* More sheet */}
          {showMore && (
            <div style={{
              position: 'fixed', bottom: 'calc(52px + env(safe-area-inset-bottom))', left: '10px', right: '10px', zIndex: 200,
              background: 'var(--card2)', borderRadius: 'var(--radius)', border: `1px solid var(--border2)`,
              borderTop: `2px solid ${NEON}`, padding: '8px', boxShadow: 'var(--float-shadow)',
              animation: 'slideUp 0.18s ease',
            }}>
              {[
                { id: 'analytics', label: 'Analytics', icon: TrendingUp },
                { id: 'session',   label: 'Session',   icon: Sliders    },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); setShowMore(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                  padding: '14px 16px', background: tab === id ? 'rgba(189,255,0,0.08)' : 'none',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: tab === id ? NEON_T : 'var(--text-dim)',
                }}>
                  <Icon size={16} strokeWidth={2} color={tab === id ? NEON : 'var(--muted)'} />
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
                  {tab === id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: NEON }} />}
                </button>
              ))}
            </div>
          )}

          {/* Bottom nav bar */}
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: 'var(--card2)', borderTop: `1px solid var(--border2)`,
            display: 'flex', alignItems: 'stretch',
            height: 'calc(52px + env(safe-area-inset-bottom))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}>
            {[
              { id: 'overview',  label: 'Analytics',icon: TrendingUp },
              { id: 'ladder',    label: 'Ladder',   icon: Zap        },
              { id: 'bet log',   label: 'Bets',     icon: BookMarked },
              { id: 'analytics', label: 'Overview', icon: BarChart3  },
              { id: 'rr engine', label: 'RR',       icon: Target     },
              { id: 'session',   label: 'Session',  icon: Sliders    },
              { id: 'partners',  label: 'Earn',     icon: Handshake  },
            ].map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button key={id} onClick={() => { setTab(id); setShowMore(false) }} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '2px', background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? NEON_T : 'var(--muted)', transition: 'color 0.12s',
                  position: 'relative', minWidth: 0, overflow: 'hidden', padding: '0 2px',
                }}>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: '20px', height: '2px', background: NEON, borderRadius: '0 0 2px 2px',
                      boxShadow: `0 0 8px ${NEON}`,
                    }} />
                  )}
                  <Icon size={15} strokeWidth={active ? 2.5 : 2} color={active ? NEON : 'var(--muted)'} />
                  <span style={{ fontFamily: R, fontSize: '6px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
                  {id === 'bet log' && stats.openBets > 0 && (
                    <div style={{ position: 'absolute', top: '7px', right: 'calc(50% - 12px)', width: '5px', height: '5px', borderRadius: '50%', background: YELLOW, animation: 'pulseDot 1.4s ease infinite' }} />
                  )}
                </button>
              )
            })}
          </nav>
        </>
      )}

      {/* ── TEMPLATES MODAL ── */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...cardStyle, width: '480px', padding: '26px 28px', borderTop: `2px solid ${NEON}`, backgroundColor: 'var(--card2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookMarked size={14} color={NEON_T} strokeWidth={2} />
                <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: NEON_T }}>SAVED TEMPLATES</span>
              </div>
              <button onClick={() => setShowTemplates(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {templates.length === 0
              ? <div style={{ fontFamily: R, fontSize: '13px', color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
                  No saved templates yet — click Save Template to create one.
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                  {templates.map(t => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                        <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                          {t.date} · ${t.bankroll?.toFixed(0)} bankroll · {t.riskSettings?.maxRiskPerBetPct}% max bet
                        </div>
                      </div>
                      <button onClick={() => loadTemplate(t)} style={{ ...btnStyle(true), padding: '4px 12px', fontSize: '10px' }}>Load</button>
                      <button onClick={() => deleteTemplate(t.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,59,0.4)' }}
                        onMouseEnter={e => e.currentTarget.style.color = RED}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,59,59,0.4)'}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={saveTemplate} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Save size={11} /> Save Current as Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── desktop only branding strip */}
      {!isMobile && (
        <footer style={{ borderTop: `1px solid var(--border)`, backgroundColor: 'var(--bg)', marginTop: '18px', padding: '10px 28px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px', flexWrap: 'wrap', textAlign: 'center' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', color: 'rgba(255,255,255,0.18)', lineHeight: 1.5 }}>
            Please bet responsibly. If you need help: <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'underline' }}>NCPG</a> · 1-800-522-4700
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, boxShadow: darkMode ? '0 0 6px rgba(189,255,0,0.5)' : 'none' }} />
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>Auto-saving</span>
            </div>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>Risk Matrix Labs © 2026</span>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--neon-sub)', textTransform: 'uppercase' }}>Operate With Discipline</span>
          </div>
        </footer>
      )}
    </div>
  )
}
