import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Users, Newspaper, TrendingUp, BookOpen, Star, ChevronDown } from 'lucide-react'

const NEON = '#BDFF00'
const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'

// ── US States available on major books ──
const STATES = ['All States','AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY']

// ── Sportsbook Signup Bonuses (swap URLs when affiliate approved) ──
const BOOKS = [
  { id: 'draftkings', name: 'DraftKings', logo: 'DK', logoColor: '#00C896', bonus: '$200', bonusLabel: 'Bonus Bets', promo: 'Bet $5, Get $200 in Bonus Bets', desc: 'Competitive lines, same-game parlays, live betting, and fast payouts. One of the top sportsbooks in the US.', cta: 'Claim Offer', url: 'https://www.draftkings.com', states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'fanduel',    name: 'FanDuel',    logo: 'FD', logoColor: '#1493FF', bonus: '$150', bonusLabel: 'Bonus Bets', promo: 'Bet $5, Get $150 in Bonus Bets', desc: 'Industry-leading odds boosts, no-sweat SGPs, and the best mobile betting app for disciplined operators.', cta: 'Claim Offer', url: 'https://www.fanduel.com', states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'betmgm',     name: 'BetMGM',     logo: 'MGM', logoColor: '#B8960C', bonus: '$1,500', bonusLabel: 'Back in Bonus Bets', promo: 'First Bet Offer Up to $1,500', desc: 'If your first bet loses, BetMGM gives it back as bonus bets. Great odds on parlays and player props.', cta: 'Claim Offer', url: 'https://www.betmgm.com', states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'caesars',    name: 'Caesars',    logo: 'CZR', logoColor: '#C9A84C', bonus: '$1,000', bonusLabel: 'Bonus Bet', promo: 'First Bet on Caesars up to $1,000', desc: 'One of the most generous welcome offers. Strong on NFL, NBA, and college sports markets.', cta: 'Claim Offer', url: 'https://www.caesars.com/sportsbook-and-casino', states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'espnbet',    name: 'ESPN BET',   logo: 'ESPN', logoColor: '#FF4B00', bonus: '$150', bonusLabel: 'Bonus Bets', promo: 'Get $150 in Bonus Bets', desc: 'Powered by PENN Entertainment. Integrated with ESPN app, solid live betting and props markets.', cta: 'Claim Offer', url: 'https://espnbet.com', states: ['AZ','CO','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'hardrock',   name: 'Hard Rock Bet', logo: 'HR', logoColor: '#FFD700', bonus: '$100', bonusLabel: 'Bonus Bet', promo: 'Bet $10, Get $100 in Bonus Bets', desc: 'Florida-based sportsbook expanding nationally. Competitive odds and fast withdrawals.', cta: 'Claim Offer', url: 'https://www.hardrock.bet', states: ['AZ','CO','IN','IA','NJ','OH','PA','TN','VA'] },
]

// ── Trusted Cappers ──
const CAPPERS = [
  { id: 'capper1', name: 'Coming Soon', handle: '@rml_verified', platform: 'Pending Review', record: '—', roi: '—', desc: 'We are vetting our first verified capper. No picks service. Only disciplined, data-backed operators.', tag: 'COMING SOON', tagColor: 'rgba(189,255,0,0.4)', url: '#', disabled: true },
  { id: 'capper2', name: 'Coming Soon', handle: '@rml_verified', platform: 'Pending Review', record: '—', roi: '—', desc: 'RML only partners with cappers who track their record publicly and operate with full transparency.', tag: 'COMING SOON', tagColor: 'rgba(189,255,0,0.4)', url: '#', disabled: true },
  { id: 'capper3', name: 'Coming Soon', handle: '@rml_verified', platform: 'Pending Review', record: '—', roi: '—', desc: 'Interested in being a verified RML capper? Reach out at hello@riskmatrixlabs.com', tag: 'APPLY', tagColor: 'rgba(100,200,255,0.5)', url: 'mailto:hello@riskmatrixlabs.com', disabled: false },
]

// ── Popular Tools ──
const TOOLS = [
  { id: 'discord',    name: 'RML Discord',      icon: Users,      iconColor: '#5865F2', desc: 'Community for disciplined bettors. No picks. No hype. Strategy only.',                              cta: 'Join Free',   url: 'https://discord.gg/smHv7CHc4p' },
  { id: 'newsletter', name: 'RML Newsletter',   icon: Newspaper,  iconColor: NEON,      desc: 'Weekly bankroll tips and platform updates straight to your inbox via Beehiiv.',                      cta: 'Subscribe',   url: 'https://riskmatrixlabs.beehiiv.com/subscribe' },
  { id: 'oddsjam',    name: 'OddsJam',          icon: TrendingUp, iconColor: '#00C896', desc: 'Real-time odds comparison across all major books. Shopping lines is free edge — use it every time.', cta: 'Sign Up',     url: 'https://oddsjam.com' },
  { id: 'pikkit',     name: 'Pikkit',           icon: Star,       iconColor: '#FF8C00', desc: 'All-in-one sports betting hub with odds, promos, and a community feed. Great companion app.',        cta: 'Sign Up',     url: 'https://pikkit.com' },
  { id: 'propswap',   name: 'PropSwap',         icon: BookOpen,   iconColor: '#A855F7', desc: 'Buy and sell winning tickets. The only secondary market for sports betting tickets.',                  cta: 'Sign Up',     url: 'https://www.propswap.com' },
  { id: 'betonline',  name: 'Action Network',   icon: TrendingUp, iconColor: '#4FC3F7', desc: 'Trusted source for line movement, sharp money tracking, and sports betting analytics.',               cta: 'Sign Up',     url: 'https://www.actionnetwork.com' },
]

const TABS = ['Signup Bonuses', 'Trusted Cappers', 'Popular Tools', 'Promote RML']

// ─────────────────────────────────────────────────────────────────────────────

function BookCard({ book, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.26 }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}
    >
      <div style={{ background: `linear-gradient(135deg, rgba(189,255,0,0.1), rgba(189,255,0,0.03))`, borderBottom: '1px solid rgba(189,255,0,0.12)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${book.logoColor}20`, border: `1px solid ${book.logoColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontSize: '12px', fontWeight: 800, color: book.logoColor }}>
            {book.logo}
          </div>
          <div>
            <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{book.name}</div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: NEON, textTransform: 'uppercase' }}>★ AFFILIATE PARTNER</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 800, color: NEON, lineHeight: 1, letterSpacing: '-0.01em' }}>{book.bonus}</div>
          <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{book.bonusLabel}</div>
        </div>
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '5px' }}>{book.promo}</div>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '12px' }}>{book.desc}</div>
        <a href={book.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%', padding: '10px', background: NEON, borderRadius: '5px', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0A0A0A', textDecoration: 'none', transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          {book.cta} <ExternalLink size={10} strokeWidth={2.5} />
        </a>
        <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.18)', marginTop: '7px', textAlign: 'center' }}>Tap to see terms. Must be 21+. Gambling problem? 1-800-GAMBLER.</div>
      </div>
    </motion.div>
  )
}

