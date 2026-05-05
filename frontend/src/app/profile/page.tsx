'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'

const API = process.env.NEXT_PUBLIC_API_URL

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

// ── Plan config (single source of truth) ──────────────────────────────────────
const PLAN_CONFIG = {
  sprint:  { label: "Prelims '26 Sprint", price: '₹759', amount: 75900, period: 'one-time',  description: 'Until Prelims 2026', cta: "🚀 Unlock Prelims Sprint — ₹759" },
  monthly: { label: '30-Day Booster',     price: '₹999', amount: 99900, period: 'per month', description: '30-day access',       cta: "📅 Get 30-Day Booster — ₹999"  },
} as const

type Plan = keyof typeof PLAN_CONFIG

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

// ── Razorpay script loader ─────────────────────────────────────────────────────
async function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return
  if (document.getElementById('razorpay-script')) {
    await new Promise<void>(r => setTimeout(r, 500))
    return
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.id  = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error('Razorpay failed to load'))
    document.body.appendChild(s)
  })
}

export default function ProfilePage() {
  const { token, isLoading, logout } = useAuth()
  const router = useRouter()

  const [profile,        setProfile]        = useState<Profile | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [selectedPlan,   setSelectedPlan]   = useState<Plan>('sprint')
  const [payLoading,     setPayLoading]     = useState(false)
  const [payError,       setPayError]       = useState('')

  // Edit fields
  const [name,            setName]            = useState('')
  const [phone,           setPhone]           = useState('')
  const [targetYear,      setTargetYear]      = useState(2026)
  const [state,           setState]           = useState('')
  const [optionalSubject, setOptionalSubject] = useState('')

  // Phone collection modal (for users who haven't saved phone yet)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneInput,     setPhoneInput]     = useState('')
  const [phoneError,     setPhoneError]     = useState('')
  const [pendingPlan,    setPendingPlan]    = useState<Plan>('sprint')

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

  // ── Trigger payment for a given plan ──────────────────────────────────────────
  const startPayment = async (plan: Plan, userPhone: string) => {
  if (!token) { setPayError('Please log in to continue.'); return }

  setPayLoading(true)
  setPayError('')

  const planCfg = PLAN_CONFIG[plan]

  try {
    // ── Create order on backend ─────────────────────────────────────────────
    const res = await fetch(
      `${API}/auth/subscription/create-order?plan=${plan}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error('Could not create order')
    const order = await res.json()

    // ── Validation: ensure backend amount matches UI selection ──────────────
    if (order.amount !== planCfg.amount) {
      console.error(
        `[Payment] Amount mismatch! UI selected ${planCfg.amount} paise (₹${planCfg.price}) ` +
        `but backend returned ${order.amount} paise. Aborting.`
      )
      throw new Error('Payment configuration error. Please refresh and try again.')
    }

    console.log(
      `[Payment] ✅ Plan: ${plan} | Amount: ₹${planCfg.amount / 100} | Order: ${order.order_id}`
    )

    await loadRazorpay()

    const rzp = new (window as any).Razorpay({
      key:         order.key,
      amount:      order.amount,       // ← use backend value (already validated)
      currency:    order.currency || 'INR',
      name:        'RankBattle UPSC',
      description: order.plan_label || planCfg.label,
      order_id:    order.order_id,
      prefill:     { name: order.name, email: order.email, contact: userPhone },
      theme:       { color: plan === 'sprint' ? '#d4a017' : '#4f46e5' },
      modal: {
        ondismiss: () => {
          console.log('[Payment] User dismissed Razorpay modal')
          setPayLoading(false)
        },
      },
      handler: async (response: any) => {
        console.log('[Payment] Payment success, verifying with backend...')
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
          console.log('[Payment] ✅ Verified. Activating subscription.')
          setProfile(p => p ? { ...p, is_subscribed: true, subscribed_at: new Date().toISOString() } : p)
          setTimeout(() => window.location.reload(), 1200)
        } else {
          setPayError('Payment verification failed. Contact support.')
        }
        setPayLoading(false)
      },
    })

    rzp.open()

  } catch (e: any) {
    setPayError(e?.message || 'Payment failed. Please try again.')
    setPayLoading(false)
  }
}
  

  const handleSubscribe = (plan: Plan) => {
    const userPhone = phone || profile?.phone || ''
    if (!userPhone) {
      setPendingPlan(plan)
      setShowPhoneModal(true)
    } else {
      startPayment(plan, userPhone)
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
      setPhone(phoneInput)
    }
    setShowPhoneModal(false)
    startPayment(pendingPlan, phoneInput)
  }

  if (isLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-faint)' }}>Loading profile...</div>
    </div>
  )

  const initials = (profile?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const plan     = PLAN_CONFIG[selectedPlan]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 100 }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .plan-sel { cursor: pointer; transition: border 0.2s, background 0.2s, transform 0.15s; }
        .plan-sel:hover { transform: translateY(-1px); }
        .plan-sel:active { transform: translateY(0); }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
        padding: '32px 20px 60px',
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

        {/* ── Subscription Card ── */}
        {!profile?.is_subscribed ? (
          <div style={{
            marginBottom: 16, padding: '20px',
            background: 'linear-gradient(145deg, #0d1117, #111827)',
            border: '1.5px solid rgba(212,160,23,0.3)',
            borderRadius: 20, position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <p style={{ fontWeight: 700, color: '#f5c842', margin: 0, fontSize: 16 }}>
                  Choose Your Plan
                </p>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                Full access to 1,400+ UPSC audit questions + AI Coach
              </p>
            </div>

            {/* ── Plan cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>

              {/* Sprint */}
              <div
                className="plan-sel"
                onClick={() => setSelectedPlan('sprint')}
                style={{
                  borderRadius: 16, padding: '14px 16px',
                  background: selectedPlan === 'sprint'
                    ? 'linear-gradient(145deg,rgba(30,21,0,0.9),rgba(16,24,0,0.9))'
                    : 'linear-gradient(145deg,rgba(20,14,0,0.5),rgba(12,16,0,0.5))',
                  border: selectedPlan === 'sprint'
                    ? '2px solid #d4a017'
                    : '1px solid rgba(212,160,23,0.3)',
                  position: 'relative',
                }}
              >
                {/* Ribbon */}
                <div style={{
                  position: 'absolute', top: 0, right: 14,
                  background: 'linear-gradient(135deg,#d4a017,#f5c842)',
                  color: '#0d0a00', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                  padding: '3px 10px', borderRadius: '0 0 8px 8px', zIndex: 1,
                }}>
                  ★ RECOMMENDED
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 4 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f5c842', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2, marginTop: 4 }}>
                      Prelims &apos;26 Sprint
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      Until Prelims 2026 · <strong style={{ color: 'rgba(212,160,23,0.6)' }}>One-time</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: '#f5c842', lineHeight: 1 }}>₹759</span>
                      <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Save ₹240</span>
                    </div>
                  </div>
                  {/* Radio */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    border: `2px solid ${selectedPlan === 'sprint' ? '#d4a017' : 'rgba(212,160,23,0.3)'}`,
                    background: selectedPlan === 'sprint' ? '#d4a017' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {selectedPlan === 'sprint' && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#0d0a00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly */}
              <div
                className="plan-sel"
                onClick={() => setSelectedPlan('monthly')}
                style={{
                  borderRadius: 16, padding: '14px 16px',
                  background: selectedPlan === 'monthly'
                    ? 'linear-gradient(145deg,rgba(15,10,40,0.9),rgba(20,12,50,0.9))'
                    : 'linear-gradient(145deg,rgba(10,8,28,0.5),rgba(14,8,32,0.5))',
                  border: selectedPlan === 'monthly'
                    ? '2px solid #6366f1'
                    : '1px solid rgba(99,102,241,0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: selectedPlan === 'monthly' ? '#a5b4fc' : 'rgba(165,180,252,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                      30-Day Booster
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      Monthly Access · <span style={{ color: selectedPlan === 'monthly' ? 'rgba(165,180,252,0.6)' : 'rgba(165,180,252,0.35)' }}>per month</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>₹1,499</span>
                      <span style={{ fontSize: 28, fontWeight: 800, color: selectedPlan === 'monthly' ? '#a5b4fc' : 'rgba(165,180,252,0.55)', lineHeight: 1 }}>₹999</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/month</span>
                    </div>
                  </div>
                  {/* Radio */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    border: `2px solid ${selectedPlan === 'monthly' ? '#6366f1' : 'rgba(99,102,241,0.3)'}`,
                    background: selectedPlan === 'monthly' ? '#6366f1' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {selectedPlan === 'monthly' && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                  Standard monthly flexibility · Renews automatically
                </div>
              </div>
            </div>

            {/* Features */}
            <div style={{ marginBottom: 16 }}>
              {[
                '1,400+ Grade A UPSC audit questions',
                'AI Coach with unlimited queries',
                'Expert explanations on every question',
                'Deep analytics & weak area tracking',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#4ade80', fontSize: 12, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {payError && (
              <div style={{ marginBottom: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>⚠ {payError}</p>
              </div>
            )}

            {/* ── Dynamic CTA ── */}
            <button
              onClick={() => handleSubscribe(selectedPlan)}
              disabled={payLoading}
              style={{
                width: '100%', padding: '14px', fontSize: 15, fontWeight: 700,
                borderRadius: 14, border: 'none',
                background: payLoading
                  ? 'rgba(255,255,255,0.08)'
                  : selectedPlan === 'sprint'
                    ? 'linear-gradient(135deg, #d4a017, #f5c842, #d4930a)'
                    : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: payLoading ? 'rgba(255,255,255,0.4)' : selectedPlan === 'sprint' ? '#0d0a00' : '#fff',
                cursor: payLoading ? 'not-allowed' : 'pointer',
                boxShadow: payLoading ? 'none'
                  : selectedPlan === 'sprint'
                    ? '0 4px 20px rgba(212,160,23,0.4)'
                    : '0 4px 20px rgba(79,70,229,0.4)',
                marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'background 0.25s, box-shadow 0.25s',
              }}
            >
              {payLoading
                ? <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Opening payment…
                  </>
                : plan.cta
              }
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              {selectedPlan === 'sprint'
                ? 'Secured via Razorpay · One-time · No auto-renewal'
                : 'Secured via Razorpay · Renews monthly · Cancel anytime'}
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
                Subscribed {profile.subscribed_at
                  ? new Date(profile.subscribed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                  : ''}
              </p>
            </div>
          </div>
        )}

        {/* Profile Settings */}
        <div className="paper-card" style={{ marginBottom: 16, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 16 }}>PROFILE SETTINGS</p>

          <Field label="Full Name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
          </Field>
          <Field label="Phone Number">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" type="tel" style={inputStyle} />
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

          <button onClick={handleSave} disabled={saving} style={{
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
          <button onClick={logout} style={{
            width: '100%', padding: '12px', fontSize: 14, fontWeight: 600,
            borderRadius: 14, border: '1.5px solid rgba(192,57,43,0.3)',
            background: 'rgba(192,57,43,0.05)', color: '#C0392B', cursor: 'pointer',
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
              Enter your phone number for the payment receipt.
            </p>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>PHONE NUMBER</label>
            <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
              placeholder="+91 XXXXX XXXXX" type="tel"
              style={{ ...inputStyle, marginBottom: 8 }} />
            {phoneError && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 12 }}>{phoneError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowPhoneModal(false)} style={{
                flex: 1, padding: '13px', fontSize: 14, fontWeight: 600,
                borderRadius: 14, border: '1.5px solid rgba(160,82,45,0.2)',
                background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handlePhoneSubmit} style={{
                flex: 2, padding: '13px', fontSize: 15, fontWeight: 700,
                borderRadius: 14, border: 'none',
                background: pendingPlan === 'sprint'
                  ? 'linear-gradient(135deg, #d4a017, #f5c842)'
                  : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: pendingPlan === 'sprint' ? '#0d0a00' : '#fff',
                cursor: 'pointer',
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