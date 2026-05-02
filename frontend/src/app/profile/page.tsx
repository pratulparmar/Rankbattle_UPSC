'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'

const API = process.env.NEXT_PUBLIC_API_URL
const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ''

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
]

const OPTIONAL_SUBJECTS = [
  'Agriculture','Animal Husbandry','Anthropology','Botany','Chemistry',
  'Civil Engineering','Commerce & Accountancy','Economics','Electrical Engineering',
  'Geography','Geology','History','Law','Management','Mathematics',
  'Mechanical Engineering','Medical Science','Philosophy','Physics','Political Science',
  'Psychology','Public Administration','Sociology','Statistics','Zoology',
]

interface Profile {
  user_id:          string
  email:            string
  name:             string
  avatar_url:       string | null
  phone:            string | null
  target_year:      number
  state:            string | null
  optional_subject: string | null
  is_subscribed:    boolean
  subscribed_at:    string | null
  streak:           number
  created_at:       string
}

export default function ProfilePage() {
  const { token, isLoading, logout } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Edit state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [targetYear, setTargetYear] = useState(2026)
  const [state, setState] = useState('')
  const [optionalSubject, setOptionalSubject] = useState('')

  // Phone modal for subscription
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !token) router.push('/login')
  }, [isLoading, token, router])

  useEffect(() => {
    if (!token) return
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProfile(data)
        setName(data.name || '')
        setPhone(data.phone || '')
        setTargetYear(data.target_year || 2026)
        setState(data.state || '')
        setOptionalSubject(data.optional_subject || '')
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    try {
      await fetch(`${API}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, target_year: targetYear, state, optional_subject: optionalSubject }),
      })
      setProfile(p => p ? { ...p, name, phone, target_year: targetYear, state, optional_subject: optionalSubject } : p)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const handleSubscribe = () => {
    // If phone not saved, show modal first
    if (!profile?.phone && !phone) {
      setShowPhoneModal(true)
    } else {
      startPayment(phone || profile?.phone || '')
    }
  }

  const handlePhoneSubmit = async () => {
    if (!phoneInput || phoneInput.length < 10) {
      setPhoneError('Enter a valid 10-digit phone number')
      return
    }
    setPhoneError('')
    if (token) {
      await fetch(`${API}/auth/subscription/save-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneInput }),
      })
    }
    setShowPhoneModal(false)
    startPayment(phoneInput)
  }

  const startPayment = async (userPhone: string) => {
    if (!token) return
    setPayLoading(true)
    try {
      const res = await fetch(`${API}/auth/subscription/create-order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const order = await res.json()

      // Load Razorpay script dynamically
      if (!document.getElementById('razorpay-script')) {
        await new Promise<void>(resolve => {
          const s = document.createElement('script')
          s.id = 'razorpay-script'
          s.src = 'https://checkout.razorpay.com/v1/checkout.js'
          s.onload = () => resolve()
          document.body.appendChild(s)
        })
      }

      const rzp = new (window as any).Razorpay({
        key:         order.key,
        amount:      order.amount,
        currency:    order.currency,
        name:        'RankBattle UPSC',
        description: 'Premium Subscription',
        image:       '/logo.png',
        order_id:    order.order_id,
        prefill: {
          name:    order.name,
          email:   order.email,
          contact: userPhone,
        },
        theme: { color: '#A0522D' },
        handler: async (response: any) => {
          const verifyRes = await fetch(`${API}/auth/subscription/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          })
          if (verifyRes.ok) {
            setProfile(p => p ? { ...p, is_subscribed: true, subscribed_at: new Date().toISOString() } : p)
          }
        },
      })
      rzp.open()
    } catch (e) {
      console.error(e)
    } finally { setPayLoading(false) }
  }

  if (isLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-faint)' }}>Loading profile...</div>
    </div>
  )

  const initials = (profile?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
        padding: '32px 20px 60px',
        position: 'relative',
      }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar"
              style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff',
              border: '3px solid rgba(255,255,255,0.4)',
            }}>{initials}</div>
          )}
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>{profile?.name}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '4px 0 0' }}>{profile?.email}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span style={{
                background: profile?.is_subscribed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                color: profile?.is_subscribed ? '#A0522D' : 'rgba(255,255,255,0.8)',
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              }}>
                {profile?.is_subscribed ? '⭐ Premium' : 'Free Plan'}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                🔥 {profile?.streak || 0} day streak
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '-32px auto 0', padding: '0 16px' }}>

        {/* Subscription Card */}
        {!profile?.is_subscribed ? (
          <div className="paper-card" style={{
            marginBottom: 16, padding: '20px',
            background: 'linear-gradient(135deg, #FFF8F0, #FFF0E0)',
            border: '1.5px solid rgba(160,82,45,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>👑</span>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--ink)', margin: 0, fontSize: 16 }}>Unlock Premium</p>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>Full access to all 1,089 questions + AI Coach</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--terra)' }}>₹799</span>
              <span style={{ fontSize: 16, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>₹1,199</span>
              <span style={{
                background: 'rgba(46,125,50,0.12)', color: '#2E7D32',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              }}>33% OFF</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              {['1,089 Grade A UPSC questions', 'AI Coach with unlimited queries', 'Expert analysis on every question', 'Full analytics & weak area tracking', 'Lifetime access'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#2E7D32', fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubscribe}
              disabled={payLoading}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
                borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
                color: '#fff', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(160,82,45,0.4)',
              }}>
              {payLoading ? 'Opening payment...' : '🚀 Get Premium — ₹799'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>
              Secure payment via Razorpay · One-time payment
            </p>
          </div>
        ) : (
          <div className="paper-card" style={{
            marginBottom: 16, padding: '16px 20px',
            background: 'rgba(46,125,50,0.05)',
            border: '1.5px solid rgba(46,125,50,0.2)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>⭐</span>
            <div>
              <p style={{ fontWeight: 700, color: '#2E7D32', margin: 0 }}>Premium Active</p>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 0' }}>
                Subscribed {profile.subscribed_at ? new Date(profile.subscribed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </p>
            </div>
          </div>
        )}

        {/* Profile Settings */}
        <div className="paper-card" style={{ marginBottom: 16, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 16 }}>PROFILE SETTINGS</p>

          <Field label="Full Name">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name"
              style={inputStyle} />
          </Field>

          <Field label="Phone Number">
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX" type="tel"
              style={inputStyle} />
          </Field>

          <Field label="Target Year">
            <select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} style={inputStyle}>
              <option value={2025}>UPSC CSE 2025</option>
              <option value={2026}>UPSC CSE 2026</option>
              <option value={2027}>UPSC CSE 2027</option>
            </select>
          </Field>

          <Field label="Home State">
            <select value={state} onChange={e => setState(e.target.value)} style={inputStyle}>
              <option value="">Select state</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Optional Subject">
            <select value={optionalSubject} onChange={e => setOptionalSubject(e.target.value)} style={inputStyle}>
              <option value="">Select optional subject</option>
              {OPTIONAL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '13px', fontSize: 15, fontWeight: 600,
              borderRadius: 14, border: 'none',
              background: saved ? '#2E7D32' : 'var(--terra)',
              color: '#fff', cursor: 'pointer', marginTop: 8,
              transition: 'background 0.2s',
            }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Account */}
        <div className="paper-card" style={{ marginBottom: 16, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 16 }}>ACCOUNT</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>Email</span>
            <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>{profile?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>Member since</span>
            <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''}
            </span>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%', padding: '12px', fontSize: 14, fontWeight: 600,
              borderRadius: 14, border: '1.5px solid rgba(192,57,43,0.3)',
              background: 'rgba(192,57,43,0.05)', color: '#C0392B',
              cursor: 'pointer',
            }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Phone Modal */}
      {showPhoneModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--paper)', borderRadius: '24px 24px 0 0',
            padding: '32px 24px', width: '100%', maxWidth: 480,
          }}>
            <h2 className="serif" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>One last step</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 24 }}>
              Enter your phone number for the payment receipt and order confirmation.
            </p>

            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>PHONE NUMBER</label>
            <input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              type="tel"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {phoneError && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 12 }}>{phoneError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowPhoneModal(false)}
                style={{
                  flex: 1, padding: '13px', fontSize: 14, fontWeight: 600,
                  borderRadius: 14, border: '1.5px solid rgba(160,82,45,0.2)',
                  background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
                }}>Cancel</button>
              <button
                onClick={handlePhoneSubmit}
                style={{
                  flex: 2, padding: '13px', fontSize: 15, fontWeight: 700,
                  borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
                  color: '#fff', cursor: 'pointer',
                }}>Continue to Payment →</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1.5px solid rgba(160,82,45,0.2)', background: 'var(--paper)',
  fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
}