function CapperCard({ capper, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.26 }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px 18px', opacity: capper.disabled ? 0.6 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, color: '#fff' }}>{capper.name}</div>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>{capper.handle} · {capper.platform}</div>
        </div>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: capper.tagColor, border: `1px solid ${capper.tagColor}`, borderRadius: '3px', padding: '3px 7px' }}>
          {capper.tag}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
        <div><div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Record</div><div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff' }}>{capper.record}</div></div>
        <div><div style={{ fontFamily: R, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ROI</div><div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: NEON }}>{capper.roi}</div></div>
      </div>
      <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '12px' }}>{capper.desc}</div>
      {!capper.disabled && (
        <a href={capper.url} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '4px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEON, textDecoration: 'none' }}>
          Contact Us <ExternalLink size={10} />
        </a>
      )}
    </motion.div>
  )
}

function ToolCard({ tool, delay }) {
  const Icon = tool.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.26 }}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
    >
      <div style={{ width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0, background: `${tool.iconColor}18`, border: `1px solid ${tool.iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} color={tool.iconColor} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff' }}>{tool.name}</div>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: 1.5 }}>{tool.desc}</div>
      </div>
      <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '7px 12px', background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.22)', borderRadius: '4px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: NEON, textDecoration: 'none', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(189,255,0,0.14)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(189,255,0,0.08)'}>
        {tool.cta} <ExternalLink size={10} strokeWidth={2.5} />
      </a>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PartnersPage({ isMobile }) {
  const [activeTab, setActiveTab] = useState('Signup Bonuses')
  const [selectedState, setSelectedState] = useState('All States')

  const filteredBooks = selectedState === 'All States'
    ? BOOKS
    : BOOKS.filter(b => b.states.includes(selectedState))

  const totalBonus = filteredBooks.reduce((sum, b) => {
    const num = parseInt(b.bonus.replace(/[$,+]/g, ''))
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: '840px', margin: '0 auto', paddingBottom: '60px' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '18px' }}>
        <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(189,255,0,0.55)', textTransform: 'uppercase', marginBottom: '3px' }}>RISK MATRIX LABS</div>
        <h1 style={{ fontFamily: R, fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.04em' }}>Offers & Partners</h1>
        <p style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>Tools and partners trusted by the RML community.</p>
      </motion.div>

      {/* Total promo value */}
      {activeTab === 'Signup Bonuses' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          style={{ background: 'linear-gradient(135deg, rgba(189,255,0,0.12), rgba(189,255,0,0.04))', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff' }}>⚡ Total Promo Value{selectedState !== 'All States' ? ` · ${selectedState}` : ''}</div>
          <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 800, color: NEON }}>${totalBonus.toLocaleString()}+</div>
        </motion.div>
      )}

      {/* Tabs + State filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: activeTab === tab ? NEON : 'rgba(255,255,255,0.3)',
              borderBottom: activeTab === tab ? `2px solid ${NEON}` : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.15s', whiteSpace: 'nowrap',
            }}>{tab}</button>
          ))}
        </div>

        {/* State selector — only on Signup Bonuses tab */}
        {activeTab === 'Signup Bonuses' && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{
              appearance: 'none', background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '5px', color: '#fff', fontFamily: R, fontSize: '11px', fontWeight: 700,
              padding: '6px 28px 6px 10px', cursor: 'pointer', outline: 'none',
              letterSpacing: '0.08em',
            }}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', right: '8px', pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      {/* ── Signup Bonuses ── */}
      {activeTab === 'Signup Bonuses' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(310px, 1fr))', gap: '12px' }}>
          {filteredBooks.length === 0
            ? <div style={{ fontFamily: R, fontSize: '13px', color: 'var(--muted)', padding: '30px', textAlign: 'center', gridColumn: '1/-1' }}>No books available in {selectedState} yet. Select a different state.</div>
            : filteredBooks.map((b, i) => <BookCard key={b.id} book={b} delay={i * 0.06} />)
          }
        </div>
      )}

      {/* ── Trusted Cappers ── */}
      {activeTab === 'Trusted Cappers' && (
        <div>
          <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '16px', lineHeight: 1.6 }}>
            RML only partners with cappers who track their record publicly and operate with full transparency. No picks services. No gurus. Just operators with verifiable results.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CAPPERS.map((c, i) => <CapperCard key={c.id} capper={c} delay={i * 0.07} />)}
          </div>
        </div>
      )}

      {/* ── Popular Tools ── */}
      {activeTab === 'Popular Tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TOOLS.map((t, i) => <ToolCard key={t.id} tool={t} delay={i * 0.06} />)}
        </div>
      )}

      {/* ── Promote RML ── */}
      {activeTab === 'Promote RML' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'linear-gradient(135deg, rgba(189,255,0,0.1), rgba(189,255,0,0.03))', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '10px', padding: '24px 22px' }}>
            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '6px' }}>AFFILIATE PROGRAM</div>
            <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px', letterSpacing: '0.03em' }}>Earn by Promoting RML</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '18px' }}>
              Are you a capper, content creator, or community builder in the sports betting space? Partner with Risk Matrix Labs and earn commission for every subscriber you refer — forever.
            </div>

            {/* Perks grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Commission', value: 'Up to 30%', sub: 'per paid subscriber' },
                { label: 'Cookie Duration', value: '90 Days', sub: 'last-click attribution' },
                { label: 'Payout', value: 'Monthly', sub: 'via PayPal or bank' },
                { label: 'Tracking', value: 'Real-Time', sub: 'dashboard + link stats' },
              ].map(p => (
                <div key={p.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(189,255,0,0.12)', borderRadius: '6px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '4px' }}>{p.label}</div>
                  <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 800, color: NEON, letterSpacing: '0.02em' }}>{p.value}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{p.sub}</div>
                </div>
              ))}
            </div>

            <a href="mailto:hello@riskmatrixlabs.com?subject=RML Affiliate Program"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '12px 22px', background: NEON, borderRadius: '5px', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#0A0A0A', textDecoration: 'none', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              Apply Now <ExternalLink size={11} strokeWidth={2.5} />
            </a>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '10px' }}>
              Email hello@riskmatrixlabs.com — we'll get back to you within 48 hours with your unique referral link.
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px 22px' }}>
            <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '16px' }}>HOW IT WORKS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { step: '01', title: 'Apply', desc: 'Email us or fill out the form. We review and approve within 48 hours.' },
                { step: '02', title: 'Get Your Link', desc: 'You get a unique tracking link like riskmatrixlabs.com?via=yourname' },
                { step: '03', title: 'Share It', desc: 'Post it on social, in your Discord, YouTube, newsletter — anywhere your audience is.' },
                { step: '04', title: 'Get Paid', desc: 'Every subscriber who signs up through your link earns you commission. Monthly payouts.' },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 800, color: 'rgba(189,255,0,0.3)', minWidth: '28px', letterSpacing: '0.02em' }}>{s.step}</div>
                  <div>
                    <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{s.title}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      )}

      {/* Disclaimer */}
      <p style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.15)', marginTop: '32px', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        Some links are affiliate links. Risk Matrix Labs may earn a commission at no extra cost to you. Always gamble responsibly. Must be 21+ and located in a legal betting state. If you or someone you know has a gambling problem, call 1-800-GAMBLER.
      </p>
    </div>
  )
}
