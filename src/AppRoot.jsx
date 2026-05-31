import { useState, useEffect } from 'react'
import { supabase, signOut } from './lib/supabase'
import { getSubscription } from './lib/subscription'
import LandingPage from './components/LandingPage'
import AuthScreen from './components/AuthScreen'
import ResetPasswordScreen from './components/ResetPasswordScreen'
import PaywallScreen from './components/PaywallScreen'
import App from './App'

const R = 'Rajdhani, sans-serif'

export default function AppRoot() {
  const [session,       setSession]       = useState(undefined) // undefined = loading
  const [showAuth,      setShowAuth]      = useState(false)
  const [resetPassword, setResetPassword] = useState(false)
  const [subStatus,     setSubStatus]     = useState(null) // null = checking

  // Check subscription whenever session changes
  useEffect(() => {
    if (!session) { setSubStatus(null); return }
    setSubStatus(null) // re-check
    getSubscription(session.user).then(setSubStatus)
  }, [session?.user?.id])

  // Handle checkout success — re-check subscription
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && session?.user) {
      // Give webhook a moment to fire, then re-check
      setTimeout(() => {
        getSubscription(session.user).then(setSubStatus)
        // Clean URL
        window.history.replaceState({}, '', '/')
      }, 2000)
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
          <img src="/brand/logo-dashboard.png" alt="RML" style={{ height: '60px', marginBottom: '16px' }} />
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
      />
    )
  }

  // ── Subscribed → dashboard ──────────────────────────────────────────────────
  return <App user={session.user} session={session} subStatus={subStatus} />
}
