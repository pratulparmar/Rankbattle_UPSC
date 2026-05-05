'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Props {
  reason: 'full_mock' | 'subject_repeat' | 'subjects_limit' | 'coach' | null
  subject?: string
  onClose: () => void
  onSuccess?: () => void   // called after successful payment
}

type Plan = 'sprint' | 'monthly'

const PLAN_CONFIG = {
  sprint:  { label: 'Prelims Sprint',  price: 759,  amount: 75900,  period: 'one-time',    cta: 'Unlock Prelims Sprint — ₹759 →'  },
  monthly: { label: '30-Day Booster',  price: 999,  amount: 99900,  period: 'per month',   cta: 'Get 30-Day Booster — ₹999 →'    },
}

const API = process.env.NEXT_PUBLIC_API_URL

// ── Countdown ──────────────────────────────────────────────────────────────────
function usePrelimsDays() {
  const [days,  setDays]  = useState(0)
  const [hours, setHours] = useState(0)
  const [mins,  setMins]  = useState(0)
  useEffect(() => {
    const PRELIMS = new Date('2026-05-24T09:00:00+05:30').getTime()
    const tick = () => {
      const diff = Math.max(0, PRELIMS - Date.now())
      setDays(Math.floor(diff / 86400000))
      setHours(Math.floor((diff % 86400000) / 3600000))
      setMins(Math.floor((diff % 3600000) / 60000))
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [])
  return { days, hours, mins }
}

// ── Trigger copy ───────────────────────────────────────────────────────────────
const TRIGGER_COPY: Record<string, { icon: string; label: string }> = {
  full_mock:      { icon: '📋', label: "You've used your free full mock" },
  subject_repeat: { icon: '📘', label: "You've used this subject's free test" },
  subjects_limit: { icon: '🎯', label: 'All 3 free subject tests used' },
  coach:          { icon: '🧠', label: "You've used all 5 free AI Coach messages" },
}

// ── Features ───────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '📋', text: 'Unlimited full mock tests' },
  { icon: '📘', text: 'All subjects, unlimited practice' },
  { icon: '🧠', text: 'Unlimited AI Coach — Feynman method' },
  { icon: '📊', text: 'Deep analytics + weak area tracking' },
  { icon: '💡', text: 'Expert explanations, every question' },
]

// ── Digit cell ─────────────────────────────────────────────────────────────────
function DigitCell({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(212,160,23,0.25)',
        borderRadius: 10, padding: '8px 10px',
        fontSize: 26, fontWeight: 800,
        fontFamily: "'DM Mono','Courier New',monospace",
        color: '#f5c842', minWidth: 52, textAlign: 'center',
      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

// ── Razorpay loader ────────────────────────────────────────────────────────────
async function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return
  if (document.getElementById('razorpay-script')) {
    await new Promise<void>(r => setTimeout(r, 500))
    return
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.id = 'razorpay-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Razorpay load failed'))
    document.body.appendChild(s)
  })
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function PaywallModal({ reason, subject, onClose, onSuccess }: Props) {
  const { days, hours, mins } = usePrelimsDays()
  const [selectedPlan, setSelectedPlan] = useState<Plan>('sprint')
  const [payLoading,   setPayLoading]   = useState(false)
  const [payError,     setPayError]     = useState('')
  const [paySuccess,   setPaySuccess]   = useState(false)

  // Reset to sprint whenever modal opens
  useEffect(() => { if (reason) { setSelectedPlan('sprint'); setPayError(''); setPaySuccess(false) } }, [reason])

  // ── Payment ────────────────────────────────────────────────────────────────
  const handlePayment = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) { setPayError('Please log in to continue.'); return }

    setPayLoading(true)
    setPayError('')

    try {
      // Create order — pass plan so backend sets correct amount
      const res = await fetch(`${API}/auth/subscription/create-order?plan=${selectedPlan}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Could not create order')
      const order = await res.json()

      await loadRazorpay()

      const plan = PLAN_CONFIG[selectedPlan]

      const rzp = new (window as any).Razorpay({
        key:         order.key,
        amount:      plan.amount,   // paise — matches backend order
        currency:    order.currency || 'INR',
        name:        'RankBattle UPSC',
        description: plan.label,
        order_id:    order.order_id,
        prefill:     { name: order.name, email: order.email, contact: order.phone || '' },
        theme:       { color: selectedPlan === 'sprint' ? '#d4a017' : '#4f46e5' },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
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
            setPaySuccess(true)
            onSuccess?.()
            setTimeout(() => { onClose(); window.location.reload() }, 1800)
          } else {
            setPayError('Payment verification failed. Contact support.')
          }
          setPayLoading(false)
        },
      })
      rzp.open()
    } catch (e: any) {
      setPayError(e?.message || 'Payment failed. Try again.')
      setPayLoading(false)
    }
  }, [selectedPlan, onClose, onSuccess])

  if (!reason) return null

  const trigger = TRIGGER_COPY[reason] ?? { icon: '🔒', label: 'Free limit reached' }
  const plan    = PLAN_CONFIG[selectedPlan]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@600&display=swap');
        @keyframes modalIn    { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes goldPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(212,160,23,0.2)} 50%{box-shadow:0 0 0 8px rgba(212,160,23,0)} }
        @keyframes successIn  { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }

        .pw-backdrop { animation: backdropIn 0.2s ease; }
        .pw-modal    { animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }

        .shimmer-text {
          background: linear-gradient(90deg,#f5c842 0%,#fff8dc 40%,#f5c842 60%,#d4930a 100%);
          background-size: 200% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          animation: shimmer 3s linear infinite;
        }

        /* Sprint card — gold pulse when selected */
        .sprint-selected { animation: goldPulse 2.5s ease-in-out infinite; }

        .pw-plan {
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
        }
        .pw-plan:hover { transform: translateY(-2px); }
        .pw-plan:active { transform: translateY(0); }

        .pw-cta {
          transition: transform 0.12s, filter 0.15s, background 0.25s, box-shadow 0.25s;
        }
        .pw-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
        .pw-cta:active:not(:disabled) { transform: translateY(0); }

        .success-icon { animation: successIn 0.4s ease both; }
      `}</style>

      {/* Backdrop */}
      <div className="pw-backdrop" onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,8,15,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {/* Sheet */}
        <div className="pw-modal" onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 480, maxHeight: '95dvh', overflowY: 'auto',
          background: 'linear-gradient(170deg,#0d1117 0%,#111827 60%,#0d1117 100%)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none',
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}>

          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* ── Success state ── */}
          {paySuccess && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div className="success-icon" style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h2 style={{ color: '#f5c842', fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "'DM Serif Display',serif" }}>
                You&apos;re in!
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                {plan.label} activated. Reloading...
              </p>
            </div>
          )}

          {/* ── Normal state ── */}
          {!paySuccess && (
            <>
              {/* Countdown */}
              <div style={{
                margin: '14px 20px 0',
                background: 'linear-gradient(135deg,rgba(212,160,23,0.08),rgba(212,160,23,0.03))',
                border: '1px solid rgba(212,160,23,0.18)', borderRadius: 16, padding: '14px 16px',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(212,160,23,0.7)', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
                  ⏱ Prelims 2026 is in
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                  <DigitCell value={days}  label="DAYS" />
                  <span style={{ color: 'rgba(212,160,23,0.4)', fontSize: 22, fontWeight: 300, marginBottom: 14 }}>:</span>
                  <DigitCell value={hours} label="HRS"  />
                  <span style={{ color: 'rgba(212,160,23,0.4)', fontSize: 22, fontWeight: 300, marginBottom: 14 }}>:</span>
                  <DigitCell value={mins}  label="MINS" />
                </div>
              </div>

              {/* Trigger pill */}
              <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 99, padding: '5px 12px', fontSize: 12, color: 'rgba(255,255,255,0.5)',
                }}>
                  {trigger.icon} {trigger.label}
                </span>
              </div>

              {/* Headline */}
              <div style={{ padding: '16px 24px 0', textAlign: 'center' }}>
                <h2 style={{
                  fontFamily: "'DM Serif Display',Georgia,serif",
                  fontSize: 26, fontWeight: 400, lineHeight: 1.2, color: '#f1f5f9', marginBottom: 8,
                }}>
                  Don&apos;t Leave Your<br />
                  <span className="shimmer-text">Rank to Chance.</span>
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                  The final {Math.min(days, 20)} days are for fixing weak areas.<br />Choose your sprint plan.
                </p>
              </div>

              {/* ── Plan cards ── */}
              <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Sprint — Gold */}
                <div
                  className={`pw-plan${selectedPlan === 'sprint' ? ' sprint-selected' : ''}`}
                  onClick={() => setSelectedPlan('sprint')}
                  style={{
                    position: 'relative', borderRadius: 20, padding: '20px',
                    background: selectedPlan === 'sprint'
                      ? 'linear-gradient(145deg,rgba(30,21,0,0.95),rgba(16,24,0,0.95))'
                      : 'linear-gradient(145deg,rgba(20,14,0,0.6),rgba(12,16,0,0.6))',
                    border: selectedPlan === 'sprint'
                      ? '2px solid #d4a017'
                      : '1px solid rgba(212,160,23,0.3)',
                  }}
                >
                  {/* Best Value ribbon */}
                  <div style={{
                    position: 'absolute', top: 0, right: 20,
                    background: 'linear-gradient(135deg,#d4a017,#f5c842)',
                    color: '#0d0a00', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                    padding: '4px 12px', borderRadius: '0 0 10px 10px',
                    boxShadow: '0 4px 12px rgba(212,160,23,0.4)', zIndex: 1,
                  }}>
                    ★ BEST VALUE
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 4 }}>
                        Prelims &apos;26 Sprint
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        Until Prelims 2026 · <strong style={{ color: 'rgba(212,160,23,0.7)' }}>One-time payment</strong>
                      </div>
                    </div>
                    {/* Radio */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${selectedPlan === 'sprint' ? '#d4a017' : 'rgba(255,255,255,0.2)'}`,
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

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: '#f5c842', fontFamily: "'DM Serif Display',serif", lineHeight: 1 }}>₹759</span>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>one-time</div>
                      <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Save ₹240 vs monthly</div>
                    </div>
                  </div>

                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.2)',
                    borderRadius: 99, padding: '5px 12px',
                    fontSize: 11, color: '#f5c842', fontWeight: 600, marginBottom: 14,
                  }}>
                    🏆 Most Recommended for May 24
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {FEATURES.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(212,160,23,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>
                          {f.icon}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly — Indigo */}
                <div
                  className="pw-plan"
                  onClick={() => setSelectedPlan('monthly')}
                  style={{
                    position: 'relative', borderRadius: 16, padding: '18px',
                    background: selectedPlan === 'monthly'
                      ? 'linear-gradient(145deg,rgba(15,10,40,0.95),rgba(20,12,50,0.95))'
                      : 'linear-gradient(145deg,rgba(10,8,28,0.6),rgba(14,8,32,0.6))',
                    border: selectedPlan === 'monthly'
                      ? '2px solid #6366f1'
                      : '1px solid rgba(99,102,241,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: selectedPlan === 'monthly' ? '#a5b4fc' : 'rgba(165,180,252,0.6)', textTransform: 'uppercase', marginBottom: 3 }}>
                        30-Day Booster
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        Monthly Access · <span style={{ color: selectedPlan === 'monthly' ? 'rgba(165,180,252,0.7)' : 'rgba(165,180,252,0.4)' }}>per month</span>
                      </div>
                    </div>
                    {/* Radio */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${selectedPlan === 'monthly' ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
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

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>₹1,499</span>
                    <span style={{ fontSize: 36, fontWeight: 800, color: selectedPlan === 'monthly' ? '#a5b4fc' : 'rgba(165,180,252,0.5)', fontFamily: "'DM Serif Display',serif", lineHeight: 1 }}>₹999</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/month</span>
                  </div>

                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                    Standard monthly flexibility · Renews automatically
                  </div>
                </div>
              </div>

              {/* Comparison callout — sprint only */}
              {selectedPlan === 'sprint' && (
                <div style={{
                  margin: '14px 16px 0',
                  background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)',
                  borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                  <p style={{ fontSize: 12, color: 'rgba(74,222,128,0.8)', lineHeight: 1.5, margin: 0 }}>
                    ₹759 covers the full exam stretch — one payment, no renewal surprises.
                  </p>
                </div>
              )}

              {/* Error */}
              {payError && (
                <div style={{ margin: '10px 16px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>⚠ {payError}</p>
                </div>
              )}

              {/* ── CTA ── */}
              <div style={{ padding: '16px 16px 8px' }}>
                <button
                  className="pw-cta"
                  onClick={handlePayment}
                  disabled={payLoading}
                  style={{
                    width: '100%', padding: '16px',
                    borderRadius: 16, border: 'none',
                    background: payLoading
                      ? 'rgba(255,255,255,0.1)'
                      : selectedPlan === 'sprint'
                        ? 'linear-gradient(135deg,#d4a017,#f5c842,#d4930a)'
                        : 'linear-gradient(135deg,#4f46e5,#6366f1)',
                    color: payLoading ? 'rgba(255,255,255,0.4)' : selectedPlan === 'sprint' ? '#0d0a00' : '#fff',
                    fontSize: 16, fontWeight: 800, cursor: payLoading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.01em',
                    boxShadow: payLoading ? 'none'
                      : selectedPlan === 'sprint'
                        ? '0 4px 24px rgba(212,160,23,0.4)'
                        : '0 4px 24px rgba(79,70,229,0.4)',
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  {payLoading
                    ? (
                      <>
                        <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                        Opening payment…
                      </>
                    )
                    : plan.cta
                  }
                </button>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 10 }}>
                  {selectedPlan === 'sprint'
                    ? 'Secured via Razorpay · One-time · No auto-renewal'
                    : 'Secured via Razorpay · Renews monthly · Cancel anytime'}
                </p>
              </div>

              {/* Dismiss */}
              <div style={{ padding: '0 16px 28px', textAlign: 'center' }}>
                <button onClick={onClose} style={{
                  background: 'none', border: 'none', fontSize: 12,
                  color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '8px',
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                >
                  Continue with limited free access
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </>
  )
}