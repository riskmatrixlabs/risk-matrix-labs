import { useState } from 'react'
import { CheckCircle, Zap, Shield, BarChart3, Lock, X } from 'lucide-react'

const NEON   = '#BDFF00'
const RED    = '#FF3B3B'
const YELLOW = '#F5A623'
const R      = 'Rajdhani, sans-serif'

const PRICE_BETA_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_BETA_MONTHLY
const PRICE_BETA_YEARLY  = import.meta.env.VITE_STRIPE_PRICE_BETA_YEARLY

const FEATURES = [
  'Full PHLT™ Bankroll Ladder Tracker',
  'Bet Log with unlimited entries',
  'Round Robin Engine',
  'Analytics & Kelly Criterion table',
  'Discipline Score™ & Session grading',
  'Cloud sync across all devices',
  'Risk Management panel',
  'PDF session reports',
]

export default function PaywallScreen({ user, onSignOut }) {
  const [billing,  setBilling]  = useState('yearly') // 'monthly' | 'yearly'
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const isYearly = billing === 'yearly'

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId:    isYearly ? PRICE_BETA_YEARLY : PRICE_BETA_MONTHLY,
          userId:     user.id,
          email:      user.email,
          successUrl: `${window.location.origin}/?checkout=success`,
          cancelUrl:  `${window.location.origin}/?checkout=canceled`,
        }),
      })

      const data = await res.json()

      if (data.bypass) {
        // Owner bypass — reload to trigger dashboard
        window.location.reload()
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong. Try again.')
        setLoading(false)
      }
    } catch (err) {
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
      padding: '24px 16px',
      position: 'relative',
    }}>

      {/* Sign out top-right */}
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
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <img src="/brand/logo-labs.png" alt="RML" style={{ height: '56px', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontFamily: R, fontSize: '20px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textShadow: '0 0 20px rgba(189,255,0,0.3)' }}>
          RISK MATRIX LABS
        </div>
        <div style={{ fontFamily: R, fontSize: '9px', letterSpacing: '0.3em', color: 'rgba(189,255,0,0.45)', marginTop: '3px' }}>
          OPERATE WITH DISCIPLINE
        </div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontFamily: R, fontSize: '28px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em', lineHeight: 1.15, marginBottom: '10px' }}>
          Your 7-Day Free Trial Awaits
        </div>
        <div style={{ fontFamily: R, fontSize: '13px', color: 'var(--text-sub)', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
          Full access to every tool. No charge until day 8.<br />Cancel anytime — no questions asked.
        </div>
      </div>

      {/* Billing toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0',
        border: '1px solid var(--border2)', borderRadius: '3px', overflow: 'hidden',
        marginBottom: '24px',
      }}>
        {[['yearly', 'Yearly', 'Save 28%'], ['monthly', 'Monthly', null]].map(([val, label, badge]) => (
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
        background: 'var(--card)', border: '1px solid var(--border)',
        borderTop: `2px solid ${NEON}`, padding: '28px 28px 24px',
        boxShadow: 'var(--card-shadow)',
        marginBottom: '16px',
      }}>
        {/* Beta badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <span style={{ fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: YELLOW, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)',
            padding: '3px 8px', borderRadius: '2px' }}>BETA ACCESS</span>
          <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
            Lock in beta pricing forever
          </span>
        </div>

        {/* Price display */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ fontFamily: R, fontSize: '48px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {isYearly ? '$12' : '$17'}
            </span>
            <div style={{ paddingBottom: '8px' }}>
              <div style={{ fontFamily: R, fontSize: '14px', fontWeight: 700, color: 'var(--text-sub)' }}>
                {isYearly ? '.25' : ''}<span style={{ fontSize: '11px' }}>/mo</span>
              </div>
            </div>
          </div>
          {isYearly && (
            <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>
              Billed $147/yr — you save <span style={{ color: NEON, fontWeight: 700 }}>$57</span> vs monthly
            </div>
          )}
          {!isYearly && (
            <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>
              Billed monthly · switch to yearly anytime
            </div>
          )}
        </div>

        {/* Trial callout */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(189,255,0,0.05)', border: '1px solid rgba(189,255,0,0.2)',
          borderRadius: '2px', padding: '10px 14px', marginBottom: '20px',
        }}>
          <Zap size={14} color={NEON} strokeWidth={2} />
          <span style={{ fontFamily: R, fontSize: '11px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
            7 days free — no card charge until day 8
          </span>
        </div>

        {/* Features list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={13} color={NEON} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: R, fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', letterSpacing: '0.03em' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
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

        <div style={{ textAlign: 'center', marginTop: '12px', fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
          Cancel anytime · Secured by Stripe
        </div>
      </div>

      {/* Trust badges */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
        {[
          { icon: Shield, text: 'SSL Encrypted' },
          { icon: Lock,   text: 'Stripe Secured' },
          { icon: BarChart3, text: 'Cancel Anytime' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon size={11} color='var(--text-dim)' strokeWidth={2} />
            <span style={{ fontFamily: R, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: R, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--text-dim)', textAlign: 'center' }}>
        RISK MATRIX LABS © 2025 · DISCIPLINE TODAY. FREEDOM TOMORROW.
      </div>
    </div>
  )
}
