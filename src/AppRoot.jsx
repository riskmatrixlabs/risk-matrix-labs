import { useState, useEffect, useRef } from 'react'
import * as SentryLib from '@sentry/react'

function ErrorFallback({ error }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#FF3B3B', marginBottom: '12px', textTransform: 'uppercase' }}>App Error</div>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#ccc', background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {error?.message || String(error)}
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '16px', background: 'rgba(189,255,0,0.1)', border: '1px solid rgba(189,255,0,0.4)', borderRadius: '4px', padding: '10px 20px', color: '#BDFF00', fontFamily: 'Rajdhani, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', cursor: 'pointer', textTransform: 'uppercase' }}>
          Reload
        </button>
      </div>
    </div>
  )
}
const ErrorBoundary = ({ children }) => (
  <SentryLib.ErrorBoundary fallback={ErrorFallback}>{children}</SentryLib.ErrorBoundary>
)

import { supabase, signOut } from './lib/supabase'
import { getSubscription } from './lib/subscription'
import LandingPage from './components/LandingPage'
import AuthScreen from './components/AuthScreen'
import ResetPasswordScreen from './components/ResetPasswordScreen'
import PaywallScreen from './components/PaywallScreen'
import PrivacyPolicy from './components/PrivacyPolicy'
import TermsOfService from './components/TermsOfService'
import AffiliatePage from './components/AffiliatePage'
import PressKit from './components/PressKit'
import PricingPage from './components/PricingPage'
import App from './App'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

const R = 'Rajdhani, sans-serif'
const NEON = '#BDFF00'

// Activating screen shown after Stripe checkout while we wait for webhook
function ActivatingScreen({ onSuccess, onGiveUp, user }) {
  const [attempt,  setAttempt]  = useState(0)
  const [msg,      setMsg]      = useState('Activating your subscription...')
  const [gaveUp,   setGaveUp]   = useState(false)
  const maxAttempts = 10 // 20 seconds total (2s × 10)
  const attemptsRef = useRef(0)

  useEffect(() => {
    const poll = () => {
      attemptsRef.current += 1
      const n = attemptsRef.current
      setAttempt(n)
      setMsg(n < 4 ? 'Activating your subscription...' : n < 7 ? 'Almost there, hang tight...' : 'This is taking longer than usual...')
      getSubscription(user).then(result => {
        if (result?.active) {
          onSuccess(result)
        } else if (n < maxAttempts) {
          setTimeout(poll, 2000)
        } else {
          setGaveUp(true)
        }
      })
    }
    const t = setTimeout(poll, 1500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  const dots = '.'.repeat((attempt % 3) + 1).padEnd(3, ' ')

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: '56px' }} />
      {!gaveUp ? (
        <>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textTransform: 'uppercase' }}>
            {msg}
          </div>
          <div style={{ fontFamily: R, fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em' }}>
            {dots}
          </div>
          <div style={{ fontFamily: R, fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6 }}>
            Your payment was received. We're syncing your access now.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em', color: NEON, textTransform: 'uppercase', textAlign: 'center' }}>
            Payment received — access pending
          </div>
          <div style={{ fontFamily: R, fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textAlign: 'center', maxWidth: '340px', lineHeight: 1.8 }}>
            Stripe confirmed your payment but our system is still syncing.<br />
            This usually resolves in under a minute.
          </div>
          <button
            onClick={() => { attemptsRef.current = 0; setGaveUp(false); setAttempt(0) }}
            style={{
              background: NEON, color: '#0A0A0A', border: 'none', borderRadius: '2px',
              padding: '12px 28px', fontFamily: R, fontSize: '12px', fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <button
            onClick={onGiveUp}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: R, fontSize: '10px', color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.1em', textDecoration: 'underline',
            }}
          >
            Skip for now
          </button>
        </>
      )}
    </div>
  )
}

