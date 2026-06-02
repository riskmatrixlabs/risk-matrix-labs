import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import { useMobile } from './hooks/useMobile'
import {
  supabase, signOut,
  fetchBets, syncAllBets, upsertBet, deleteBet as dbDeleteBet, deleteAllBets,
  fetchSettings, upsertSettings,
  fetchTemplates, upsertTemplate, deleteTemplate as dbDeleteTemplate,
  rowToBet,
} from './lib/supabase'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, LineChart, Line,
  PieChart, Pie, RadialBarChart, RadialBar, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Plus, Trash2, ChevronUp, ChevronDown, Sun, Moon, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Target, Crosshair, BarChart3, Lock, Zap, Wallet, ArrowUpRight, ArrowDownRight, Clock, Pencil, RotateCcw, CheckSquare, X, Minimize2, Flame, Calendar, Tag, Sliders, Share2, Copy, CheckCheck, Save, FolderOpen, FileDown, RefreshCcw, BookMarked, Upload, Handshake } from 'lucide-react'
import PartnersPage from './components/PartnersPage'

const LS_KEY   = 'rml_session_v1'
const TMPL_KEY = 'rml_templates_v1'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Brand accents — same in both themes
const NEON   = '#BDFF00'
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
  { id: 1,  date: '2025-01-03', sport: 'NFL', book: 'DraftKings', betType: 'Straight', event: 'Chiefs vs Raiders',     pick: 'Chiefs -6.5',    odds: -110, units: 1.0, stake: 10.00, result: 'W',    pnl: +0.91 },
  { id: 2,  date: '2025-01-05', sport: 'NBA', book: 'FanDuel', betType: 'Straight', event: 'Lakers vs Celtics',     pick: 'Celtics ML',     odds: +140, units: 0.5, stake:  5.00, result: 'L',    pnl: -0.50 },
  { id: 3,  date: '2025-01-07', sport: 'NFL', book: 'BetMGM', betType: 'Straight', event: 'Cowboys vs Eagles',     pick: 'Eagles -3',      odds: -115, units: 1.0, stake: 10.00, result: 'W',    pnl: +0.87 },
  { id: 4,  date: '2025-01-09', sport: 'NHL', book: 'Caesars', betType: 'Straight', event: 'Bruins vs Rangers',     pick: 'Bruins ML',      odds: -130, units: 1.5, stake: 15.00, result: 'W',    pnl: +1.15 },
  { id: 5,  date: '2025-01-11', sport: 'NBA', book: 'PointsBet', betType: 'Straight', event: 'Warriors vs Nuggets',   pick: 'Over 226.5',     odds: -110, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 6,  date: '2025-01-14', sport: 'CFB', book: 'DraftKings', betType: 'Straight', event: 'Alabama vs Georgia',    pick: 'Alabama -4.5',   odds: -108, units: 2.0, stake: 20.00, result: 'W',    pnl: +1.85 },
  { id: 7,  date: '2025-01-16', sport: 'NFL', book: 'FanDuel', betType: 'Straight', event: 'Bills vs Dolphins',     pick: 'Bills -7',       odds: -112, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 8,  date: '2025-01-19', sport: 'NBA', book: 'BetMGM', betType: 'Straight', event: 'Bucks vs Heat',         pick: 'Bucks -5.5',     odds: -110, units: 1.0, stake: 10.00, result: 'W',    pnl: +0.91 },
  { id: 9,  date: '2025-01-21', sport: 'MLB', book: 'Caesars', betType: 'Straight', event: 'Yankees vs Red Sox',    pick: 'Yankees ML',     odds: -165, units: 2.0, stake: 20.00, result: 'W',    pnl: +1.21 },
  { id: 10, date: '2025-01-23', sport: 'NFL', book: 'DraftKings', betType: 'Straight', event: 'Packers vs Bears',      pick: 'Bears +8',       odds: -110, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 11, date: '2025-01-25', sport: 'NBA', book: 'FanDuel', betType: 'Straight', event: 'Suns vs Clippers',      pick: 'Suns ML',        odds: +180, units: 0.5, stake:  5.00, result: 'W',    pnl: +0.90 },
  { id: 12, date: '2025-01-27', sport: 'NHL', book: 'BetMGM', betType: 'Straight', event: 'Lightning vs Panthers', pick: 'Lightning ML',   odds: +115, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 13, date: '2025-01-29', sport: 'NFL', book: 'Caesars', betType: 'Straight', event: 'Ravens vs Steelers',    pick: 'Ravens -4',      odds: -118, units: 1.5, stake: 15.00, result: 'W',    pnl: +1.27 },
  { id: 14, date: '2025-02-01', sport: 'NBA', book: 'DraftKings', betType: 'Straight', event: 'Nets vs Knicks',        pick: 'Knicks -3.5',    odds: -112, units: 1.0, stake: 10.00, result: 'W',    pnl: +0.89 },
  { id: 15, date: '2025-02-03', sport: 'CFB', book: 'FanDuel', betType: 'Straight', event: 'Ohio State vs Michigan', pick: 'Michigan +7',   odds: -110, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 16, date: '2025-02-05', sport: 'MLB', book: 'BetMGM', betType: 'Straight', event: 'Dodgers vs Giants',     pick: 'Dodgers -1.5',   odds: +135, units: 1.0, stake: 10.00, result: 'W',    pnl: +1.35 },
  { id: 17, date: '2025-02-07', sport: 'NBA', book: 'DraftKings', betType: 'Parlay',   event: 'Sixers vs Raptors',     pick: 'Sixers ML',      odds: -140, units: 2.0, stake: 20.00, result: 'L',    pnl: -2.00 },
  { id: 18, date: '2025-02-10', sport: 'NFL', book: 'FanDuel', betType: 'Straight', event: 'Super Bowl LIX',        pick: 'Eagles -1.5',    odds: -108, units: 3.0, stake: 30.00, result: 'W',    pnl: +2.78 },
  { id: 19, date: '2025-02-14', sport: 'NBA', book: 'BetMGM', betType: 'Straight', event: 'Cavs vs Bucks',         pick: 'Under 218',      odds: -115, units: 1.0, stake: 10.00, result: 'L',    pnl: -1.00 },
  { id: 20, date: '2025-02-17', sport: 'NHL', book: 'Caesars', betType: 'Straight', event: 'Avalanche vs Stars',    pick: 'Avalanche -1.5', odds: +125, units: 1.0, stake: 10.00, result: 'W',    pnl: +1.25 },
  // Open bets — pending results
  { id: 21, date: '2025-02-20', sport: 'NFL', book: 'DraftKings', betType: 'Straight', event: 'Chiefs vs Bills',    pick: 'Chiefs -3',   odds: -112, units: 1.5, stake: 15.00, result: 'Open', pnl: 0 },
  { id: 22, date: '2025-02-20', sport: 'NBA', betType: 'SGP',      event: 'Lakers vs Warriors', pick: 'Over 224.5', odds: -108, units: 2.0, stake: 20.00, result: 'Open', pnl: 0 },
  // PHLT™ Ladder bets — shared with Ladder tab
  { id: 101, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 1', pick: 'TBD', odds: -120, units: 0, stake: 150, result: 'Open', pnl: 0, ladder: true, ladderId: 1, pull: false, pullNote: '' },
  { id: 102, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 2', pick: 'TBD', odds: -115, units: 0, stake: 175, result: 'Open', pnl: 0, ladder: true, ladderId: 2, pull: true,  pullNote: 'Pull $150 — risk free from here' },
  { id: 103, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 3', pick: 'TBD', odds: -120, units: 0, stake: 225, result: 'Open', pnl: 0, ladder: true, ladderId: 3, pull: false, pullNote: '' },
  { id: 104, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 4', pick: 'TBD', odds: -110, units: 0, stake: 300, result: 'Open', pnl: 0, ladder: true, ladderId: 4, pull: true,  pullNote: 'Pull $200 profit' },
  { id: 105, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 5', pick: 'TBD', odds: -125, units: 0, stake: 400, result: 'Open', pnl: 0, ladder: true, ladderId: 5, pull: false, pullNote: '' },
  { id: 106, date: '2025-02-21', sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 6', pick: 'TBD', odds: -118, units: 0, stake: 600, result: 'Open', pnl: 0, ladder: true, ladderId: 6, pull: true,  pullNote: 'Bank majority — session complete' },
]

const DEFAULT_LADDER_IDS = [101, 102, 103, 104, 105, 106]
const LADDER_STARTING_BR = 150

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

function calcStats(bets, bankroll) {
  // Only settled bets count toward stats and bankroll
  const settled        = bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P')
  const regular        = settled.filter(b => !b.ladder)   // unit-based bets
  const ladderSettled  = settled.filter(b => b.ladder)    // dollar-based pnl
  const wins    = regular.filter(b => b.result === 'W')
  const losses  = regular.filter(b => b.result === 'L')
  const netUnits    = regular.reduce((s, b) => s + b.pnl, 0)
  const totalUnits  = regular.reduce((s, b) => s + b.units, 0)
  const unitsWon    = wins.reduce((s, b) => s + b.pnl, 0)
  const unitsLost   = losses.reduce((s, b) => s + Math.abs(b.pnl), 0)
  const unitSize    = bankroll / 100
  // Ladder net P&L is in dollars — add directly without unit conversion
  const ladderNetDollars = ladderSettled.reduce((s, b) => s + b.pnl, 0)
  const currentBankroll  = bankroll + netUnits * unitSize + ladderNetDollars
  const openBets    = bets.filter(b => b.result === 'Open')
  const openRisk$   = openBets.reduce((s, b) => s + (b.stake || b.units * unitSize), 0)
  const openUnits   = openBets.reduce((s, b) => s + b.units, 0)
  const largestWin  = wins.length   ? Math.max(...wins.map(b => b.pnl))             : 0
  const largestLoss = losses.length ? Math.max(...losses.map(b => Math.abs(b.pnl))) : 0
  const avgOdds     = regular.length ? regular.reduce((s, b) => s + b.odds, 0) / regular.length : 0
  const winRate     = (wins.length + losses.length) > 0 ? wins.length / (wins.length + losses.length) : 0
  const roi         = totalUnits > 0 ? netUnits / totalUnits : 0
  return {
    currentBankroll, netUnits, totalUnits, unitsWon, unitsLost,
    wins: wins.length, losses: losses.length, total: wins.length + losses.length,
    largestWin, largestLoss, avgOdds, winRate, roi, unitSize,
    openBets: openBets.length, openRisk$, openUnits,
    ladderNetDollars,
  }
}

function buildCurve(bets, bankroll) {
  const unitSize = bankroll / 100
  let running = bankroll
  const pts = [{ label: 'Start', value: bankroll }]
  // Only settled bets move the bankroll
  bets.filter(b => b.result === 'W' || b.result === 'L' || b.result === 'P').forEach((b, i) => {
    running += b.pnl * unitSize
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

  // Detect bet sizing up after a loss
  let chasingDetected = false
  for (let i = 1; i < settled.length; i++) {
    if (settled[i - 1].result === 'L' && settled[i].units > settled[i - 1].units) {
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

function calcRisk(bets, masterBankroll, startingBankroll, riskSettings) {
  const { maxRiskPerBetPct, maxRiskTodayPct, stopLossPct, profitLockPct, unitPct } = riskSettings

  // Unit size always derives from CURRENT (master) bankroll so it scales with your growth
  const unitSize = masterBankroll * ((unitPct || 1) / 100)

  // Open bets = your true live exposure right now
  const openBets       = bets.filter(b => b.result === 'Open')
  const totalOpenRisk  = openBets.reduce((s, b) => s + (b.stake > 0 ? b.stake : b.units * unitSize), 0)
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
  color: active ? NEON : danger ? 'rgba(255,59,59,0.7)' : 'var(--text-dim)',
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

const SmallCard = ({ label, value, color }) => {
  const c = color || 'var(--text-sub)'
  const glow = color === NEON ? '0 0 12px rgba(189,255,0,0.22)' : color === RED ? '0 0 10px rgba(255,59,59,0.18)' : 'none'
  return (
    <div style={{ ...cardStyle, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
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
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: '50%', width: '13px', height: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.65 }}>i</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px', zIndex: 300,
          background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '4px', padding: '7px 10px',
          width: '180px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.45 }}>{text}</div>
          <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', width: '8px', height: '8px', background: 'var(--card2)', border: '1px solid var(--border2)', borderTop: 'none', borderLeft: 'none', transform: 'translateX(-50%) rotate(45deg)' }} />
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
      <div style={{ fontFamily: R, fontSize: '12px', color: NEON, fontWeight: 700 }}>{fmt$(payload[0].value)}</div>
      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>{payload[0].payload.label}</div>
    </div>
  )
}

// ─── ADD BET MODAL ────────────────────────────────────────────────────────────
const BOOKS = ['DraftKings','FanDuel','BetMGM','Caesars','ESPN Bet','PointsBet','Barstool','BetRivers','WynnBET','Hard Rock','Other']

const EMPTY = {
  date: '', sport: 'NFL', book: '', betType: 'Straight', event: '', pick: '',
  odds: '', units: '', stake: '', result: 'Open', confidence: 0,
}

function profitFromOdds(stake, odds) {
  if (!stake || !odds || odds === 0) return 0
  return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
}

function AddBetModal({ onAdd, onClose, unitSize, initial }) {
  const { isMobile } = useMobile()
  const [form, setForm] = useState(initial
    ? { ...initial, odds: String(initial.odds), units: String(initial.units), stake: String(initial.stake) }
    : { ...EMPTY, date: new Date().toISOString().slice(0, 10) }
  )
  const isEdit = !!initial

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const f   = (k)    => (e) => set(k, e.target.value)

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

  // Always calculate both scenarios regardless of result selection
  const potentialWin  = odds !== 0 ? (odds > 0 ? units * odds / 100 : units * 100 / Math.abs(odds)) : 0
  const potentialLoss = units

  const calcPnl = () => {
    if (form.result === 'W')    return potentialWin
    if (form.result === 'L')    return -potentialLoss
    if (form.result === 'P')    return 0
    // Open / TBD — use potential win as the optimistic display
    return potentialWin
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.date || !form.event || !form.pick || !form.odds || (!form.units && !form.stake)) return
    const finalUnits = units || (stake$ / unitSize)
    onAdd({
      ...form,
      odds,
      units: +finalUnits.toFixed(2),
      stake: +stake$.toFixed(2),
      pnl:   +calcPnl().toFixed(2),
      id:    Date.now(),
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}>
      <div style={{ ...cardStyle, width: isMobile ? '100%' : '520px', maxHeight: isMobile ? '95vh' : 'none', overflowY: isMobile ? 'auto' : 'visible', padding: isMobile ? '20px 16px' : '26px 28px', borderTop: `2px solid ${NEON}`, backgroundColor: 'var(--card2)', borderRadius: isMobile ? '8px 8px 0 0' : 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>{isEdit ? 'EDIT BET' : 'LOG BET'}</div>
            <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em', marginTop: '2px' }}>
              1u = {fmt$(unitSize)} · {form.units ? `${form.units}u = ${fmt$(parseFloat(form.units) * unitSize)}` : 'enter units or $'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '4px' }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Row 1: Date / Sport / Book / Bet Type */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '10px' }}>
            {FL({ label: 'Date', children: <input type="date" value={form.date} onChange={f('date')} style={inputStyle} /> })}
            {FL({ label: '🏟️ Sport', children:
              <select value={form.sport} onChange={f('sport')} style={inputStyle}>
                {ALL_SPORTS.map(s => <option key={s}>{s}</option>)}
              </select>
            })}
            {FL({ label: '📚 Book', hint: 'sportsbook', children:
              <select value={form.book} onChange={f('book')} style={{ ...inputStyle, color: form.book ? 'var(--text)' : 'var(--muted)' }}>
                <option value="">— Select —</option>
                {BOOKS.map(b => <option key={b}>{b}</option>)}
              </select>
            })}
            {FL({ label: 'Bet Type', children:
              <select value={form.betType} onChange={f('betType')} style={inputStyle}>
                {['Straight','Parlay','RR 2s','RR 3s','RR 4s','RR 5s','SGP','Live Bet','Hedge'].map(s => <option key={s}>{s}</option>)}
              </select>
            })}
          </div>

          {/* Row 2: Event */}
          {FL({ label: 'Event / Matchup', children:
            <input value={form.event} onChange={f('event')} placeholder="Chiefs vs Raiders" style={inputStyle} />
          })}

          {/* Row 3: Pick */}
          {FL({ label: 'Pick / Market', children:
            <input value={form.pick} onChange={f('pick')} placeholder="Chiefs -6.5" style={inputStyle} />
          })}

          {/* Row 4: Odds / Units / Stake$ */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
            {FL({ label: 'Odds (American)', children:
              <input value={form.odds} onChange={f('odds')} placeholder="-110" type="number" style={inputStyle} />
            })}
            {FL({ label: 'Units', hint: `1u = ${fmt$(unitSize)}`, children:
              <input value={form.units} onChange={onUnitsChange} placeholder="1.0" type="number" step="0.25" min="0" style={inputStyle} />
            })}
            {FL({ label: 'Stake $', hint: 'or type $ directly', children:
              <input value={form.stake} onChange={onStakeChange} placeholder={fmt$(unitSize)} type="number" step="0.01" min="0" style={inputStyle} />
            })}
          </div>

          {/* Row 5: To Win / Total Payout / Result — live preview */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
            {FL({ label: 'To Win', hint: 'auto', children:
              <input readOnly value={stake$ && odds ? fmt$(toWin) : ''} placeholder="auto" style={autoStyle} />
            })}
            {FL({ label: 'Total Payout', hint: 'auto', children:
              <input readOnly value={stake$ && odds ? fmt$(payout) : ''} placeholder="auto" style={autoStyle} />
            })}
            {FL({ label: 'Result', children:
              <select value={form.result} onChange={f('result')} style={inputStyle}>
                <option value="W">Win</option>
                <option value="L">Loss</option>
                <option value="P">Push</option>
                <option value="Open">Open</option>
                <option value="VOID">Void</option>
              </select>
            })}
          </div>

          {/* P&L preview — always shows win/loss scenarios as soon as odds + size entered */}
          {(form.units || form.stake) && odds !== 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {/* Win scenario */}
              <div style={{ padding: '8px 12px', background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.25)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: NEON, textTransform: 'uppercase' }}>✓ If Win</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: NEON }}>+{fmtU(potentialWin)}</div>
                  <div style={{ fontFamily: R, fontSize: '10px', color: NEON, opacity: 0.75 }}>+{fmt$(potentialWin * unitSize)}</div>
                </div>
              </div>
              {/* Loss scenario */}
              <div style={{ padding: '8px 12px', background: 'rgba(255,59,59,0.05)', border: `1px solid rgba(255,59,59,0.2)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: RED, textTransform: 'uppercase' }}>✗ If Loss</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: RED }}>-{fmtU(potentialLoss)}</div>
                  <div style={{ fontFamily: R, fontSize: '10px', color: RED, opacity: 0.75 }}>-{fmt$(stake$ || potentialLoss * unitSize)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence stars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: MUTED, textTransform: 'uppercase' }}>Confidence</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => set('confidence', form.confidence === n ? 0 : n)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  fontSize: '18px', lineHeight: 1,
                  opacity: n <= (form.confidence || 0) ? 1 : 0.2,
                  filter: n <= (form.confidence || 0) ? 'drop-shadow(0 0 4px rgba(189,255,0,0.6))' : 'none',
                  transition: 'all 0.1s',
                }}>⭐</button>
              ))}
            </div>
            {form.confidence > 0 && (
              <span style={{ fontFamily: R, fontSize: '9px', color: NEON, letterSpacing: '0.08em' }}>
                {['','Low','Moderate','Average','High','Lock 🔒'][form.confidence]}
              </span>
            )}
          </div>

          {/* Actions — sticky at bottom so always visible on mobile */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px',
            position: 'sticky', bottom: isMobile ? '-20px' : 'auto',
            background: 'var(--card2)', paddingTop: '10px', paddingBottom: '4px',
            borderTop: `1px solid var(--border)`, zIndex: 10,
          }}>
            <button type="button" onClick={onClose} style={{ ...btnStyle(), flex: isMobile ? 1 : 'none' }}>Cancel</button>
            <button type="submit" style={{
              ...btnStyle(true),
              padding: '10px 20px', fontSize: '12px',
              flex: isMobile ? 2 : 'none',
              opacity: (!form.event || !form.pick || !form.odds || (!form.units && !form.stake)) ? 0.4 : 1,
            }}>
              {isEdit ? '💾 Save Changes' : '+ Log Bet'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

// ─── PHLT™ LADDER TRACKER ─────────────────────────────────────────────────────
function profitFromLadderOdds(stake, odds) {
  if (!stake || !odds || odds === 0) return 0
  return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds))
}

function LadderTracker({ bets, setBets, ladderStarting, setLadderStarting, darkMode }) {
  const { isMobile } = useMobile()
  const [startInput, setStartInput] = useState(String(ladderStarting))
  const [editRow,    setEditRow]    = useState(null)

  // Ladder rows = all ladder-tagged bets sorted by ladderId
  const rows = bets.filter(b => b.ladder).sort((a, z) => a.ladderId - z.ladderId)

  const setRow = (id, k, v) => setBets(p => p.map(b => b.id === id ? { ...b, [k]: v } : b))

  const resetLadder = () => {
    // Reset uses the CURRENT starting bankroll (not hardcoded $150)
    // so stakes scale proportionally to whatever starting $ the user set
    const s = ladderStarting
    const defaults = [
      { id: 101, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 1', pick: 'TBD', odds: -120, units: 0, stake: scaleStake(s, LADDER_RATIOS[0]), result: 'Open', pnl: 0, ladder: true, ladderId: 1, pull: false, pullNote: '' },
      { id: 102, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 2', pick: 'TBD', odds: -115, units: 0, stake: scaleStake(s, LADDER_RATIOS[1]), result: 'Open', pnl: 0, ladder: true, ladderId: 2, pull: true,  pullNote: `Pull ${fmt$(s)} — risk free from here` },
      { id: 103, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 3', pick: 'TBD', odds: -120, units: 0, stake: scaleStake(s, LADDER_RATIOS[2]), result: 'Open', pnl: 0, ladder: true, ladderId: 3, pull: false, pullNote: '' },
      { id: 104, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 4', pick: 'TBD', odds: -110, units: 0, stake: scaleStake(s, LADDER_RATIOS[3]), result: 'Open', pnl: 0, ladder: true, ladderId: 4, pull: true,  pullNote: `Pull ${fmt$(Math.round(s * 1.33 / 5) * 5)} profit` },
      { id: 105, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 5', pick: 'TBD', odds: -125, units: 0, stake: scaleStake(s, LADDER_RATIOS[4]), result: 'Open', pnl: 0, ladder: true, ladderId: 5, pull: false, pullNote: '' },
      { id: 106, date: new Date().toISOString().slice(0,10), sport: 'NFL', betType: 'Straight', event: 'PHLT Ladder Rung 6', pick: 'TBD', odds: -118, units: 0, stake: scaleStake(s, LADDER_RATIOS[5]), result: 'Open', pnl: 0, ladder: true, ladderId: 6, pull: true,  pullNote: 'Bank majority — session complete' },
    ]
    setBets(p => [...p.filter(b => !b.ladder), ...defaults])
    setEditRow(null)
  }

  // Build rolling bankroll and computed values
  const computed = rows.reduce((acc, row) => {
    const prev    = acc.length ? acc[acc.length - 1] : null
    const bankIn  = prev ? (prev.result === 'W' ? prev.bankOut : prev.bankIn) : ladderStarting
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
      sport: 'NFL', betType: 'Straight', event: `PHLT Ladder Rung ${rows.length + 1}`,
      pick: 'TBD', odds: -110, units: 0, stake: newStake,
      result: 'Open', pnl: 0, ladder: true,
      ladderId: (last?.ladderId || 0) + 1, pull: false, pullNote: '',
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
          {/* Reset button always top-right on mobile */}
          {isMobile && (
            <button onClick={resetLadder} style={{
              ...btnStyle(), display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
              borderColor: 'rgba(255,59,59,0.35)', color: 'rgba(255,59,59,0.6)',
            }}>
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>

        {/* Controls + stats row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? '10px' : '16px' }}>
          {/* Starting Bankroll input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>Ladder Starting</span>
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
              { label: 'Profit',        value: `+${fmt$(totalProfit)}`,         color: NEON },
              { label: 'Final BR',      value: fmt$(finalBankroll),             color: finalBankroll > ladderStarting ? NEON : RED },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontFamily: R, fontSize: isMobile ? '12px' : '14px', fontWeight: 700, color,
                  textShadow: color === NEON && darkMode ? '0 0 12px rgba(189,255,0,0.25)' : 'none' }}>{value}</div>
              </div>
            ))}
            {!isMobile && (
              <button onClick={resetLadder} style={{
                ...btnStyle(), display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                borderColor: 'rgba(255,59,59,0.35)', color: 'rgba(255,59,59,0.6)',
              }}>
                <RotateCcw size={11} /> Reset
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
          <button onClick={resetLadder} style={{
            fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            padding: '12px 32px', borderRadius: '2px', cursor: 'pointer',
            border: `1px solid rgba(189,255,0,0.5)`, background: 'rgba(189,255,0,0.1)', color: NEON,
            boxShadow: '0 0 16px rgba(189,255,0,0.15)',
          }}>
            ⚡ Start Session
          </button>
        </div>
      )}

      {/* Main ladder table */}
      {rows.length > 0 && <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid var(--border)` }}>
              {['Rung','Odds','Stake $','To Win','Total Return','Profit','Bank After','Pull Checkpoint','Result',''].map((h, i) => (
                <th key={i} style={{
                  fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em',
                  color: 'var(--muted)', textTransform: 'uppercase', padding: '10px 12px',
                  textAlign: i > 1 ? 'right' : 'left', background: 'var(--card)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.map((row, i) => {
              const isWin     = row.result === 'W'
              const isLoss    = row.result === 'L'
              const isOpen    = row.result === 'Open'
              const isCurrent = isOpen && i === runActive
              const isPull    = row.pull
              const isEdit    = editRow === row.id

              const rowBg = isWin  ? 'rgba(189,255,0,0.04)'
                          : isLoss ? 'rgba(255,59,59,0.05)'
                          : isCurrent ? 'rgba(245,166,35,0.03)'
                          : 'transparent'

              const leftBorder = isWin  ? `3px solid rgba(189,255,0,0.5)`
                               : isLoss ? `3px solid rgba(255,59,59,0.5)`
                               : isCurrent ? `3px solid rgba(245,166,35,0.4)`
                               : '3px solid transparent'

              return (
                <tr key={row.id} style={{ borderBottom: `1px solid var(--border)`, backgroundColor: rowBg, borderLeft: leftBorder }}>

                  {/* Rung # */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{
                        fontFamily: R, fontSize: '13px', fontWeight: 700,
                        color: isWin ? NEON : isLoss ? RED : isCurrent ? YELLOW : 'var(--text-dim)',
                        minWidth: '18px',
                      }}>{i + 1}</span>
                      {isCurrent && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: YELLOW, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', padding: '1px 5px', borderRadius: '2px' }}>ACTIVE</span>}
                    </div>
                  </td>

                  {/* Odds */}
                  <td style={{ padding: '8px 12px' }}>
                    {isEdit
                      ? iCell(row.odds, v => setRow(row.id, 'odds', parseInt(v) || 0), 'number', '75px')
                      : <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: row.odds > 0 ? NEON : 'var(--text)' }}>{row.odds > 0 ? `+${row.odds}` : row.odds}</span>}
                  </td>

                  {/* Stake */}
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {isEdit
                      ? iCell(row.stake, v => setRow(row.id, 'stake', parseFloat(v) || 0), 'number', '80px')
                      : <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{fmt$(row.stake)}</span>}
                  </td>

                  {/* To Win */}
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, color: NEON,
                      textShadow: darkMode ? '0 0 10px rgba(189,255,0,0.2)' : 'none' }}>+{fmt$(row.toWin)}</span>
                  </td>

                  {/* Total Return */}
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(row.payout)}</span>
                  </td>

                  {/* Profit */}
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700,
                      color: isWin ? NEON : isLoss ? RED : 'var(--muted)' }}>
                      {isWin ? `+${fmt$(row.profit)}` : isLoss ? `-${fmt$(row.stake)}` : `+${fmt$(row.profit)}`}
                    </span>
                  </td>

                  {/* Bankroll After */}
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700,
                      color: isWin ? NEON : isLoss ? RED : 'var(--text-dim)' }}>
                      {isOpen ? <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span> : fmt$(row.bankOut)}
                    </span>
                  </td>

                  {/* Pull Checkpoint */}
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {isPull
                      ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                          <CheckSquare size={11} color={isWin ? NEON : YELLOW} strokeWidth={2} />
                          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, color: isWin ? NEON : YELLOW, letterSpacing: '0.06em', maxWidth: '160px', textAlign: 'right', lineHeight: 1.3 }}>{row.pullNote}</span>
                        </div>
                      : <span style={{ color: 'var(--muted)', fontSize: '9px', fontFamily: R }}>—</span>}
                  </td>

                  {/* Result — inline settle */}
                  <td style={{ padding: '8px 12px' }}>
                    {isOpen
                      ? <div style={{ display: 'flex', gap: '4px' }}>
                          {['W', 'L'].map(r => (
                            <button key={r} onClick={() => settleRow(row.id, r)} style={{
                              fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                              padding: '3px 9px', borderRadius: '2px', cursor: 'pointer',
                              border: `1px solid ${r === 'W' ? 'rgba(189,255,0,0.4)' : 'rgba(255,59,59,0.4)'}`,
                              background: r === 'W' ? 'rgba(189,255,0,0.08)' : 'rgba(255,59,59,0.08)',
                              color: r === 'W' ? NEON : RED,
                            }}>{r}</button>
                          ))}
                          <button onClick={() => settleRow(row.id, 'P')} style={{
                            fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '2px', cursor: 'pointer',
                            border: `1px solid var(--border2)`, background: 'var(--card2)', color: 'var(--muted)',
                          }}>P</button>
                        </div>
                      : <span style={{
                          fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                          padding: '2px 8px', borderRadius: '2px',
                          color: isWin ? NEON : isLoss ? RED : 'var(--muted)',
                          background: isWin ? 'rgba(189,255,0,0.08)' : isLoss ? 'rgba(255,59,59,0.08)' : 'var(--card2)',
                          border: `1px solid ${isWin ? 'rgba(189,255,0,0.22)' : isLoss ? 'rgba(255,59,59,0.22)' : 'var(--border)'}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => settleRow(row.id, 'Open')}
                        title="Click to re-open"
                      >
                        {isWin ? 'WIN' : isLoss ? 'LOSS' : 'PUSH'}
                      </span>}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button onClick={() => setEditRow(isEdit ? null : row.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        color: isEdit ? NEON : 'rgba(189,255,0,0.25)',
                        display: 'flex', alignItems: 'center',
                      }}
                        onMouseEnter={e => !isEdit && (e.currentTarget.style.color = NEON)}
                        onMouseLeave={e => !isEdit && (e.currentTarget.style.color = 'rgba(189,255,0,0.25)')}
                      ><Pencil size={10} /></button>
                      <button onClick={() => removeRung(row.id)} style={{
                        background: 'none', border: 'none', cursor: rows.length > 1 ? 'pointer' : 'default',
                        padding: '2px', color: rows.length > 1 ? 'rgba(255,59,59,0.28)' : 'var(--border2)',
                        display: 'flex', alignItems: 'center',
                      }}
                        onMouseEnter={e => rows.length > 1 && (e.currentTarget.style.color = RED)}
                        onMouseLeave={e => rows.length > 1 && (e.currentTarget.style.color = 'rgba(255,59,59,0.28)')}
                      ><Trash2 size={10} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* Table footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid var(--border)` }}>
          <button onClick={addRung} style={{ ...btnStyle(false), display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px' }}>
            <Plus size={11} /> Add Rung
          </button>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.1em' }}>
              TOTAL STAKED: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{fmt$(computed.reduce((s, r) => s + (r.result !== 'Open' ? r.stake : 0), 0))}</span>
            </span>
            <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.1em' }}>
              NET P/L: <span style={{ color: totalProfit - totalLost >= 0 ? NEON : RED, fontWeight: 700 }}>
                {totalProfit - totalLost >= 0 ? '+' : ''}{fmt$(totalProfit - totalLost)}
              </span>
            </span>
          </div>
        </div>
      </div>}

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

function RREngine({ unitSize, darkMode }) {
  const { isMobile } = useMobile()
  const [legs,         setLegs]         = useState([{ ...EMPTY_LEG }, { ...EMPTY_LEG }, { ...EMPTY_LEG }])
  const [rrType,       setRrType]       = useState(2)
  const [stakeMode,    setStakeMode]    = useState('units') // 'units' | 'dollars'
  const [stakeVal,     setStakeVal]     = useState('1')
  const [showMBO,      setShowMBO]      = useState(false)  // Missed By One panel

  const setLeg = (i, k, v) => setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  const addLeg    = () => legs.length < 10 && setLegs(p => [...p, { ...EMPTY_LEG }])
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

  const healthColor = (pl) => pl > 0 ? NEON : pl < 0 ? RED : YELLOW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── TOP ROW: Leg Inputs + Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>

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

          {/* Leg rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {legs.map((leg, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '20px 1fr 72px 26px' : '22px 1fr 1fr 80px 26px',
                gap: '6px', alignItems: 'center',
                padding: '6px 8px',
                background: leg.result === 'W' ? 'rgba(189,255,0,0.04)' : leg.result === 'L' ? 'rgba(255,59,59,0.04)' : 'var(--card2)',
                border: `1px solid ${leg.result === 'W' ? 'rgba(189,255,0,0.2)' : leg.result === 'L' ? 'rgba(255,59,59,0.15)' : 'var(--border)'}`,
                borderRadius: '2px',
              }}>
                <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</span>
                <input
                  value={leg.odds}
                  onChange={e => setLeg(i, 'odds', e.target.value)}
                  placeholder={isMobile ? '-110' : 'Odds e.g. -110'}
                  type="number"
                  style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px' }}
                />
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
                      {leg.odds && parseInt(leg.odds) !== 0 ? `payout: ${fmt$(stakePerCombo * toDecimal(parseInt(leg.odds)))}` : 'enter odds'}
                    </span>
                    {leg.odds && parseInt(leg.odds) !== 0 && (
                      <span style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>
                        impl: {(100 / (parseInt(leg.odds) > 0 ? parseInt(leg.odds) + 100 : Math.abs(parseInt(leg.odds)) + 100) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
                <select
                  value={leg.result}
                  onChange={e => setLeg(i, 'result', e.target.value)}
                  style={{ ...inputStyle, padding: '4px 6px', fontSize: '10px', fontWeight: 700,
                    color: leg.result === 'W' ? NEON : leg.result === 'L' ? RED : 'var(--muted)' }}
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
                { label: 'Max Payout', value: maxPayout ? fmt$(maxPayout) : '—',         color: NEON },
                { label: 'Max Profit', value: maxPayout ? fmt$(maxPayout - totalRisk) : '—', color: NEON },
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
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>Break-even Hit Rate</span>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON }}>
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
                  { label: 'Returned',   value: fmt$(exactTotal), color: exactTotal > 0 ? NEON : 'var(--muted)' },
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
                <span style={{ fontWeight: 700, color: mboResult >= 0 ? NEON : RED }}>
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
                const plColor     = pl > 0 ? NEON : pl < 0 ? RED : YELLOW
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
                      <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: hits === 0 ? RED : isMax ? NEON : 'var(--text)', lineHeight: 1 }}>{hits}/{n}</div>
                      <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '1px' }}>legs</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isBreakEven && hits > 0 && <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, color: YELLOW, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.08em' }}>MIN</span>}
                      {isMax && <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, color: NEON, background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.2)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.08em' }}>MAX</span>}
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
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'center', color: hits === 0 ? RED : hits === n ? NEON : 'var(--text)' }}>
                          {hits} / {n}
                          {isBreakEven && hits > 0 && <span style={{ fontFamily: R, fontSize: '8px', color: YELLOW, marginLeft: '6px', letterSpacing: '0.1em' }}>MIN</span>}
                          {isMax && <span style={{ fontFamily: R, fontSize: '8px', color: NEON, marginLeft: '6px', letterSpacing: '0.1em' }}>MAX</span>}
                        </td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, padding: '9px 14px', textAlign: 'center', color: winningCombos > 0 ? NEON : 'var(--muted)' }}>{winningCombos > 0 ? winningCombos : '—'}</td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'right', color: payout > 0 ? 'var(--text)' : 'var(--muted)' }}>{payout > 0 ? fmt$(payout) : '—'}</td>
                        <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 14px', textAlign: 'right', color: pl > 0 ? NEON : pl < 0 ? RED : YELLOW, textShadow: pl > 0 ? 'var(--neon-glow)' : pl < 0 ? 'var(--red-glow)' : 'none' }}>{pl > 0 ? '+' : ''}{fmt$(pl)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '2px', color: pl > 0 ? NEON : pl < 0 ? RED : YELLOW, background: pl > 0 ? 'rgba(189,255,0,0.07)' : pl < 0 ? 'rgba(255,59,59,0.07)' : 'rgba(245,166,35,0.07)', border: `1px solid ${pl > 0 ? 'rgba(189,255,0,0.2)' : pl < 0 ? 'rgba(255,59,59,0.2)' : 'rgba(245,166,35,0.2)'}` }}>
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
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: wr >= 0.525 ? NEON : 'var(--text-sub)' }}>
            {total > 0 ? (wr * 100).toFixed(0) : 0}%
          </span>
          <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, minWidth: '52px', textAlign: 'right',
            color: pnl >= 0 ? NEON : RED,
            textShadow: pnl >= 0 && darkMode ? '0 0 8px rgba(189,255,0,0.2)' : 'none' }}>
            {fmtU(pnl)}
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
          <div style={{ fontSize: '14px', fontWeight: 700, color: payload[0].value >= 0 ? NEON : RED }}>{fmtU(payload[0].value)}</div>
          {tLabel && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{tLabel}</div>}
        </>
      )}
    </div>
  )
}

// ─── ANALYTICS PANEL ─────────────────────────────────────────────────────────
function AnalyticsPanel({ bets, stats, masterBankroll, darkMode, onSettle, onEdit }) {
  const { isMobile, isTablet } = useMobile()
  const g = (d, t, m) => isMobile ? m : isTablet ? t : d
  const [chartView,      setChartView]      = useState('cumulative')
  const [analyticspill,  setAnalyticsPill]  = useState('curve')

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
  const typeMap = {}
  settled.forEach(b => {
    const t = b.betType || 'Straight'
    if (!typeMap[t]) typeMap[t] = { type: t, pnl: 0, bets: 0, wins: 0 }
    typeMap[t].pnl += b.pnl; typeMap[t].bets++
    if (b.result === 'W') typeMap[t].wins++
  })
  const byType = Object.values(typeMap).sort((a, z) => z.bets - a.bets)

  // Book
  const bookMap = {}
  settled.forEach(b => {
    const bk = b.book || 'Unknown'
    if (!bookMap[bk]) bookMap[bk] = { book: bk, pnl: 0, bets: 0, wins: 0 }
    bookMap[bk].pnl += b.pnl; bookMap[bk].bets++
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
  const profitFactor = stats.unitsLost > 0 ? (stats.unitsWon / stats.unitsLost).toFixed(2) : '∞'

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
              color: chartView === v.id ? NEON : 'var(--muted)',
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
                <div style={{ fontSize: '13px', fontWeight: 700, color: p[0].value >= 0 ? NEON : RED }}>{fmtU(p[0].value)} cumulative</div>
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
                <div style={{ fontSize: '14px', fontWeight: 700, color: p[0].value >= 0 ? NEON : RED }}>{fmtU(p[0].value)}</div>
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
                <div style={{ fontSize: '14px', fontWeight: 700, color: parseFloat(p[0].value) >= 52.5 ? NEON : RED }}>{p[0].value}% WR</div>
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

  if (isMobile) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Always visible: Net Units + ROI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.netUnits >= 0 ? NEON : RED}` }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Units</div>
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: stats.netUnits >= 0 ? NEON : RED, lineHeight: 1 }}>{fmtU(stats.netUnits)}</div>
          <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.total} settled</div>
        </div>
        <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.roi >= 0 ? NEON : RED}` }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>ROI</div>
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: stats.roi >= 0 ? NEON : RED, lineHeight: 1 }}>{stats.roi >= 0 ? '+' : ''}{(stats.roi * 100).toFixed(1)}%</div>
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
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: isYours ? NEON : 'var(--text-sub)' }}>
                    {(wr * 100).toFixed(0)}% WR{isYours ? ' ←' : ''}
                  </span>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON }}>{(k * 100).toFixed(1)}%</span>
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
            { label: 'Win Streak', value: maxW ? `${maxW}W` : '—', color: NEON },
            { label: 'Loss Streak', value: maxL ? `${maxL}L` : '—', color: RED },
            { label: 'Profit Factor', value: profitFactor, color: parseFloat(profitFactor) >= 1 ? NEON : RED },
            { label: 'Avg Win', value: stats.wins ? fmtU(stats.unitsWon / stats.wins) : '—', color: NEON },
            { label: 'Avg Loss', value: stats.losses ? fmtU(-stats.unitsLost / stats.losses) : '—', color: RED },
            { label: 'Avg Odds', value: fmtOdds(Math.round(stats.avgOdds)), color: 'var(--text)' },
          ].map(({ label, value, color }) => (
            <SmallCard key={label} label={label} value={value} color={color} />
          ))}
        </div>
      )}

      {/* Live Open Bets — always at the bottom */}
      {(() => {
        const openBets = bets.filter(b => b.result === 'Open').slice(0, 6)
        if (!openBets.length) return null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
              ● Live — {openBets.length} Open
            </div>
            {openBets.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '2px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.pick}</div>
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>
                    {b.sport} · {b.odds > 0 ? '+' : ''}{b.odds} · {b.stake > 0 ? `$${b.stake.toFixed(0)}` : `${b.units}u`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {['W','L','P'].map(r => (
                    <button key={r} onClick={() => onSettle?.(b.id, r)} style={{
                      fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
                      padding: '4px 8px', borderRadius: '2px', cursor: 'pointer',
                      border: `1px solid ${r === 'W' ? 'rgba(189,255,0,0.4)' : r === 'L' ? 'rgba(255,59,59,0.4)' : 'var(--border2)'}`,
                      background: r === 'W' ? 'rgba(189,255,0,0.07)' : r === 'L' ? 'rgba(255,59,59,0.07)' : 'var(--card)',
                      color: r === 'W' ? NEON : r === 'L' ? RED : 'var(--muted)',
                    }}>{r}</button>
                  ))}
                  {onEdit && (
                    <button onClick={() => onEdit(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(189,255,0,0.3)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )

  // Desktop layout (unchanged)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: g('repeat(6,1fr)', 'repeat(3,1fr)', 'repeat(2,1fr)'), gap: '6px' }}>
        {[
          { label: 'Current Streak',  value: curStreak ? `${curStreak.count} ${curStreak.result === 'W' ? 'W' : 'L'}` : '—', color: curStreak?.result === 'W' ? NEON : curStreak?.result === 'L' ? RED : 'var(--text)', sub: 'in a row' },
          { label: 'Best Win Run',    value: maxW ? `${maxW}W` : '—',  color: NEON, sub: 'consecutive wins' },
          { label: 'Worst Loss Run',  value: maxL ? `${maxL}L` : '—',  color: RED,  sub: 'consecutive losses' },
          { label: 'Avg Win',         value: stats.wins   ? fmtU(stats.unitsWon  / stats.wins)   : '—', color: NEON, sub: 'per winning bet' },
          { label: 'Avg Loss',        value: stats.losses ? fmtU(-stats.unitsLost / stats.losses) : '—', color: RED,  sub: 'per losing bet' },
          { label: 'Profit Factor',   value: profitFactor, color: parseFloat(profitFactor) >= 1 ? NEON : RED, sub: 'won ÷ lost' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color, lineHeight: 1,
              textShadow: color === NEON && darkMode ? '0 0 12px rgba(189,255,0,0.25)' : 'none' }}>{value}</div>
            <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>{sub}</div>
          </div>
        ))}
      </div>
      {chartPanel}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <SectionLabel>🎯 Bet Type Performance</SectionLabel>
          {byType.length === 0
            ? <div style={{ fontFamily: R, fontSize: '12px', color: 'var(--muted)', padding: '16px 0' }}>No settled bets yet</div>
            : byType.map(t => <BreakRow key={t.type} label={t.type} wins={t.wins} total={t.bets} pnl={t.pnl} darkMode={darkMode} />)}
        </div>
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <SectionLabel>📚 Book Performance</SectionLabel>
          {byBook.length === 0
            ? <div style={{ fontFamily: R, fontSize: '12px', color: 'var(--muted)', padding: '16px 0' }}>No book data</div>
            : byBook.map(b => <BreakRow key={b.book} label={b.book} wins={b.wins} total={b.bets} pnl={b.pnl} darkMode={darkMode} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <SectionLabel>🎯 Kelly Criterion at -110</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            {[0.52, 0.54, 0.56, 0.58, 0.60].map(wr => {
              const b = 100 / 110
              const k = (b * wr - (1 - wr)) / b
              const isYours = Math.abs(wr - stats.winRate) < 0.015
              return (
                <div key={wr} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                  background: isYours ? 'rgba(189,255,0,0.05)' : 'var(--card2)',
                  border: `1px solid ${isYours ? 'rgba(189,255,0,0.3)' : 'var(--border)'}`, borderRadius: '2px' }}>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)', flex: 1 }}>
                    {(wr * 100).toFixed(0)}% WR {isYours ? '← your rate' : ''}
                  </span>
                  <span style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: NEON, minWidth: '48px', textAlign: 'right' }}>{(k * 100).toFixed(1)}%</span>
                  <span style={{ fontFamily: R, fontSize: '11px', color: 'var(--muted)', minWidth: '52px', textAlign: 'right' }}>{fmt$(masterBankroll * k)}</span>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px', minWidth: '90px', textAlign: 'right' }}>
                    <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text-sub)' }}>{(k / 2 * 100).toFixed(1)}%</div>
                    <div style={{ fontFamily: R, fontSize: '9px', color: NEON }}>½ Kelly = {fmt$(masterBankroll * k / 2)} ✓</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '16px 18px' }}>
          <SectionLabel>📊 Quick Stats</SectionLabel>
          {[
            ['Total Settled', stats.total],
            ['Win Rate',      `${(stats.winRate * 100).toFixed(1)}%`],
            ['Net Units',     fmtU(stats.netUnits)],
            ['Avg Win',       stats.wins   ? fmtU(stats.unitsWon  / stats.wins)   : '—'],
            ['Avg Loss',      stats.losses ? fmtU(-stats.unitsLost / stats.losses) : '—'],
            ['Profit Factor', profitFactor],
            ['Avg Odds',      fmtOdds(Math.round(stats.avgOdds))],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: R, fontSize: '11px', color: 'var(--muted)' }}>{label}</span>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text-sub)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
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
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Session Grade</div>
          <div style={{ fontFamily: R, fontSize: '40px', fontWeight: 700, lineHeight: 1, color: gradeColor }}>{displayGrade}</div>
          <div style={{ fontFamily: R, fontSize: '9px', color: gradeColor, marginTop: '3px', opacity: 0.8 }}>{gradeOverride ? {A:'Elite',B:'Strong',C:'Average',D:'Needs Work',F:'Restart'}[gradeOverride] : gradeLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Discipline</div>
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

  if (isMobile) return (
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
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: allChecked ? NEON : 'var(--muted)' }}>{checksPassed}/{CHECKLIST.length} {allChecked ? '✓' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {CHECKLIST.map(({ id, label }) => {
              const checked = !!checks[id]
              return (
                <button key={id} onClick={() => toggleCheck(id)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                  background: checked ? 'rgba(189,255,0,0.06)' : 'var(--card2)',
                  border: `1px solid ${checked ? 'rgba(189,255,0,0.3)' : 'var(--border)'}`, transition: 'all 0.15s',
                }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${checked ? NEON : 'var(--border2)'}`, background: checked ? 'rgba(189,255,0,0.15)' : 'var(--card)' }}>
                    {checked && <span style={{ color: NEON, fontSize: '9px', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: checked ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
                </button>
              )
            })}
          </div>
          {allChecked && (
            <div style={{ marginTop: '10px', padding: '9px 12px', background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.3)', borderRadius: '2px' }}>
              <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>🛡️ FULL DISCIPLINE — YOU ARE IN CONTROL</span>
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
                <span style={{ color: style === 'conservative' ? NEON : style === 'balanced' ? YELLOW : RED, fontSize: '9px' }}>▸</span>
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
                  color: mood === m ? NEON : 'var(--text-dim)', transition: 'all 0.12s',
                }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '✅ What went well?', val: wentWell, set: setWentWell, placeholder: 'Stayed disciplined, hit 3/4 picks...' },
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
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: pass ? NEON : RED, marginLeft: '8px' }}>{pts > 0 ? `+${pts}` : '0'}</span>
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

  // Desktop layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── ROW 1: Discipline Score™ (full width) ── */}
      <div style={{ ...cardStyle, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ flex: 1, marginRight: '32px' }}>
            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.28em', color: 'var(--neon-accent)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
              🏆 Discipline Score™<InfoTip text="0–100 score based on sizing discipline, tilt control, and process rules." />
            </div>
            <div style={{ fontFamily: R, fontSize: '48px', fontWeight: 700, lineHeight: 1, color: scoreColor,
              textShadow: scoreColor === NEON && darkMode ? '0 0 24px rgba(189,255,0,0.35)' : 'none' }}>
              {score}<span style={{ fontSize: '20px', color: 'var(--muted)', fontWeight: 500 }}>/100</span>
            </div>
            <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', letterSpacing: '0.06em' }}>
              {score >= 80 ? 'Operate With Discipline 🛡️' : score >= 60 ? 'Solid — keep tightening' : 'Review your process'}
            </div>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '10px' }}>
              <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: '2px', transition: 'width 0.5s',
                boxShadow: scoreColor === NEON && darkMode ? '0 0 8px rgba(189,255,0,0.5)' : 'none' }} />
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 24px', border: `2px solid ${gradeColorAlpha}`, borderRadius: '4px', background: `${gradeColor}08`, transition: 'all 0.2s' }}>
            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Session Grade</div>
            <div style={{ fontFamily: R, fontSize: '56px', fontWeight: 700, lineHeight: 1, color: gradeColor,
              textShadow: gradeColor === NEON && darkMode ? '0 0 24px rgba(189,255,0,0.4)' : 'none' }}>{displayGrade}</div>
            <div style={{ fontFamily: R, fontSize: '10px', color: gradeColor, marginTop: '5px', opacity: 0.8 }}>
              {gradeOverride ? { A: 'Elite Discipline', B: 'Strong Session', C: 'Average', D: 'Needs Work', F: 'Restart' }[gradeOverride] : gradeLabel}
            </div>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '10px' }}>
              {['A','B','C','D','F'].map(g => (
                <button key={g} onClick={() => setGradeOverride(gradeOverride === g ? null : g)} style={{
                  fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '2px', cursor: 'pointer',
                  border: `1px solid ${displayGrade === g ? gradeColor : 'var(--border2)'}`,
                  background: displayGrade === g ? `${gradeColor}18` : 'var(--card)',
                  color: displayGrade === g ? gradeColor : 'var(--muted)',
                }}>{g}</button>
              ))}
            </div>
            <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', marginTop: '4px' }}>tap to override</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
          {reasons.map(({ label, pts, pass }) => (
            <div key={label} style={{ padding: '10px 12px', background: 'var(--card2)',
              border: `1px solid ${pass ? 'rgba(189,255,0,0.18)' : 'rgba(255,59,59,0.18)'}`, borderRadius: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', lineHeight: 1.3 }}>{label}</span>
                <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: pass ? NEON : RED, marginLeft: '6px', flexShrink: 0 }}>{pts > 0 ? `+${pts}` : '0'}</span>
              </div>
              <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pts}%`, background: pass ? NEON : RED, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <SectionLabel>🧠 Pre-Bet Discipline Checklist</SectionLabel>
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: allChecked ? NEON : 'var(--muted)', letterSpacing: '0.08em' }}>{checksPassed}/{CHECKLIST.length} {allChecked ? '✓' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {CHECKLIST.map(({ id, label }) => {
              const checked = !!checks[id]
              return (
                <button key={id} onClick={() => toggleCheck(id)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                  background: checked ? 'rgba(189,255,0,0.06)' : 'var(--card2)',
                  border: `1px solid ${checked ? 'rgba(189,255,0,0.3)' : 'var(--border)'}`, transition: 'all 0.15s',
                }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${checked ? NEON : 'var(--border2)'}`, background: checked ? 'rgba(189,255,0,0.15)' : 'var(--card)' }}>
                    {checked && <span style={{ color: NEON, fontSize: '10px', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, color: checked ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
                </button>
              )
            })}
          </div>
          {allChecked && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.3)', borderRadius: '2px' }}>
              <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON, letterSpacing: '0.1em' }}>🛡️ FULL DISCIPLINE — YOU ARE IN CONTROL</span>
            </div>
          )}
        </div>
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <SectionLabel>⚙️ Bet Structure Guide</SectionLabel>
          <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.06em' }}>Choose your style for this session</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STYLES.map(s => {
              const active = style === s.id
              return (
                <button key={s.id} onClick={() => setStyle(s.id)} style={{
                  padding: '14px 16px', borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                  background: active ? `${s.color}10` : 'var(--card2)',
                  border: `1px solid ${active ? `${s.color}50` : 'var(--border)'}`,
                  borderLeft: active ? `3px solid ${s.color}` : '3px solid transparent', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: active ? s.color : 'var(--text)' }}>{s.icon} {s.label}</span>
                    {active && <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, color: s.color, letterSpacing: '0.12em' }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontFamily: R, fontSize: '10px', color: 'var(--muted)', lineHeight: 1.5 }}>{s.desc}</div>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '2px' }}>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--neon-accent)', textTransform: 'uppercase', marginBottom: '8px' }}>
              {style === 'conservative' ? '🛡️ Conservative Rules' : style === 'balanced' ? '⚖️ Balanced Rules' : '⚡ Aggressive Rules'}
            </div>
            {(style === 'conservative'
              ? ['Max 1-2 bets per day','Straight bets only','Minimum -130 odds or better','Never bet > 2u per play','Stop after 2 losses in a day']
              : style === 'balanced'
              ? ['4-6 bets per day max','Straights + small parlays OK','Mix of favorites and dogs','Max 3u on any single play','Reset after hitting stop loss']
              : ['7+ bets per day allowed','RR bets and parlays welcome','Chase value at any odds','Larger units when confident','Aggressive profit targets']
            ).map(rule => (
              <div key={rule} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span style={{ color: style === 'conservative' ? NEON : style === 'balanced' ? '#F5A623' : RED, fontSize: '10px' }}>▸</span>
                <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', letterSpacing: '0.04em' }}>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <SectionLabel>📝 Today's Recap</SectionLabel>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em' }}>MOOD:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {MOODS.map(m => (
                <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={{
                  fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '2px', cursor: 'pointer',
                  border: `1px solid ${mood === m ? 'rgba(189,255,0,0.5)' : 'var(--border2)'}`,
                  background: mood === m ? 'rgba(189,255,0,0.08)' : 'var(--card)',
                  color: mood === m ? NEON : 'var(--text-dim)', transition: 'all 0.12s',
                }}>{m}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: '✅ What went well today?', val: wentWell, set: setWentWell, placeholder: 'e.g. Stayed disciplined, hit 3/4 picks...' },
            { label: '🔧 What needs improvement?', val: improve, set: setImprove, placeholder: 'e.g. Avoided chasing that late bet...' },
            { label: '⚡ What triggered any bad bets?', val: trigger, set: setTrigger, placeholder: 'e.g. Frustration after loss 2...' },
            { label: '🎓 Main lesson from this session', val: lesson, set: setLesson, placeholder: 'e.g. Trust the process, ignore the noise...' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
              <textarea value={val} onChange={e => set(e.target.value)} placeholder={placeholder} rows={3}
                style={{ ...inputStyle, resize: 'vertical', padding: '10px 12px', fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: '1.5', fontWeight: 400, letterSpacing: '0.02em' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Discipline Score', value: `${score}/100`, color: scoreColor },
            { label: 'Session Grade', value: displayGrade, color: gradeColorMap[displayGrade] },
            { label: 'Record', value: `${stats.wins}W – ${stats.losses}L`, color: 'var(--text)' },
            { label: 'Net P/L', value: fmt$(stats.netUnits * (masterBankroll / 100), true), color: stats.netUnits >= 0 ? NEON : RED },
            { label: 'Checklist', value: `${checksPassed}/${CHECKLIST.length}`, color: allChecked ? NEON : 'var(--muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '10px 14px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '2px', textAlign: 'center' }}>
              <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
              <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function loadSession() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App({ user, session, subStatus }) {
  const { isMobile, isTablet, isLandscape } = useMobile()
  // g(desktop, tablet, mobile) — grid-template-columns helper
  const g = (d, t, m) => isMobile ? m : isTablet ? t : d
  const pad = isMobile ? '10px' : '8px'

  const saved          = useRef(loadSession())
  const [syncing,      setSyncing]      = useState(false)
  const [cloudSynced,  setCloudSynced]  = useState(false)
  const userId = user?.id

  const [darkMode,       setDarkMode]       = useState(saved.current?.darkMode       ?? true)
  const [tiltDismissed,  setTiltDismissed]  = useState(false)
  const [ladderStarting, setLadderStarting] = useState(saved.current?.ladderStarting ?? LADDER_STARTING_BR)
  const [bets,           setBets]           = useState(saved.current?.bets            ?? [])
  const [bankroll,       setBankroll]       = useState(saved.current?.bankroll        ?? 1000)
  const [username,       setUsername]       = useState(saved.current?.username        ?? 'OPERATOR')
  const [sportFilter,  setSportFilter]  = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [sortCol,      setSortCol]      = useState('date')
  const [sortDir,      setSortDir]      = useState('desc')
  const [showAdd,      setShowAdd]      = useState(false)
  const [showShare,    setShowShare]    = useState(false)
  const [shareCopied,  setShareCopied]  = useState(false)
  const [editingBet,   setEditingBet]   = useState(null)
  const [tab,          setTab]          = useState('overview')
  const [riskSettings, setRiskSettings] = useState(saved.current?.riskSettings ?? {
    maxRiskPerBetPct: 3,
    maxRiskTodayPct:  10,
    stopLossPct:      10,
    profitLockPct:    20,
    unitPct:          1,
  })

  const [saveStatus,   setSaveStatus]   = useState(null)  // 'saved' | 'saving' | null
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [templates,    setTemplates]    = useState(() => { try { return JSON.parse(localStorage.getItem(TMPL_KEY) || '[]') } catch { return [] } })
  const [showTemplates,setShowTemplates]= useState(false)

  const [showWelcome,  setShowWelcome]  = useState(false)
  const [welcomeBr,    setWelcomeBr]    = useState('')
  const [showHelp,     setShowHelp]     = useState(false)
  const [showMore,     setShowMore]     = useState(false)
  const [settingsPill, setSettingsPill] = useState(null)
  const [overviewSection, setOverviewSection] = useState('limits')
  const [betLogShowAll,   setBetLogShowAll]   = useState(false)

  // Tab order for swipe navigation
  const TAB_ORDER = ['overview', 'bet log', 'ladder', 'rr engine', 'analytics', 'session', 'partners']
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
  const [masterBrOverride, setMasterBrOverride] = useState(null) // null = auto-follow bets

  const _stats = useMemo(() => calcStats(bets, bankroll), [bets, bankroll])
  const curve  = useMemo(() => buildCurve(bets, bankroll), [bets, bankroll])
  const tilt   = useMemo(() => { setTiltDismissed(false); return calcTilt(bets) }, [bets])

  // Master Bankroll = manual override OR auto-follows P/L from bets
  const masterBankroll = masterBrOverride !== null ? masterBrOverride : _stats.currentBankroll

  // Unit size flows from masterBankroll (grows/shrinks with your balance)
  const stats = useMemo(() => ({
    ..._stats,
    unitSize: masterBankroll * (riskSettings.unitPct ?? 2) / 100,
  }), [_stats, masterBankroll, riskSettings.unitPct])

  const risk  = useMemo(() => calcRisk(bets, masterBankroll, bankroll, riskSettings), [bets, masterBankroll, bankroll, riskSettings])
  const setRS = (k) => (e) => setRiskSettings(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))

  const applyMasterBr = () => {
    setMasterBrFocused(false)
    const v = parseFloat(masterBrInput)
    if (!isNaN(v) && v > 0) setMasterBrOverride(v)
    else setMasterBrOverride(null)
  }

  // ── Auto-save to localStorage whenever key state changes ──
  useEffect(() => {
    const payload = { bets, bankroll, username, ladderStarting, riskSettings, darkMode }
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
  }, [bets, bankroll, username, ladderStarting, riskSettings, darkMode])

  // ── On first load: pull data from Supabase if user is logged in ──
  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setSyncing(true)

      // Load bets from cloud
      const { data: betRows, error: betErr } = await fetchBets(userId)
      if (!betErr && betRows?.length > 0) {
        setBets(betRows.map(rowToBet))
      } else if (!betErr && betRows?.length === 0) {
        // Brand new user — show welcome modal (once)
        const welcomed = localStorage.getItem('rml_welcomed_v1')
        if (!welcomed) setShowWelcome(true)
      }

      // Load settings from cloud
      const { data: settings } = await fetchSettings(userId)
      if (settings) {
        if (settings.bankroll)       setBankroll(settings.bankroll)
        if (settings.ladder_starting) setLadderStarting(settings.ladder_starting)
        if (settings.username)       setUsername(settings.username)
        if (settings.risk_settings)  setRiskSettings(settings.risk_settings)
        if (settings.dark_mode !== undefined) setDarkMode(settings.dark_mode)
      }

      // Load templates from cloud
      const { data: tmplRows } = await fetchTemplates(userId)
      if (tmplRows?.length > 0) {
        setTemplates(tmplRows.map(r => ({ name: r.name, date: r.created_at?.slice(0,10), bankroll: r.bankroll, username: r.username, riskSettings: r.risk_settings })))
      }

      setSyncing(false)
      setCloudSynced(true)
    })()
  }, [userId])

  // ── Auto-sync bets to Supabase (debounced 2s) ──
  useEffect(() => {
    if (!userId || !cloudSynced) return
    const t = setTimeout(() => {
      syncAllBets(bets, userId)
    }, 2000)
    return () => clearTimeout(t)
  }, [bets, userId, cloudSynced])

  // ── Auto-sync settings to Supabase (debounced 2s) ──
  useEffect(() => {
    if (!userId || !cloudSynced) return
    const t = setTimeout(() => {
      upsertSettings(userId, {
        bankroll, ladder_starting: ladderStarting, username,
        risk_settings: riskSettings, dark_mode: darkMode,
      })
    }, 2000)
    return () => clearTimeout(t)
  }, [bankroll, ladderStarting, username, riskSettings, darkMode, userId, cloudSynced])

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
    const payload = { bets, bankroll, username, ladderStarting, riskSettings, darkMode }
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
    setTimeout(() => setSaveStatus('saved'), 400)
    setTimeout(() => setSaveStatus(null), 2400)
  }, [bets, bankroll, username, ladderStarting, riskSettings, darkMode])

  // ── Reset session ──
  const resetSession = useCallback(() => {
    if (!window.confirm('Reset everything to zero? All bets and data will be cleared. This cannot be undone.')) return
    localStorage.removeItem(LS_KEY)
    setBets([])
    setBankroll(0)
    setMasterBrOverride(null)
    setMasterBrInput('')
    setUsername('OPERATOR')
    setLadderStarting(LADDER_STARTING_BR)
    setRiskSettings({ maxRiskPerBetPct: 3, maxRiskTodayPct: 10, stopLossPct: 10, profitLockPct: 20, unitPct: 2 })
    if (userId) deleteAllBets(userId)
  }, [userId])

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
    let b = [...bets]
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
    setBets(prev => prev.map(b => {
      if (b.id !== id) return b
      const unitSize = stats.unitSize
      const pnl = result === 'W'
        ? (b.odds > 0 ? b.units * b.odds / 100 : b.units * 100 / Math.abs(b.odds))
        : result === 'L' ? -b.units : 0
      return { ...b, result, pnl: +pnl.toFixed(2) }
    }))
  }


  const sportBkdn = useMemo(() => {
    const map = {}
    bets.forEach(b => {
      if (!map[b.sport]) map[b.sport] = { sport: b.sport, pnl: 0, bets: 0 }
      map[b.sport].pnl += b.pnl
      map[b.sport].bets++
    })
    return Object.values(map).sort((a, z) => z.bets - a.bets)
  }, [bets])

  const roi = stats.roi
  const up  = v => v >= 0

  const TH = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em',
      color: sortCol === col ? NEON : MUTED, textTransform: 'uppercase',
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
    <div data-theme={darkMode ? 'dark' : 'light'} style={{ backgroundColor: 'var(--bg)', minHeight: '100vh', fontFamily: R, overflowX: 'hidden', maxWidth: '100vw' }}>
      {showAdd && <AddBetModal onAdd={b => setBets(p => [...p, b])} onClose={() => setShowAdd(false)} unitSize={stats.unitSize} />}

      {/* SHARE MODAL */}
      {showShare && (() => {
        const lines = [
          `🎯 RISK MATRIX DASHBOARD — SESSION STATS`,
          `👤 Operator: ${username}`,
          ``,
          `💰 Starting Bankroll: ${fmt$(bankroll)}`,
          `📈 Current Bankroll:  ${fmt$(masterBankroll)}  (${masterBankroll >= bankroll ? '+' : ''}${fmt$(masterBankroll - bankroll)})`,
          `📊 Total P/L:         ${fmt$(stats.netUnits * stats.unitSize, true)}`,
          `🎯 ROI:               ${(stats.roi * 100).toFixed(2)}%`,
          ``,
          `🏆 Record: ${stats.wins}W — ${stats.losses}L (${(stats.winRate * 100).toFixed(1)}% WR)`,
          `⚡ Units Won: ${fmtU(stats.unitsWon)}  |  Units Lost: ${fmtU(-stats.unitsLost)}`,
          `📅 Total Bets: ${stats.total}`,
          ``,
          `🪜 PHLT™ LADDER`,
          ...bets.filter(b => b.ladder).sort((a,z) => a.ladderId - z.ladderId).map(b =>
            `  Rung ${b.ladderId}: ${fmtOdds(b.odds)} odds  $${b.stake}  →  ${b.result === 'Open' ? '⏳ Pending' : b.result === 'W' ? '✅ WIN' : b.result === 'L' ? '❌ LOSS' : '➡️ PUSH'}`
          ),
          ``,
          `Operate With Discipline 🛡️`,
          `riskmatrixlabs.com`,
        ].join('\n')

        const copy = () => {
          navigator.clipboard.writeText(lines).then(() => {
            setShareCopied(true)
            setTimeout(() => setShareCopied(false), 2500)
          })
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}>
            <div style={{ ...cardStyle, width: isMobile ? '100%' : '520px', maxHeight: isMobile ? '90vh' : 'none', overflowY: isMobile ? 'auto' : 'visible', padding: isMobile ? '20px 16px' : '26px 28px', borderTop: `2px solid ${NEON}`, borderRadius: isMobile ? '8px 8px 0 0' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={14} color={NEON} strokeWidth={2} />
                  <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: NEON }}>SHARE SESSION</span>
                </div>
                <button onClick={() => setShowShare(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
              </div>

              {/* Preview */}
              <pre style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-sub)', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px',
                padding: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '320px', overflowY: 'auto', lineHeight: 1.6 }}>
                {lines}
              </pre>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowShare(false)} style={btnStyle()}>Close</button>
                <button onClick={copy} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {shareCopied ? <><CheckCheck size={12} /> Copied!</> : <><Copy size={12} /> Copy to Clipboard</>}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {editingBet && (
        <AddBetModal
          initial={editingBet}
          onAdd={updated => {
            setBets(p => p.map(b => b.id === updated.id ? updated : b))
            setEditingBet(null)
          }}
          onClose={() => setEditingBet(null)}
          unitSize={stats.unitSize}
        />
      )}

      {/* WELCOME MODAL */}
      {showWelcome && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ ...cardStyle, width: '100%', maxWidth: '460px', padding: '30px 32px', borderTop: `2px solid ${NEON}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: '36px' }} />
              <div>
                <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, lineHeight: 1 }}>WELCOME TO RISK MATRIX LABS</div>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.28em', color: 'var(--muted)', marginTop: '3px' }}>OPERATE WITH DISCIPLINE</div>
              </div>
            </div>
            <p style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.6, margin: '16px 0', letterSpacing: '0.04em' }}>
              Set your starting bankroll to calibrate unit sizes, risk limits, and the PHLT™ Ladder.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Starting Bankroll ($)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={welcomeBr}
                onChange={e => setWelcomeBr(e.target.value)}
                autoFocus
                style={{ ...inputStyle, fontSize: '16px', fontWeight: 700, padding: '9px 14px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  const v = parseFloat(welcomeBr)
                  if (!isNaN(v) && v > 0) setBankroll(v)
                  setBets([])
                  localStorage.setItem('rml_welcomed_v1', '1')
                  setShowWelcome(false)
                }}
                style={{ flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '11px', border: `1px solid ${NEON}`, borderRadius: '2px', background: NEON, color: '#0A0A0A', cursor: 'pointer' }}
              >
                Start Fresh
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('rml_welcomed_v1', '1')
                  setShowWelcome(false)
                }}
                style={{ flex: 1, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '11px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                Explore with Sample Data
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>HELP &amp; GUIDE</span>
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
                    color: subStatus.sub.status === 'trialing' ? YELLOW : NEON,
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
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: subStatus.sub.stripe_customer_id, returnUrl: window.location.href }) })
                        const { url } = await res.json()
                        if (url) window.location.href = url
                      } catch {}
                    }}
                    style={{ marginTop: '10px', width: '100%', fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer' }}
                  >
                    Manage Billing →
                  </button>
                )}
              </div>
            )}
            {subStatus?.owner && (
              <div style={{ background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.2)`, borderRadius: '2px', padding: '8px 14px', marginBottom: '18px' }}>
                <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON }}>OWNER ACCOUNT — FULL ACCESS</span>
              </div>
            )}

            {/* Quick Start */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Quick Start</div>
              {[
                'Set your starting bankroll in the header',
                'Log your first bet → Bet Log tab → LOG BET',
                'Run the PHLT™ Ladder → Ladder tab',
                'Check your discipline → Session tab after each session',
                'Analyze your edge → Analytics tab weekly',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: NEON, flexShrink: 0, width: '16px' }}>{i + 1}.</span>
                  <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.5, letterSpacing: '0.03em' }}>{step}</span>
                </div>
              ))}
            </div>

            {/* Tab Guide */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Tab Guide</div>
              {[
                ['Overview', 'Bankroll curve, stats, tilt meter & risk panel'],
                ['Bet Log', 'Log, edit, settle, and filter all your bets'],
                ['Ladder', 'PHLT™ Ladder — step-by-step session roadmap'],
                ['Analytics', 'Charts, ROI, Kelly Criterion, book breakdown'],
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
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>PHLT™ Ladder</div>
              {[
                'Each rung stakes a calculated amount based on your starting bankroll',
                'Pull checkpoints let you lock in profit before climbing the next rung',
                'Complete all 6 rungs to bank the majority — session complete',
              ].map((pt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '7px' }}>
                  <span style={{ color: NEON, flexShrink: 0, marginTop: '1px' }}>·</span>
                  <span style={{ fontFamily: R, fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.5, letterSpacing: '0.03em' }}>{pt}</span>
                </div>
              ))}
            </div>

            {/* Session Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Session Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={() => { saveSession(); setShowHelp(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: saveStatus === 'saved' ? 'rgba(189,255,0,0.12)' : 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.35)`, borderRadius: '2px', cursor: 'pointer', color: NEON, textAlign: 'left' }}>
                  <Save size={12} strokeWidth={2} /> {saveStatus === 'saved' ? 'Saved!' : 'Save Session'}
                </button>
                <button onClick={() => { const s = loadSession(); if (s) { setBets(s.bets||[]); setBankroll(s.bankroll||0); setUsername(s.username||'OPERATOR'); setLadderStarting(s.ladderStarting||150); setRiskSettings(s.riskSettings||{}); setSaveStatus('saved'); setTimeout(()=>setSaveStatus(null),1500) } setShowHelp(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 14px', background: 'var(--card)', border: `1px solid var(--border2)`, borderRadius: '2px', cursor: 'pointer', color: 'var(--text-sub)', textAlign: 'left' }}>
                  <FolderOpen size={12} strokeWidth={2} /> Resume Last Session
                </button>
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
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid var(--border)` }}>Session Reminders</div>
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
                        await fetch('/api/push-subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id }) })
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
                        await fetch('/api/push-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id, subscription: sub.toJSON() }) })
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
              <div style={{ fontFamily: R, fontWeight: 700, fontSize: isMobile ? '13px' : '17px', letterSpacing: '0.22em', color: 'var(--neon-title)', lineHeight: 1, textShadow: 'var(--neon-glow)' }}>RISK MATRIX DASHBOARD</div>
              <div style={{ fontFamily: R, fontWeight: 500, fontSize: '8px', letterSpacing: '0.32em', color: 'var(--neon-sub)', marginTop: '3px' }}>OPERATE WITH DISCIPLINE</div>
            </div>
          </div>
          {/* Mobile: theme + user in logo row */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setDarkMode(d => !d)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid var(--border2)`, backgroundColor: 'var(--card)', cursor: 'pointer' }}>
                {darkMode ? <Sun size={14} color={NEON} strokeWidth={2} /> : <Moon size={14} color='var(--text-sub)' strokeWidth={2} />}
              </button>
              {user && (
                <div data-user-menu style={{ position: 'relative' }}>
                  <button onClick={() => setUserMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '5px 8px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <Lock size={10} color={NEON} strokeWidth={2} />
                  </button>
                  {userMenuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--card2)', border: `1px solid var(--border2)`, borderTop: `2px solid ${NEON}`, borderRadius: '2px', minWidth: '200px', zIndex: 500, padding: '6px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      <div style={{ padding: '8px 16px 10px', borderBottom: `1px solid var(--border)` }}>
                        <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Signed in as</div>
                        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{user.email}</div>
                      </div>
                      {subStatus?.sub && (
                        <div style={{ padding: '8px 16px', borderBottom: `1px solid var(--border)` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subStatus.sub.plan || 'Pro'}</span>
                            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: '2px',
                              background: subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.15)' : 'rgba(189,255,0,0.1)',
                              color: subStatus.sub.status === 'trialing' ? YELLOW : NEON,
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
                                  const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: subStatus.sub.stripe_customer_id, returnUrl: window.location.href }) })
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

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flexWrap: 'nowrap' }}>

          {/* Operator — desktop only; mobile shows user email in the user menu button */}
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Operator</span>
              <input value={username} onChange={e => setUsername(e.target.value)} style={{ ...inputStyle, width: '110px', padding: '5px 10px' }} />
            </div>
          )}

          {/* Desktop-only controls */}
          {!isMobile && <>
            {/* Theme toggle */}
            <button
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid var(--border2)`, backgroundColor: 'var(--card)', cursor: 'pointer', flexShrink: 0, boxShadow: 'var(--card-shadow)' }}
            >
              {darkMode ? <Sun size={14} color={NEON} strokeWidth={2} /> : <Moon size={14} color='var(--text-sub)' strokeWidth={2} />}
            </button>

            {/* Share button */}
            <button onClick={() => setShowShare(true)} title="Share session stats"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', padding: '6px 12px', border: `1px solid rgba(189,255,0,0.4)`, borderRadius: '2px', background: 'rgba(189,255,0,0.08)', color: NEON, cursor: 'pointer', textTransform: 'uppercase' }}>
              <Share2 size={12} strokeWidth={2} /> Share
            </button>
          </>}

          {/* Share on mobile — icon only */}
          {isMobile && (
            <button onClick={() => setShowShare(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: `1px solid rgba(189,255,0,0.4)`, background: 'rgba(189,255,0,0.08)', cursor: 'pointer' }}>
              <Share2 size={13} color={NEON} strokeWidth={2} />
            </button>
          )}

          {/* Help button — mobile */}
          {isMobile && (
            <button data-help-btn onClick={() => setShowHelp(h => !h)} title="Help & Guide"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: showHelp ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, background: showHelp ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer' }}>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: showHelp ? NEON : 'var(--text-dim)' }}>?</span>
            </button>
          )}

          {/* Help button — desktop */}
          {!isMobile && (
            <button data-help-btn onClick={() => setShowHelp(h => !h)} title="Help & Guide"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '2px', border: showHelp ? `1px solid rgba(189,255,0,0.6)` : `1px solid var(--border2)`, backgroundColor: showHelp ? 'rgba(189,255,0,0.1)' : 'var(--card)', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: showHelp ? NEON : 'var(--text-dim)' }}>?</span>
            </button>
          )}

          {/* Desktop: sync + user menu + version */}
          {!isMobile && <>
            {syncing && (
              <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: YELLOW, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RefreshCcw size={10} style={{ animation: 'spin 1s linear infinite' }} /> Syncing
              </span>
            )}
            {user && (
              <div data-user-menu style={{ position: 'relative' }}>
                <button onClick={() => setUserMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '5px 10px', border: `1px solid var(--border2)`, borderRadius: '2px', background: 'var(--card)', color: 'var(--text-dim)', cursor: 'pointer', maxWidth: '180px' }} title={user.email}>
                  <Lock size={10} color={NEON} strokeWidth={2} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{user.email?.split('@')[0].toUpperCase()}</span>
                </button>
                {userMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--card2)', border: `1px solid var(--border2)`, borderTop: `2px solid ${NEON}`, borderRadius: '2px', minWidth: '220px', zIndex: 500, padding: '6px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div style={{ padding: '8px 16px 10px', borderBottom: `1px solid var(--border)` }}>
                      <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Signed in as</div>
                      <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{user.email}</div>
                    </div>
                    {/* Subscription info in user menu */}
                    {subStatus?.sub && (
                      <div style={{ padding: '8px 16px', borderBottom: `1px solid var(--border)` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{subStatus.sub.plan || 'Pro'}</span>
                          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: '2px',
                            background: subStatus.sub.status === 'trialing' ? 'rgba(245,166,35,0.15)' : 'rgba(189,255,0,0.1)',
                            color: subStatus.sub.status === 'trialing' ? YELLOW : NEON,
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
                                const res = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: subStatus.sub.stripe_customer_id, returnUrl: window.location.href }) })
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
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--neon-sub)' }}>v2.4</span>
          </>}
        </div>
      </header>

      {/* TABS — desktop only */}
      {!isMobile && (
        <div style={{ borderBottom: `1px solid var(--border)`, padding: '0 28px', display: 'flex', backgroundColor: 'var(--bg)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[['overview','Stats'],['bet log','Bet Log'],['ladder','Ladder'],['analytics','Overview'],['rr engine','RR Engine'],['session','Session'],['partners','Partners']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} data-active={tab === t} style={{
              fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em',
              textTransform: 'uppercase', padding: '11px 20px',
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: tab === t ? NEON : 'var(--text-dim)',
              borderBottom: tab === t ? `2px solid ${NEON}` : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.15s',
              textShadow: tab === t && darkMode ? '0 0 14px rgba(189,255,0,0.3)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* TILT BANNER — always visible when triggered */}
      <div style={{ padding: `6px ${pad} 0` }}>
        <TiltBanner tilt={tilt} dismissed={tiltDismissed} onDismiss={() => setTiltDismissed(true)} />
      </div>


      {/* CONTENT */}
      <div {...(isMobile ? swipeHandlers : {})}
        className={isMobile ? 'content-with-bottom-nav' : ''}
        style={{ padding: isMobile ? '8px 10px 0' : `4px ${pad} 0`, overflowX: 'hidden', width: '100%', boxSizing: 'border-box', animation: 'tabIn 0.18s ease', touchAction: 'pan-y' }}
        key={tab}
      >

      {/* OPEN BETS LIVE BANNER — mobile only, overview only */}
      {isMobile && tab === 'overview' && stats.openBets > 0 && (
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
              <div style={{ ...cardStyle, padding: '12px 14px', marginBottom: '6px', borderTop: `2px solid ${up(masterBankroll - bankroll) ? NEON : RED}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>Master Bankroll</div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {masterBrOverride !== null && <button onClick={() => { setMasterBrOverride(null); setMasterBrInput('') }} style={{ fontFamily: R, fontSize: '7px', color: YELLOW, background: 'none', border: `1px solid rgba(245,166,35,0.35)`, borderRadius: '2px', cursor: 'pointer', padding: '0 4px' }}>↺ AUTO</button>}
                    <span style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)' }}>1u = <strong style={{ color: 'var(--text)' }}>{fmt$(stats.unitSize)}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <input value={masterBrFocused ? masterBrInput : masterBankroll.toFixed(2)}
                    onFocus={() => { setMasterBrFocused(true); setMasterBrInput(masterBankroll.toFixed(2)) }}
                    onChange={e => setMasterBrInput(e.target.value)} onBlur={applyMasterBr}
                    onKeyDown={e => e.key === 'Enter' && applyMasterBr()}
                    style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, lineHeight: 1, background: 'none', border: 'none', padding: 0, width: '100%', cursor: 'text', color: up(masterBankroll - bankroll) ? NEON : RED }} />
                  <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: up(masterBankroll - bankroll) ? NEON : RED, whiteSpace: 'nowrap' }}>
                    {up(masterBankroll - bankroll) ? '+' : ''}{fmt$(masterBankroll - bankroll)}
                  </div>
                </div>
                <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>
                  started {fmt$(bankroll)} · {up(masterBankroll - bankroll) ? '+' : ''}{((masterBankroll - bankroll) / bankroll * 100).toFixed(1)}% all time
                </div>
              </div>

              {(() => {
                const pills = [
                  { id: 'limits',      label: 'BR Limits' },
                  { id: 'curve',       label: 'BR Curve' },
                  { id: 'performance', label: 'Performance' },
                  { id: 'exposure',    label: 'Risk Exposure', dot: risk.health !== 'GOOD' ? (risk.health === 'CAUTION' ? YELLOW : RED) : null },
                  { id: 'riskset',     label: 'Risk Settings' },
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

              {overviewSection === 'curve' && (
                <div style={{ ...cardStyle, padding: '14px 14px 10px', maxHeight: '60vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <SectionLabel icon={BarChart3}>Bankroll Curve</SectionLabel>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Start: <strong style={{ color: 'var(--text)' }}>{fmt$(bankroll)}</strong></span>
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Now: <strong style={{ color: up(masterBankroll-bankroll) ? NEON : RED }}>{fmt$(masterBankroll)}</strong></span>
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
                      <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={42} />
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
                        <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: val >= target ? NEON : 'var(--text-sub)' }}>{disp}</span>
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
                    {risk.health === 'GOOD' ? <ShieldCheck size={20} color={NEON} strokeWidth={2} /> : risk.health === 'CAUTION' ? <AlertTriangle size={20} color={YELLOW} strokeWidth={2} /> : <ShieldAlert size={20} color={RED} strokeWidth={2} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED }}>
                        {risk.health === 'GOOD' ? 'BANKROLL HEALTHY' : risk.health === 'CAUTION' ? 'USE CAUTION' : 'DANGER ZONE'}
                      </div>
                      <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>Tilt: <span style={{ color: tilt.level === 'GREEN' ? NEON : tilt.level === 'YELLOW' ? YELLOW : RED, fontWeight: 700 }}>{tilt.level === 'GREEN' ? 'IN CONTROL' : tilt.level === 'YELLOW' ? 'WATCH YOURSELF' : 'STOP BETTING'}</span></div>
                    </div>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED }}>{risk.currentRiskPct.toFixed(1)}%</div>
                  </div>
                  <div style={{ ...cardStyle, padding: '10px 14px' }}>
                    <div style={{ height: '7px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, risk.currentRiskPct * 5)}%`, background: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED, borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: R, fontSize: '8px', color: NEON }}>SAFE 0–10%</span>
                      <span style={{ fontFamily: R, fontSize: '8px', color: YELLOW }}>CAUTION</span>
                      <span style={{ fontFamily: R, fontSize: '8px', color: RED }}>DANGER 20%+</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { label: 'Max Per Bet', value: fmt$(risk.maxRiskPerBet$), sub: `${riskSettings.maxRiskPerBetPct}% of bankroll`, color: 'var(--text)' },
                      { label: 'Daily Cap',   value: fmt$(risk.maxRiskCap$),    sub: `${riskSettings.maxRiskTodayPct}% cap`,          color: 'var(--text)' },
                      { label: 'Open Now',    value: fmt$(risk.totalOpenRisk),  sub: `${stats.openBets} active`,                      color: stats.openBets > 0 ? YELLOW : 'var(--text)' },
                      { label: 'Remaining',   value: fmt$(risk.remainingRisk$), sub: 'capacity left',                                 color: risk.remainingRisk$ <= 0 ? RED : NEON },
                    ].map(({ label, value, sub, color }) => (
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
                      <div style={{ fontFamily: R, fontSize: '9px', color: RED, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Stop Loss</div>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: RED }}>-{fmt$(risk.stopLoss$)}</div>
                      <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>{riskSettings.stopLossPct ?? 10}% · walk away</div>
                    </div>
                    <div style={{ padding: '10px 12px', border: `1px solid rgba(189,255,0,0.28)`, background: 'rgba(189,255,0,0.05)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontFamily: R, fontSize: '9px', color: NEON, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Profit Lock</div>
                      <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: NEON }}>+{fmt$(risk.profitLock$)}</div>
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
                      { label: 'CONSERVATIVE', vals: { unitPct:1,maxRiskPerBetPct:2,maxRiskTodayPct:6,stopLossPct:8,profitLockPct:15 }, color: NEON },
                      { label: 'BALANCED',     vals: { unitPct:2,maxRiskPerBetPct:3,maxRiskTodayPct:10,stopLossPct:10,profitLockPct:20 }, color: YELLOW },
                      { label: 'AGGRESSIVE',   vals: { unitPct:3,maxRiskPerBetPct:5,maxRiskTodayPct:15,stopLossPct:15,profitLockPct:25 }, color: RED },
                    ].map(({ label, vals, color }) => (
                      <button key={label} onClick={() => setRiskSettings(vals)} style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', padding: '9px 4px', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase', border: `1px solid ${color === NEON ? 'rgba(189,255,0,0.4)' : color === YELLOW ? 'rgba(245,166,35,0.4)' : 'rgba(255,59,59,0.4)'}`, background: color === NEON ? 'rgba(189,255,0,0.07)' : color === YELLOW ? 'rgba(245,166,35,0.07)' : 'rgba(255,59,59,0.07)', color }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Unit Size',   key: 'unitPct',          desc: 'per unit' },
                      { label: 'Max Bet',     key: 'maxRiskPerBetPct', desc: 'per bet' },
                      { label: 'Daily Max',   key: 'maxRiskTodayPct',  desc: 'daily cap' },
                      { label: 'Stop Loss',   key: 'stopLossPct',      desc: 'walk away' },
                      { label: 'Profit Lock', key: 'profitLockPct',    desc: 'lock in' },
                    ].map(({ label, key, desc }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)' }}>{label}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: stats.openBets > 0 ? `2px solid ${YELLOW}` : undefined }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Open Risk</div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: stats.openBets > 0 ? YELLOW : 'var(--text)', lineHeight: 1 }}>{fmt$(stats.openRisk$)}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.openBets > 0 ? `${stats.openBets} pending` : 'none open'}</div>
                </div>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${up(stats.netUnits) ? NEON : RED}` }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total P / L</div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: up(stats.netUnits) ? NEON : RED, lineHeight: 1 }}>{fmt$(stats.netUnits * stats.unitSize, true)}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{fmtU(stats.netUnits)} net units</div>
                </div>
              </div>

              {/* ── ROI + W/L + Win Rate in one row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${up(roi) ? NEON : RED}` }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>ROI<InfoTip text="Return on units risked across all settled bets." /></div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: up(roi) ? NEON : RED, lineHeight: 1 }}>{roi >= 0 ? '+' : ''}{(roi * 100).toFixed(1)}%</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>{stats.total} bets</div>
                </div>
                <div style={{ ...cardStyle, padding: '10px 12px' }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>W / L</div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stats.wins} — {stats.losses}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>record</div>
                </div>
                <div style={{ ...cardStyle, padding: '10px 12px', borderTop: `2px solid ${stats.winRate >= 0.525 ? NEON : 'transparent'}` }}>
                  <div style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Win Rate<InfoTip text="52.5% is breakeven at -110 odds. Above is profitable." /></div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: stats.winRate >= 0.525 ? NEON : 'var(--text)', lineHeight: 1 }}>{(stats.winRate * 100).toFixed(1)}%</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '3px' }}>target 52.5%</div>
                </div>
              </div>


              {/* ── 8 small stat chips ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', marginBottom: '10px', marginTop: '2px' }}>
                <SmallCard label="Units +"    value={fmtU(stats.unitsWon)}   color={NEON} />
                <SmallCard label="Units –"    value={fmtU(-stats.unitsLost)} color={RED} />
                <SmallCard label="Avg Odds"   value={fmtOdds(Math.round(stats.avgOdds))} />
                <SmallCard label="Settled"    value={String(stats.total)} />
                <SmallCard label="Best Win"   value={fmt$(stats.largestWin * stats.unitSize)}  color={NEON} />
                <SmallCard label="Worst Loss" value={fmt$(stats.largestLoss * stats.unitSize)} color={RED} />
                <SmallCard label="Risked"     value={`${stats.totalUnits.toFixed(0)}u`} />
                <SmallCard label="Unit $"     value={fmt$(stats.unitSize)} />
              </div>

            </>
          ) : (
            /* ══ DESKTOP OVERVIEW — unchanged ══ */
            <>
          {/* ── ROW 1: 5 primary stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px', marginBottom: '6px' }}>
            <div style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>Starting Bankroll</span>
                <Wallet size={11} color='var(--muted)' strokeWidth={2} />
              </div>
              <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{fmt$(bankroll)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>1u = {fmt$(stats.unitSize)}</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: `1px solid ${up(masterBankroll - bankroll) ? 'rgba(189,255,0,0.5)' : 'rgba(255,59,59,0.5)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>Current Bankroll</span>
                  {masterBrOverride !== null && <span style={{ fontFamily: R, fontSize: '7px', color: YELLOW, border: `1px solid ${YELLOW}`, padding: '0 3px', borderRadius: '2px' }}>MANUAL</span>}
                </div>
                {up(masterBankroll - bankroll) ? <ArrowUpRight size={13} color={NEON} /> : <ArrowDownRight size={13} color={RED} />}
              </div>
              <input value={masterBrFocused ? masterBrInput : masterBankroll.toFixed(2)}
                onFocus={() => { setMasterBrFocused(true); setMasterBrInput(masterBankroll.toFixed(2)) }}
                onChange={e => setMasterBrInput(e.target.value)} onBlur={applyMasterBr}
                onKeyDown={e => e.key === 'Enter' && applyMasterBr()}
                style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, lineHeight: 1, background: 'none', border: 'none', padding: 0, width: '100%', cursor: 'text',
                  color: up(masterBankroll - bankroll) ? NEON : RED,
                  textShadow: darkMode && up(masterBankroll - bankroll) ? '0 0 16px rgba(189,255,0,0.3)' : 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                <div>
                  <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: up(masterBankroll - bankroll) ? NEON : RED }}>{up(masterBankroll - bankroll) ? '+' : ''}{fmt$(masterBankroll - bankroll)}</span>
                  <span style={{ fontFamily: R, fontSize: '11px', color: up(masterBankroll - bankroll) ? NEON : RED, marginLeft: '5px', opacity: 0.7 }}>({up(masterBankroll - bankroll) ? '+' : ''}{((masterBankroll - bankroll) / bankroll * 100).toFixed(1)}%)</span>
                </div>
                {masterBrOverride !== null && (
                  <button onClick={() => { setMasterBrOverride(null); setMasterBrInput('') }}
                    style={{ fontFamily: R, fontSize: '8px', color: YELLOW, background: 'none', border: `1px solid rgba(245,166,35,0.35)`, borderRadius: '2px', cursor: 'pointer', padding: '1px 6px' }}>↺ auto</button>
                )}
              </div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: stats.openBets > 0 ? `1px solid rgba(245,166,35,0.5)` : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>Open Risk</span>
                <Clock size={11} color={stats.openBets > 0 ? YELLOW : 'var(--muted)'} strokeWidth={2} />
              </div>
              <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, color: stats.openBets > 0 ? YELLOW : 'var(--text)', lineHeight: 1 }}>{fmt$(stats.openRisk$)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>{stats.openBets > 0 ? `${stats.openBets} bet${stats.openBets > 1 ? 's' : ''} pending` : 'no open bets'}</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: `1px solid ${up(stats.netUnits) ? 'rgba(189,255,0,0.4)' : 'rgba(255,59,59,0.4)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>Total P / L</span>
                {up(stats.netUnits) ? <TrendingUp size={13} color={NEON} /> : <TrendingDown size={13} color={RED} />}
              </div>
              <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, lineHeight: 1, color: up(stats.netUnits) ? NEON : RED,
                textShadow: darkMode && up(stats.netUnits) ? '0 0 16px rgba(189,255,0,0.28)' : 'none' }}>{fmt$(stats.netUnits * stats.unitSize, true)}</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>{fmtU(stats.netUnits)} net units</div>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', borderTop: `1px solid ${up(roi) ? 'rgba(189,255,0,0.4)' : 'rgba(255,59,59,0.4)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>ROI</span>
                <Target size={11} color={up(roi) ? NEON : RED} strokeWidth={2} />
              </div>
              <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, lineHeight: 1, color: up(roi) ? NEON : RED }}>{roi >= 0 ? '+' : ''}{(roi * 100).toFixed(2)}%</div>
              <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>{stats.total} settled bets</div>
            </div>
          </div>

          {/* ── ROW 2: 8 small stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: g('repeat(8,1fr)', 'repeat(4,1fr)', 'repeat(2,1fr)'), gap: '6px', marginBottom: '8px' }}>
            <SmallCard label="W / L"        value={`${stats.wins} — ${stats.losses}`} />
            <SmallCard label="Win Rate"     value={`${(stats.winRate * 100).toFixed(1)}%`} color={stats.winRate >= 0.525 ? NEON : undefined} />
            <SmallCard label="Units Won"    value={fmtU(stats.unitsWon)}   color={NEON} />
            <SmallCard label="Units Lost"   value={fmtU(-stats.unitsLost)} color={RED} />
            <SmallCard label="Avg Odds"     value={fmtOdds(Math.round(stats.avgOdds))} />
            <SmallCard label="Largest Win"  value={fmt$(stats.largestWin * stats.unitSize)}  color={NEON} />
            <SmallCard label="Largest Loss" value={fmt$(stats.largestLoss * stats.unitSize)} color={RED} />
            <SmallCard label="Units Risked" value={`${stats.totalUnits.toFixed(1)}u`} />
          </div>
            </>
          )}

          {/* ── ROW 3: Bankroll Curve + Performance — desktop only ── */}
          {!isMobile && <>
          <div style={{ display: 'grid', gridTemplateColumns: g('2fr 1fr', '1fr', '1fr'), gap: '6px' }}>
            <div style={{ ...cardStyle, padding: '16px 18px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <SectionLabel icon={BarChart3}>Bankroll Curve</SectionLabel>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Start: <strong style={{ color: 'var(--text)' }}>{fmt$(bankroll)}</strong></span>
                  <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>Now: <strong style={{ color: up(masterBankroll - bankroll) ? NEON : RED }}>{fmt$(masterBankroll)}</strong></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tick={{ fontFamily: R, fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} width={46} />
                  <Tooltip content={<BankrollTip />} />
                  <ReferenceLine y={bankroll} stroke="var(--border2)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="value" stroke={NEON} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: NEON, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <SectionLabel icon={Target}>Performance</SectionLabel>
              {[
                { label: 'Win Rate',   val: stats.winRate,                              target: 0.525, disp: `${(stats.winRate * 100).toFixed(1)}%` },
                { label: 'ROI',        val: Math.min(1, Math.max(0, roi + 0.3) / 0.6), target: 0.5,   disp: `${(roi * 100).toFixed(1)}%` },
                { label: 'Discipline', val: Math.min(1, stats.total / 30),              target: 0.8,   disp: `${Math.round(Math.min(1, stats.total / 30) * 100)}/100` },
              ].map(({ label, val, target, disp }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: val >= target ? NEON : 'var(--text-sub)' }}>{disp}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, val * 100)}%`, background: val >= target ? NEON : 'var(--border2)', borderRadius: '2px',
                      boxShadow: val >= target && darkMode ? '0 0 7px rgba(189,255,0,0.4)' : 'none', transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid var(--border)`, paddingTop: '12px', marginTop: 'auto' }}>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Unit Sizes</div>
                {[[1,'1u'],[2,'2u'],[3,'3u']].map(([m,l]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontFamily: R, fontSize: '11px', color: 'var(--muted)' }}>{l}</span>
                    <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * m)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* ── ROW 4: RISK PANEL (3 columns: Exposure | Master Bankroll + Limits | Settings) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: g('1fr 1fr 1fr', '1fr 1fr', '1fr'), gap: '6px', marginBottom: '6px' }}>

            {/* ── COL 1: Risk Exposure ── */}
            <div style={{ ...cardStyle, padding: '16px 18px' }}>
              <SectionLabel icon={Crosshair}>Risk Exposure</SectionLabel>
              {/* Health status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '12px', borderRadius: '2px',
                background: risk.health === 'GOOD' ? 'rgba(189,255,0,0.05)' : risk.health === 'CAUTION' ? 'rgba(245,166,35,0.05)' : 'rgba(255,59,59,0.05)',
                border: `1px solid ${risk.health === 'GOOD' ? 'rgba(189,255,0,0.22)' : risk.health === 'CAUTION' ? 'rgba(245,166,35,0.25)' : 'rgba(255,59,59,0.25)'}` }}>
                {risk.health === 'GOOD' ? <ShieldCheck size={18} color={NEON} strokeWidth={2} /> : risk.health === 'CAUTION' ? <AlertTriangle size={18} color={YELLOW} strokeWidth={2} /> : <ShieldAlert size={18} color={RED} strokeWidth={2} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED }}>
                    {risk.health === 'GOOD' ? 'BANKROLL HEALTHY' : risk.health === 'CAUTION' ? 'USE CAUTION' : 'DANGER ZONE'}
                  </div>
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>
                    Tilt: <span style={{ color: tilt.level === 'GREEN' ? NEON : tilt.level === 'YELLOW' ? YELLOW : RED, fontWeight: 700 }}>
                      {tilt.level === 'GREEN' ? 'IN CONTROL' : tilt.level === 'YELLOW' ? 'WATCH YOURSELF' : 'STOP BETTING'}
                    </span>
                  </div>
                </div>
                <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED }}>
                  {risk.currentRiskPct.toFixed(1)}%
                </div>
              </div>
              {/* Risk bar */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ height: '7px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, risk.currentRiskPct * 5)}%`,
                    background: risk.health === 'GOOD' ? NEON : risk.health === 'CAUTION' ? YELLOW : RED,
                    borderRadius: '3px', transition: 'width 0.5s',
                    boxShadow: darkMode ? `0 0 8px ${risk.health === 'GOOD' ? 'rgba(189,255,0,0.4)' : risk.health === 'CAUTION' ? 'rgba(245,166,35,0.4)' : 'rgba(255,59,59,0.4)'}` : 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontFamily: R, fontSize: '8px', color: NEON, letterSpacing: '0.1em' }}>SAFE 0–10%</span>
                  <span style={{ fontFamily: R, fontSize: '8px', color: YELLOW, letterSpacing: '0.1em' }}>CAUTION</span>
                  <span style={{ fontFamily: R, fontSize: '8px', color: RED, letterSpacing: '0.1em' }}>DANGER 20%+</span>
                </div>
              </div>
              {/* 4 dollar boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { label: 'Max Per Bet',   value: fmt$(risk.maxRiskPerBet$), sub: `${riskSettings.maxRiskPerBetPct}% of bankroll`, color: 'var(--text)' },
                  { label: 'Daily Cap',     value: fmt$(risk.maxRiskCap$),    sub: `${riskSettings.maxRiskTodayPct}% cap`,           color: 'var(--text)' },
                  { label: 'Open Now',      value: fmt$(risk.totalOpenRisk),  sub: `${stats.openBets} active bets`,                  color: stats.openBets > 0 ? YELLOW : 'var(--text)' },
                  { label: 'Remaining',     value: fmt$(risk.remainingRisk$), sub: 'capacity left',                                  color: risk.remainingRisk$ <= 0 ? RED : NEON },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} style={{ padding: '9px 11px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px' }}>
                    <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', marginTop: '2px' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── COL 2: Master Bankroll + Limits ── */}
            <div style={{ ...cardStyle, padding: '16px 18px' }}>
              <SectionLabel icon={Wallet}>Bankroll Limits</SectionLabel>
              {/* Master bankroll input */}
              <div style={{ padding: '12px 14px', background: 'var(--card2)', border: `1px solid var(--neon-border)`, borderRadius: '2px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--neon-accent)', textTransform: 'uppercase' }}>Master Bankroll</span>
                  {masterBrOverride !== null && (
                    <button onClick={() => { setMasterBrOverride(null); setMasterBrInput('') }}
                      style={{ fontFamily: R, fontSize: '8px', color: YELLOW, background: 'none', border: `1px solid rgba(245,166,35,0.4)`, borderRadius: '2px', cursor: 'pointer', padding: '1px 6px' }}>
                      ↺ AUTO
                    </button>
                  )}
                </div>
                <input
                  value={masterBrFocused ? masterBrInput : masterBankroll.toFixed(2)}
                  onFocus={() => { setMasterBrFocused(true); setMasterBrInput(masterBankroll.toFixed(2)) }}
                  onChange={e => setMasterBrInput(e.target.value)}
                  onBlur={applyMasterBr}
                  onKeyDown={e => e.key === 'Enter' && applyMasterBr()}
                  style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, background: 'none', border: 'none', padding: '0', width: '100%', cursor: 'text',
                    color: up(masterBankroll - bankroll) ? NEON : RED,
                    textShadow: darkMode && up(masterBankroll - bankroll) ? '0 0 16px rgba(189,255,0,0.28)' : 'none' }}
                />
                <div style={{ marginTop: '7px' }}>
                  <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color: up(masterBankroll - bankroll) ? NEON : RED,
                    textShadow: darkMode && up(masterBankroll - bankroll) ? '0 0 10px rgba(189,255,0,0.25)' : 'none' }}>
                    {up(masterBankroll - bankroll) ? '+' : ''}{fmt$(masterBankroll - bankroll)}
                    <span style={{ fontSize: '12px', marginLeft: '6px', opacity: 0.75 }}>
                      ({up(masterBankroll - bankroll) ? '+' : ''}{((masterBankroll - bankroll) / bankroll * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', marginTop: '2px' }}>from starting {fmt$(bankroll)}</div>
                </div>
              </div>
              {/* Stop loss + profit lock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <div style={{ padding: '10px 12px', border: `1px solid rgba(255,59,59,0.3)`, background: 'rgba(255,59,59,0.05)', borderRadius: '2px' }}>
                  <div style={{ fontFamily: R, fontSize: '9px', color: RED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Stop Loss<InfoTip text="Walk away when your session loss hits this amount." /></div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: RED }}>-{fmt$(risk.stopLoss$)}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>walk away trigger</div>
                </div>
                <div style={{ padding: '10px 12px', border: `1px solid rgba(189,255,0,0.28)`, background: 'rgba(189,255,0,0.05)', borderRadius: '2px' }}>
                  <div style={{ fontFamily: R, fontSize: '9px', color: NEON, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>Profit Lock<InfoTip text="Lock in gains — stop betting once you're up this much." /></div>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: NEON, textShadow: darkMode ? '0 0 10px rgba(189,255,0,0.25)' : 'none' }}>+{fmt$(risk.profitLock$)}</div>
                  <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>protect your gains</div>
                </div>
              </div>
              {/* Unit reference */}
              <div style={{ borderTop: `1px solid var(--border)`, paddingTop: '12px' }}>
                <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Unit Reference</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px' }}>
                  {[['0.5u', 0.5], ['1u', 1], ['2u', 2], ['3u', 3], ['4u', 4], ['5u', 5]].map(([label, mult]) => (
                    <div key={label} style={{ padding: '5px 8px', background: 'var(--card2)', border: `1px solid var(--border)`, borderRadius: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text-sub)' }}>{fmt$(stats.unitSize * mult)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── COL 3: Risk Settings ── */}
            <div style={{ ...cardStyle, padding: '16px 18px' }}>
              <SectionLabel icon={Sliders}>Risk Settings</SectionLabel>
              {/* Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px', marginBottom: '14px' }}>
                {[
                  { label: 'CONSERVATIVE', vals: { unitPct: 1, maxRiskPerBetPct: 2, maxRiskTodayPct: 6,  stopLossPct: 8,  profitLockPct: 15 }, color: NEON },
                  { label: 'BALANCED',     vals: { unitPct: 2, maxRiskPerBetPct: 3, maxRiskTodayPct: 10, stopLossPct: 10, profitLockPct: 20 }, color: YELLOW },
                  { label: 'AGGRESSIVE',   vals: { unitPct: 3, maxRiskPerBetPct: 5, maxRiskTodayPct: 15, stopLossPct: 15, profitLockPct: 25 }, color: RED },
                ].map(({ label, vals, color }) => (
                  <button key={label} onClick={() => setRiskSettings(vals)} style={{
                    fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', padding: '8px 4px',
                    borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase',
                    border: `1px solid ${color === NEON ? 'rgba(189,255,0,0.4)' : color === YELLOW ? 'rgba(245,166,35,0.4)' : 'rgba(255,59,59,0.4)'}`,
                    background: color === NEON ? 'rgba(189,255,0,0.07)' : color === YELLOW ? 'rgba(245,166,35,0.07)' : 'rgba(255,59,59,0.07)',
                    color,
                  }}>{label}</button>
                ))}
              </div>
              {/* Settings — dollar first, % small */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Unit Size',   key: 'unitPct',          desc: 'per 1 unit', tip: 'Your standard bet size — X% of master bankroll.' },
                  { label: 'Max Bet',     key: 'maxRiskPerBetPct', desc: 'per bet' },
                  { label: 'Daily Max',   key: 'maxRiskTodayPct',  desc: 'daily cap' },
                  { label: 'Stop Loss',   key: 'stopLossPct',      desc: 'walk away', tip: 'Walk away when your session loss hits this amount.' },
                  { label: 'Profit Lock', key: 'profitLockPct',    desc: 'lock in', tip: "Lock in gains — stop betting once you're up this much." },
                ].map(({ label, key, desc, tip }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, color: 'var(--text-sub)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center' }}>{label}{tip && <InfoTip text={tip} />}</div>
                      <div style={{ fontFamily: R, fontSize: '8px', color: 'var(--text-dim)', marginTop: '1px' }}>{desc}</div>
                    </div>
                    <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: NEON, minWidth: '62px', textAlign: 'right',
                      textShadow: darkMode ? '0 0 8px rgba(189,255,0,0.2)' : 'none' }}>
                      {fmt$(masterBankroll * (riskSettings[key] / 100))}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input type="number" min="0" max="100" step="0.5" value={riskSettings[key]} onChange={setRS(key)}
                        style={{ ...inputStyle, width: '46px', padding: '4px 6px', textAlign: 'center', fontSize: '12px' }} />
                      <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', fontWeight: 600 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>        </> /* end details-only section */}
        </>}

        {/* ── BET LOG ── */}
        {tab === 'bet log' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase', marginRight: '3px' }}>🏟️ Sport</span>
                <select
                  value={sportFilter}
                  onChange={e => setSportFilter(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '4px 28px 4px 10px', fontSize: '11px', fontWeight: 700,
                    color: sportFilter !== 'ALL' ? NEON : 'var(--text-sub)',
                    border: sportFilter !== 'ALL' ? `1px solid rgba(189,255,0,0.5)` : `1px solid var(--border2)`,
                    backgroundImage: 'none', cursor: 'pointer' }}
                >
                  <option value="ALL">All Sports</option>
                  {['NFL','NBA','MLB','NHL','CFB','Soccer','UFC/MMA','Boxing','Tennis','Golf','NCAA BB','NASCAR','Cricket','Rugby','Other'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {/* Show current filter if it's a custom sport not in the list */}
                  {!['ALL','NFL','NBA','MLB','NHL','CFB','Soccer','UFC/MMA','Boxing','Tennis','Golf','NCAA BB','NASCAR','Cricket','Rugby','Other'].includes(sportFilter) && (
                    <option value={sportFilter}>{sportFilter}</option>
                  )}
                </select>
                <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: MUTED, textTransform: 'uppercase', marginLeft: '10px', marginRight: '3px' }}>Result</span>
                {RESULTS.map(r => <button key={r} onClick={() => setResultFilter(r)} style={{
                  ...btnStyle(resultFilter === r),
                  color: resultFilter === r ? NEON
                    : r === 'OPEN' ? (resultFilter === r ? NEON : YELLOW)
                    : r === 'W'    ? 'rgba(189,255,0,0.55)'
                    : r === 'L'    ? 'rgba(255,59,59,0.55)'
                    : 'var(--text-sub)',
                  borderColor: r === 'OPEN' && resultFilter !== r ? 'rgba(245,166,35,0.35)' : undefined,
                }}>{r}{r === 'OPEN' && stats.openBets > 0 ? ` (${stats.openBets})` : ''}</button>)}
              </div>
              <button onClick={() => setShowAdd(true)} style={{ ...btnStyle(true), display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Plus size={11} /> LOG BET
              </button>
            </div>

            {/* ── Mobile card view ── */}
            {isMobile && (
              <div>
                {(betLogShowAll ? filtered : filtered.slice(0, 10)).map((bet) => {
                  const isOpen = bet.result === 'Open'
                  const resultColor = bet.result === 'W' ? NEON : bet.result === 'L' ? RED : MUTED
                  return (
                    <div key={bet.id} style={{
                      ...cardStyle, marginBottom: '6px', padding: '10px 12px',
                      borderLeft: isOpen ? `3px solid rgba(245,166,35,0.6)` : bet.result === 'W' ? `3px solid rgba(189,255,0,0.4)` : bet.result === 'L' ? `3px solid rgba(255,59,59,0.4)` : `3px solid var(--border)`,
                    }}>
                      {/* Row 1: pick + result badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: 'var(--text)', flex: 1, marginRight: '8px', lineHeight: 1.2 }}>{bet.pick || '—'}</div>
                        {isOpen ? (
                          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: YELLOW, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', padding: '2px 7px', borderRadius: '2px', flexShrink: 0 }}>OPEN</span>
                        ) : (
                          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: resultColor, background: bet.result === 'W' ? 'rgba(189,255,0,0.07)' : bet.result === 'L' ? 'rgba(255,59,59,0.07)' : 'var(--card2)', border: `1px solid ${bet.result === 'W' ? 'rgba(189,255,0,0.2)' : bet.result === 'L' ? 'rgba(255,59,59,0.2)' : 'var(--border)'}`, padding: '2px 7px', borderRadius: '2px', flexShrink: 0 }}>
                            {bet.result === 'W' ? 'WIN' : bet.result === 'L' ? 'LOSS' : bet.result === 'P' ? 'PUSH' : bet.result}
                          </span>
                        )}
                      </div>
                      {/* Row 2: sport, book, event, date */}
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '7px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: '2px' }}>{bet.sport}</span>
                        {bet.book && <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, color: NEON, background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.2)', padding: '1px 5px', borderRadius: '2px' }}>{bet.book}</span>}
                        {bet.event && <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{bet.event}</span>}
                        <span style={{ fontFamily: R, fontSize: '8px', color: isOpen ? YELLOW : 'var(--text-dim)', marginLeft: 'auto' }}>{bet.date}</span>
                      </div>
                      {/* Row 3: odds | units | P&L */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: isOpen ? '8px' : '6px' }}>
                        <div style={{ padding: '4px 6px', background: 'var(--card2)', borderRadius: '2px' }}>
                          <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>ODDS</div>
                          <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: bet.odds > 0 ? NEON : 'var(--text)' }}>{fmtOdds(bet.odds)}</div>
                        </div>
                        <div style={{ padding: '4px 6px', background: 'var(--card2)', borderRadius: '2px' }}>
                          <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>UNITS</div>
                          <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{bet.units}u</div>
                          {bet.stake > 0 && <div style={{ fontFamily: R, fontSize: '8px', color: MUTED }}>{fmt$(bet.stake)}</div>}
                        </div>
                        <div style={{ padding: '4px 6px', background: 'var(--card2)', borderRadius: '2px' }}>
                          <div style={{ fontFamily: R, fontSize: '7px', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>P&L</div>
                          <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: isOpen ? YELLOW : bet.pnl > 0 ? NEON : bet.pnl < 0 ? RED : MUTED }}>
                            {isOpen ? 'pend.' : fmtU(bet.pnl)}
                          </div>
                        </div>
                      </div>
                      {/* Row 4: actions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isOpen && ['W','L','P'].map(r => (
                          <button key={r} onClick={() => settleBet(bet.id, r)} style={{
                            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                            padding: '4px 12px', borderRadius: '2px', cursor: 'pointer', flex: 1,
                            border: `1px solid ${r === 'W' ? 'rgba(189,255,0,0.4)' : r === 'L' ? 'rgba(255,59,59,0.4)' : BORDER2}`,
                            background: r === 'W' ? 'rgba(189,255,0,0.07)' : r === 'L' ? 'rgba(255,59,59,0.07)' : 'var(--card)',
                            color: r === 'W' ? NEON : r === 'L' ? RED : MUTED,
                          }}>{r === 'W' ? 'WIN ✓' : r === 'L' ? 'LOSS ✗' : 'PUSH'}</button>
                        ))}
                        <div style={{ marginLeft: isOpen ? '4px' : 'auto', display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingBet(bet)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(189,255,0,0.3)', padding: '4px', display: 'flex', alignItems: 'center' }}
                            onTouchStart={e => e.currentTarget.style.color = NEON} onTouchEnd={e => e.currentTarget.style.color = 'rgba(189,255,0,0.3)'}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setBets(b => b.filter(x => x.id !== bet.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,59,0.3)', padding: '4px', display: 'flex', alignItems: 'center' }}
                            onTouchStart={e => e.currentTarget.style.color = RED} onTouchEnd={e => e.currentTarget.style.color = 'rgba(255,59,59,0.3)'}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div style={{ ...cardStyle, padding: '40px 20px', textAlign: 'center' }}>
                    {bets.filter(b => !b.ladder).length === 0 ? (
                      <div>
                        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text)', marginBottom: '8px' }}>NO BETS LOGGED YET</div>
                        <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.08em', marginBottom: '16px' }}>Track your first bet to start building your edge.</div>
                        <button onClick={() => setShowAdd(true)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '9px 20px', border: `1px solid ${NEON}`, borderRadius: '2px', background: 'rgba(189,255,0,0.1)', color: NEON, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                      {fmtU(filtered.filter(b => b.result !== 'Open').reduce((s, b) => s + b.pnl, 0))}
                    </span>
                  </span>
                </div>
              </div>
            )}
            {!isMobile && (
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <TH col="date"       label="Date" />
                    <TH col="sport"      label="Sport" />
                    <TH col="book"       label="📚 Book" />
                    <TH col="event"      label="Event" />
                    <TH col="pick"       label="Pick" />
                    <TH col="odds"       label="Odds" right />
                    <TH col="units"      label="Units" right />
                    <TH col="confidence" label="⭐" />
                    <TH col="result"     label="Result" />
                    <TH col="pnl"        label="P&L" right />
                    <th style={{ width: '32px', background: CARD }} />
                  </tr>
                </thead>
                <tbody>
                  {(betLogShowAll ? filtered : filtered.slice(0, 10)).map((bet, i) => {
                    const isOpen = bet.result === 'Open'
                    return (
                    <tr key={bet.id} style={{
                      borderBottom: `1px solid ${BORDER}`,
                      backgroundColor: isOpen ? 'rgba(245,166,35,0.04)' : i % 2 ? 'var(--card2)' : 'transparent',
                      borderLeft: isOpen ? `3px solid rgba(245,166,35,0.5)` : '3px solid transparent',
                    }}>
                      <td style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: isOpen ? YELLOW : MUTED, padding: '9px 13px', letterSpacing: '0.05em' }}>{bet.date}</td>
                      <td style={{ padding: '9px 13px' }}>
                        <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '2px' }}>{bet.sport}</span>
                      </td>
                      <td style={{ padding: '9px 13px' }}>
                        {bet.book
                          ? <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: NEON, background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.2)', padding: '2px 6px', borderRadius: '2px' }}>{bet.book}</span>
                          : <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--border2)' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: R, fontSize: '11px', fontWeight: 600, color: 'var(--text-sub)', padding: '9px 13px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.event}</td>
                      <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: 'var(--text)', padding: '9px 13px' }}>{bet.pick}</td>
                      <td style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: bet.odds > 0 ? NEON : 'var(--text)', padding: '9px 13px', textAlign: 'right' }}>{fmtOdds(bet.odds)}</td>
                      <td style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', padding: '9px 13px', textAlign: 'right' }}>
                        {bet.units}u
                        {bet.stake > 0 && <div style={{ fontFamily: R, fontSize: '9px', color: MUTED, fontWeight: 600 }}>{fmt$(bet.stake)}</div>}
                      </td>

                      {/* Confidence stars */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        {bet.confidence > 0
                          ? <span style={{ fontSize: '11px', letterSpacing: '-1px', opacity: 0.85 }}>{'⭐'.repeat(bet.confidence)}</span>
                          : <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--border2)' }}>—</span>}
                      </td>

                      {/* Result cell — inline settle for Open bets */}
                      <td style={{ padding: '7px 10px' }}>
                        {isOpen ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: YELLOW, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', padding: '2px 6px', borderRadius: '2px', marginRight: '4px' }}>OPEN</span>
                            {['W','L','P'].map(r => (
                              <button key={r} onClick={() => settleBet(bet.id, r)} style={{
                                fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                                padding: '2px 7px', borderRadius: '2px', cursor: 'pointer',
                                border: `1px solid ${r === 'W' ? 'rgba(189,255,0,0.4)' : r === 'L' ? 'rgba(255,59,59,0.4)' : BORDER2}`,
                                background: r === 'W' ? 'rgba(189,255,0,0.07)' : r === 'L' ? 'rgba(255,59,59,0.07)' : 'var(--card)',
                                color: r === 'W' ? NEON : r === 'L' ? RED : MUTED,
                              }}>{r}</button>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={bet.result === 'W' ? 'badge-win' : bet.result === 'L' ? 'badge-loss' : ''}
                            style={{
                              fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                              color: bet.result === 'W' ? NEON : bet.result === 'L' ? RED : 'var(--muted)',
                              background: bet.result === 'W' ? 'rgba(189,255,0,0.07)' : bet.result === 'L' ? 'rgba(255,59,59,0.07)' : 'var(--card2)',
                              border: `1px solid ${bet.result === 'W' ? 'rgba(189,255,0,0.2)' : bet.result === 'L' ? 'rgba(255,59,59,0.2)' : 'var(--border)'}`,
                              padding: '2px 7px', borderRadius: '2px',
                            }}>
                            {bet.result === 'W' ? 'WIN' : bet.result === 'L' ? 'LOSS' : bet.result === 'P' ? 'PUSH' : bet.result}
                          </span>
                        )}
                      </td>

                      <td style={{
                        fontFamily: R, fontSize: '12px', fontWeight: 700, padding: '9px 13px', textAlign: 'right',
                        color: isOpen ? MUTED : bet.pnl > 0 ? NEON : bet.pnl < 0 ? RED : MUTED,
                      }}>
                        {isOpen ? <span style={{ fontSize: '9px', color: YELLOW }}>pending</span> : fmtU(bet.pnl)}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button onClick={() => setEditingBet(bet)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(189,255,0,0.25)', display: 'flex', alignItems: 'center', padding: '2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = NEON}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(189,255,0,0.25)'}>
                            <Pencil size={10} />
                          </button>
                          <button onClick={() => setBets(b => b.filter(x => x.id !== bet.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,59,0.28)', display: 'flex', alignItems: 'center', padding: '2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = RED}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,59,59,0.28)'}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: '44px 20px', textAlign: 'center' }}>
                      {bets.filter(b => !b.ladder).length === 0 ? (
                        <div>
                          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text)', marginBottom: '8px' }}>NO BETS LOGGED YET</div>
                          <div style={{ fontFamily: R, fontSize: '10px', color: MUTED, letterSpacing: '0.08em', marginBottom: '16px' }}>Track your first bet to start building your edge.</div>
                          <button onClick={() => setShowAdd(true)} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '9px 20px', border: `1px solid ${NEON}`, borderRadius: '2px', background: 'rgba(189,255,0,0.1)', color: NEON, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={11} /> Log Your First Bet
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: R, fontSize: '11px', color: MUTED, letterSpacing: '0.12em' }}>NO BETS MATCH FILTERS</span>
                      )}
                    </td></tr>
                  )}
                </tbody>
              </table>
              </div>
              {/* Show more / less toggle */}
              {filtered.length > 10 && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 13px', textAlign: 'center' }}>
                  <button onClick={() => setBetLogShowAll(v => !v)} style={{
                    fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    background: 'none', border: `1px solid var(--border2)`, borderRadius: '2px',
                    color: 'var(--muted)', cursor: 'pointer', padding: '5px 16px',
                  }}>
                    {betLogShowAll ? '▲ Show Less' : `▼ Show ${filtered.length - 10} More`}
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 13px', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>{filtered.length} BETS</span>
                  {filtered.filter(b => b.result === 'Open').length > 0 && (
                    <span style={{ fontFamily: R, fontSize: '9px', color: YELLOW, letterSpacing: '0.1em', fontWeight: 700 }}>
                      {filtered.filter(b => b.result === 'Open').length} OPEN · {fmt$(filtered.filter(b => b.result === 'Open').reduce((s, b) => s + (b.stake || 0), 0))} AT RISK
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: R, fontSize: '9px', color: MUTED, letterSpacing: '0.1em' }}>
                  NET: <span style={{ color: filtered.filter(b => b.result !== 'Open').reduce((s, b) => s + b.pnl, 0) >= 0 ? NEON : RED, fontWeight: 700 }}>
                    {fmtU(filtered.filter(b => b.result !== 'Open').reduce((s, b) => s + b.pnl, 0))}
                  </span>
                </span>
              </div>
            </div>
            )}
          </div>
        )}

        {/* ── LADDER ── */}
        {tab === 'ladder' && <LadderTracker bets={bets} setBets={setBets} ladderStarting={ladderStarting} setLadderStarting={setLadderStarting} darkMode={darkMode} />}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && <AnalyticsPanel bets={bets} stats={stats} masterBankroll={masterBankroll} darkMode={darkMode} onSettle={settleBet} onEdit={setEditingBet} />}

        {/* ══ RR ENGINE ══ */}
        {tab === 'rr engine' && <RREngine unitSize={stats.unitSize} darkMode={darkMode} />}
        {tab === 'session' && <SessionRecap bets={bets} stats={stats} tilt={tilt} masterBankroll={masterBankroll} riskSettings={riskSettings} darkMode={darkMode} />}
        {tab === 'partners' && <PartnersPage darkMode={darkMode} isMobile={isMobile} />}

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
              position: 'fixed', bottom: '56px', left: '10px', right: '10px', zIndex: 200,
              background: 'var(--card2)', borderRadius: 'var(--radius)', border: `1px solid var(--border2)`,
              borderTop: `2px solid ${NEON}`, padding: '8px', boxShadow: 'var(--float-shadow)',
              animation: 'slideUp 0.18s ease',
            }}>
              {[
                { id: 'analytics', label: 'Analytics', icon: TrendingUp },
                { id: 'session',   label: 'Session',   icon: Flame },
                { id: 'partners',  label: 'Partners',  icon: Handshake },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); setShowMore(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                  padding: '14px 16px', background: tab === id ? 'rgba(189,255,0,0.08)' : 'none',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: tab === id ? NEON : 'var(--text-dim)',
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
            display: 'flex', alignItems: 'stretch', height: '56px',
            paddingBottom: 'env(safe-area-inset-bottom)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          }}>
            {[
              { id: 'overview',  label: 'Stats',    icon: BarChart3  },
              { id: 'ladder',    label: 'Ladder',   icon: Zap        },
              { id: 'bet log',   label: 'Bets',     icon: BookMarked },
              { id: 'rr engine', label: 'RR',       icon: Target     },
              { id: 'analytics', label: 'Overview', icon: TrendingUp },
              { id: 'session',   label: 'Session',  icon: Sliders    },
            ].map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button key={id} onClick={() => { setTab(id); setShowMore(false) }} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? NEON : 'var(--muted)', transition: 'color 0.12s',
                  position: 'relative', minWidth: 0,
                }}>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: '24px', height: '2px', background: NEON, borderRadius: '0 0 2px 2px',
                      boxShadow: `0 0 8px ${NEON}`,
                    }} />
                  )}
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} color={active ? NEON : 'var(--muted)'} />
                  <span style={{ fontFamily: R, fontSize: '7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                  {id === 'bet log' && stats.openBets > 0 && (
                    <div style={{ position: 'absolute', top: '8px', right: 'calc(50% - 14px)', width: '5px', height: '5px', borderRadius: '50%', background: YELLOW, animation: 'pulseDot 1.4s ease infinite' }} />
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
                <BookMarked size={14} color={NEON} strokeWidth={2} />
                <span style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: NEON }}>SAVED TEMPLATES</span>
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
        <footer style={{ borderTop: `1px solid var(--border)`, backgroundColor: 'var(--bg)', marginTop: '18px', padding: '10px 28px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, boxShadow: darkMode ? '0 0 6px rgba(189,255,0,0.5)' : 'none' }} />
            <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>Auto-saving</span>
          </div>
          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 600, letterSpacing: '0.18em', color: 'var(--muted)', textTransform: 'uppercase' }}>Risk Matrix Labs © 2025</span>
          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--neon-sub)', textTransform: 'uppercase' }}>Operate With Discipline</span>
        </footer>
      )}
    </div>
  )
}
