'use client'
import { useRouter } from 'next/navigation'

interface Props {
  reason: 'full_mock' | 'subject_repeat' | 'subjects_limit' | 'coach' | null
  subject?: string
  onClose: () => void
}

const CONTENT = {
  full_mock: {
    icon:     '📋',
    title:    'Free Full Mock Used',
    message:  'You have used your 1 free full mock test. Subscribe to unlock unlimited full mocks, all subject tests, and unlimited AI coaching.',
  },
  subject_repeat: {
    icon:     '📘',
    title:    'Subject Already Used',
    message:  'You have already taken a free test for this subject. Subscribe to retake any subject unlimited times.',
  },
  subjects_limit: {
    icon:     '🎯',
    title:    'Free Subject Tests Used',
    message:  'You have used all 3 free subject tests. Subscribe to unlock unlimited subject practice across all topics.',
  },
  coach: {
    icon:     '🤖',
    title:    '5 Free Messages Used',
    message:  'You have used all 5 free AI Coach messages. Subscribe to unlock unlimited Feynman-style coaching, personalised to your weak areas.',
  },
}

export default function PaywallModal({ reason, subject, onClose }: Props) {
  const router = useRouter()
  if (!reason) return null

  const content = CONTENT[reason]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', backdropFilter: 'blur(4px)',
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: 24, padding: '32px 24px',
        maxWidth: 380, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        animation: 'popIn 0.2s ease',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
        }}>
          {content.icon}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: '#1e293b',
          marginBottom: 12, lineHeight: 1.2,
        }}>
          {content.title}
        </h2>

        {/* Message */}
        <p style={{
          fontSize: 14, color: '#64748b', lineHeight: 1.7,
          marginBottom: 28,
        }}>
          {content.message}
        </p>

        {/* What you get */}
        <div style={{
          background: '#fafafa', borderRadius: 14,
          padding: '16px', marginBottom: 24, textAlign: 'left',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 12 }}>
            SUBSCRIPTION INCLUDES
          </p>
          {[
            '✅ Unlimited full mock tests',
            '✅ Unlimited subject-wise practice',
            '✅ Unlimited AI Coach messages',
            '✅ Detailed analytics & weak area tracking',
            '✅ Expert explanations for every question',
          ].map((item, i) => (
            <p key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>
              {item}
            </p>
          ))}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>₹1,199</span>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#1e293b', margin: '0 8px' }}>₹799</span>
          <span style={{ fontSize: 13, color: '#64748b' }}>one-time</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/profile')}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #A0522D, #7A3A1E)',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', marginBottom: 12,
            boxShadow: '0 4px 16px rgba(160,82,45,0.4)',
          }}
        >
          Unlock Full Access →
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', fontSize: 13,
            color: '#94a3b8', cursor: 'pointer', padding: '4px',
          }}
        >
          Maybe later
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}