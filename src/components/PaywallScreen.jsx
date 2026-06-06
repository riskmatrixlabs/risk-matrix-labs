import { useState } from 'react'
import { CheckCircle, Zap, Shield, Lock, BarChart3, X } from 'lucide-react'

const NEON = '#BDFF00'
const RED  = '#FF3B3B'
const R    = 'Rajdhani, sans-serif'
const I    = 'Inter, sans-serif'

// ── Price IDs ─────────────────────────────────────────────────────────────────
// Pricing: $29/mo · $149/yr ($12.42/mo)
// Stripe price IDs set via VITE_STRIPE_PRICE_MONTHLY / VITE_STRIPE_PRICE_YEARLY
const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || import.meta.env.VITE_STRIPE_PRICE_BETA_MONTHLY || 'price_1Td5MzJEv6JkAZy9C5xTxiBj'
const PRICE_YEARLY  = import.meta.env.VITE_STRIPE_PRICE_YEARLY  || import.meta.env.VITE_STRIPE_PRICE_BETA_YEARLY  || 'price_1Td5MzJEv6JkAZy9DssU8aTH'

const FEATURES = [
  'Bankroll Simulator',
  'PHLT™ Ladder System',
  'Unit Sizing Engine',
  'Round Robin Engine',
  'Behavioral Analytics',
  'Discipline Score™ & Session grading',
  'Pre-Session Checklist & Tilt Detection',
  'Bet Log — unlimited entries',
  'Cloud sync across all devices',
  'Risk Management panel',
  'PDF session reports',
]

