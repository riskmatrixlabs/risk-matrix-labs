import { useState } from 'react'
import { updatePassword } from '../lib/supabase'

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

export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error: err } = await updatePassword(password)
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setTimeout(() => onDone?.(), 2000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
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
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: R, fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text)', marginBottom: '6px' }}>
              SET NEW PASSWORD
            </div>
            <div style={{ fontFamily: R, fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.6 }}>
              Choose a new password for your account.
            </div>
          </div>

          {success ? (
            <div style={{
              fontFamily: R, fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em',
              color: NEON, background: 'rgba(189,255,0,0.06)',
              border: '1px solid rgba(189,255,0,0.25)', padding: '16px',
              borderRadius: '2px', textAlign: 'center', lineHeight: 1.6,
            }}>
              Password updated.<br />
              <span style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 600 }}>Redirecting to your dashboard...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ fontFamily: R, fontSize: '11px', color: RED, background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.25)', padding: '8px 12px', borderRadius: '2px' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: 'rgba(189,255,0,0.1)', border: `1px solid rgba(189,255,0,0.5)`,
                borderRadius: '2px', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: R, fontSize: '12px', fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: NEON, marginTop: '4px',
                textShadow: '0 0 12px rgba(189,255,0,0.3)',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: R, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--text-dim)' }}>
          RISK MATRIX LABS © 2025 · DISCIPLINE TODAY. FREEDOM TOMORROW.
        </div>
      </div>
    </div>
  )
}
