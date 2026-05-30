import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LandingPage from './components/LandingPage'
import AuthScreen from './components/AuthScreen'
import App from './App'

export default function AppRoot() {
  const [session,   setSession]   = useState(undefined) // undefined = loading
  const [showAuth,  setShowAuth]  = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // Once logged in, clear the auth overlay
      if (session) setShowAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Loading splash
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/brand/logo-dashboard.png" alt="RML" style={{ height: '60px', marginBottom: '16px' }} />
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.24em',
            color: 'rgba(189,255,0,0.5)', textTransform: 'uppercase' }}>Loading...</div>
        </div>
      </div>
    )
  }

  // Logged in → dashboard
  if (session) {
    return <App user={session.user} session={session} />
  }

  // Auth overlay on top of landing page
  if (showAuth) {
    return <AuthScreen onBack={() => setShowAuth(false)} />
  }

  // Default: landing page
  return <LandingPage onLogin={() => setShowAuth(true)} />
}
