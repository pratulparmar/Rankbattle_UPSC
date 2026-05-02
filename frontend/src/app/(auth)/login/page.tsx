'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { login } from '@/lib/api'
import {
  signInWithGoogle,
  sendOTP,
  verifyOTP,
  setupRecaptcha,
  type ConfirmationResult,
} from '@/lib/firebase'

const API = process.env.NEXT_PUBLIC_API_URL

export default function Login() {
  const router = useRouter()
  const { setToken, setUser } = useAuth()

  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<ReturnType<typeof setupRecaptcha> | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const anyLoading = loading || googleLoading || phoneLoading

  const exchangeToken = async (idToken: string, endpoint: string) => {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    })
    if (!res.ok) throw new Error('Auth failed')
    return res.json()
  }

  const storeAuth = (data: { access_token: string }) => {
    const payload = JSON.parse(atob(data.access_token.split('.')[1]))
    setToken(data.access_token)
    setUser({ id: payload.sub, email: payload.email || '', name: payload.name || 'User' })
    router.push('/dashboard')
  }

  const handleGoogle = async () => {
    setGoogleLoading(true); setError('')
    try {
      const idToken = await signInWithGoogle()
      const data = await exchangeToken(idToken, '/auth/firebase/google')
      storeAuth(data)
    } catch (e: any) {
      setError('Google sign-in failed. Please try again.')
    } finally { setGoogleLoading(false) }
  }

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) { setError('Enter a valid phone number'); return }
    setPhoneLoading(true); setError('')
    try {
      const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`
      if (!recaptchaRef.current) recaptchaRef.current = setupRecaptcha('recaptcha-container')
      const result = await sendOTP(formatted, recaptchaRef.current)
      setConfirmResult(result); setOtpSent(true)
    } catch {
      setError('Failed to send OTP. Check the number and try again.')
      recaptchaRef.current = null
    } finally { setPhoneLoading(false) }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) { setError('Enter the 6-digit OTP'); return }
    if (!confirmResult) return
    setPhoneLoading(true); setError('')
    try {
      const idToken = await verifyOTP(confirmResult, otp)
      const data = await exchangeToken(idToken, '/auth/firebase/phone')
      storeAuth(data)
    } catch { setError('Invalid OTP. Please try again.') }
    finally { setPhoneLoading(false) }
  }

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await login(email, password)
      const token = res.data.access_token
      const payload = JSON.parse(atob(token.split('.')[1]))
      setToken(token)
      setUser({ id: payload.sub, email, name: payload.name || email.split('@')[0] })
      router.push('/dashboard')
    } catch { setError('Invalid credentials. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -100, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(160,82,45,0.07)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(200,150,12,0.06)', pointerEvents: 'none' }}/>
      <div id="recaptcha-container" />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 68, height: 68, borderRadius: 20,
          background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(160,82,45,0.35)',
        }}>
          <span style={{ fontSize: 32 }}>🏆</span>
        </div>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 6 }}>RankBattle</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Compete. Rank. Succeed.</p>
        <div style={{ width: 40, height: 2, background: 'var(--terra)', margin: '10px auto 0', borderRadius: 999 }}/>
      </div>

      <div className="paper-card" style={{ width: '100%', maxWidth: 400, padding: '28px 24px', position: 'relative', zIndex: 1 }}>
        <p className="serif" style={{ fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Get Started</p>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 22 }}>New or returning — sign in to continue</p>

        {/* Google — primary CTA */}
        <button onClick={handleGoogle} disabled={anyLoading} style={{
          width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
          borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)',
          background: '#fff', color: '#1a1a1a', cursor: 'pointer', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.13)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
        >
          {googleLoading ? 'Signing in...' : <><GoogleIcon />Continue with Google</>}
        </button>

        {/* Phone OTP */}
        {!showPhone ? (
          <button onClick={() => setShowPhone(true)} disabled={anyLoading} style={{
            width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
            borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)',
            background: '#fff', color: '#1a1a1a', cursor: 'pointer', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            📱 Continue with Phone
          </button>
        ) : (
          <div style={{
            border: '1.5px solid rgba(160,82,45,0.2)', borderRadius: 14,
            padding: '16px', marginBottom: 16, background: 'rgba(160,82,45,0.03)',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 10 }}>PHONE LOGIN</p>
            {!otpSent ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX" type="tel"
                  style={{ flex: 1, padding: '11px 13px', borderRadius: 10, border: '1.5px solid rgba(160,82,45,0.2)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none' }} />
                <button onClick={handleSendOTP} disabled={phoneLoading} style={{
                  padding: '11px 16px', borderRadius: 10, border: 'none',
                  background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{phoneLoading ? '...' : 'Send OTP'}</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>OTP sent to {phone}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={otp} onChange={e => setOtp(e.target.value)}
                    placeholder="6-digit OTP" maxLength={6}
                    style={{ flex: 1, padding: '11px 13px', borderRadius: 10, border: '1.5px solid rgba(160,82,45,0.2)', background: 'var(--paper)', fontSize: 16, color: 'var(--ink)', outline: 'none', letterSpacing: 4, textAlign: 'center' }} />
                  <button onClick={handleVerifyOTP} disabled={phoneLoading} style={{
                    padding: '11px 16px', borderRadius: 10, border: 'none',
                    background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>{phoneLoading ? '...' : 'Verify'}</button>
                </div>
                <button onClick={() => { setOtpSent(false); setOtp('') }} style={{
                  background: 'none', border: 'none', fontSize: 12, color: 'var(--terra)', cursor: 'pointer', marginTop: 8, padding: 0,
                }}>Resend OTP</button>
              </>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
          <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: 1 }}>EXISTING USERS</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
        </div>

        {/* Email login — collapsed by default */}
        {!showEmail ? (
          <button onClick={() => setShowEmail(true)} style={{
            width: '100%', padding: '12px', fontSize: 14, fontWeight: 500,
            borderRadius: 14, border: '1.5px solid rgba(160,82,45,0.2)',
            background: 'transparent', color: 'var(--ink-soft)', cursor: 'pointer',
          }}>
            Sign in with Email & Password
          </button>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 7 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#A0522D'}
                onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 7 }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#A0522D'}
                onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'} />
            </div>
            <button className="btn-terra" onClick={handleLogin} disabled={anyLoading}
              style={{ width: '100%', padding: '14px', fontSize: 15, letterSpacing: 0.5 }}>
              {loading ? 'Signing in...' : 'Enter the War Room →'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '10px 14px', marginTop: 14 }}>
            <p style={{ fontSize: 13, color: '#C0392B', fontWeight: 500, margin: 0 }}>{error}</p>
          </div>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>
        1,402 aspirants currently preparing
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