export default function AppRoot() {
  const [session,         setSession]         = useState(undefined) // undefined = loading
  const [showAuth,        setShowAuth]        = useState(false)
  const [resetPassword,   setResetPassword]   = useState(false)
  const [subStatus,       setSubStatus]       = useState(null)       // null = checking
  const [justSubscribed,  setJustSubscribed]  = useState(false)      // came back from Stripe

  // Check subscription whenever session changes
  useEffect(() => {
    if (!session) {
      setSubStatus(null)
      posthog.reset()
      return
    }
    setSubStatus(null)
    getSubscription(session.user, session.access_token).then(status => {
      setSubStatus(status)
      if (!status) return
      // GA4 funnel events on status resolution
      const ga4 = (ev, p = {}) => { try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: ev, ...p }) } catch {} }
      if (status.active && status.sub?.status === 'active') ga4('subscribed', { plan: status.sub?.plan, user_id: session.user.id })
      if (status.sub?.status === 'canceled') ga4('churned', { user_id: session.user.id })
    })

    // Identify user in PostHog + Sentry + Crisp
    posthog.identify(session.user.id, { email: session.user.email })
    Sentry.setUser({ id: session.user.id, email: session.user.email })
    try { if (window.$crisp) { window.$crisp.push(['set', 'user:email', [session.user.email]]) } } catch {}
  }, [session?.user?.id])

  // GA4 helper — pushes to dataLayer (GTM picks it up)
  const ga4 = (event, params = {}) => {
    try {
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({ event, ...params })
    } catch {}
  }

  // Handle checkout success — show activating screen instead of polling here
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && session?.user) {
      window.history.replaceState({}, '', '/')
      // Rewardful conversion tracking
      if (typeof window.rewardful === 'function' && session.user.email) {
        window.rewardful('convert', { email: session.user.email })
      }
      // GA4: trial started
      ga4('trial_started', { user_id: session.user.id })
      setJustSubscribed(true)
    }
    if (params.get('checkout') === 'canceled') {
      window.history.replaceState({}, '', '/')
    }
  }, [session?.user?.id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetPassword(true)
        setSession(session)
        return
      }
      setSession(session)
      if (session && !resetPassword) setShowAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Loading splash ──────────────────────────────────────────────────────────
  if (session === undefined || (session && subStatus === null)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: '60px', marginBottom: '16px' }} />
          <div style={{ fontFamily: R, fontSize: '10px', fontWeight: 600, letterSpacing: '0.24em', color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase' }}>
            Loading...
          </div>
        </div>
      </div>
    )
  }

  // ── Password reset flow ─────────────────────────────────────────────────────
  if (resetPassword) {
    return (
      <ResetPasswordScreen onDone={() => setResetPassword(false)} />
    )
  }

  // ── Legal pages (URL-based routing, no router needed) ──────────────────────
  const path = window.location.pathname
  if (path === '/privacy')    return <PrivacyPolicy onBack={() => window.history.back()} />
  if (path === '/terms')      return <TermsOfService onBack={() => window.history.back()} />
  if (path === '/affiliates') return <AffiliatePage onBack={() => window.location.href = '/'} />
  if (path === '/press')      return <PressKit onBack={() => window.location.href = '/'} />
  if (path === '/pricing')    return <PricingPage onBack={() => window.location.href = '/'} onSignup={(plan) => { localStorage.setItem('rml_plan_pending', JSON.stringify({ plan: plan || 'yearly', ts: Date.now() })); window.location.href = '/?signup=true' }} />

  // ── 404 — unknown paths ────────────────────────────────────────────────────
  const knownPaths = ['/', '/privacy', '/terms', '/affiliates', '/press', '/pricing']
  if (path !== '/' && !knownPaths.includes(path)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', fontFamily: 'Rajdhani, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '72px', fontWeight: 800, color: '#BDFF00', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '8px' }}>404</div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '20px' }}>Page Not Found</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: '28px' }}>
            This page doesn't exist or was moved. Head back and operate with discipline.
          </div>
          <a href="/" style={{ display: 'inline-block', padding: '11px 28px', background: '#BDFF00', borderRadius: '4px', fontFamily: 'Rajdhani, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0A0A0A', textDecoration: 'none' }}>
            Back to Home
          </a>
        </div>
      </div>
    )
  }

  // ── Demo mode (?demo=true) — bypasses auth + paywall, loads sample data ─────
  const params = new URLSearchParams(window.location.search)
  if (params.get('demo') === 'true') {
    const demoUser    = { id: 'demo', email: 'demo@riskmatrixlabs.com' }
    const demoSession = { access_token: null, refresh_token: null, user: demoUser }
    const demoStatus  = { active: true, plan: 'demo' }
    return <App key="demo" user={demoUser} session={demoSession} subStatus={demoStatus} isDemo={true} />
  }

  // ── Not logged in ───────────────────────────────────────────────────────────
  if (!session) {
    const autoSignup = new URLSearchParams(window.location.search).get('signup') === 'true'
    if (showAuth || autoSignup) return <AuthScreen onBack={() => { window.history.replaceState({}, '', '/'); setShowAuth(false) }} />
    return <LandingPage onLogin={() => setShowAuth(true)} />
  }

  // ── Team whitelist — bypass paywall for internal testers ───────────────────
  const TEAM_EMAILS = [
    'michaeltejeda08@gmail.com',
    'josiahteem@yahoo.com',
    'tremizy@gmail.com',
    'j.willey2489@gmail.com',
    'lauriesjeanpaul@gmail.com',
  ]
  const isTeamMember = TEAM_EMAILS.includes(session.user.email?.toLowerCase())

  // ── Subscribed → dashboard ──────────────────────────────────────────────────
  if (subStatus?.active || isTeamMember) {
    return <ErrorBoundary><App key={session.user.id} user={session.user} session={session} subStatus={subStatus} /></ErrorBoundary>
  }

  // ── Just came back from Stripe but subscription not yet active → activating screen ──
  if (justSubscribed) {
    return (
      <ActivatingScreen
        user={session.user}
        onSuccess={(result) => { setSubStatus(result); setJustSubscribed(false) }}
        onGiveUp={() => setJustSubscribed(false)}
      />
    )
  }

  // ── Logged in but not subscribed ──
  const _pendingRaw = localStorage.getItem('rml_plan_pending')
  const _pending    = _pendingRaw ? (() => { try { return JSON.parse(_pendingRaw) } catch { return null } })() : null
  // Ignore if older than 24 hours
  const savedPlan   = _pending && (Date.now() - _pending.ts < 86400000) ? _pending.plan : null
  if (savedPlan) {
    // They came from /pricing — auto-launch Stripe, skip the paywall screen
    localStorage.removeItem('rml_plan_pending')
    const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || 'price_1Tf56QJEv6JkAZy9zxplxbSI'
    const PRICE_YEARLY  = import.meta.env.VITE_STRIPE_PRICE_YEARLY  || 'price_1Tf58cJEv6JkAZy9kzUbPCDV'
    const priceId = savedPlan === 'monthly' ? PRICE_MONTHLY : PRICE_YEARLY
    fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        priceId,
        successUrl: `${window.location.origin}/?checkout=success`,
        cancelUrl: `${window.location.origin}/pricing`,
        rewardfulReferral: window.Rewardful?.referral || null,
      }),
    }).then(r => r.json()).then(({ url }) => { if (url) window.location.href = url })
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <img src="/brand/logos/logo-dashboard.png" alt="RML" style={{ height: '52px' }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(189,255,0,0.6)', textTransform: 'uppercase' }}>Setting up your trial...</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PaywallScreen
        user={session.user}
        token={session.access_token}
        subStatus={subStatus}
        onSignOut={async () => { await signOut(); setSession(null) }}
        onRefreshAccess={() => getSubscription(session.user, session.access_token).then(result => { setSubStatus(result); return result })}
      />
    </ErrorBoundary>
  )
}
