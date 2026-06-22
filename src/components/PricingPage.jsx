import { useState } from 'react'
import { ArrowLeft, CheckCircle, Zap, Shield, RefreshCw, BarChart3, Layers, Target } from 'lucide-react'

const NEON = '#BDFF00'
const BG   = '#0A0A0A'
const R    = "'Rajdhani', sans-serif"
const I    = "'Inter', sans-serif"

const FEATURES = [
  { icon: Zap,       label: 'Live Odds & EV Grades',     desc: 'Scan the slate — live odds and EV-graded bets, no locks' },
  { icon: Target,    label: 'Props & Model Leans',       desc: 'Player props grouped by player, with a record graded in public' },
  { icon: BarChart3, label: 'Line Movement',             desc: 'Since-open moves and book-by-book comparison' },
  { icon: BarChart3, label: 'Bankroll Simulator',       desc: 'Model any staking system before risking real money' },
  { icon: Target,    label: 'Unit Sizing Engine',        desc: 'Auto-calculates stake based on your bankroll %' },
  { icon: Layers,    label: 'PHLT™ Ladder System',       desc: 'Compounding ladder with pull checkpoints' },
  { icon: Zap,       label: 'Round Robin Engine',        desc: 'Full RR matrix — combos, payouts, break-even hits' },
  { icon: Shield,    label: 'Session Grading (A–F)',     desc: 'Grades every session on discipline, not just results' },
  { icon: RefreshCw, label: 'Cloud Sync + Backup',       desc: 'Your data synced in real time, across any device' },
]

const FAQS = [
  { q: 'Is there really a free trial?',        a: '3 days free — no charge until day 4. Cancel before then and you pay nothing.' },
  { q: 'Can I switch plans later?',            a: 'Yes. Switch between monthly and annual anytime from your account settings.' },
  { q: 'What happens if I cancel?',            a: 'You keep access until the end of your billing period. No partial refunds — but no surprise charges either.' },
  { q: 'Is this a picks service?',             a: 'No. We don\'t sell picks. Risk Matrix Labs is an edge platform — live odds, EV grades, props, and models graded in public, plus the discipline tools to operate the money side with a system.' },
  { q: 'Who is this built for?',               a: 'Operators — people who treat sports betting as a system, not a slot machine. Cappers, serious recreational bettors, and anyone who wants to stop guessing and start operating.' },
]

