import { useState, useEffect } from 'react'
import { supabase, signOut } from './lib/supabase'
import { getSubscription } from './lib/subscription'
import LandingPage from './components/LandingPage'
import AuthScreen from './components/AuthScreen'
import ResetPasswordScreen from './components/ResetPasswordScreen'
import PaywallScreen from './components/PaywallScreen'
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

  // ── Not logged in ───────────────────────────────────────────────────────────
  if (!session) {
    if (showAuth) return <AuthScreen onBack={() => setShowAuth(false)} />
    return <LandingPage onLogin={() => setShowAuth(true)} />
  }

  // ── Logged in but not subscribed → paywall ──────────────────────────────────
  if (!subStatus?.active) {
    return (
      <PaywallScreen
        user={session.user}
        onSignOut={async () => { await signOut(); setSession(null) }}
        onRefreshAccess={() => getSubscription(session.user).then(setSubStatus)}
      />
    )
  }

  // ── Subscribed → dashboard ──────────────────────────────────────────────────
  return <App user={session.user} session={session} subStatus={subStatus} />
}
