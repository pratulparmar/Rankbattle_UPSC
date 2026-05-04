'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Props {
  reason: 'full_mock' | 'subject_repeat' | 'subjects_limit' | 'coach' | null
  subject?: string
  onClose: () => void
}

// ── Countdown to Prelims 2026 (May 24) ────────────────────────────────────────
function usePrelimsDays() {
  const [days, setDays] = useState<number>(0)
  const [hours, setHours] = useState<number>(0)
  const [mins, setMins] = useState<number>(0)

  useEffect(() => {
    const PRELIMS = new Date('2026-05-24T09:00:00+05:30').getTime()

    const tick = () => {
      const now  = Date.now()
      const diff = Math.max(0, PRELIMS - now)
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

// ── Content per trigger reason ────────────────────────────────────────────────
const TRIGGER_COPY: Record<string, { icon: string; label: string }> = {
  full_mock:      { icon: '📋', label: "You've used your free full mock" },
  subject_repeat: { icon: '📘', label: "You've used this subject's free test" },
  subjects_limit: { icon: '🎯', label: 'All 3 free subject tests used' },
  coach:          { icon: '🧠', label: "You've used all 5 free AI Coach messages" },
}

// ── Feature list ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '📋', text: 'Unlimited full mock tests' },
  { icon: '📘', text: 'All subjects, unlimited practice' },
  { icon: '🧠', text: 'Unlimited AI Coach — Feynman method' },
  { icon: '📊', text: 'Deep analytics + weak area tracking' },
  { icon: '💡', text: 'Expert explanations, every question' },
]

// ── Digit flip cell ───────────────────────────────────────────────────────────
function DigitCell({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 48 }}>
      <div style={{
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(212,160,23,0.25)',
        borderRadius: 10, padding: '8px 10px',
        fontSize: 26, fontWeight: 800,
        fontFamily: "'DM Mono', 'Courier New', monospace",
        color: '#f5c842',
        letterSpacing: '-0.02em',
        minWidth: 52, textAlign: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PaywallModal({ reason, subject, onClose }: Props) {
  const router              = useRouter()
  const { days, hours, mins } = usePrelimsDays()
  const [selectedPlan, setSelectedPlan] = useState<'sprint' | 'monthly'>('sprint')
  const [entering, setEntering]         = useState(true)

  useEffect(() => {
    if (reason) {
      setEntering(true)
      const t = setTimeout(() => setEntering(false), 20)
      return () => clearTimeout(t)
    }
  }, [reason])

  if (!reason) return null

  const trigger = TRIGGER_COPY[reason] ?? { icon: '🔒', label: 'Free limit reached' }

  const handleCTA = () => {
    router.push('/profile')
    onClose()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@600&display=swap');

        @keyframes modalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ribbonPop {
          from { opacity: 0; transform: translateY(-4px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,160,23,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(212,160,23,0); }
        }

        .paywall-backdrop {
          animation: backdropIn 0.2s ease;
        }
        .paywall-modal {
          animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .plan-sprint {
          animation: pulse 2.5s ease-in-out infinite;
        }
        .ribbon {
          animation: ribbonPop 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .shimmer-text {
          background: linear-gradient(90deg, #f5c842 0%, #fff8dc 40%, #f5c842 60%, #d4930a 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        .plan-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .plan-card:hover {
          transform: translateY(-2px);
        }
        .cta-btn {
          transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
        }
        .cta-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
        .cta-btn:active {
          transform: translateY(0);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="paywall-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(5, 8, 15, 0.82)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0',
        }}
      >
        {/* Modal sheet */}
        <div
          className="paywall-modal"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '95dvh',
            overflowY: 'auto',
            background: 'linear-gradient(170deg, #0d1117 0%, #111827 60%, #0d1117 100%)',
            borderRadius: '28px 28px 0 0',
            border: '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            position: 'relative',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* ── Countdown Banner ── */}
          <div style={{
            margin: '14px 20px 0',
            background: 'linear-gradient(135deg, rgba(212,160,23,0.08), rgba(212,160,23,0.03))',
            border: '1px solid rgba(212,160,23,0.18)',
            borderRadius: 16,
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(212,160,23,0.7)', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
              ⏱ Prelims 2026 is in
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
              <DigitCell value={days}  label="DAYS"  />
              <span style={{ color: 'rgba(212,160,23,0.5)', fontSize: 22, fontWeight: 300, marginBottom: 14 }}>:</span>
              <DigitCell value={hours} label="HRS"   />
              <span style={{ color: 'rgba(212,160,23,0.5)', fontSize: 22, fontWeight: 300, marginBottom: 14 }}>:</span>
              <DigitCell value={mins}  label="MINS"  />
            </div>
          </div>

          {/* ── Trigger pill ── */}
          <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 99, padding: '5px 12px',
              fontSize: 12, color: 'rgba(255,255,255,0.5)',
            }}>
              <span>{trigger.icon}</span> {trigger.label}
            </span>
          </div>

          {/* ── Headline ── */}
          <div style={{ padding: '16px 24px 0', textAlign: 'center' }}>
            <h2 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 26, fontWeight: 400, lineHeight: 1.2,
              color: '#f1f5f9', marginBottom: 8,
            }}>
              Don't Leave Your<br />
              <span className="shimmer-text">Rank to Chance.</span>
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              The final {days <= 20 ? days : 20} days are for fixing weak areas.<br />Choose your sprint plan.
            </p>
          </div>

          {/* ── Pricing Cards ── */}
          <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* ─ Tier B: Prelims Sprint (Winner) ─ */}
            <div
              className="plan-card plan-sprint"
              onClick={() => setSelectedPlan('sprint')}
              style={{
                position: 'relative', borderRadius: 20, padding: '20px',
                background: 'linear-gradient(145deg, #1a1200, #0f1700)',
                border: selectedPlan === 'sprint'
                  ? '2px solid #d4a017'
                  : '1px solid rgba(212,160,23,0.3)',
                cursor: 'pointer',
                order: -1, // mobile: sprint on top
              }}
            >
              {/* Ribbon */}
              <div className="ribbon" style={{
                position: 'absolute', top: -1, right: 20,
                background: 'linear-gradient(135deg, #d4a017, #f5c842)',
                color: '#0d0a00', fontSize: 10, fontWeight: 800,
                letterSpacing: '0.08em', padding: '4px 12px 4px 12px',
                borderRadius: '0 0 10px 10px',
                boxShadow: '0 4px 12px rgba(212,160,23,0.4)',
              }}>
                ★ BEST VALUE
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#f5c842', textTransform: 'uppercase', marginBottom: 4 }}>
                    Prelims '26 Sprint
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    Until Prelims 2026 · One-time payment
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2px solid #d4a017',
                  background: selectedPlan === 'sprint' ? '#d4a017' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s', flexShrink: 0,
                }}>
                  {selectedPlan === 'sprint' && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#0d0a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 42, fontWeight: 800, color: '#f5c842', fontFamily: "'DM Serif Display', serif", lineHeight: 1 }}>
                  ₹759
                </span>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>one-time</div>
                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                    Save ₹240 vs monthly
                  </div>
                </div>
              </div>

              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(212,160,23,0.12)',
                border: '1px solid rgba(212,160,23,0.25)',
                borderRadius: 99, padding: '5px 12px',
                fontSize: 11, color: '#f5c842', fontWeight: 600, marginBottom: 14,
              }}>
                🏆 Most Recommended for May 24
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(212,160,23,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>
                      {f.icon}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─ Tier A: Monthly (Decoy) ─ */}
            <div
              className="plan-card"
              onClick={() => setSelectedPlan('monthly')}
              style={{
                position: 'relative', borderRadius: 16, padding: '16px 18px',
                background: 'rgba(255,255,255,0.02)',
                border: selectedPlan === 'monthly'
                  ? '2px solid rgba(148,163,184,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', opacity: 0.8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 3 }}>
                    30-Day Booster
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Monthly Access · Renews each month</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.2)',
                  background: selectedPlan === 'monthly' ? 'rgba(255,255,255,0.2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s', flexShrink: 0,
                }}>
                  {selectedPlan === 'monthly' && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>₹1,499</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.6)', lineHeight: 1 }}>₹999</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>/month</span>
              </div>

              {/* Comparison nudge */}
              <div style={{
                marginTop: 10,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.12)',
                borderRadius: 8, padding: '6px 10px',
                fontSize: 11, color: 'rgba(239,68,68,0.7)',
              }}>
                ₹240 more expensive — and expires before Prelims
              </div>
            </div>
          </div>

          {/* ── Comparison callout ── */}
          <div style={{
            margin: '14px 16px 0',
            background: 'rgba(74,222,128,0.05)',
            border: '1px solid rgba(74,222,128,0.12)',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <p style={{ fontSize: 12, color: 'rgba(74,222,128,0.8)', lineHeight: 1.5, margin: 0 }}>
              The ₹759 Sprint is cheaper <em>and</em> lasts exactly until exam day — no subscription trap.
            </p>
          </div>

          {/* ── CTA ── */}
          <div style={{ padding: '16px 16px 8px' }}>
            <button
              className="cta-btn"
              onClick={handleCTA}
              style={{
                width: '100%', padding: '16px',
                borderRadius: 16, border: 'none',
                background: selectedPlan === 'sprint'
                  ? 'linear-gradient(135deg, #d4a017, #f5c842, #d4930a)'
                  : 'linear-gradient(135deg, #374151, #4b5563)',
                color: selectedPlan === 'sprint' ? '#0d0a00' : '#fff',
                fontSize: 16, fontWeight: 800,
                cursor: 'pointer', letterSpacing: '0.01em',
                boxShadow: selectedPlan === 'sprint'
                  ? '0 4px 24px rgba(212,160,23,0.35)'
                  : '0 4px 12px rgba(0,0,0,0.3)',
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {selectedPlan === 'sprint'
                ? `Unlock Prelims Sprint — ₹759 →`
                : `Get 30-Day Booster — ₹999 →`
              }
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 10 }}>
              Secured payment via Razorpay · No auto-renewal on Sprint
            </p>
          </div>

          {/* ── Dismiss ── */}
          <div style={{ padding: '0 16px 28px', textAlign: 'center' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                fontSize: 12, color: 'rgba(255,255,255,0.2)',
                cursor: 'pointer', padding: '8px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
            >
              Continue with limited free access
            </button>
          </div>
        </div>
      </div>
    </>
  )
}