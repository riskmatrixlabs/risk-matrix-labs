import { useState } from 'react'
import { signInEmail, signUpEmail, signInGoogle, resetPassword } from '../lib/supabase'

const NEON = '#BDFF00'
const RED  = '#FF3B3B'
const R    = 'Rajdhani, sans-serif'

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--card2)', border: '1px solid var(--border2)',
  borderRadius: '2px', color: 'var(--text)',
  fontFamily: R, fontSize: '13px', fontWeight: 600,
  letterSpacing: '0.04em', outline: 'none',
}

const labelStyle = {
  fontFamily: R, fontSize: '8px', fontWeight: 700,
  letterSpacing: '0.2em', color: 'var(--text-dim)',
  textTransform: 'uppercase', display: 'block', marginBottom: '5px',
}

export default function AuthScreen({ onAuth, onBack }) {
  const [mode,     setMode]     = useState('login')   // 'login' | 'signup' | 'forgot'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(null)

  const switchMode = (m) => { setMode(m); setError(null); setSuccess(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'forgot') {
      const { error: err } = await resetPassword(email)
      if (err) setError(err.message)
      else setSuccess('Check your email for a password reset link.')
      setLoading(false)
      return
    }

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error: err } = await signInEmail(email, password)
      if (err) {
        if (err.message.includes('Invalid login')) setError('Incorrect email or password.')
        else if (err.message.includes('Email not confirmed')) setError('Please confirm your email before logging in.')
        else setError(err.message)
      }
    } else {
      const { data: signUpData, error: err } = await signUpEmail(email, password)
      if (err) {
        if (err.message.includes('already registered') || err.message.includes('already been registered')) setError('An account with this email already exists. Try logging in.')
        else if (err.message.includes('invalid') && err.message.toLowerCase().includes('email')) setError('Please enter a valid email address.')
        else if (err.message.includes('weak') || err.message.includes('too short')) setError('Password must be at least 6 characters.')
        else setError(err.message)
      } else if (signUpData?.user) {
        // Auto-confirm email server-side so user doesn't need to check inbox
        try {
          await fetch('/api/auto-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: signUpData.user.id }),
          })
        } catch (e) {
          console.warn('[RML] auto-confirm failed:', e)
        }
        // Sign them in immediately
        const { error: loginErr } = await signInEmail(email, password)
        if (loginErr) {
          // Auto-confirm might not have worked — show email fallback with clear message
          setSuccess(`Almost there — check ${email} for a confirmation link. Click it and you'll be taken straight to checkout.`)
          setLoading(false)
          return
        }
        // If login succeeded, onAuthStateChange fires and AppRoot takes over — no action needed here
      }
    }

    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error: err } = await signInGoogle()
    if (err) { setError('Google sign-in failed. Please try again or use email.'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {onBack && (
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--text-dim)', textTransform: 'uppercase',
          }}>
            ← Back to site
          </button>
        )}

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src="/brand/logos/logo-labs.png" alt="Risk Matrix Labs" style={{ height: '72px', margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontFamily: R, fontSize: '22px', fontWeight: 700, letterSpacing: '0.22em', color: NEON, textShadow: '0 0 24px rgba(189,255,0,0.35)' }}>
            RISK MATRIX LABS
          </div>
          <div style={{ fontFamily: R, fontSize: '9px', fontWeight: 500, letterSpacing: '0.32em', color: 'rgba(189,255,0,0.5)', marginTop: '4px' }}>
            OPERATE WITH DISCIPLINE
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderTop: `2px solid ${NEON}`, padding: '32px 28px',
          boxShadow: 'var(--card-shadow)',
        }}>

          {/* Mode toggle — only for login/signup */}
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', marginBottom: '24px', border: '1px solid var(--border2)', borderRadius: '2px', overflow: 'hidden' }}>
              {[['login', 'Log In'], ['signup', 'Sign Up']].map(([m, label]) => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: '9px', fontFamily: R, fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.16em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                  background: mode === m ? 'rgba(189,255,0,0.1)' : 'var(--card)',
                  color: mode === m ? NEON : 'var(--text-dim)',
                  borderBottom: mode === m ? `2px solid ${NEON}` : '2px solid transparent',
                }}>{label}</button>
              ))}
            </div>
          )}

          {/* Forgot password header */}
          {mode === 'forgot' && (
            <div style={{ marginBottom: '24px' }}>
              <button onClick={() => switchMode('login')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: R, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '16px', padding: 0,
              }}>← Back to Log In</button>
              <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text)', marginBottom: '6px' }}>
                RESET PASSWORD
              </div>
              <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.6 }}>
                Enter your email and we'll send you a reset link.
              </div>
            </div>
          )}

          {/* Google button — only for login/signup */}
          {mode !== 'forgot' && (
            <>
              <button onClick={handleGoogle} disabled={loading} style={{
                width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: '2px', cursor: 'pointer',
                fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--text-sub)', marginBottom: '20px',
                opacity: loading ? 0.6 : 1,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border2)' }} />
                <span style={{ fontFamily: R, fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.14em' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border2)' }} />
              </div>
            </>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="operator@email.com" required
                style={inputStyle}
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontFamily: R, fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em',
                      color: 'var(--text-dim)', textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = NEON}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={inputStyle}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={inputStyle}
                />
              </div>
            )}

            {error   && <div style={{ fontFamily: R, fontSize: '11px', color: RED,  background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.25)', padding: '8px 12px', borderRadius: '2px' }}>{error}</div>}
            {success && <div style={{ fontFamily: R, fontSize: '11px', color: NEON, background: 'rgba(189,255,0,0.06)', border: '1px solid rgba(189,255,0,0.25)', padding: '8px 12px', borderRadius: '2px' }}>{success}</div>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px',
              background: 'rgba(189,255,0,0.1)', border: `1px solid rgba(189,255,0,0.5)`,
              borderRadius: '2px', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: NEON, marginTop: '4px',
              textShadow: '0 0 12px rgba(189,255,0,0.3)',
              opacity: loading ? 0.6 : 1,
            }}>
              {loading
                ? 'Please wait...'
                : mode === 'login'  ? 'Log In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: R, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--text-dim)' }}>
          RISK MATRIX LABS © 2026 · DISCIPLINE TODAY. FREEDOM TOMORROW.
        </div>
      </div>
    </div>
  )
}
