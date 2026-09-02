'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { guestLogin } from './api'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const decodeUser = (tok: string): User => {
  try {
    const p = JSON.parse(atob(tok.split('.')[1]))
    return { id: p.sub || '', email: p.email || '', name: p.name || 'Guest' }
  } catch {
    return { id: '', email: '', name: 'Guest' }
  }
}

// Skippable welcome shown once to a brand-new visitor. Either way they land
// straight in the app; anything they share (and their IP) is logged.
function GuestSplash({ onEnter }: { onEnter: (p: { name?: string; org?: string }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (payload: { name?: string; org?: string }) => {
    if (busy) return
    setBusy(true)
    try { await onEnter(payload) } catch { try { await onEnter({}) } catch { setBusy(false) } }
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', marginBottom: 10,
    borderRadius: 12, border: '1.5px solid #e5e5ea', fontSize: 15, outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f7', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, padding: 32,
        boxShadow: '0 12px 48px rgba(0,0,0,.10)' }}>
        <div style={{ fontSize: 34 }}>👋</div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#16162e', margin: '8px 0 4px' }}>
          Welcome to RankBattle UPSC
        </h1>
        <p style={{ fontSize: 14, color: '#6a6a80', lineHeight: 1.55, margin: '0 0 20px' }}>
          Jump straight in — no sign-up needed. If you like, tell us who&apos;s visiting so we know you stopped by.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); go({ name: name.trim() || undefined, org: org.trim() || undefined }) }}>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          <input style={input} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company / organization" autoComplete="organization" />
          <button type="submit" disabled={busy} style={{ width: '100%', padding: 14, borderRadius: 12, border: 0,
            background: 'linear-gradient(135deg,#e2b04a,#c8892f)', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Entering…' : 'Enter the app →'}
          </button>
        </form>
        <button onClick={() => go({})} disabled={busy} style={{ width: '100%', marginTop: 12, padding: 8, border: 0,
          background: 'transparent', color: '#8a8aa0', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f7', color: '#8a8aa0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
      Loading…
    </div>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needIdentify, setNeedIdentify] = useState(false)

  const applyToken = (tok: string) => {
    const u = decodeUser(tok)
    setTokenState(tok)
    setUserState(u)
    try {
      localStorage.setItem('token', tok)
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('rb_identified', '1')
    } catch { /* ignore */ }
  }

  const enterAsGuest = async (payload: { name?: string; org?: string } = {}) => {
    const res = await guestLogin(payload)
    applyToken(res.data.access_token)
    setNeedIdentify(false)
    setIsLoading(false)
  }

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem('token') } catch { /* ignore */ }
    if (stored && stored !== 'undefined') {
      applyToken(stored)
      setIsLoading(false)
      return
    }
    let identified: string | null = null
    try { identified = localStorage.getItem('rb_identified') } catch { /* ignore */ }
    if (identified) {
      enterAsGuest({}).catch(() => { setNeedIdentify(true); setIsLoading(false) })
      return
    }
    setNeedIdentify(true)
    setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setUser = (u: User) => { setUserState(u); try { localStorage.setItem('user', JSON.stringify(u)) } catch { /* ignore */ } }
  const setToken = (t: string) => { setTokenState(t); try { localStorage.setItem('token', t) } catch { /* ignore */ } }
  const logout = () => {
    try {
      localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('rb_identified')
    } catch { /* ignore */ }
    setUserState(null); setTokenState(null)
    if (typeof window !== 'undefined') window.location.href = '/'
  }

  if (isLoading) return <Loader />
  if (needIdentify) return <GuestSplash onEnter={enterAsGuest} />

  return (
    <AuthContext.Provider value={{ user, token, setUser, setToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
