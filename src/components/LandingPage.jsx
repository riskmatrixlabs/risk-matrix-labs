import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { FaInstagram, FaTiktok, FaYoutube, FaDiscord } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NEON    = '#BDFF00'
const BG      = '#0A0A0A'
const RED     = '#FF3B3B'
const R       = "'Rajdhani', sans-serif"
const I       = "'Inter', sans-serif"
const BEEHIIV = 'https://riskmatrixlabs.beehiiv.com/subscribe'

// ─── HEX GRID ─────────────────────────────────────────────────────────────────
function HexGrid({ opacity = 0.04 }) {
  const id = useRef(`hex-${Math.random().toString(36).slice(2)}`).current
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="28,2 52,14 52,34 28,46 4,34 4,14" fill="none" stroke={NEON} strokeWidth="0.6" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

// ─── GLOW ORB ─────────────────────────────────────────────────────────────────
function GlowOrb({ size = 400, x = '50%', y = '50%', opacity = 0.06, color = NEON }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)',
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity, pointerEvents: 'none', filter: 'blur(40px)',
    }} />
  )
}

// ─── FADE IN ON SCROLL ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, y = 22, style, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} style={style} className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  )
}

// ─── PILL ─────────────────────────────────────────────────────────────────────
function Pill({ children, color = NEON }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em',
      color, textTransform: 'uppercase',
      border: `1px solid ${color}44`, borderRadius: '2px',
      padding: '5px 12px', background: `${color}0D`,
    }}>
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, display: 'block' }}
      />
      {children}
    </span>
  )
}

// ─── WAITLIST FORM ────────────────────────────────────────────────────────────
function WaitlistForm() {
  return (
    <div data-beehiiv-form="d6ea407b-4704-4045-be5f-b241d4b3c26b" style={{ width: '100%' }} />
  )
}

// ─── FEATURE CARD ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay = 0 }) {
  return (
    <FadeIn delay={delay}>
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderTop: `2px solid rgba(189,255,0,0.28)`, borderRadius: '4px',
        padding: '28px 24px', height: '100%', transition: 'all 0.22s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(189,255,0,0.42)'; e.currentTarget.style.background = 'rgba(189,255,0,0.03)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <div style={{ fontSize: '26px', marginBottom: '14px' }}>{icon}</div>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.14em', color: '#fff', marginBottom: '8px', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{desc}</div>
      </div>
    </FadeIn>
  )
}

