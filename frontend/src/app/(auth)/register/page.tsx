'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register, login } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { signInWithGoogle } from '@/lib/firebase'

const API = process.env.NEXT_PUBLIC_API_URL

export default function RegisterPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { setUser, setToken }   = useAuth()
  const router                  = useRouter()

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('All fields required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      await register(email, password, name)
      const res     = await login(email, password)
      const token   = res.data.access_token
      const payload = JSON.parse(atob(token.split('.')[1]))
      setToken(token)
      setUser({ id: payload.sub, email, name })
      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Try again.')
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true); setError('')
    try {
      const idToken = await signInWithGoogle()
      const res = await fetch(`${API}/auth/firebase/google`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id_token: idToken }),
      })
      if (!res.ok) throw new Error('Google auth failed')
      const data    = await res.json()
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      setToken(data.access_token)
      setUser({ id: payload.sub, email: payload.email || '', name: payload.name || 'User' })
      router.push('/dashboard')
    } catch { setError('Google sign-in failed. Please try again.') }
    finally { setGoogleLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -100, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(160,82,45,0.07)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(200,150,12,0.06)', pointerEvents: 'none' }}/>

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
        <p className="serif" style={{ fontSize: 21, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Create Account</p>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 22 }}>Start your UPSC prep journey</p>

        {/* Google — fastest signup */}
        <button onClick={handleGoogle} disabled={googleLoading || loading} style={{
          width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
          borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)',
          background: '#fff', color: '#1a1a1a', cursor: 'pointer', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {googleLoading ? 'Signing up...' : <><GoogleIcon />Sign up with Google</>}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
          <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: 1 }}>OR REGISTER WITH EMAIL</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 7 }}>FULL NAME</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#A0522D'}
            onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'} />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 7 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#A0522D'}
            onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'} />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 7 }}>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#A0522D'}
            onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'} />
        </div>

        {error && (
          <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#C0392B', fontWeight: 500, margin: 0 }}>{error}</p>
          </div>
        )}

        <button className="btn-terra" onClick={handleRegister} disabled={loading || googleLoading}
          style={{ width: '100%', padding: '14px', fontSize: 15, letterSpacing: 0.5 }}>
          {loading ? 'Creating account...' : 'Create Account →'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--ink-faint)' }}>
          Already have an account?{' '}
          <span style={{ color: 'var(--terra)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/login')}>
            Sign in
          </span>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>
        Every serious aspirant is one test ahead of you.
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
