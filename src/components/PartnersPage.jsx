import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Users, Newspaper, Star, Zap, TrendingUp, BookOpen } from 'lucide-react'

const NEON = '#BDFF00'
const RED  = '#FF3B3B'
const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'

// ── Swap these with real affiliate links when approved ──
const AFFILIATES = [
  {
    id: 'draftkings',
    name: 'DraftKings',
    logo: 'DK',
    logoColor: '#00C896',
    tag: 'FEATURED',
    tagColor: NEON,
    bonus: '$200',
    bonusLabel: 'Bonus Bets',
    promo: 'Bet $5, Get $200 in Bonus Bets',
    desc: 'One of the top-rated sportsbooks in the US. Competitive lines, same-game parlays, and fast payouts.',
    cta: 'Claim Offer',
    url: 'https://www.draftkings.com',
    featured: true,
  },
  {
    id: 'fanduel',
    name: 'FanDuel',
    logo: 'FD',
    logoColor: '#1493FF',
    tag: 'FEATURED',
    tagColor: NEON,
    bonus: '$150',
    bonusLabel: 'Bonus Bets',
    promo: 'Bet $5, Get $150 in Bonus Bets',
    desc: 'Industry-leading odds boosts, live betting, and one of the best mobile apps for disciplined bettors.',
    cta: 'Claim Offer',
    url: 'https://www.fanduel.com',
    featured: true,
  },
]

const TOOLS = [
  {
    id: 'discord',
    name: 'RML Discord',
    icon: Users,
    iconColor: '#5865F2',
    desc: 'Community for disciplined bettors. No picks. No hype. Strategy only.',
    cta: 'Join Free',
    url: 'https://discord.gg/smHv7CHc4p',
  },
  {
    id: 'newsletter',
    name: 'RML Newsletter',
    icon: Newspaper,
    iconColor: NEON,
    desc: 'Weekly bankroll tips and platform updates straight to your inbox.',
    cta: 'Subscribe',
    url: 'https://riskmatrixlabs.beehiiv.com/subscribe',
  },
  {
    id: 'oddsresearch',
    name: 'Odds Research',
    icon: TrendingUp,
    iconColor: '#FF8C00',
    desc: 'Find the best lines before you bet. Shopping odds is free edge.',
    cta: 'Coming Soon',
    url: '#',
    disabled: true,
  },
  {
    id: 'bankrollguide',
    name: 'Bankroll Guide',
    icon: BookOpen,
    iconColor: '#A855F7',
    desc: 'Free PDF: The Operator\'s Guide to Bankroll Management.',
    cta: 'Coming Soon',
    url: '#',
    disabled: true,
  },
]

const TABS = ['Signup Bonuses', 'Popular Tools']

function FeaturedCard({ partner, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Featured banner */}
      <div style={{
        background: `linear-gradient(135deg, rgba(189,255,0,0.12), rgba(189,255,0,0.04))`,
        borderBottom: `1px solid rgba(189,255,0,0.15)`,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '8px',
            background: `${partner.logoColor}22`,
            border: `1px solid ${partner.logoColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: R, fontSize: '14px', fontWeight: 800,
            color: partner.logoColor, letterSpacing: '0.04em',
          }}>
            {partner.logo}
          </div>
          <div>
            <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
              {partner.name}
            </div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, textTransform: 'uppercase' }}>
              ★ AFFILIATE PARTNER
            </div>
          </div>
        </div>

        {/* Bonus badge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 800, color: NEON, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {partner.bonus}
          </div>
          <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
            {partner.bonusLabel}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{
          fontFamily: R, fontSize: '13px', fontWeight: 700,
          color: '#fff', letterSpacing: '0.04em', marginBottom: '6px',
        }}>
          {partner.promo}
        </div>
        <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: '14px' }}>
          {partner.desc}
        </div>

        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '11px',
            background: NEON, border: 'none', borderRadius: '5px',
            fontFamily: R, fontSize: '12px', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#0A0A0A', cursor: 'pointer', textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {partner.cta} <ExternalLink size={11} strokeWidth={2.5} />
        </a>

        <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '8px', textAlign: 'center' }}>
          Tap to see terms. Must be 21+. Gambling problem? Call 1-800-GAMBLER.
        </div>
      </div>
    </motion.div>
  )
}

function ToolCard({ tool, delay }) {
  const Icon = tool.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: '14px',
        opacity: tool.disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
        background: `${tool.iconColor}18`,
        border: `1px solid ${tool.iconColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={tool.iconColor} strokeWidth={1.8} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          {tool.name}
        </div>
        <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px', lineHeight: 1.5 }}>
          {tool.desc}
        </div>
      </div>

      <a
        href={tool.disabled ? undefined : tool.url}
        target={tool.disabled ? undefined : '_blank'}
        rel="noopener noreferrer"
        style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '8px 14px',
          background: tool.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(189,255,0,0.08)',
          border: `1px solid ${tool.disabled ? 'rgba(255,255,255,0.08)' : 'rgba(189,255,0,0.25)'}`,
          borderRadius: '5px',
          fontFamily: R, fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: tool.disabled ? 'rgba(255,255,255,0.25)' : NEON,
          cursor: tool.disabled ? 'default' : 'pointer',
          textDecoration: 'none',
          transition: 'background 0.15s',
          pointerEvents: tool.disabled ? 'none' : 'auto',
        }}
      >
        {tool.cta}
        {!tool.disabled && <ExternalLink size={10} strokeWidth={2.5} />}
      </a>
    </motion.div>
  )
}

export default function PartnersPage({ isMobile }) {
  const [activeTab, setActiveTab] = useState('Signup Bonuses')

  const totalBonus = AFFILIATES.reduce((sum, a) => {
    const num = parseInt(a.bonus.replace('$', '').replace('+', ''))
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: '820px', margin: '0 auto', paddingBottom: '60px' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(189,255,0,0.6)', textTransform: 'uppercase', marginBottom: '4px' }}>
          RISK MATRIX LABS
        </div>
        <h1 style={{ fontFamily: R, fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>
          Offers & Partners
        </h1>
      </motion.div>

      {/* Total promo value banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        style={{
          background: 'linear-gradient(135deg, rgba(189,255,0,0.15), rgba(189,255,0,0.06))',
          border: '1px solid rgba(189,255,0,0.3)',
          borderRadius: '8px', padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
          ⚡ Total Promo Value
        </div>
        <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 800, color: NEON, letterSpacing: '0.04em' }}>
          ${totalBonus}+
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '20px',
        borderBottom: '1px solid var(--border)', paddingBottom: '0',
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: R, fontSize: '12px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: activeTab === tab ? NEON : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === tab ? `2px solid ${NEON}` : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Signup Bonuses Tab */}
      {activeTab === 'Signup Bonuses' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {AFFILIATES.map((p, i) => <FeaturedCard key={p.id} partner={p} delay={i * 0.07} />)}
        </div>
      )}

      {/* Popular Tools Tab */}
      {activeTab === 'Popular Tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TOOLS.map((t, i) => <ToolCard key={t.id} tool={t} delay={i * 0.07} />)}
        </div>
      )}

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        style={{
          fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.18)',
          marginTop: '32px', lineHeight: 1.6,
          borderTop: '1px solid var(--border)', paddingTop: '14px',
        }}
      >
        Some links are affiliate links. Risk Matrix Labs may earn a commission at no extra cost to you. Gambling involves risk. Must be 21+. Please gamble responsibly.
      </motion.p>
    </div>
  )
}