// ─── SOCIAL BUTTON ────────────────────────────────────────────────────────────
function SocialBtn({ Icon, href, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      style={{ width: '38px', height: '38px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.38)', textDecoration: 'none', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(189,255,0,0.4)'; e.currentTarget.style.color = NEON; e.currentTarget.style.background = 'rgba(189,255,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; e.currentTarget.style.background = 'transparent' }}
    ><Icon size={15} /></a>
  )
}

// ─── NAV LINK ─────────────────────────────────────────────────────────────────
function NavLink({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: R, fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', transition: 'color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
    >{label}</button>
  )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ pill, title, sub, center = true }) {
  return (
    <FadeIn style={{ textAlign: center ? 'center' : 'left', marginBottom: '64px' }}>
      {pill && <Pill>{pill}</Pill>}
      <h2 style={{ fontFamily: R, fontSize: 'clamp(28px, 3.8vw, 48px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '20px 0 16px', lineHeight: 1.08 }}
        dangerouslySetInnerHTML={{ __html: title }} />
      {sub && <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', maxWidth: center ? '520px' : '100%', margin: center ? '0 auto' : '0', lineHeight: 1.75 }}>{sub}</p>}
    </FadeIn>
  )
}

// ─── MARQUEE ──────────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  'Bankroll Management', 'Risk Control', 'Ladder Systems',
  'Round Robin Engine', 'Session Grading', 'Discipline Systems',
  'Unit Calculator', 'Tilt Detection', 'Performance Analytics',
]

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 0', background: 'rgba(189,255,0,0.03)' }}>
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
        style={{ display: 'flex', gap: '0', whiteSpace: 'nowrap', width: 'max-content' }}
      >
        {items.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '20px', padding: '0 24px' }}>
            <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>{item}</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: NEON, opacity: 0.6, flexShrink: 0 }} />
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── FAQ ITEM ─────────────────────────────────────────────────────────────────
function FAQItem({ q, a, delay = 0 }) {
  const [open, setOpen] = useState(false)
  return (
    <FadeIn delay={delay}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
          textAlign: 'left',
        }}>
          <span style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, letterSpacing: '0.06em', color: open ? NEON : '#fff', transition: 'color 0.2s' }}>{q}</span>
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.22 }}
            style={{ fontFamily: R, fontSize: '24px', color: NEON, flexShrink: 0, lineHeight: 1 }}>+</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
              <div style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, paddingBottom: '20px' }}>{a}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  )
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 36)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMobileMenu(false) }

  const NAV_LINKS = [['features', 'Features'], ['pricing', 'Pricing'], ['beta', 'Beta']]

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: I, overflowX: 'hidden' }}>

      {/* ══ NAVBAR ══ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: '64px', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        background: scrolled ? 'rgba(10,10,10,0.9)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <img src="/brand/logos/logo-dashboard.png" alt="Risk Matrix" style={{ height: '34px' }} />
          <div>
            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, lineHeight: 1 }}>RISK MATRIX</div>
            <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.3em', color: 'rgba(189,255,0,0.45)', lineHeight: 1, marginTop: '2px' }}>DASHBOARD</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '28px' }} className="lp-nav-links">
          {NAV_LINKS.map(([id, label]) => <NavLink key={id} label={label} onClick={() => scrollTo(id)} />)}
        </nav>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onLogin} className="lp-nav-links" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '3px', padding: '7px 15px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >Log In</button>
          <button onClick={onLogin} style={{ background: NEON, border: 'none', borderRadius: '3px', padding: '7px 16px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: BG, textTransform: 'uppercase', transition: 'opacity 0.15s, transform 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
          >Request Beta</button>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenu(o => !o)} className="lp-hamburger" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', flexDirection: 'column', gap: '4px', padding: '4px' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: '22px', height: '2px', background: 'rgba(255,255,255,0.7)', borderRadius: '1px' }} />)}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 199, background: 'rgba(10,10,10,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</button>
            ))}
            <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', textAlign: 'left' }}>Log In</button>
            <button onClick={onLogin} style={{ marginTop: '8px', background: NEON, border: 'none', borderRadius: '3px', padding: '12px', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: BG, textTransform: 'uppercase', cursor: 'pointer' }}>Start Free Trial</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO ══ */}
      <section ref={heroRef} id="hero" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: '64px' }}>
        <HexGrid opacity={0.042} />
        <GlowOrb size={700} x="68%" y="42%" opacity={0.05} />
        <GlowOrb size={300} x="8%"  y="82%" opacity={0.035} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.022) 2px, rgba(0,0,0,0.022) 4px)' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '80px 40px 100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="lp-hero-grid">
            <div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Pill>Beta Access Open</Pill>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ fontFamily: R, fontWeight: 700, fontSize: 'clamp(40px, 5.5vw, 70px)', letterSpacing: '-0.01em', lineHeight: 1.04, margin: '22px 0 18px', color: '#fff' }}
              >
                Stop Gambling.<br />
                <span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.2)' }}>Start Operating.</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }}
                style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, marginBottom: '32px', maxWidth: '440px' }}>
                The platform built for bettors who operate with a system. Bankroll management, risk controls, and session analytics — built for discipline, not luck.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }}>
                <button onClick={onLogin}
                  style={{ padding: '15px 36px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, transition: 'opacity 0.15s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
                >Start My Free Trial →</button>
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '10px' }}>7 days free · $17/month after · cancel anytime</div>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.44 }}
                style={{ display: 'flex', gap: '32px', marginTop: '44px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {[['6', 'Core Modules'], ['100pt', 'Discipline Score™'], ['PHLT™', 'Ladder System']].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: NEON }}>{val}</div>
                    <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '0.06em' }}>{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Dashboard mockup */}
            <motion.div className="lp-hero-img"
              initial={{ opacity: 0, x: 36, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative' }}
            >
              <div style={{ position: 'absolute', inset: '-24px', borderRadius: '12px', background: 'radial-gradient(ellipse, rgba(189,255,0,0.07) 0%, transparent 70%)', filter: 'blur(24px)' }} />
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(189,255,0,0.16)', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}>
                <div style={{ background: '#111', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />)}
                  <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>RISK MATRIX DASHBOARD — OPERATOR VIEW</div>
                </div>
                <img src="/brand/screenshots/desktop/dashboard-overview-full.png" alt="Dashboard Preview" style={{ width: '100%', display: 'block' }} />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', textAlign: 'center' }}>↓ Scroll</motion.div>
        </motion.div>
      </section>

      {/* ══ MARQUEE ══ */}
      <Marquee />

      {/* ══ THREE COLUMNS ══ */}
      <section id="what" style={{ position: 'relative', padding: '120px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <SectionHeader pill="What Is It" title="Built For Operators.<br/><span style='color:#BDFF00'>Not Gamblers.</span>" sub="Risk Matrix Labs is a professional-grade bankroll management platform. Every bet tracked, every dollar protected, every session graded." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="lp-3col">
            <FeatureCard delay={0}   icon="📊" title="Track Like A Trader"        desc="Real-time bankroll curve, unit sizing, P&L tracking, and rolling performance metrics across every bet you place." />
            <FeatureCard delay={0.1} icon="🛡️" title="Manage Your Risk"           desc="Set daily limits, max bet size, stop-loss levels, and profit locks. Know your exposure before you place a single dollar." />
            <FeatureCard delay={0.2} icon="🧠" title="Stay In The System"         desc="Tilt detection flags when you're off track. Pre-session checklists enforce your process. Your Discipline Score™ doesn't lie." />
          </div>
        </div>
      </section>

      {/* ══ FEATURES GRID ══ */}
      <section id="features" style={{ position: 'relative', padding: '80px 40px 120px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <HexGrid opacity={0.022} />
        <GlowOrb size={600} x="84%" y="55%" opacity={0.036} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionHeader pill="Features" title="Every Tool An Operator Needs" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="lp-3col">
            <FeatureCard delay={0}    icon="🪜" title="PHLT™ Ladder Tracker"    desc="Fund each bet only from previous winnings. Protect your principal at every rung of the ladder system." />
            <FeatureCard delay={0.06} icon="🎯" title="Unit Calculator"          desc="Configure your unit % and instantly see 0.25u through 5u stake sizes in dollars. Size every bet with precision." />
            <FeatureCard delay={0.12} icon="⚙️" title="Round Robin Engine"       desc="Build 2–5 team round robins. See every combo, total exposure, max payout, and the break-even hit rate you need." />
            <FeatureCard delay={0.18} icon="🧘" title="Pre-Session Checklist"    desc="Answer 5 discipline questions before your session starts. Are you chasing? Tilted? If the checklist fails — you don't bet." />
            <FeatureCard delay={0.24} icon="📝" title="Session Grading"          desc="Every session earns an A–F grade based on your process, not your results. Discipline compounds over time." />
            <FeatureCard delay={0.30} icon="📈" title="Performance Analytics"    desc="Break down your edge by sport, book, bet type, and time period. Know what's working — and what's bleeding you." />
          </div>
        </div>
      </section>

      {/* ══ DASHBOARD PREVIEW ══ */}
      <section style={{ position: 'relative', padding: '120px 40px', overflow: 'hidden' }}>
        <GlowOrb size={800} x="20%" y="50%" opacity={0.04} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="lp-hero-grid">
          <FadeIn>
            <Pill>Dashboard Preview</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(28px, 3.5vw, 46px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '20px 0 16px', lineHeight: 1.08 }}>
              Built For Operators.<br /><span style={{ color: NEON }}>Not Gamblers.</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: '32px' }}>
              Every data point you need. Nothing you don't. A terminal-style command center that treats your bankroll like a trading account.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Real-time bankroll curve', 'Risk exposure at a glance', 'Discipline Score™ per session', 'Tilt detection + alerts', 'Cloud sync across devices'].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NEON, flexShrink: 0 }} />{item}
                </li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn delay={0.12}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '-20px', borderRadius: '12px', background: 'radial-gradient(ellipse, rgba(189,255,0,0.06) 0%, transparent 70%)', filter: 'blur(20px)' }} />
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(189,255,0,0.14)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ background: '#111', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />)}
                  <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>OVERVIEW — OPERATOR SESSION</div>
                </div>
                <img src="/brand/screenshots/desktop/dashboard-overview-header.png" alt="Dashboard Stats" style={{ width: '100%', display: 'block' }} />
              </div>
            </motion.div>
          </FadeIn>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" style={{ position: 'relative', padding: '80px 40px 120px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <HexGrid opacity={0.025} />
        <GlowOrb size={700} x="50%" y="50%" opacity={0.045} />
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionHeader pill="Pricing" title="One Price.<br/><span style='color:#BDFF00'>Everything Included.</span>" sub="No tiers. No upsells. Everything you need to operate with discipline — in one plan." />

          <FadeIn delay={0.1}>
            <div style={{ position: 'relative', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(189,255,0,0.3)', borderRadius: '6px', padding: '48px', overflow: 'hidden' }}>
              {/* Beta badge */}
              <div style={{ position: 'absolute', top: '20px', right: '20px', background: NEON, color: BG, fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '2px' }}>
                BETA PRICE
              </div>

              {/* Price display */}
              <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '32px' }}>
                <div>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Beta Price — Lock It In Now</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontFamily: R, fontSize: '56px', fontWeight: 700, color: NEON, lineHeight: 1, textShadow: '0 0 30px rgba(189,255,0,0.25)' }}>$17</span>
                    <span style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>/month</span>
                  </div>
                  <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginTop: '4px' }}>Locked in for life — as long as you stay subscribed</div>
                </div>
                <div style={{ paddingBottom: '8px' }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Regular Price</div>
                  <div style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>$27/mo</div>
                  <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginTop: '2px' }}>or $197/year (save $127)</div>
                </div>
              </div>

              {/* Features list */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: '36px' }} className="lp-pricing-grid">
                {[
                  'PHLT™ Ladder Tracker', 'Unit Calculator',
                  'Round Robin Engine', 'Emotional Checklist',
                  'Session Grading (A–F)', 'Discipline Score™',
                  'Performance Analytics', 'Tilt Detection',
                  'Cloud Sync + Backup', 'All future features',
                ].map(feature => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: NEON, fontWeight: 700, flexShrink: 0 }}>✓</span>{feature}
                  </div>
                ))}
              </div>

              <button onClick={onLogin}
                style={{ width: '100%', padding: '15px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, transition: 'opacity 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
              >Start My Free Trial →</button>

              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.22)', textAlign: 'center', marginTop: '16px' }}>
                7 days free · $17/month after · cancel anytime
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section style={{ padding: '120px 40px', position: 'relative' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <SectionHeader pill="How It Works" title="Three Steps.<br/><span style='color:#BDFF00'>One System.</span>" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }} className="lp-3col">
            {[
              { num: '01', title: 'Set Your Bankroll', desc: 'Enter your starting bankroll, configure your unit size %, and lock in your risk limits. The system calculates everything else automatically.' },
              { num: '02', title: 'Operate Every Session', desc: 'Log every bet. Run the pre-session checklist. Use the unit calculator and round robin engine. No guessing — just execution.' },
              { num: '03', title: 'Grade Your Process', desc: 'Settle bets, review your Discipline Score™, and grade the session A–F. Your record is built on process — not results.' },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.12}>
                <div style={{ padding: '40px 32px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', position: 'relative' }}>
                  <div style={{ fontFamily: R, fontSize: '52px', fontWeight: 700, color: 'rgba(189,255,0,0.12)', lineHeight: 1, marginBottom: '20px', letterSpacing: '-0.02em' }}>{step.num}</div>
                  <div style={{ fontFamily: R, fontSize: '16px', fontWeight: 700, letterSpacing: '0.1em', color: '#fff', marginBottom: '10px', textTransform: 'uppercase' }}>{step.title}</div>
                  <div style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{step.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ABOUT ══ */}
      <section style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', position: 'relative', overflow: 'hidden' }}>
        <HexGrid opacity={0.02} />
        <div style={{ maxWidth: '760px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn style={{ textAlign: 'center' }}>
            <Pill>About</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '20px 0 20px', lineHeight: 1.1 }}>
              Built By A Bettor.<br /><span style={{ color: NEON }}>For Bettors.</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.85 }}>
              Risk Matrix Labs was built because no tool existed that treated sports betting like what it actually is — a risk management discipline. We built the system we wished existed. Now we're sharing it.
            </p>
            <div style={{ marginTop: '32px', padding: '24px 28px', background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.2)', borderRadius: '4px' }}>
              <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, textTransform: 'uppercase' }}>
                "Operate With Discipline."
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section style={{ padding: '120px 40px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <SectionHeader pill="FAQ" title="Common Questions" />
          <FAQItem delay={0}    q="What is Risk Matrix Labs?" a="A professional bankroll management platform built for disciplined sports bettors. Track every bet, manage your risk, and grade every session — with the tools of a real operator." />
          <FAQItem delay={0.05} q="Is this a picks service?" a="No. We don't sell picks. We build the systems that help you manage your bankroll with discipline. Risk Matrix Labs is about process — not predictions." />
          <FAQItem delay={0.1}  q="When does it launch?" a="We are live now in beta. Start your 7-day free trial today — no credit card charge until day 8. Beta subscribers lock in their rate for as long as they stay subscribed." />
          <FAQItem delay={0.15} q="How much does it cost?" a="$17/month or $147/year during beta (save 28%). Regular pricing will be $27/month. Lock in the beta rate now — it won't be available once we exit beta." />
          <FAQItem delay={0.2}  q="Does it work on mobile?" a="Yes. Risk Matrix Labs is fully responsive and works on desktop, tablet, and mobile. Your data syncs automatically across every device." />
          <FAQItem delay={0.25} q="Is my data safe?" a="All data is encrypted, stored securely, and backed up automatically. You own your data and can export it at any time." />
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section id="beta" style={{ position: 'relative', padding: '140px 40px', overflow: 'hidden', textAlign: 'center' }}>
        <HexGrid opacity={0.038} />
        <GlowOrb size={900} x="50%" y="50%" opacity={0.06} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '660px', margin: '0 auto' }}>
          <FadeIn>
            <Pill>Ready To Operate</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(34px, 5vw, 62px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '24px 0 18px', lineHeight: 1.05 }}>
              Ready To Operate<br /><span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.18)' }}>With Discipline?</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: '36px' }}>
              Start your 7-day free trial today. No charge until day 8.<br />
              <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Beta users lock in $17/month — for as long as they stay subscribed.</strong>
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <button onClick={onLogin}
              style={{ padding: '16px 48px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, transition: 'opacity 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >Start My Free Trial →</button>
            <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.18)', marginTop: '14px' }}>
              7 days free · cancel anytime · questions?{' '}
              <a href="mailto:hello@riskmatrixlabs.com" style={{ color: 'rgba(189,255,0,0.55)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(189,255,0,0.55)'}
              >hello@riskmatrixlabs.com</a>
            </div>
          </FadeIn>
          <FadeIn delay={0.24}>
            <div style={{ marginTop: '60px', paddingTop: '44px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.32em', color: 'rgba(189,255,0,0.38)', textTransform: 'uppercase' }}>
                Discipline Today. Freedom Tomorrow.
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 40px 36px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '36px' }}>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <img src="/brand/logos/logo-dashboard.png" alt="Risk Matrix" style={{ height: '26px' }} />
                <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>RISK MATRIX LABS</div>
              </div>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.65, maxWidth: '220px' }}>
                Professional bankroll management for disciplined sports bettors.
              </div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(189,255,0,0.3)', textTransform: 'uppercase', marginTop: '12px' }}>
                Operate With Discipline.
              </div>
            </div>

            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Links</div>
              {[['Features', '#features'], ['Pricing', '#pricing'], ['Beta', '#beta'], ['About', '#about'], ['FAQ', '#faq']].map(([label, href]) => (
                <div key={label} style={{ marginBottom: '8px' }}>
                  <a href={href} style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.36)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.36)'}
                  >{label}</a>
                </div>
              ))}
              <div style={{ marginBottom: '8px', marginTop: '4px' }}>
                <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.36)', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.36)'}
                >Log In</button>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Contact</div>
              {[['hello@riskmatrixlabs.com', 'mailto:hello@riskmatrixlabs.com'], ['support@riskmatrixlabs.com', 'mailto:support@riskmatrixlabs.com']].map(([label, href]) => (
                <div key={label} style={{ marginBottom: '8px' }}>
                  <a href={href} style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.36)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = NEON}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.36)'}
                  >{label}</a>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Follow</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <SocialBtn Icon={FaInstagram} href="https://www.instagram.com/riskmatrixlabs" label="Instagram" />
                <SocialBtn Icon={FaXTwitter}  href="https://x.com/riskmatrixlabs" label="X / Twitter" />
                <SocialBtn Icon={FaTiktok}    href="https://www.tiktok.com/@riskmatrixlabs" label="TikTok" />
                <SocialBtn Icon={FaYoutube}   href="https://www.youtube.com/@riskmatrixlabs" label="YouTube" />
                <SocialBtn Icon={FaDiscord}   href="https://discord.gg/smHv7CHc4p" label="Discord" />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '44px', paddingTop: '22px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.16)' }}>© 2026 Risk Matrix Labs LLC. All rights reserved.</div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.26)', textTransform: 'uppercase' }}>Operate With Discipline.</div>
          </div>
        </div>
      </footer>

      {/* ══ RESPONSIVE ══ */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero-grid    { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-hero-img     { display: none !important; }
          .lp-3col         { grid-template-columns: 1fr 1fr !important; }
          .lp-nav-links    { display: none !important; }
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
          .lp-hamburger    { display: flex !important; }
        }
        @media (max-width: 560px) {
          .lp-3col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          section, footer { padding-left: 20px !important; padding-right: 20px !important; }
          header          { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
    </div>
  )
}
