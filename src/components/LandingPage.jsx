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
  useEffect(() => {
    // Remove any stale beehiiv script so the loader re-runs after React mounts the div
    document.querySelectorAll('script[src*="beehiiv.com/v3/loader"]').forEach(s => s.remove())
    const script = document.createElement('script')
    script.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js'
    script.async = true
    script.setAttribute('data-beehiiv-form', 'd6ea407b-4704-4045-be5f-b241d4b3c26b')
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch {} }
  }, [])
  return <div data-beehiiv-form="d6ea407b-4704-4045-be5f-b241d4b3c26b" style={{ width: '100%' }} />
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
  'Free Live Odds', 'Spotlight O/U Models', 'Player Props by Player',
  'Line Movement', 'EV + CLV Tracking', 'Graded in Public',
  'PHLT™ Ladder System', 'Round Robin Engine', 'Discipline Score',
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

// ─── SCREENSHOT CAROUSEL ──────────────────────────────────────────────────────
const CAROUSEL_TABS = [
  { label: 'Analytics',    file: 'desktop-overview',   bar: 'BANKROLL COMMAND CENTER' },
  { label: 'Overview',     file: 'desktop-analytics',  bar: 'P&L CURVE + BEHAVIORAL DATA' },
  { label: 'Ladder',       file: 'desktop-ladder',     bar: 'PHLT™ LADDER SIMULATOR' },
  { label: 'Bet Log',      file: 'desktop-bet-log',    bar: 'BET LOG + HISTORY' },
  { label: 'RR Engine',    file: 'desktop-rr-engine',  bar: 'ROUND ROBIN CALCULATOR' },
  { label: 'Session',      file: 'desktop-session',    bar: 'SESSION RECAP + DISCIPLINE SCORE' },
]

