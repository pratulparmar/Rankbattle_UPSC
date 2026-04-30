'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { login, guestLogin } from '@/lib/api'

export default function Login() {
  const router = useRouter()
  const { setToken, setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await login(email, password)
      const token = res.data.access_token
      const payload = JSON.parse(atob(token.split('.')[1]))
      setToken(token)
      setUser({ id: payload.sub, email: email, name: payload.name || email.split('@')[0] })
      router.push('/dashboard')
    } catch {
      setError('Invalid credentials. Please try again.')
    } finally { setLoading(false) }
  }

  const handleGuest = async () => {
    setGuestLoading(true); setError('')
    try {
      const res = await guestLogin()
      const token = res.data.access_token
      const payload = JSON.parse(atob(token.split('.')[1]))
      setToken(token)
      setUser({ id: payload.sub, email: 'guest@rankbattle.demo', name: 'Guest Aspirant' })
      router.push('/dashboard')
    } catch {
      setError('Could not start guest session. Please try again.')
    } finally { setGuestLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -100, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(160,82,45,0.07)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(200,150,12,0.06)', pointerEvents: 'none' }}/>

      <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', boxShadow: '0 8px 32px rgba(160,82,45,0.35)',
        }}>
          <span style={{ fontSize: 34 }}>🏆</span>
        </div>
        <h1 className="serif" style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 8 }}>RankBattle</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Compete. Rank. Succeed.</p>
        <div style={{ width: 40, height: 2, background: 'var(--terra)', margin: '12px auto 0', borderRadius: 999 }}/>
      </div>

      <div className="paper-card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px', position: 'relative', zIndex: 1 }}>
        <p className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Welcome back</p>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 28 }}>Sign in to your war room</p>

        {/* Guest button — prominent, at top */}
        <button
          onClick={handleGuest}
          disabled={guestLoading || loading}
          style={{
            width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
            borderRadius: 14, border: '2px dashed rgba(160,82,45,0.35)',
            background: 'rgba(160,82,45,0.06)', color: 'var(--terra)',
            cursor: 'pointer', marginBottom: 20, letterSpacing: 0.3,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(160,82,45,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(160,82,45,0.06)')}
        >
          {guestLoading ? 'Starting session...' : '👁 Explore as Guest'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: 1 }}>OR SIGN IN</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(160,82,45,0.15)' }}/>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontFamily: 'Inter, sans-serif', fontSize: 15, color: 'var(--ink)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#A0522D'}
            onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '2px solid rgba(160,82,45,0.15)', background: 'var(--paper)', fontFamily: 'Inter, sans-serif', fontSize: 15, color: 'var(--ink)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#A0522D'}
            onBlur={e => e.target.style.borderColor = 'rgba(160,82,45,0.15)'}
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
            <p style={{ fontSize: 13, color: '#C0392B', fontWeight: 500 }}>{error}</p>
          </div>
        )}

        <button className="btn-terra" onClick={handleLogin} disabled={loading || guestLoading}
          style={{ width: '100%', padding: '16px', fontSize: 16, letterSpacing: 0.5 }}>
          {loading ? 'Signing in...' : 'Enter the War Room →'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--ink-faint)' }}>
          No account?{' '}
          <span style={{ color: 'var(--terra)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/register')}>Register here</span>
        </p>
      </div>

      <p style={{ marginTop: 32, fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>
        1,402 aspirants currently preparing
      </p>
    </div>
  )
}
