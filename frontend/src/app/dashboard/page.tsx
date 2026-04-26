'use client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubjects } from '@/lib/api'

const SUBJECT_ICONS: Record<string, string> = {
  'Economy': '📈', 'Environment': '🌿', 'Geography': '🗺️',
  'History': '🏛️', 'Polity': '⚖️', 'Science & Tech': '🔬',
}
const SUBJECT_COLORS: Record<string, string> = {
  'Economy': 'bg-green-50 border-green-200 hover:bg-green-100',
  'Environment': 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  'Geography': 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  'History': 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
  'Polity': 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  'Science & Tech': 'bg-red-50 border-red-200 hover:bg-red-100',
}

const SCORES = [62, 71, 58, 75, 68, 79, 83, 88]

function ScoreCurve({ scores }: { scores: number[] }) {
  const W = 300, H = 72
  const max = Math.max(...scores) + 5, min = Math.min(...scores) - 8
  const px = (i: number) => (i / (scores.length - 1)) * W
  const py = (s: number) => H - ((s - min) / (max - min)) * H
  const pts = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ')
  const area = `M0,${H} ` + scores.map((s, i) => `L${px(i)},${py(s)}`).join(' ') + ` L${W},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A0522D" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#A0522D" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)"/>
      <polyline points={pts} fill="none" stroke="#A0522D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {scores.map((s, i) => i === scores.length - 1 && (
        <circle key={i} cx={px(i)} cy={py(s)} r="5" fill="#A0522D" stroke="white" strokeWidth="2.5"/>
      ))}
    </svg>
  )
}

export default function Dashboard() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [subjects, setSubjects] = useState<string[]>([])
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({})
  const [loadingSubjects, setLoadingSubjects] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])

  useEffect(() => {
    getSubjects()
      .then(res => {
        const data = res.data
        const names = Object.keys(data)
        const counts: Record<string, number> = {}
        names.forEach(name => { counts[name] = data[name].reduce((sum: number, t: any) => sum + t.count, 0) })
        setSubjects(names)
        setTopicCounts(counts)
      })
      .catch(console.error)
      .finally(() => setLoadingSubjects(false))
  }, [])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <p style={{ fontFamily: 'Georgia, serif', color: 'var(--ink-soft)', fontSize: 15 }}>Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen fade-in" style={{ background: 'var(--paper)', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #3D2E22 0%, #1A1410 100%)', padding: '52px 22px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(160,82,45,0.15)' }}/>
        <div style={{ position: 'absolute', bottom: -30, left: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(200,150,12,0.08)' }}/>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 2.5, marginBottom: 3, fontFamily: 'JetBrains Mono, monospace' }}>GOOD MORNING</p>
              <h2 className="serif" style={{ color: 'white', fontSize: 26, fontWeight: 600 }}>{user?.name}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={logout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Logout
              </button>
            </div>
          </div>

          {/* Rank card */}
          <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2.5, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}>CURRENT RANK</p>
              <p className="mono gold-shine" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>#2,847</p>
              <p style={{ color: '#E8B422', fontSize: 12, marginTop: 5, fontWeight: 600 }}>▲ Top 15% · +124 this week</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: 'rgba(200,150,12,0.18)', border: '1px solid rgba(200,150,12,0.35)', borderRadius: 14, padding: '10px 16px' }}>
                <p style={{ color: '#E8B422', fontSize: 10, letterSpacing: 1.5, marginBottom: 3 }}>STREAK</p>
                <p className="mono" style={{ color: 'white', fontSize: 26, fontWeight: 700 }}>🔥 12</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        {/* Score Curve */}
        <div className="paper-card" style={{ padding: '18px 18px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink-faint)', fontWeight: 600 }}>SCORE CURVE</p>
              <p className="serif" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>Last 8 Mocks</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--terra)', lineHeight: 1 }}>88</p>
              <p style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>↑ +5 from last</p>
            </div>
          </div>
          <ScoreCurve scores={SCORES}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {['M1','M2','M3','M4','M5','M6','M7','M8'].map((m,i) => (
              <span key={i} className="mono" style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{m}</span>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div style={{ background: 'linear-gradient(135deg, #A0522D, #7A3A1E)', borderRadius: 20, padding: '22px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}/>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: 2.5, marginBottom: 5 }}>QUICK START</p>
          <p className="serif" style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>GS Paper I — Full Length</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 18 }}>100 questions · 120 minutes · −⅓ penalty</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-terra" onClick={() => router.push('/test/start')} style={{ flex: 1, padding: '13px', fontSize: 14, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.25)' }}>
              Start Mock →
            </button>
            <button style={{ padding: '13px 16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter' }}>
              Subject
            </button>
          </div>
        </div>

        {/* Aspirants Daily */}
        <div className="paper-card" style={{ padding: '16px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/aspirants-daily')}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink-faint)', marginBottom: 4, fontWeight: 600 }}>TODAY&apos;S EDITION</p>
            <p className="serif" style={{ fontSize: 17, fontWeight: 600, fontStyle: 'italic' }}>The Aspirant&apos;s Daily</p>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>Editorials · Current Affairs · Vocab</p>
          </div>
          <div style={{ background: 'var(--paper-dark)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>📰</div>
            <p style={{ fontSize: 9, color: 'var(--terra)', fontWeight: 700, marginTop: 4, letterSpacing: 1.5 }}>READ →</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[{ l: 'Tests', v: '34', e: '📝' }, { l: 'Accuracy', v: '71%', e: '🎯' }, { l: 'Hours', v: '128h', e: '⏱️' }].map((s, i) => (
            <div key={i} className="paper-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{s.e}</div>
              <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--terra)' }}>{s.v}</p>
              <p style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: 1.5, marginTop: 2, fontWeight: 600 }}>{s.l.toUpperCase()}</p>
            </div>
          ))}
        </div>

        {/* Subject Grid */}
        <p className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>Practice by Subject</p>
        {loadingSubjects ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Loading subjects...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subjects.map(name => (
              <button key={name} onClick={() => router.push(`/test/start?subject=${encodeURIComponent(name)}`)}
                className={`border-2 rounded-2xl p-4 text-left transition ${SUBJECT_COLORS[name] || 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <div className="text-3xl mb-2">{SUBJECT_ICONS[name] || '📚'}</div>
                <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{topicCounts[name]} MCQs →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