function ScreenshotCarousel() {
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setDirection(1)
      setActive(p => (p + 1) % CAROUSEL_TABS.length)
    }, 3200)
    return () => clearTimeout(t)
  }, [active])

  const go = (i) => {
    setDirection(i > active ? 1 : -1)
    setActive(i)
  }

  const tab = CAROUSEL_TABS[active]

  return (
    <div style={{ position: 'relative' }}>
      {/* Preload all images to prevent flash on transition */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {CAROUSEL_TABS.map(t => <img key={t.file} src={`/brand/screenshots/${t.file}.png`} alt="" />)}
      </div>
      {/* Tab pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {CAROUSEL_TABS.map((t, i) => (
          <button key={t.label} onClick={() => go(i)} style={{
            fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', padding: '5px 12px', borderRadius: '3px', cursor: 'pointer',
            border: `1px solid ${i === active ? NEON : 'rgba(255,255,255,0.1)'}`,
            background: i === active ? 'rgba(189,255,0,0.1)' : 'transparent',
            color: i === active ? NEON : 'rgba(255,255,255,0.35)',
            transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Frame */}
      <div style={{ position: 'absolute', inset: '-24px 0 0', borderRadius: '12px', background: 'radial-gradient(ellipse, rgba(189,255,0,0.07) 0%, transparent 70%)', filter: 'blur(24px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(189,255,0,0.16)', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}>
        <div style={{ background: '#111', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />)}
          <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>RISK MATRIX LABS — {tab.bar}</div>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={tab.file}
              src={`/brand/screenshots/${tab.file}.png`}
              alt={tab.label}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%', display: 'block' }}
            />
          </AnimatePresence>
        </div>
      </div>
      {/* Dots */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '14px' }}>
        {CAROUSEL_TABS.map((_, i) => (
          <div key={i} onClick={() => go(i)} style={{
            width: i === active ? '20px' : '6px', height: '6px', borderRadius: '3px',
            background: i === active ? NEON : 'rgba(255,255,255,0.18)',
            cursor: 'pointer', transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem('rml_cookie_ok') } catch { return true }
  })
  const accept = () => {
    try {
      localStorage.setItem('rml_cookie_ok', 'accept')
      // Enable PostHog analytics now that user has consented
      if (typeof window !== 'undefined' && window.posthog?.opt_in_capturing) {
        window.posthog.opt_in_capturing()
      }
    } catch { /* localStorage unavailable */ }
    setVisible(false)
  }
  const dismiss = () => {
    try { localStorage.setItem('rml_cookie_ok', 'dismiss') } catch { /* localStorage unavailable */ }
    setVisible(false)
  }
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(10,10,10,0.97)', borderTop: '1px solid rgba(189,255,0,0.15)',
      padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', flexWrap: 'wrap',
    }}>
      <p style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6, flex: 1, minWidth: '240px' }}>
        We use cookies and similar technologies to operate the site and analyze usage.
        By continuing you agree to our{' '}
        <a href="/privacy" style={{ color: NEON, textDecoration: 'none' }}>Privacy Policy</a>.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button onClick={accept} style={{
          fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', padding: '8px 20px', borderRadius: '3px', cursor: 'pointer',
          background: NEON, border: 'none', color: '#0A0A0A',
        }}>Accept</button>
        <button onClick={dismiss} style={{
          fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', padding: '8px 16px', borderRadius: '3px', cursor: 'pointer',
          background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)',
        }}>Dismiss</button>
      </div>
    </div>
  )
}

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

  const NAV_LINKS = [['features', 'Features'], ['about', 'About'], ['faq', 'FAQ']]

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: I, overflowX: 'hidden' }}>

      {/* ══ NAVBAR ══ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 'calc(64px + env(safe-area-inset-top, 0px))', padding: '0 40px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
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
            <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.3em', color: 'rgba(189,255,0,0.45)', lineHeight: 1, marginTop: '2px' }}>LABS</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '28px', alignItems: 'center' }} className="lp-nav-links">
          {NAV_LINKS.map(([id, label]) => <NavLink key={id} label={label} onClick={() => scrollTo(id)} />)}
          <a href="/pricing" style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: NEON, textTransform: 'uppercase', textDecoration: 'none', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >Pricing</a>
        </nav>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onLogin} className="lp-nav-links" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '3px', padding: '7px 15px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >Log In</button>
          <a href="/pricing" style={{ background: NEON, border: 'none', borderRadius: '3px', padding: '7px 16px', cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: BG, textTransform: 'uppercase', textDecoration: 'none', transition: 'opacity 0.15s, transform 0.15s', display: 'inline-block' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >Start Free Trial</a>
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
            style={{ position: 'fixed', top: 'calc(64px + env(safe-area-inset-top, 0px))', left: 0, right: 0, zIndex: 199, background: 'rgba(10,10,10,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_LINKS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</button>
            ))}
            <a href="/pricing" onClick={() => setMobileMenu(false)} style={{ display: 'block', padding: '12px 0', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, textTransform: 'uppercase', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Pricing</a>
            <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', textAlign: 'left' }}>Log In</button>
            <a href="/pricing" style={{ marginTop: '8px', display: 'block', background: NEON, border: 'none', borderRadius: '3px', padding: '12px', fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: BG, textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>Start Free Trial</a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO ══ */}
      <section ref={heroRef} id="hero" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <HexGrid opacity={0.042} />
        <GlowOrb size={700} x="68%" y="42%" opacity={0.05} />
        <GlowOrb size={300} x="8%"  y="82%" opacity={0.035} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.022) 2px, rgba(0,0,0,0.022) 4px)' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '80px 40px 100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="lp-hero-grid">
            <div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Pill>Graded in public</Pill>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ fontFamily: R, fontWeight: 700, fontSize: 'clamp(40px, 5.5vw, 70px)', letterSpacing: '-0.01em', lineHeight: 1.04, margin: '22px 0 18px', color: '#fff' }}
              >
                We don't sell picks.<br />
                <span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.2)' }}>We show the numbers — graded in public.</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }}
                style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, marginBottom: '32px', maxWidth: '440px' }}>
                Free live odds, model reads, and EV — with every lean graded in public, wins and misses. No picks, no hype. The tools and the discipline; the decisions are yours.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }}>
                <a href="/pricing"
                  style={{ display: 'inline-block', padding: '15px 36px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, textDecoration: 'none', transition: 'opacity 0.15s, transform 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
                >Start My Free Trial →</a>
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '10px' }}>$0 to start · 3 days free · $29/mo or $149/yr after · cancel anytime</div>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.44 }}
                style={{ display: 'flex', gap: '32px', marginTop: '44px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {[['FREE', 'Live odds'], ['PUBLIC', 'Graded record'], ['$0', 'To start']].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: NEON }}>{val}</div>
                    <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '0.06em' }}>{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Dashboard mockup — screenshot carousel */}
            <motion.div className="lp-hero-img"
              initial={{ opacity: 0, x: 36, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative' }}
            >
              <ScreenshotCarousel />
            </motion.div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', textAlign: 'center' }}>↓ Scroll</motion.div>
        </motion.div>
      </section>

      {/* ══ SOCIAL PROOF BAR ══ */}
      <div style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {/* subtle left neon bleed */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: `linear-gradient(to bottom, transparent, ${NEON}, transparent)`, opacity: 0.35 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: `linear-gradient(to bottom, transparent, ${NEON}, transparent)`, opacity: 0.35 }} />
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'stretch' }}>
          {/* trust signals */}
          {[
            { icon: '✦', value: '3-Day Free Trial', sub: 'No card charged until day 4' },
            { icon: '✦', value: 'Cancel Anytime',   sub: 'No contracts, no questions' },
            { icon: '✦', value: 'Free Demo',         sub: 'Try it before you subscribe' },
          ].map(({ icon, value, sub }, i) => (
            <div key={value} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 24px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontFamily: R, fontSize: '10px', color: NEON, opacity: 0.6, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', lineHeight: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
          {/* discord CTA — right-aligned, distinct */}
          <a href="https://discord.gg/smHv7CHc4p" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 28px', textDecoration: 'none', background: 'rgba(189,255,0,0.04)', transition: 'background 0.2s', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(189,255,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(189,255,0,0.04)'}
          >
            <FaDiscord size={16} color={NEON} style={{ opacity: 0.8 }} />
            <div>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', color: NEON, textTransform: 'uppercase', lineHeight: 1 }}>Community</div>
              <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(189,255,0,0.45)', marginTop: '3px' }}>Join on Discord</div>
            </div>
          </a>
        </div>
      </div>

      {/* ══ MARQUEE ══ */}
      <Marquee />

      {/* ══ HOW IT WORKS ══ */}
      <section style={{ padding: '72px 40px', position: 'relative' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <SectionHeader pill="How It Works" title="Scan. Grade.<br/><span style='color:#BDFF00'>Decide.</span>" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0' }} className="lp-4col">
            {[
              { num: '01', title: 'See the edge', desc: 'Open any game free — live odds, line movement since open, win probability, and the by-sportsbook chart. No paywall to look.' },
              { num: '02', title: 'Grade the bet', desc: 'Spotlight O/U models, player props by player, and EV scoring tell you where the value is — and where it isn’t. Every read shown honestly.' },
              { num: '03', title: 'Check the record', desc: 'Every model lean is graded in public — wins and misses, today, yesterday, all-time. No hidden losses, no cherry-picked screenshots.' },
              { num: '04', title: 'Operate with discipline', desc: 'Size every bet, run the ladder, grade the session. Act on real edges with the bankroll system built in — not on tilt.' },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.1}>
                <div style={{ padding: '40px 28px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', position: 'relative' }}>
                  <div style={{ fontFamily: R, fontSize: '48px', fontWeight: 700, color: 'rgba(189,255,0,0.12)', lineHeight: 1, marginBottom: '20px', letterSpacing: '-0.02em' }}>{step.num}</div>
                  <div style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.1em', color: '#fff', marginBottom: '10px', textTransform: 'uppercase' }}>{step.title}</div>
                  <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{step.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ THREE COLUMNS ══ */}
      <section id="what" style={{ position: 'relative', padding: '72px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <SectionHeader pill="What Is It" title="An edge platform<br/><span style='color:#BDFF00'>that grades itself in public.</span>" sub="Risk Matrix Labs is a sports betting edge platform: free live odds, models that show their record — wins and misses — and the discipline system to act on real value. No locks. No hype. Built for operators who run a system." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="lp-3col">
            <FeatureCard delay={0}   icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="10" width="3" height="6" rx="1" fill="#BDFF00"/><rect x="7" y="6" width="3" height="10" rx="1" fill="#BDFF00" opacity=".7"/><rect x="12" y="2" width="3" height="14" rx="1" fill="#BDFF00" opacity=".4"/></svg>} title="See the edge"        desc="Open any game free — live odds, line movement since open, win probability, and the by-sportsbook chart. Spot where the value is before you bet." />
            <FeatureCard delay={0.1} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L9 4M9 14L9 16M2 9L4 9M14 9L16 9" stroke="#BDFF00" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="9" r="4" stroke="#BDFF00" strokeWidth="1.5"/><circle cx="9" cy="9" r="1.5" fill="#BDFF00" opacity=".5"/></svg>} title="Grade the bet"           desc="Spotlight O/U models, player props grouped by player, and EV scoring read every market — and every model lean is graded in public, wins and misses." />
            <FeatureCard delay={0.2} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2 L15 5 L15 10 C15 13.5 12 16 9 17 C6 16 3 13.5 3 10 L3 5 Z" stroke="#BDFF00" strokeWidth="1.5" fill="none"/><path d="M6 9l2 2 4-4" stroke="#BDFF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>} title="Stay disciplined"         desc="Size every bet, run the PHLT™ ladder, track CLV, and grade every session. The bankroll system that turns an edge into a process." />
          </div>
        </div>
      </section>

      {/* ══ GRADED IN PUBLIC (track record) ══ */}
      <section style={{ position: 'relative', padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <HexGrid opacity={0.022} />
        <GlowOrb size={620} x="78%" y="40%" opacity={0.04} />
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionHeader pill="Graded in Public" title="We show our work.<br/><span style='color:#BDFF00'>Wins and misses.</span>" sub="Every model lean is snapshotted before the game and graded against the real result — today, yesterday, all-time. No hidden losses. No cherry-picked screenshots. Most apps won't show you this." />
          <FadeIn delay={0.1}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }} className="lp-3col">
              {[
                { label: 'Spotlight · all-time', rec: '12–13', sub: 'O/U model leans, graded' },
                { label: 'Spotlight · yesterday', rec: '2–1', sub: 'directional leans' },
                { label: 'KBO · yesterday', rec: '1–0', sub: 'no-pick games excluded' },
              ].map(({ label, rec, sub }) => (
                <div key={label} style={{ background: 'rgba(189,255,0,0.04)', border: '1px solid rgba(189,255,0,0.22)', borderRadius: '6px', padding: '24px 22px', textAlign: 'center' }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</div>
                  <div style={{ fontFamily: R, fontSize: '44px', fontWeight: 700, color: NEON, lineHeight: 1, textShadow: '0 0 30px rgba(189,255,0,0.2)' }}>{rec}</div>
                  <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.34)', textAlign: 'center', lineHeight: 1.7 }}>
              Snapshot of the live record. Models are continuously back-tested and still calibrating — we show the real numbers, good and bad. <a href="https://app.riskmatrixlabs.com" style={{ color: NEON, textDecoration: 'none' }}>See it live in the app →</a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ DASHBOARD PREVIEW ══ */}
      <section style={{ position: 'relative', padding: '80px 40px', overflow: 'hidden' }}>
        <GlowOrb size={800} x="20%" y="50%" opacity={0.04} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="lp-hero-grid">
          <FadeIn>
            <Pill>Dashboard Preview</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(28px, 3.5vw, 46px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '20px 0 16px', lineHeight: 1.08 }}>
              A Terminal For<br /><span style={{ color: NEON }}>Your Bankroll.</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: '32px' }}>
              Every data point you need. Nothing you don't. A terminal-style command center that treats your bankroll like a trading account.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Real-time bankroll curve', 'Risk exposure at a glance', 'Bankroll simulation mode', 'Discipline Score™ per session', 'Tilt detection + alerts'].map(item => (
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
                  <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>RISK MATRIX LABS — ANALYTICS VIEW</div>
                </div>
                <img src="/brand/screenshots/desktop-analytics.png" alt="Dashboard Analytics" style={{ width: '100%', display: 'block' }} />
              </div>
            </motion.div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FEATURES GRID ══ */}
      <section id="features" style={{ position: 'relative', padding: '80px 40px 120px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <HexGrid opacity={0.022} />
        <GlowOrb size={600} x="84%" y="55%" opacity={0.036} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <SectionHeader pill="Features" title="Every tool an operator needs" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="lp-3col">
            <FeatureCard delay={0}    icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 13 L5 9 L8 11 L11 6 L14 8 L16 4" stroke="#BDFF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>} title="Free live odds + line movement"  desc="Open any game at $0 — live odds, win probability, and line movement since open across every sportsbook. Paid scans only when you tap refresh." />
            <FeatureCard delay={0.06} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#BDFF00" strokeWidth="1.5"/><circle cx="9" cy="9" r="3.5" stroke="#BDFF00" strokeWidth="1.5" opacity=".6"/><circle cx="9" cy="9" r="1" fill="#BDFF00"/></svg>} title="Spotlight O/U models"       desc="Over/under models on the slate — park, weather, pitching and bullpen — ranked by conviction and graded in public, every lean, wins and misses." />
            <FeatureCard delay={0.12} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 6h12M3 9h8M3 12h10" stroke="#BDFF00" strokeWidth="1.5" strokeLinecap="round"/><rect x="12" y="7" width="4" height="7" rx="1" stroke="#BDFF00" strokeWidth="1.5" opacity=".6"/></svg>} title="Player props by player"       desc="Props grouped by player — every market, best price across books, and the EV edge on each line so you see value at a glance." />
            <FeatureCard delay={0.18} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="13" width="16" height="2" rx="1" fill="#BDFF00"/><rect x="3" y="9" width="12" height="2" rx="1" fill="#BDFF00" opacity=".6"/><rect x="6" y="5" width="6" height="2" rx="1" fill="#BDFF00" opacity=".35"/></svg>} title="EV + CLV tracking"       desc="Log a play and Beat the Close grades it on closing-line value — the truest measure of whether a bet was actually sharp." />
            <FeatureCard delay={0.24} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="13" width="16" height="2" rx="1" fill="#BDFF00"/><rect x="3" y="9" width="12" height="2" rx="1" fill="#BDFF00" opacity=".6"/><rect x="6" y="5" width="6" height="2" rx="1" fill="#BDFF00" opacity=".35"/></svg>} title="PHLT™ Ladder + unit sizing"          desc="Fund each bet from previous winnings only, size every stake from your bankroll %, and protect your principal at every rung." />
            <FeatureCard delay={0.30} icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="#BDFF00" strokeWidth="1.5"/><path d="M6 7h6M6 10h4" stroke="#BDFF00" strokeWidth="1.5" strokeLinecap="round" opacity=".6"/></svg>} title="Session grading + discipline"     desc="Every session graded on process, not results, with a Discipline Score that compounds. Run a round robin and see exposure, payout, and break-even hit rate." />
          </div>
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
              {/* Price display */}
              <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '32px' }}>
                <div>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Monthly</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontFamily: R, fontSize: '56px', fontWeight: 700, color: NEON, lineHeight: 1, textShadow: '0 0 30px rgba(189,255,0,0.25)' }}>$29</span>
                    <span style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>/month</span>
                  </div>
                  <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginTop: '4px' }}>Cancel anytime</div>
                </div>
                <div style={{ paddingBottom: '8px' }}>
                  <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase', marginBottom: '6px' }}>Annual — Best Value</div>
                  <div style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: '#fff' }}>$149<span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/yr</span></div>
                  <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(189,255,0,0.6)', marginTop: '2px' }}>$12.42/mo · save $199 vs monthly</div>
                </div>
              </div>

              {/* Features list */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: '36px' }} className="lp-pricing-grid">
                {[
                  'Free Live Odds + Game Center', 'Spotlight O/U Models',
                  'Player Props by Player', 'EV + CLV Tracking',
                  'Line Movement + Line Shop', 'PHLT™ Ladder System',
                  'Unit Sizing + Round Robin', 'Session Grading + Discipline Score',
                  'Public Model Record', 'All future features',
                ].map(feature => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: NEON, fontWeight: 700, flexShrink: 0 }}>✓</span>{feature}
                  </div>
                ))}
              </div>

              <a href="/pricing"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '15px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, textDecoration: 'none', textAlign: 'center', transition: 'opacity 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
              >Start My Free Trial →</a>

              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.22)', textAlign: 'center', marginTop: '16px' }}>
                3 days free · no charge until day 4 · cancel anytime · annual plan saves $199/yr
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ CREATORS EARN HOOK ══ */}
      <section style={{ padding: '48px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(189,255,0,0.03)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(189,255,0,0.1)', border: '1px solid rgba(189,255,0,0.3)', borderRadius: '3px', padding: '4px 10px', marginBottom: '12px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: NEON, display: 'inline-block' }} />
              <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: NEON, textTransform: 'uppercase' }}>For Creators & Cappers</span>
            </div>
            <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', lineHeight: 1.3 }}>Your audience already bets.<br />Start getting paid for it.</div>
            <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>30% recurring commission. Free to join.</div>
          </div>
          <a href="/affiliates" style={{ display: 'inline-block', padding: '12px 28px', background: 'transparent', border: `1px solid ${NEON}`, borderRadius: '3px', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = NEON; e.currentTarget.style.color = BG }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NEON }}
          >Get Your Link →</a>
        </div>
      </section>

      {/* ══ ABOUT ══ */}
      <section style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', position: 'relative', overflow: 'hidden' }}>
        <HexGrid opacity={0.02} />
        <div style={{ maxWidth: '760px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn style={{ textAlign: 'center' }}>
            <Pill>About</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '20px 0 20px', lineHeight: 1.1 }}>
              Built by an operator.<br /><span style={{ color: NEON }}>For operators.</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.85 }}>
              Risk Matrix Labs was built because no tool existed that treated sports betting like what it actually is — a risk management discipline and a bankroll simulation problem. We built the operating system we wished existed. Now we're sharing it.
            </p>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.85, marginTop: '20px' }}>
              Whether you're managing your own bankroll or you're a capper whose followers need real tools to tail your picks — Risk Matrix Labs gives everyone on your roster the infrastructure to execute with discipline.
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
      <section id="faq" style={{ padding: '80px 40px 60px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <SectionHeader pill="FAQ" title="Common Questions" />
          <FAQItem delay={0}    q="What is Risk Matrix Labs?" a="A sports betting edge platform: free live odds, models that read the slate and show their record in public, and a bankroll discipline system to act on real value. See the edge, grade the bet, operate with discipline." />
          <FAQItem delay={0.05} q="Do you sell picks?" a="No. We never sell picks and we never will. Our models surface where there may be value, and we grade every lean openly — wins and misses. We give you the numbers and the discipline; the decisions are yours. Information and tools, not advice." />
          <FAQItem delay={0.07} q="Do you guarantee wins?" a="No — and anyone who does is lying. Our models are continuously back-tested and still calibrating, and we show the real record, good and bad. We sell honesty and discipline, not a crystal ball." />
          <FAQItem delay={0.1}  q="How does the free trial work?" a="Start your 3-day free trial — no charge until day 4. You'll see the exact billing date and amount before you enter your card. Cancel anytime, no questions asked." />
          <FAQItem delay={0.15} q="How much does it cost?" a="$29/month, or $149/year (saves you $199 vs monthly). Annual plan works out to $12.42/month. Both plans include a 3-day free trial — no charge until day 4." />
          <FAQItem delay={0.2}  q="Does it work on mobile?" a="Yes. Risk Matrix Labs is built mobile-first. Log bets, run the ladder, and grade sessions from your phone — your data syncs across every device automatically." />
          <FAQItem delay={0.25} q="Is my data safe?" a="All data is encrypted, stored securely, and backed up automatically. You own your data and can export it at any time." />
        </div>
      </section>

      {/* ══ NEWSLETTER ══ */}
      <section id="newsletter" style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <FadeIn>
            <Pill>Free Newsletter</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', margin: '16px 0 10px', textTransform: 'uppercase' }}>
              Operate With Discipline
            </h2>
            <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, marginBottom: '28px' }}>
              Bankroll strategy, risk management frameworks, and discipline systems — straight to your inbox. No picks. No hype.
            </p>
            <WaitlistForm />
            <p style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '14px', letterSpacing: '0.04em' }}>
              Free forever. Unsubscribe anytime.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section id="beta" style={{ position: 'relative', padding: '100px 40px', overflow: 'hidden', textAlign: 'center' }}>
        <HexGrid opacity={0.038} />
        <GlowOrb size={900} x="50%" y="50%" opacity={0.06} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '660px', margin: '0 auto' }}>
          <FadeIn>
            <Pill>Ready To Operate</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(34px, 5vw, 62px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '24px 0 18px', lineHeight: 1.05 }}>
              Ready To Operate<br /><span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.18)' }}>With Discipline?</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: '36px' }}>
              Start your 3-day free trial today. No charge until day 4.<br />
              <strong style={{ color: 'rgba(255,255,255,0.65)' }}>$29/month or $149/year — annual plan saves $199.</strong>
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <a href="/pricing"
              style={{ display: 'inline-block', padding: '16px 48px', background: NEON, border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: R, fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, textDecoration: 'none', transition: 'opacity 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >Start My Free Trial →</a>
            <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.18)', marginTop: '14px' }}>
              3 days free · cancel anytime · questions?{' '}
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
                The bankroll operating system for disciplined operators.
              </div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(189,255,0,0.3)', textTransform: 'uppercase', marginTop: '12px' }}>
                Operate With Discipline.
              </div>
            </div>

            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Links</div>
              {[['Features', '#features'], ['Pricing', '/pricing'], ['About', '#about'], ['FAQ', '#faq']].map(([label, href]) => (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.16)' }}>© 2026 Risk Matrix Labs LLC. All rights reserved.</div>
              <a href="/privacy" style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.28)'}
              >Privacy Policy</a>
              <a href="/terms" style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.28)'}
              >Terms of Service</a>
              <a href="/pricing" style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.28)'}
              >Pricing</a>
              <a href="/affiliates" style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.28)'}
              >Affiliates</a>
            <a href="/press" style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.28)'}
              >Press</a>
            </div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.26)', textTransform: 'uppercase' }}>Operate With Discipline.</div>
          </div>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <span style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.14)', lineHeight: 1.6 }}>
              Past performance does not guarantee future results. Risk Matrix Labs is a bankroll simulation and tracking tool — not financial or gambling advice.
            </span>
          </div>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <span style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.14)', lineHeight: 1.6 }}>
              Please bet responsibly. If you or someone you know has a gambling problem, help is available 24/7 at{' '}
              <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.24)', textDecoration: 'underline' }}>ncpgambling.org</a>
              {' '}or call the National Problem Gambling Helpline: <strong style={{ color: 'rgba(255,255,255,0.22)' }}>1-800-522-4700</strong>
            </span>
          </div>
        </div>
      </footer>

      {/* ══ RESPONSIVE ══ */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero-grid    { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-hero-img     { display: none !important; }
          .lp-3col         { grid-template-columns: 1fr 1fr !important; }
          .lp-4col         { grid-template-columns: 1fr 1fr !important; }
          .lp-nav-links    { display: none !important; }
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
          .lp-hamburger    { display: flex !important; }
        }
        @media (max-width: 560px) {
          .lp-3col { grid-template-columns: 1fr !important; }
          .lp-4col { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          section, footer { padding-left: 20px !important; padding-right: 20px !important; }
          header          { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
      <CookieBanner />
    </div>
  )
}
