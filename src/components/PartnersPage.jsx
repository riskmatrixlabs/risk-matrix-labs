import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Users, Newspaper, TrendingUp, BookOpen, Star, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'

const NEON = '#BDFF00'
const R = 'Rajdhani, sans-serif'
const I = 'Inter, sans-serif'

const STATES = ['All States','AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY']

const BOOKS = [
  { id: 'draftkings', name: 'DraftKings', logo: 'DK',   logoColor: '#00C896', bonus: '$200',   bonusLabel: 'Bonus Bets',            promo: 'Bet $5, Get $200 in Bonus Bets',          desc: 'Competitive lines, same-game parlays, live betting, and fast payouts. One of the top sportsbooks in the US.', cta: 'Claim Offer', url: 'https://www.draftkings.com',                       states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'fanduel',    name: 'FanDuel',    logo: 'FD',   logoColor: '#1493FF', bonus: '$150',   bonusLabel: 'Bonus Bets',            promo: 'Bet $5, Get $150 in Bonus Bets',          desc: 'Industry-leading odds boosts, no-sweat SGPs, and the best mobile betting app for disciplined operators.',    cta: 'Claim Offer', url: 'https://www.fanduel.com',                          states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'betmgm',     name: 'BetMGM',     logo: 'MGM',  logoColor: '#B8960C', bonus: '$1,500', bonusLabel: 'Back in Bonus Bets',    promo: 'First Bet Offer Up to $1,500',            desc: 'If your first bet loses, BetMGM gives it back as bonus bets. Great odds on parlays and player props.',       cta: 'Claim Offer', url: 'https://www.betmgm.com',                           states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'caesars',    name: 'Caesars',    logo: 'CZR',  logoColor: '#C9A84C', bonus: '$1,000', bonusLabel: 'Bonus Bet',             promo: 'First Bet on Caesars up to $1,000',       desc: 'One of the most generous welcome offers. Strong on NFL, NBA, and college sports markets.',                    cta: 'Claim Offer', url: 'https://www.caesars.com/sportsbook-and-casino', states: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY'] },
  { id: 'espnbet',    name: 'ESPN BET',   logo: 'ESPN', logoColor: '#FF4B00', bonus: '$150',   bonusLabel: 'Bonus Bets',            promo: 'Get $150 in Bonus Bets',                  desc: 'Powered by PENN Entertainment. Integrated with ESPN app, solid live betting and props markets.',             cta: 'Claim Offer', url: 'https://espnbet.com',                              states: ['AZ','CO','IL','IN','IA','KS','KY','LA','MD','MA','MI','NJ','NY','NC','OH','PA','TN','VA','WV','WY']     },
  { id: 'hardrock',   name: 'Hard Rock',  logo: 'HR',   logoColor: '#FFD700', bonus: '$100',   bonusLabel: 'Bonus Bet',             promo: 'Bet $10, Get $100 in Bonus Bets',         desc: 'Florida-based sportsbook expanding nationally. Competitive odds and fast withdrawals.',                       cta: 'Claim Offer', url: 'https://www.hardrock.bet',                         states: ['AZ','CO','IN','IA','NJ','OH','PA','TN','VA']                                                             },
]

const CAPPERS = [
  { id: 'c1', name: 'Coming Soon', handle: '@rml_verified', platform: 'Pending Review', record: '—', roi: '—', desc: 'We are vetting our first verified capper. No picks service. Only disciplined, data-backed operators.', tag: 'COMING SOON', tagColor: 'rgba(189,255,0,0.4)', url: '#', disabled: true },
  { id: 'c2', name: 'Coming Soon', handle: '@rml_verified', platform: 'Pending Review', record: '—', roi: '—', desc: 'RML only partners with cappers who track their record publicly and operate with full transparency.', tag: 'COMING SOON', tagColor: 'rgba(189,255,0,0.4)', url: '#', disabled: true },
  { id: 'c3', name: 'Apply to Join', handle: '@rml_verified', platform: 'Open', record: '—', roi: '—', desc: 'Interested in being a verified RML capper? Reach out at hello@riskmatrixlabs.com', tag: 'APPLY', tagColor: 'rgba(100,200,255,0.5)', url: 'mailto:hello@riskmatrixlabs.com', disabled: false },
]

const TOOLS = [
  { id: 'discord',    name: 'RML Discord',    icon: Users,      iconColor: '#5865F2', desc: 'Community for disciplined bettors. No picks. No hype. Strategy only.',                               cta: 'Join Free',  url: 'https://discord.gg/smHv7CHc4p' },
  { id: 'newsletter', name: 'RML Newsletter', icon: Newspaper,  iconColor: NEON,      desc: 'Weekly bankroll tips and platform updates straight to your inbox.',                                   cta: 'Subscribe',  url: 'https://riskmatrixlabs.beehiiv.com/subscribe' },
  { id: 'oddsjam',    name: 'OddsJam',        icon: TrendingUp, iconColor: '#00C896', desc: 'Real-time odds comparison across all major books. Shopping lines is free edge.',                      cta: 'Sign Up',    url: 'https://oddsjam.com' },
  { id: 'pikkit',     name: 'Pikkit',         icon: Star,       iconColor: '#FF8C00', desc: 'All-in-one sports betting hub with odds, promos, and a community feed.',                              cta: 'Sign Up',    url: 'https://pikkit.com' },
  { id: 'propswap',   name: 'PropSwap',       icon: BookOpen,   iconColor: '#A855F7', desc: 'Buy and sell winning tickets. The only secondary market for sports betting.',                         cta: 'Sign Up',    url: 'https://www.propswap.com' },
  { id: 'actionnet',  name: 'Action Network', icon: TrendingUp, iconColor: '#4FC3F7', desc: 'Trusted source for line movement, sharp money tracking, and betting analytics.',                      cta: 'Sign Up',    url: 'https://www.actionnetwork.com' },
]

// ─── Section label ────────────────────────────────────────────────────────────
function SectionHeader({ label, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(189,255,0,0.55)', textTransform: 'uppercase' }}>{label}</div>
      {right}
    </div>
  )
}

// ─── Book slider (vertical, one card at a time) ───────────────────────────────
function BookSlider({ books }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const book = books[idx]

  const go = (d) => {
    setDir(d)
    setIdx(i => Math.max(0, Math.min(books.length - 1, i + d)))
  }

  if (books.length === 0) return (
    <div style={{ fontFamily: R, fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '20px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
      No books available in this state.
    </div>
  )

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={book.id}
          initial={{ opacity: 0, y: dir > 0 ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dir > 0 ? -20 : 20 }}
          transition={{ duration: 0.2 }}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}
        >
          {/* Card header */}
          <div style={{ background: 'linear-gradient(135deg, rgba(189,255,0,0.1), rgba(189,255,0,0.03))', borderBottom: '1px solid rgba(189,255,0,0.12)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: `${book.logoColor}20`, border: `1px solid ${book.logoColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: R, fontSize: '11px', fontWeight: 800, color: book.logoColor, flexShrink: 0 }}>
                {book.logo}
              </div>
              <div>
                <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{book.name}</div>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', color: NEON, textTransform: 'uppercase' }}>★ AFFILIATE PARTNER</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 800, color: NEON, lineHeight: 1 }}>{book.bonus}</div>
              <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>{book.bonusLabel}</div>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: '12px 16px 14px' }}>
            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{book.promo}</div>
            <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, marginBottom: '12px' }}>{book.desc}</div>
            <a href={book.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%', padding: '10px', background: NEON, borderRadius: '5px', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0A0A0A', textDecoration: 'none', boxSizing: 'border-box' }}>
              {book.cta} <ExternalLink size={10} strokeWidth={2.5} />
            </a>
            <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.15)', marginTop: '7px', textAlign: 'center' }}>Must be 21+. Gambling problem? 1-800-GAMBLER.</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nav row: prev · dots · next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
        <button onClick={() => go(-1)} disabled={idx === 0} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '5px 10px', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>
          <ChevronUp size={14} />
        </button>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {books.map((_, i) => (
            <button key={i} onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i) }} style={{ width: i === idx ? '16px' : '6px', height: '6px', borderRadius: '3px', background: i === idx ? NEON : 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === books.length - 1} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '5px 10px', cursor: idx === books.length - 1 ? 'not-allowed' : 'pointer', color: idx === books.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Tool row ─────────────────────────────────────────────────────────────────
function ToolRow({ tool }) {
  const Icon = tool.icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, background: `${tool.iconColor}18`, border: `1px solid ${tool.iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={tool.iconColor} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff' }}>{tool.name}</div>
        <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '1px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.desc}</div>
      </div>
      <a href={tool.url} target="_blank" rel="noopener noreferrer"
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 11px', background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.22)', borderRadius: '4px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: NEON, textDecoration: 'none' }}>
        {tool.cta} <ChevronRight size={10} />
      </a>
    </div>
  )
}

// ─── Capper card ──────────────────────────────────────────────────────────────
function CapperCard({ capper }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 16px', opacity: capper.disabled ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div>
          <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff' }}>{capper.name}</div>
          <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{capper.handle} · {capper.platform}</div>
        </div>
        <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: capper.tagColor, border: `1px solid ${capper.tagColor}`, borderRadius: '3px', padding: '2px 6px', flexShrink: 0, marginLeft: '8px' }}>
          {capper.tag}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '14px', marginBottom: '8px' }}>
        <div><div style={{ fontFamily: R, fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Record</div><div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff' }}>{capper.record}</div></div>
        <div><div style={{ fontFamily: R, fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ROI</div><div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: NEON }}>{capper.roi}</div></div>
      </div>
      <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, marginBottom: capper.disabled ? 0 : '10px' }}>{capper.desc}</div>
      {!capper.disabled && (
        <a href={capper.url} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 13px', background: 'rgba(189,255,0,0.08)', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '4px', fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEON, textDecoration: 'none' }}>
          Contact Us <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}

const TABS = ['Bonuses', 'Tools', 'Promote', 'Cappers']

// ─────────────────────────────────────────────────────────────────────────────
export default function PartnersPage({ isMobile }) {
  const [tab, setTab]               = useState('Bonuses')
  const [selectedState, setSelectedState] = useState('All States')

  const filteredBooks = selectedState === 'All States' ? BOOKS : BOOKS.filter(b => b.states.includes(selectedState))
  const totalBonus = filteredBooks.reduce((s, b) => s + (parseInt(b.bonus.replace(/[$,]/g, '')) || 0), 0)

  return (
    <div style={{ padding: isMobile ? '12px 14px' : '20px 28px', maxWidth: '640px', margin: '0 auto', paddingBottom: '80px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '3px' }}>RISK MATRIX LABS</div>
        <div style={{ fontFamily: R, fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.1 }}>Offers & Partners</div>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>Tools and partners trusted by the RML community.</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px', gap: '2px' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: tab === t ? NEON : 'rgba(255,255,255,0.3)',
            borderBottom: tab === t ? `2px solid ${NEON}` : '2px solid transparent',
            marginBottom: '-1px', whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>

      {/* ── Bonuses ── */}
      {tab === 'Bonuses' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            {totalBonus > 0
              ? <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: NEON }}>${totalBonus.toLocaleString()}+ available</span>
              : <span />}
            <div style={{ position: 'relative' }}>
              <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{ appearance: 'none', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '5px', color: '#fff', fontFamily: R, fontSize: '10px', fontWeight: 700, padding: '5px 24px 5px 9px', cursor: 'pointer', outline: 'none', letterSpacing: '0.08em' }}>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={11} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <BookSlider books={filteredBooks} />
          <p style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.12)', marginTop: '16px', lineHeight: 1.6 }}>
            Affiliate links — RML may earn a commission. Must be 21+. Problem gambling? 1-800-GAMBLER.
          </p>
        </div>
      )}

      {/* ── Tools ── */}
      {tab === 'Tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TOOLS.map(t => <ToolRow key={t.id} tool={t} />)}
        </div>
      )}

      {/* ── Promote ── */}
      {tab === 'Promote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(189,255,0,0.1), rgba(189,255,0,0.03))', border: '1px solid rgba(189,255,0,0.25)', borderRadius: '10px', padding: '20px 18px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '5px' }}>AFFILIATE PROGRAM</div>
          <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '6px', letterSpacing: '0.03em' }}>Earn by Promoting RML</div>
          <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: '16px' }}>
            Are you a capper, content creator, or community builder in the sports betting space? Partner with Risk Matrix Labs and earn commission for every subscriber you refer — forever.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '18px' }}>
            {[
              { label: 'Commission', value: '30%',     sub: 'per paid subscriber' },
              { label: 'Cookie',     value: '90 Days', sub: 'last-click attribution' },
              { label: 'Payout',     value: 'Monthly', sub: 'PayPal or bank' },
              { label: 'Tracking',   value: 'Live',    sub: 'dashboard + stats' },
            ].map(p => (
              <div key={p.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(189,255,0,0.12)', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '3px' }}>{p.label}</div>
                <div style={{ fontFamily: R, fontSize: '17px', fontWeight: 800, color: NEON }}>{p.value}</div>
                <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>{p.sub}</div>
              </div>
            ))}
          </div>
          <a href="mailto:hello@riskmatrixlabs.com?subject=RML Affiliate Program"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', background: NEON, borderRadius: '5px', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#0A0A0A', textDecoration: 'none' }}>
            Apply Now <ExternalLink size={11} strokeWidth={2.5} />
          </a>
          <div style={{ fontFamily: I, fontSize: '9px', color: 'rgba(255,255,255,0.18)', marginTop: '8px', textAlign: 'center' }}>
            hello@riskmatrixlabs.com — response within 48 hours
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px 18px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '14px' }}>HOW IT WORKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { step: '01', title: 'Apply',         desc: 'Email us or fill out the form. We review and approve within 48 hours.' },
              { step: '02', title: 'Get Your Link', desc: 'You get a unique tracking link like riskmatrixlabs.com?via=yourname' },
              { step: '03', title: 'Share It',      desc: 'Post it on social, Discord, YouTube, newsletter — anywhere your audience is.' },
              { step: '04', title: 'Get Paid',      desc: 'Every subscriber who signs up through your link earns you commission. Monthly payouts.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 800, color: 'rgba(189,255,0,0.3)', minWidth: '26px', letterSpacing: '0.02em', lineHeight: 1 }}>{s.step}</div>
                <div>
                  <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{s.title}</div>
                  <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '2px', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* ── Cappers ── */}
      {tab === 'Cappers' && (
        <div>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px', lineHeight: 1.6 }}>
            RML only partners with cappers who track their record publicly. No gurus. Just verifiable results.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CAPPERS.map(c => <CapperCard key={c.id} capper={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
