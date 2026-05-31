import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  FaInstagram, FaTiktok, FaYoutube, FaDiscord,
} from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NEON    = '#BDFF00'
const BG      = '#0A0A0A'
const R       = "'Rajdhani', sans-serif"
const I       = "'Inter', sans-serif"
const BEEHIIV = 'https://riskmatrixlabs.beehiiv.com/subscribe'

// ─── HEX GRID ─────────────────────────────────────────────────────────────────
function HexGrid({ opacity = 0.04 }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="28,2 52,14 52,34 28,46 4,34 4,14" fill="none" stroke={NEON} strokeWidth="0.6" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  )
}

// ─── GLOW ORB ─────────────────────────────────────────────────────────────────
function GlowOrb({ size = 400, x = '50%', y = '50%', opacity = 0.06 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)',
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle, ${NEON} 0%, transparent 70%)`,
      opacity, pointerEvents: 'none', filter: 'blur(40px)',
    }} />
  )
}

// ─── FADE IN ON SCROLL ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, y = 24, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  )
}

// ─── PILL BADGE ───────────────────────────────────────────────────────────────
function Pill({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em',
      color: NEON, textTransform: 'uppercase',
      border: `1px solid rgba(189,255,0,0.32)`, borderRadius: '2px',
      padding: '5px 12px', background: 'rgba(189,255,0,0.06)',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: NEON, boxShadow: `0 0 8px ${NEON}` }} />
      {children}
    </span>
  )
}

// ─── WAITLIST FORM ────────────────────────────────────────────────────────────
function WaitlistForm({ size = 'lg' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const isLg = size === 'lg'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const fd = new FormData()
      fd.append('email', email)
      await fetch(BEEHIIV, { method: 'POST', body: fd, mode: 'no-cors' })
    } catch {}
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{
        background: 'rgba(189,255,0,0.06)', border: `1px solid rgba(189,255,0,0.32)`,
        borderRadius: '4px', padding: isLg ? '20px 28px' : '14px 20px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: R, fontSize: isLg ? '17px' : '14px', fontWeight: 700, letterSpacing: '0.14em', color: NEON, marginBottom: '4px' }}>YOU'RE ON THE LIST ✓</div>
        <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>We'll reach out when access opens. Operate with discipline.</div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="Enter your email address" required
        style={{
          flex: '1 1 220px', padding: isLg ? '14px 18px' : '11px 14px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '3px', color: '#fff', fontFamily: I, fontSize: isLg ? '14px' : '13px', outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(189,255,0,0.45)'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
      />
      <button type="submit" disabled={status === 'loading'} style={{
        padding: isLg ? '14px 28px' : '11px 20px',
        background: NEON, border: 'none', borderRadius: '3px',
        color: BG, fontFamily: R, fontSize: isLg ? '13px' : '12px', fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
        whiteSpace: 'nowrap', opacity: status === 'loading' ? 0.7 : 1,
        transition: 'opacity 0.15s, transform 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {status === 'loading' ? 'Joining...' : 'Join the Waitlist →'}
      </button>
    </form>
  )
}

// ─── FEATURE CARD ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay = 0 }) {
  return (
    <FadeIn delay={delay}>
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderTop: `2px solid rgba(189,255,0,0.3)`, borderRadius: '4px',
        padding: '28px 24px', height: '100%',
        transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(189,255,0,0.45)'; e.currentTarget.style.background = 'rgba(189,255,0,0.03)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <div style={{ fontSize: '26px', marginBottom: '14px' }}>{icon}</div>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.14em', color: '#fff', marginBottom: '8px', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{desc}</div>
      </div>
    </FadeIn>
  )
}

// ─── SOCIAL ICON BUTTON ───────────────────────────────────────────────────────
function SocialBtn({ Icon, href, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} style={{
      width: '38px', height: '38px', borderRadius: '3px',
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.38)', textDecoration: 'none',
      transition: 'all 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(189,255,0,0.4)'; e.currentTarget.style.color = NEON; e.currentTarget.style.background = 'rgba(189,255,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} />
    </a>
  )
}

// ─── MAIN LANDING PAGE ────────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 36)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: I, overflowX: 'hidden' }}>

      {/* ══ NAVBAR ══ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: '64px', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        background: scrolled ? 'rgba(10,10,10,0.88)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <img src="/brand/logo-dashboard.png" alt="Risk Matrix" style={{ height: '34px' }} />
          <div>
            <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, lineHeight: 1 }}>RISK MATRIX</div>
            <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.3em', color: 'rgba(189,255,0,0.45)', lineHeight: 1, marginTop: '2px' }}>DASHBOARD</div>
          </div>
        </div>

        {/* Nav — desktop */}
        <nav style={{ display: 'flex', gap: '28px' }} className="lp-nav-links">
          {[['what', 'What Is It'], ['features', 'Features'], ['access', 'Waitlist']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: R, fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
            >{label}</button>
          ))}
        </nav>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onLogin} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '3px',
            padding: '7px 15px', cursor: 'pointer', fontFamily: R, fontSize: '11px',
            fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >Log In</button>
          <button onClick={() => scrollTo('access')} style={{
            background: NEON, border: 'none', borderRadius: '3px', padding: '7px 16px',
            cursor: 'pointer', fontFamily: R, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.15em', color: BG, textTransform: 'uppercase',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
          >Join Waitlist</button>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section ref={heroRef} style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: '64px' }}>
        <HexGrid opacity={0.042} />
        <GlowOrb size={700} x="65%" y="40%" opacity={0.052} />
        <GlowOrb size={350} x="5%" y="85%" opacity={0.038} />

        {/* Scanline */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '80px 40px 100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="lp-hero-grid">

            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <Pill>Now Accepting Waitlist</Pill>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ fontFamily: R, fontWeight: 700, fontSize: 'clamp(40px, 5.5vw, 70px)', letterSpacing: '-0.01em', lineHeight: 1.05, margin: '22px 0 18px', color: '#fff' }}
              >
                Stop Gambling.<br />
                <span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.22)' }}>Start Operating.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.48)', lineHeight: 1.75, marginBottom: '32px', maxWidth: '440px' }}
              >
                The Dashboard Built For Disciplined Bettors. Track bankroll, manage risk, and grade every session — like a professional operator.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }}>
                <WaitlistForm size="lg" />
                <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '10px', letterSpacing: '0.04em' }}>No spam. No picks. Just discipline.</div>
              </motion.div>

              {/* Mini stats */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }}
                style={{ display: 'flex', gap: '32px', marginTop: '44px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                {[['6', 'Tracking Modules'], ['100pt', 'Discipline Score'], ['PHLT™', 'Ladder System']].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, color: NEON, letterSpacing: '0.04em' }}>{val}</div>
                    <div style={{ fontFamily: I, fontSize: '10px', color: 'rgba(255,255,255,0.32)', marginTop: '2px', letterSpacing: '0.06em' }}>{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — Dashboard preview */}
            <motion.div
              className="lp-hero-img"
              initial={{ opacity: 0, x: 36, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative' }}
            >
              <div style={{ position: 'absolute', inset: '-24px', borderRadius: '12px', background: 'radial-gradient(ellipse, rgba(189,255,0,0.07) 0%, transparent 70%)', filter: 'blur(24px)' }} />
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(189,255,0,0.16)', boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(189,255,0,0.06)' }}>
                <div style={{ background: '#111', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />)}
                  <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginLeft: '8px' }}>RISK MATRIX DASHBOARD — OPERATOR VIEW</div>
                </div>
                <img src="/brand/dashboard-v2.png" alt="Dashboard Preview" style={{ width: '100%', display: 'block' }} />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', textAlign: 'center' }}>↓ Scroll</motion.div>
        </motion.div>
      </section>

      {/* ══ WHAT IS IT ══ */}
      <section id="what" style={{ position: 'relative', padding: '120px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: '64px' }}>
            <Pill>What Is It</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 700, letterSpacing: '0.03em', color: '#fff', margin: '20px 0 16px', lineHeight: 1.1 }}>
              Built For Operators.<br /><span style={{ color: NEON }}>Not Gamblers.</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.75 }}>
              Risk Matrix Dashboard is a professional-grade bankroll management terminal. Every bet tracked, every dollar protected, every session graded.
            </p>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="lp-3col">
            <FeatureCard delay={0}    icon="📊" title="Bankroll Tracking"   desc="Real-time bankroll curve, unit sizing, P&L tracking, and rolling performance metrics across every bet you place." />
            <FeatureCard delay={0.1}  icon="🛡️" title="Risk Management"    desc="Set daily limits, max bet size, stop-loss levels, and profit locks. Get alerted before you blow your edge." />
            <FeatureCard delay={0.2}  icon="🧠" title="Discipline Systems"  desc="Tilt detection, emotional checklists, session grading, and a Discipline Score™ that holds you accountable." />
          </div>
        </div>
      </section>

      {/* ══ FEATURES GRID ══ */}
      <section id="features" style={{ position: 'relative', padding: '80px 40px 120px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <HexGrid opacity={0.022} />
        <GlowOrb size={600} x="82%" y="55%" opacity={0.038} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn style={{ textAlign: 'center', marginBottom: '60px' }}>
            <Pill>Features</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 700, letterSpacing: '0.03em', color: '#fff', margin: '20px 0 0' }}>
              Every Tool An Operator Needs
            </h2>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="lp-3col">
            <FeatureCard delay={0}    icon="🪜" title="PHLT™ Ladder Tracker"    desc="Fund each bet only from previous winnings. Protect your principal at every rung of the ladder." />
            <FeatureCard delay={0.06} icon="🎯" title="Unit Calculator"          desc="Configure your unit % and instantly see 0.25u through 5u stake sizes in dollars. No mental math mid-session." />
            <FeatureCard delay={0.12} icon="⚙️" title="Round Robin Engine"       desc="Build 2s, 3s, 4s, and 5s round robins. See every combo, total risk, max payout, and break-even hit rate." />
            <FeatureCard delay={0.18} icon="🧘" title="Emotional Checklist"      desc="Complete a pre-session discipline checklist before placing a single bet. Am I chasing? Did I follow the system?" />
            <FeatureCard delay={0.24} icon="📝" title="Session Grading"          desc="Every session earns an A–F grade based on your process, not your results. Build consistency over time." />
            <FeatureCard delay={0.30} icon="📈" title="Performance Analytics"    desc="Deep breakdowns by sport, book, bet type, and time period. Know exactly where your edge lives." />
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF ══ */}
      <section style={{ padding: '80px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '32px' }} className="lp-proof-bar">
          <FadeIn>
            <div>
              <div style={{ fontFamily: R, fontSize: 'clamp(40px, 5vw, 68px)', fontWeight: 700, color: NEON, letterSpacing: '-0.01em', lineHeight: 1, textShadow: '0 0 40px rgba(189,255,0,0.18)' }}>1,000+</div>
              <div style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>operators on the waitlist</div>
            </div>
          </FadeIn>
          <FadeIn delay={0.1} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['Bankroll Protection', 'Discipline Score™', 'PHLT™ Ladder', 'Cloud Sync'].map(tag => (
              <div key={tag} style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', padding: '7px 13px' }}>{tag}</div>
            ))}
          </FadeIn>
          <FadeIn delay={0.2}>
            <div style={{ background: 'rgba(189,255,0,0.07)', border: `1px solid rgba(189,255,0,0.28)`, borderRadius: '3px', padding: '12px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.24em', color: NEON, textTransform: 'uppercase' }}>● Coming Soon</div>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.36)', marginTop: '4px' }}>Early access opening soon</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section id="access" style={{ position: 'relative', padding: '140px 40px', overflow: 'hidden', textAlign: 'center' }}>
        <HexGrid opacity={0.038} />
        <GlowOrb size={900} x="50%" y="50%" opacity={0.065} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '660px', margin: '0 auto' }}>
          <FadeIn>
            <Pill>Get Early Access</Pill>
            <h2 style={{ fontFamily: R, fontSize: 'clamp(34px, 5vw, 62px)', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: '24px 0 18px', lineHeight: 1.05 }}>
              Ready to Operate<br /><span style={{ color: NEON, textShadow: '0 0 40px rgba(189,255,0,0.18)' }}>With Discipline?</span>
            </h2>
            <p style={{ fontFamily: I, fontSize: '15px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, marginBottom: '36px' }}>
              Join the waitlist and be first in line when Risk Matrix Dashboard opens. Built for serious operators — not casual gamblers.
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <WaitlistForm size="lg" />
            <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.18)', marginTop: '14px' }}>
              Questions?{' '}
              <a href="mailto:hello@riskmatrixlabs.com" style={{ color: 'rgba(189,255,0,0.55)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = NEON}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(189,255,0,0.55)'}
              >hello@riskmatrixlabs.com</a>
            </div>
          </FadeIn>
          <FadeIn delay={0.24}>
            <div style={{ marginTop: '60px', paddingTop: '44px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.32em', color: 'rgba(189,255,0,0.4)', textTransform: 'uppercase' }}>
                Discipline Today. Freedom Tomorrow.
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 40px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '36px' }}>

            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <img src="/brand/logo-dashboard.png" alt="Risk Matrix" style={{ height: '26px' }} />
                <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>RISK MATRIX LABS</div>
              </div>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.26)', lineHeight: 1.65, maxWidth: '220px' }}>
                Professional bankroll management for disciplined sports bettors.
              </div>
            </div>

            {/* Product links */}
            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Product</div>
              {[['Features', '#features'], ['Waitlist', '#access']].map(([label, href]) => (
                <div key={label} style={{ marginBottom: '8px' }}>
                  <a href={href} style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                  >{label}</a>
                </div>
              ))}
              <div style={{ marginBottom: '8px' }}>
                <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.38)', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                >Log In</button>
              </div>
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Contact</div>
              {[['hello@riskmatrixlabs.com', 'mailto:hello@riskmatrixlabs.com'], ['support@riskmatrixlabs.com', 'mailto:support@riskmatrixlabs.com']].map(([label, href]) => (
                <div key={label} style={{ marginBottom: '8px' }}>
                  <a href={href} style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = NEON}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
                  >{label}</a>
                </div>
              ))}
            </div>

            {/* Social */}
            <div>
              <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', marginBottom: '14px' }}>Follow</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <SocialBtn Icon={FaInstagram} href="https://www.instagram.com/riskmatrixlabs" label="Instagram" />
                <SocialBtn Icon={FaXTwitter}  href="https://x.com/riskmatrixlabs" label="X / Twitter" />
                <SocialBtn Icon={FaTiktok}    href="https://www.tiktok.com/@riskmatrixlabs" label="TikTok" />
                <SocialBtn Icon={FaYoutube}   href="https://www.youtube.com/@riskmatrixlabs" label="YouTube" />
                <SocialBtn Icon={FaDiscord}   href="https://discord.gg/riskmatrixlabs" label="Discord" />
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div style={{ marginTop: '44px', paddingTop: '22px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.16)' }}>© 2025 Risk Matrix Labs. All rights reserved.</div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.28)', textTransform: 'uppercase' }}>Discipline Today. Freedom Tomorrow.</div>
          </div>
        </div>
      </footer>

      {/* ══ RESPONSIVE ══ */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero-grid  { grid-template-columns: 1fr !important; gap: 48px !important; }
          .lp-hero-img   { display: none !important; }
          .lp-3col       { grid-template-columns: 1fr 1fr !important; }
          .lp-nav-links  { display: none !important; }
          .lp-proof-bar  { flex-direction: column !important; }
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
