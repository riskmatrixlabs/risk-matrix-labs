import { motion } from 'framer-motion'
import { ExternalLink, Users, Newspaper } from 'lucide-react'

const NEON = '#BDFF00'
const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'

// ── Affiliate links — swap in real links when approved ──
const DRAFTKINGS_URL = 'https://www.draftkings.com'
const FANDUEL_URL    = 'https://www.fanduel.com'

const PARTNERS = [
  {
    id: 'draftkings',
    name: 'DraftKings',
    tag: 'SPORTSBOOK',
    tagColor: '#00C896',
    desc: 'One of the top-rated sportsbooks in the US. Competitive lines, same-game parlays, and fast payouts.',
    cta: 'Bet at DraftKings',
    url: DRAFTKINGS_URL,
    badge: 'AFFILIATE PARTNER',
  },
  {
    id: 'fanduel',
    name: 'FanDuel',
    tag: 'SPORTSBOOK',
    tagColor: '#1493FF',
    desc: 'Industry-leading odds boosts, live betting, and one of the best mobile apps for disciplined bettors.',
    cta: 'Bet at FanDuel',
    url: FANDUEL_URL,
    badge: 'AFFILIATE PARTNER',
  },
]

const RESOURCES = [
  {
    id: 'discord',
    name: 'RML Discord',
    icon: Users,
    desc: 'Join the community. No picks. No hype. Disciplined bettors only.',
    cta: 'Join Server',
    url: 'https://discord.gg/smHv7CHc4p',
  },
  {
    id: 'newsletter',
    name: 'RML Newsletter',
    icon: Newspaper,
    desc: 'Bankroll tips, platform updates, and operator insights — straight to your inbox.',
    cta: 'Subscribe Free',
    url: 'https://riskmatrixlabs.beehiiv.com/subscribe',
  },
]

function PartnerCard({ partner, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${partner.tagColor}`,
        borderRadius: '6px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
            {partner.name}
          </div>
          <div style={{
            display: 'inline-block', marginTop: '4px',
            background: `${partner.tagColor}18`,
            border: `1px solid ${partner.tagColor}44`,
            borderRadius: '3px', padding: '2px 8px',
            fontFamily: R, fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.18em', color: partner.tagColor,
            textTransform: 'uppercase',
          }}>
            {partner.tag}
          </div>
        </div>
        <div style={{
          fontFamily: R, fontSize: '8px', fontWeight: 700,
          letterSpacing: '0.18em', color: 'rgba(189,255,0,0.5)',
          textTransform: 'uppercase', border: '1px solid rgba(189,255,0,0.2)',
          borderRadius: '3px', padding: '3px 8px',
        }}>
          {partner.badge}
        </div>
      </div>

      <p style={{ fontFamily: I, fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
        {partner.desc}
      </p>

      <a
        href={partner.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          marginTop: '4px', padding: '10px 20px',
          background: NEON, border: 'none', borderRadius: '3px',
          fontFamily: R, fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#0A0A0A', cursor: 'pointer', textDecoration: 'none',
          alignSelf: 'flex-start', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {partner.cta}
        <ExternalLink size={12} strokeWidth={2.5} />
      </a>
    </motion.div>
  )
}

function ResourceCard({ resource, delay }) {
  const Icon = resource.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '8px',
        background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={NEON} strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
          {resource.name}
        </div>
        <div style={{ fontFamily: I, fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.5 }}>
          {resource.desc}
        </div>
      </div>

      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '8px 14px', flexShrink: 0,
          background: 'rgba(189,255,0,0.08)',
          border: '1px solid rgba(189,255,0,0.25)',
          borderRadius: '3px',
          fontFamily: R, fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: NEON, cursor: 'pointer', textDecoration: 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(189,255,0,0.14)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(189,255,0,0.08)'}
      >
        {resource.cta}
        <ExternalLink size={11} strokeWidth={2.5} />
      </a>
    </motion.div>
  )
}

export default function PartnersPage({ darkMode }) {
  return (
    <div style={{
      padding: '24px 20px',
      maxWidth: '800px',
      margin: '0 auto',
      paddingBottom: '40px',
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '6px' }}>
          RISK MATRIX LABS
        </div>
        <h1 style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>
          Partners & Tools
        </h1>
        <p style={{ fontFamily: I, fontSize: '13px', color: 'var(--text-dim)', marginTop: '6px' }}>
          Resources trusted by the RML community. Use the platforms where your edge compounds.
        </p>
      </motion.div>

      {/* Partner Books */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontFamily: R, fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--muted)', marginBottom: '14px',
          borderBottom: '1px solid var(--border)', paddingBottom: '8px',
        }}>
          Partner Sportsbooks
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {PARTNERS.map((p, i) => <PartnerCard key={p.id} partner={p} delay={i * 0.08} />)}
        </div>
      </div>

      {/* Community & Resources */}
      <div>
        <div style={{
          fontFamily: R, fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--muted)', marginBottom: '14px',
          borderBottom: '1px solid var(--border)', paddingBottom: '8px',
        }}>
          Community & Resources
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {RESOURCES.map((r, i) => <ResourceCard key={r.id} resource={r} delay={0.16 + i * 0.08} />)}
        </div>
      </div>

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          fontFamily: I, fontSize: '11px',
          color: 'rgba(255,255,255,0.2)',
          marginTop: '36px', lineHeight: 1.6,
          borderTop: '1px solid var(--border)', paddingTop: '16px',
        }}
      >
        Some links on this page are affiliate links. Risk Matrix Labs may earn a commission when you sign up through these links at no extra cost to you. We only partner with platforms we'd recommend regardless.
      </motion.p>
    </div>
  )
}