function FeatureRow({ icon: Icon, label, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(189,255,0,0.07)', border: '1px solid rgba(189,255,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
        <Icon size={13} color={NEON} />
      </div>
      <div>
        <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: '2px', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', gap: '16px', textAlign: 'left' }}>
        <span style={{ fontFamily: R, fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{q}</span>
        <span style={{ fontFamily: R, fontSize: '18px', color: NEON, flexShrink: 0, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, paddingBottom: '18px' }}>{a}</div>
      )}
    </div>
  )
}

export default function PricingPage({ onBack, onSignup }) {
  const [billing, setBilling] = useState('yearly')
  const isYearly = billing === 'yearly'

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff' }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 40px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/brand/logos/logo-dashboard.png" alt="Risk Matrix" style={{ height: '26px' }} />
          <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>RISK MATRIX LABS</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 14px', color: 'rgba(255,255,255,0.5)', fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >
            <ArrowLeft size={12} /> Back
          </button>
          <button onClick={() => onSignup(billing)} style={{ background: NEON, border: 'none', borderRadius: '6px', padding: '7px 16px', color: BG, fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', cursor: 'pointer', textTransform: 'uppercase' }}>
            Start Free Trial
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 40px 100px' }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', padding: '72px 0 56px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.32em', color: 'rgba(189,255,0,0.55)', textTransform: 'uppercase', marginBottom: '20px' }}>Simple Pricing</div>
          <h1 style={{ fontFamily: R, fontSize: 'clamp(38px, 6vw, 58px)', fontWeight: 700, lineHeight: 1.05, color: '#fff', margin: '0 0 16px' }}>
            One plan.<br /><span style={{ color: NEON }}>Everything included.</span>
          </h1>
          <p style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
            No tiers. No feature gates. Every tool we build ships to every subscriber.
          </p>
        </div>

        {/* ── BILLING TOGGLE ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px', gap: '4px' }}>
            {[['yearly', 'Annual', 'Save $199'], ['monthly', 'Monthly', null]].map(([val, label, badge]) => (
              <button key={val} onClick={() => setBilling(val)} style={{
                padding: '9px 24px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                background: billing === val ? 'rgba(189,255,0,0.12)' : 'transparent',
                color: billing === val ? NEON : 'rgba(255,255,255,0.35)',
              }}>
                {label}
                {badge && billing === val && (
                  <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', background: NEON, color: BG, padding: '2px 6px', borderRadius: '3px' }}>{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── PRICING CARD ── */}
        <div style={{ maxWidth: '520px', margin: '0 auto 72px', position: 'relative' }}>

          {isYearly && (
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: NEON, color: BG, fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: '20px', whiteSpace: 'nowrap', zIndex: 1 }}>
              Best Value — Save $199/yr
            </div>
          )}

          <div style={{ background: '#0f0f0f', border: `1px solid ${isYearly ? 'rgba(189,255,0,0.35)' : 'rgba(255,255,255,0.1)'}`, borderTop: `2px solid ${isYearly ? NEON : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', padding: '44px 40px 36px', boxShadow: isYearly ? '0 0 60px rgba(189,255,0,0.05)' : 'none', transition: 'all 0.2s' }}>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontFamily: R, fontSize: '64px', fontWeight: 700, color: NEON, lineHeight: 1, textShadow: isYearly ? '0 0 40px rgba(189,255,0,0.2)' : 'none' }}>
                {isYearly ? '$12' : '$29'}
              </span>
              <span style={{ fontFamily: I, fontSize: '16px', color: 'rgba(255,255,255,0.4)', paddingBottom: '10px' }}>/mo</span>
              {isYearly && (
                <span style={{ fontFamily: R, fontSize: '13px', color: 'rgba(255,255,255,0.25)', paddingBottom: '10px', textDecoration: 'line-through', marginLeft: '4px' }}>$29</span>
              )}
            </div>

            <div style={{ fontFamily: I, fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px' }}>
              {isYearly
                ? 'Billed $149/yr — that\'s $12.42/month'
                : 'Billed $29/month — switch to annual and save $199/yr'}
            </div>

            {/* CTA */}
            <button onClick={() => onSignup(billing)} style={{ width: '100%', padding: '16px', background: NEON, border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: R, fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: BG, marginBottom: '14px', transition: 'opacity 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Start My 3-Day Free Trial →
            </button>

            <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: '32px' }}>
              No charge until day 4 · Cancel anytime · No contracts
            </div>

            {/* Feature checklist */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                'Live Odds & EV Grades', 'Props & Model Leans',
                'Line Movement', 'Bankroll Simulator',
                'PHLT™ Ladder System', 'Round Robin Engine',
                'Session Grading (A–F)', 'Discipline Score™',
                'Cloud Sync + Backup', 'All future features',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={12} color={NEON} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{f}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── WHAT'S INCLUDED ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px 60px', marginBottom: '80px' }}>
          <div>
            <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '8px' }}>Every Feature</div>
            <h2 style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, color: '#fff', marginBottom: '24px', lineHeight: 1.1 }}>Built for operators who run a system.</h2>
            {FEATURES.slice(0, 4).map(f => <FeatureRow key={f.label} {...f} />)}
          </div>
          <div style={{ paddingTop: '46px' }}>
            {FEATURES.slice(4).map(f => <FeatureRow key={f.label} {...f} />)}
            <div style={{ marginTop: '28px', padding: '18px', background: 'rgba(189,255,0,0.04)', border: '1px solid rgba(189,255,0,0.1)', borderRadius: '8px' }}>
              <div style={{ fontFamily: R, fontSize: '12px', fontWeight: 700, color: NEON, letterSpacing: '0.1em', marginBottom: '6px' }}>Every feature. Always.</div>
              <div style={{ fontFamily: I, fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>New tools ship to all subscribers — no upgrade tiers, no add-ons. You're in from day one.</div>
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div style={{ maxWidth: '620px', margin: '0 auto 72px' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>FAQ</div>
          <h2 style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '32px', textAlign: 'center' }}>Common questions</h2>
          {FAQS.map(f => <FAQItem key={f.q} {...f} />)}
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ background: 'rgba(189,255,0,0.04)', border: '1px solid rgba(189,255,0,0.14)', borderRadius: '12px', padding: '52px 40px', textAlign: 'center' }}>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase', marginBottom: '14px' }}>Ready to operate?</div>
          <h2 style={{ fontFamily: R, fontSize: '32px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>3 days free. No card charge until day 4.</h2>
          <p style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px' }}>Cancel anytime before day 4 and you pay nothing.</p>
          <button onClick={() => onSignup(billing)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: NEON, color: BG, fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', border: 'none', padding: '15px 36px', borderRadius: '6px', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Start Free Trial →
          </button>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: '14px' }}>
            Questions? <a href="mailto:hello@riskmatrixlabs.com" style={{ color: 'rgba(189,255,0,0.4)', textDecoration: 'none' }}>hello@riskmatrixlabs.com</a>
          </div>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.16)' }}>
          © 2026 Risk Matrix Labs LLC.&nbsp;·&nbsp;
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Privacy</a>&nbsp;·&nbsp;
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Terms</a>&nbsp;·&nbsp;
          <a href="/affiliates" style={{ color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}>Affiliates</a>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="padding: 0 40px"] { padding: 0 20px 80px !important; }
          div[style*="padding: 72px 0"] { padding: 48px 0 40px !important; }
          div[style*="padding: 52px 40px"] { padding: 36px 24px !important; }
          div[style*="padding: 44px 40px"] { padding: 32px 24px 28px !important; }
        }
      `}</style>
    </div>
  )
}