export default function PaywallScreen({ user, onSignOut, onRefreshAccess }) {
  const [billing,  setBilling]  = useState('yearly')
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState(null)

  const isYearly = billing === 'yearly'

  const handleCheckAccess = async () => {
    setChecking(true)
    await onRefreshAccess?.()
    setTimeout(() => setChecking(false), 3000)
  }

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    const priceId    = isYearly ? PRICE_YEARLY : PRICE_MONTHLY
    const userId     = user?.id
    const email      = user?.email
    const successUrl = `${window.location.origin}/?checkout=success`
    const cancelUrl  = `${window.location.origin}/?checkout=canceled`

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId, email, successUrl, cancelUrl, rewardfulReferral: window.Rewardful?.referral || null }),
      })

      const data = await res.json()

      if (data.bypass) { window.location.reload(); return }
      if (data.url)    { window.location.href = data.url }
      else { setError(data.error || 'Something went wrong. Try again.'); setLoading(false) }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px 48px',
      position: 'relative',
    }}>

      {/* Sign out */}
      <button onClick={onSignOut} style={{
        position: 'absolute', top: '16px', right: '16px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: R, fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        <X size={12} /> Sign Out
      </button>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img src="/brand/logos/logo-labs.png" alt="RML" style={{ height: '48px', display: 'block', margin: '0 auto 10px' }} />
        <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.22em', color: NEON }}>
          RISK MATRIX LABS
        </div>
        <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(189,255,0,0.45)', marginTop: '3px' }}>
          BANKROLL SIMULATOR
        </div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontFamily: R, fontSize: '26px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em', lineHeight: 1.15, marginBottom: '8px' }}>
          Start Your 3-Day Free Trial
        </div>
        <div style={{ fontFamily: I, fontSize: '13px', color: 'var(--text-sub)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
          Full access to every tool. No charge until day 4.<br />Cancel anytime — no questions asked.
        </div>
      </div>

      {/* Trial callout */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.2)',
        borderRadius: '2px', padding: '9px 16px', marginBottom: '20px',
      }}>
        <Zap size={13} color={NEON} strokeWidth={2} />
        <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em' }}>
          3 days free · No card charge until day 4 · Cancel anytime
        </span>
      </div>

      {/* Billing toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0',
        border: '1px solid var(--border2)', borderRadius: '3px', overflow: 'hidden',
        marginBottom: '20px',
      }}>
        {[['yearly', 'Yearly', 'Best Value'], ['monthly', 'Monthly', null]].map(([val, label, badge]) => (
          <button key={val} onClick={() => setBilling(val)} style={{
            padding: '8px 20px', fontFamily: R, fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            background: billing === val ? 'rgba(189,255,0,0.1)' : 'var(--card)',
            color: billing === val ? NEON : 'var(--text-dim)',
            borderBottom: billing === val ? `2px solid ${NEON}` : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            {label}
            {badge && (
              <span style={{
                fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em',
                background: 'rgba(189,255,0,0.15)', color: NEON,
                border: '1px solid rgba(189,255,0,0.35)',
                padding: '1px 5px', borderRadius: '2px',
              }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Pricing card */}
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--card)', border: '1px solid rgba(189,255,0,0.3)',
        borderTop: `2px solid ${NEON}`, padding: '28px 28px 24px',
        boxShadow: 'var(--card-shadow)',
        marginBottom: '16px',
      }}>

        {/* Price display */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '8px' }}>
            {isYearly ? 'Annual Plan' : 'Monthly Plan'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontFamily: R, fontSize: '52px', fontWeight: 700, color: NEON, lineHeight: 1, textShadow: '0 0 30px rgba(189,255,0,0.2)' }}>
              {isYearly ? '$12' : '$29'}
            </span>
            <span style={{ fontFamily: I, fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/mo</span>
          </div>
          <div style={{ fontFamily: I, fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '5px' }}>
            {isYearly
              ? 'Billed $149/yr — save $199 vs monthly · cancel anytime'
              : 'Billed $29/mo · switch to yearly and save $199/yr'}
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={13} color={NEON} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: I, fontSize: '12px', color: 'var(--text-sub)' }}>{f}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontFamily: R, fontSize: '11px', color: RED, background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.25)', padding: '8px 12px', borderRadius: '2px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <button onClick={handleCheckout} disabled={loading} style={{
          width: '100%', padding: '14px',
          background: loading ? 'rgba(189,255,0,0.05)' : NEON,
          border: `1px solid ${NEON}`,
          borderRadius: '2px', cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: loading ? NEON : '#0A0A0A',
          transition: 'all 0.15s',
        }}>
          {loading ? 'Redirecting...' : 'Start My Free Trial →'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '10px', fontFamily: I, fontSize: '11px', color: 'var(--text-dim)' }}>
          Cancel anytime · Secured by Stripe
        </div>
      </div>

      {/* Already subscribed */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button onClick={handleCheckAccess} disabled={checking} style={{
          background: 'none', border: 'none', cursor: checking ? 'default' : 'pointer',
          fontFamily: R, fontSize: '11px', color: checking ? 'var(--text-dim)' : 'rgba(189,255,0,0.5)',
          letterSpacing: '0.08em', textDecoration: 'underline', padding: 0,
        }}>
          {checking ? 'Checking...' : 'Already subscribed? Click here →'}
        </button>
      </div>

      {/* Trust badges */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '12px' }}>
        {[{ icon: Shield, text: 'SSL Encrypted' }, { icon: Lock, text: 'Stripe Secured' }, { icon: BarChart3, text: 'Cancel Anytime' }].map(({ icon: Icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon size={11} color='var(--text-dim)' strokeWidth={2} />
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Legal */}
      <div style={{ fontFamily: I, fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '8px' }}>
        By subscribing you agree to our{' '}
        <a href="/terms" style={{ color: 'rgba(189,255,0,0.5)', textDecoration: 'none' }}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: 'rgba(189,255,0,0.5)', textDecoration: 'none' }}>Privacy Policy</a>
      </div>

      <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--text-dim)', textAlign: 'center' }}>
        RISK MATRIX LABS © 2026 · DISCIPLINE TODAY. FREEDOM TOMORROW.
      </div>
    </div>
  )
}
