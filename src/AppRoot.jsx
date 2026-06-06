import { useState, useEffect } from 'react'
import { supabase, signOut } from './lib/supabase'
import { getSubscription } from './lib/subscription'
import LandingPage from './components/LandingPage'
import AuthScreen from './components/AuthScreen'
import ResetPasswordScreen from './components/ResetPasswordScreen'
import PaywallScreen from './components/PaywallScreen'
import PrivacyPolicy from './components/PrivacyPolicy'
import TermsOfService from './components/TermsOfService'
import AffiliatePage from './components/AffiliatePage'
import PricingPage from './components/PricingPage'
import App from './App'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

const R = 'Rajdhani, sans-serif'

export default function AppRoot() {
  const [session,       setSession]       = useState(undefined) // undefined = loading
  const [showAuth,      setShowAuth]      = useState(false)
  const [resetPassword, setResetPassword] = useState(false)
  const [subStatus,     setSubStatus]     = useState(null) // null = checking

  // Check subscription whenever session changes
  useEffect(() => {
    if (!session) {
      setSubStatus(null)
      posthog.reset()
      return
    }
    setSubStatus(null)
    getSubscription(session.user).then(setSubStatus)

    // Identify user in PostHog + Sentry
    posthog.identify(session.user.id, { email: session.user.email })
    Sentry.setUser({ id: session.user.id, email: session.user.email })
  }, [session?.user?.id])

  // Handle checkout success — re-check subscription with retries
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && session?.user) {
      window.history.replaceState({}, '', '/')
      // Rewardful conversion tracking
      if (typeof window.rewardful === 'function' && session.user.email) {
        window.rewardful('convert', { email: session.user.email })
      }
      // Poll up to 5 times (every 2s) until subscription is active
      let attempts = 0
      const poll = () => {
        attempts++
        getSubscription(session.user).then(result => {
          setSubStatus(result)
          if (!result?.active && attempts < 5) {
            setTimeout(poll, 2000)
          }
        })
      }
      setTimeout(poll, 2000)
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
  if (path === '/pricing')    return <PricingPage onBack={() => window.location.href = '/'} onSignup={(plan) => { sessionStorage.setItem('rml_plan', plan || 'yearly'); window.location.href = '/?signup=true' }} />

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
  ]
  const isTeamMember = TEAM_EMAILS.includes(session.user.email?.toLowerCase())

  // ── Logged in but not subscribed → auto-checkout if plan pre-selected, else paywall ──
  if (!subStatus?.active && !isTeamMember) {
    const savedPlan = sessionStorage.getItem('rml_plan')
    if (savedPlan) {
      // They came from /pricing — auto-launch Stripe, skip the paywall screen
      sessionStorage.removeItem('rml_plan')
      const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || 'price_1Tf56QJEv6JkAZy9zxplxbSI'
      const PRICE_YEARLY  = import.meta.env.VITE_STRIPE_PRICE_YEARLY  || 'price_1Tf58cJEv6JkAZy9kzUbPCDV'
      const priceId = savedPlan === 'monthly' ? PRICE_MONTHLY : PRICE_YEARLY
      fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: session.user.id,
          email: session.user.email,
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
      <PaywallScreen
        user={session.user}
        onSignOut={async () => { await signOut(); setSession(null) }}
        onRefreshAccess={() => getSubscription(session.user).then(setSubStatus)}
      />
    )
  }

  // ── Subscribed → dashboard ──────────────────────────────────────────────────
  return <App key={session.user.id} user={session.user} session={session} subStatus={subStatus} />
}
