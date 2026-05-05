'use client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubjects } from '@/lib/api'
import BottomNav from '@/components/BottomNav'

const API = process.env.NEXT_PUBLIC_API_URL

// Icons + colors only — mastery comes from /analytics/me
const SUBJECT_CONFIG: Record<string, { icon: string; bg: string; accent: string }> = {
  'Economy':        { icon: '📈', bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', accent: '#2E7D52' },
  'Environment':    { icon: '🌿', bg: 'linear-gradient(135deg, #E0F2F1, #B2DFDB)', accent: '#00695C' },
  'Geography':      { icon: '🗺️', bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', accent: '#1565C0' },
  'History':        { icon: '🏛️', bg: 'linear-gradient(135deg, #FFF8E1, #FFECB3)', accent: '#F57F17' },
  'Polity':         { icon: '⚖️', bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', accent: '#6A1B9A' },
  'Science & Tech': { icon: '🔬', bg: 'linear-gradient(135deg, #FCE4EC, #F8BBD0)', accent: '#C62828' },
}

// ── Score Curve ───────────────────────────────────────────────────────────────
function ScoreCurve({ scores }: { scores: number[] }) {
  if (scores.length < 2) return (
    <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        Complete tests to see your score curve
      </p>
    </div>
  )
  const W = 300, H = 72
  const max = Math.max(...scores) + 5
  const min = Math.max(0, Math.min(...scores) - 8)
  const px = (i: number) => (i / (scores.length - 1)) * W
  const py = (s: number) => H - ((s - min) / ((max - min) || 1)) * H
  const pts = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ')
  const area = `M0,${H} ` + scores.map((s, i) => `L${px(i)},${py(s)}`).join(' ') + ` L${W},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A0522D" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A0522D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke="#A0522D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => i === scores.length - 1 && (
        <circle key={i} cx={px(i)} cy={py(s)} r="5" fill="#A0522D" stroke="white" strokeWidth="2.5" />
      ))}
    </svg>
  )
}

// ── Greeting ──────────────────────────────────────────────────────────────────
function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const emoji    = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'
  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 2.5, marginBottom: 3, fontFamily: 'JetBrains Mono, monospace' }}>
        {emoji} {greeting.toUpperCase()}
      </p>
      <h2 className="serif" style={{ color: 'white', fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
        {name?.split(' ')[0]} 👋
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
        Your rank is waiting to be claimed.
      </p>
    </div>
  )
}

// ── Mastery Bar ───────────────────────────────────────────────────────────────
function MasteryBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: 1 }}>MASTERY</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
          {value > 0 ? `${value}%` : '—'}
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(255,255,255,0.08)',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout, isLoading, token } = useAuth()
  const router = useRouter()

  const [subjects,      setSubjects]      = useState<string[]>([])
  const [topicCounts,   setTopicCounts]   = useState<Record<string, number>>({})
  const [loadingSubj,   setLoadingSubj]   = useState(true)
  const [profile,       setProfile]       = useState<any>(null)
  const [sessions,      setSessions]      = useState<any[]>([])
  const [analytics,     setAnalytics]     = useState<any[]>([])
  const [dataLoading,   setDataLoading]   = useState(true)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])

  // Subjects (public)
  useEffect(() => {
    getSubjects()
      .then(res => {
        const data  = res.data
        const names = Object.keys(data)
        const counts: Record<string, number> = {}
        names.forEach(n => { counts[n] = data[n].reduce((s: number, t: any) => s + t.count, 0) })
        setSubjects(names)
        setTopicCounts(counts)
      })
      .catch(console.error)
      .finally(() => setLoadingSubj(false))
  }, [])

  // Personalized data
  useEffect(() => {
    if (!token) return
    const h = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API}/auth/me`,            { headers: h }).then(r => r.json()),
      fetch(`${API}/sessions/`,          { headers: h }).then(r => r.json()),
      fetch(`${API}/analytics/me`,       { headers: h }).then(r => r.json()),
    ])
      .then(([prof, sess, anal]) => {
        setProfile(prof)
        setSessions(Array.isArray(sess) ? sess : [])
        setAnalytics(Array.isArray(anal) ? anal : [])
      })
      .catch(console.error)
      .finally(() => setDataLoading(false))
  }, [token])

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <p style={{ fontFamily: 'Georgia, serif', color: 'var(--ink-soft)', fontStyle: 'italic' }}>Loading your war room...</p>
    </div>
  )

  // ── Derived stats ──────────────────────────────────────────────────────────
  const submitted   = sessions.filter(s => s.status === 'SUBMITTED')
  const testsCount  = submitted.length

  // Score curve: last 8 sessions as % of max possible score
  const curveData   = submitted.slice(-8).map(s => {
    const max = (s.total_q ?? 100) * 2
    return max > 0 ? Math.round(((s.final_score ?? 0) / max) * 100) : 0
  })
  const lastScore   = curveData.length > 0 ? curveData[curveData.length - 1] : null
  const prevScore   = curveData.length > 1 ? curveData[curveData.length - 2] : null
  const scoreDelta  = lastScore !== null && prevScore !== null ? lastScore - prevScore : null

  // Overall accuracy from analytics
  const totalCorrect  = analytics.reduce((s, r) => s + (r.correct ?? 0), 0)
  const totalAttempts = analytics.reduce((s, r) => s + (r.total_attempts ?? 0), 0)
  const overallAcc    = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  // Subject mastery: aggregate topics → subjects
  const subjectMastery: Record<string, { correct: number; total: number }> = {}
  analytics.forEach(r => {
    const subj = r.subject ?? 'Other'
    if (!subjectMastery[subj]) subjectMastery[subj] = { correct: 0, total: 0 }
    subjectMastery[subj].correct += r.correct ?? 0
    subjectMastery[subj].total   += r.total_attempts ?? 0
  })

  const streak  = profile?.streak ?? 0
  const ringPct = overallAcc

  return (
    <div className="min-h-screen fade-in" style={{ background: 'var(--paper)', paddingBottom: 100 }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      {/* ── Dark header ── */}
      <div style={{ background: 'linear-gradient(160deg, #3D2E22 0%, #1A1410 100%)', padding: '52px 22px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(160,82,45,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(200,150,12,0.08)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <Greeting name={user?.name || 'Aspirant'} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* Real streak */}
              <div style={{ background: 'rgba(200,150,12,0.18)', border: '1px solid rgba(200,150,12,0.35)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
                <p style={{ color: '#E8B422', fontSize: 9, letterSpacing: 1.5, marginBottom: 2 }}>STREAK</p>
                {dataLoading
                  ? <Skeleton w={60} h={22} r={6} />
                  : <p className="mono" style={{ color: 'white', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                      {streak > 0 ? `🔥 ${streak}` : '— days'}
                    </p>
                }
              </div>
              <button onClick={logout} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Logout
              </button>
            </div>
          </div>

          {/* Real accuracy ring (replaces fake rank) */}
          <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2.5, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}>OVERALL ACCURACY</p>
              {dataLoading ? (
                <Skeleton w={120} h={38} r={8} />
              ) : (
                <>
                  <p className="mono gold-shine" style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>
                    {overallAcc > 0 ? `${overallAcc}%` : '—'}
                  </p>
                  <p style={{ fontSize: 12, marginTop: 5, fontWeight: 600, color: overallAcc >= 50 ? '#4ade80' : overallAcc > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                    {totalAttempts > 0
                      ? `${totalCorrect} correct · ${totalAttempts} attempted`
                      : 'No attempts yet — start a test'}
                  </p>
                </>
              )}
            </div>
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="34" cy="34" r="28" fill="none" stroke="#C8960C" strokeWidth="6"
                strokeDasharray={`${(ringPct / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                strokeDashoffset={2 * Math.PI * 28 * 0.25}
                strokeLinecap="round" transform="rotate(-90 34 34)" />
              <text x="34" y="39" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                {ringPct > 0 ? `${ringPct}%` : '—'}
              </text>
            </svg>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>

        {/* ── Score Curve ── */}
        <div className="paper-card" style={{ padding: '18px 18px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink-faint)', fontWeight: 600 }}>SCORE CURVE</p>
              <p className="serif" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                {testsCount > 0 ? `Last ${curveData.length} Mock${curveData.length > 1 ? 's' : ''}` : 'No Tests Yet'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {dataLoading ? <Skeleton w={70} h={30} r={6} /> : lastScore !== null ? (
                <>
                  <p className="mono" style={{ fontSize: 30, fontWeight: 700, color: 'var(--terra)', lineHeight: 1 }}>{lastScore}%</p>
                  {scoreDelta !== null && (
                    <p style={{ fontSize: 11, fontWeight: 600, color: scoreDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {scoreDelta >= 0 ? `↑ +${scoreDelta}` : `↓ ${scoreDelta}`} from last
                    </p>
                  )}
                </>
              ) : (
                <p className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-faint)' }}>—</p>
              )}
            </div>
          </div>
          <ScoreCurve scores={curveData} />
          {curveData.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {curveData.map((_, i) => (
                <span key={i} className="mono" style={{ fontSize: 9, color: 'var(--ink-faint)' }}>M{i + 1}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Start ── */}
        <div style={{ background: 'linear-gradient(135deg, #A0522D, #7A3A1E)', borderRadius: 20, padding: '20px', marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: 2.5, marginBottom: 5 }}>QUICK START</p>
          <p className="serif" style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>GS Paper I — Full Length</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>100 questions · 120 min · −⅓ penalty</p>
          <button className="btn-terra" onClick={() => router.push('/test/start')}
            style={{ width: '100%', padding: '13px', fontSize: 14, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.25)' }}>
            Start Full Mock →
          </button>
        </div>

        {/* ── Real Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
          {[
            { l: 'Tests Done',  v: dataLoading ? '—' : String(testsCount),                                        e: '📝', c: '#A0522D' },
            { l: 'Accuracy',    v: dataLoading ? '—' : overallAcc > 0 ? `${overallAcc}%` : '—',                   e: '🎯', c: '#2E7D52' },
            { l: 'Attempted',   v: dataLoading ? '—' : totalAttempts > 0 ? String(totalAttempts) : '—',           e: '✏️', c: '#1565C0' },
          ].map((s, i) => (
            <div key={i} className="paper-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{s.e}</div>
              <p className="mono" style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</p>
              <p style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: 1.2, marginTop: 2, fontWeight: 600 }}>{s.l.toUpperCase()}</p>
            </div>
          ))}
        </div>

        {/* ── Subject Cards with real mastery ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Practice by Subject</p>
          <p style={{ fontSize: 11, color: 'var(--terra)', fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push('/analytics')}>
            See Analytics →
          </p>
        </div>

        {loadingSubj ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Loading subjects...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {subjects.map(name => {
              const cfg = SUBJECT_CONFIG[name] || { icon: '📚', bg: 'linear-gradient(135deg, #F5F5F5, #EEEEEE)', accent: '#616161' }
              const m   = subjectMastery[name]
              const mastery = m && m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0
              return (
                <button key={name}
                  onClick={() => router.push(`/test/start?subject=${encodeURIComponent(name)}`)}
                  style={{
                    background: cfg.bg, borderRadius: 20, padding: '18px 16px',
                    border: `1.5px solid ${cfg.accent}22`, cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseDown={e  => (e.currentTarget.style.transform = 'scale(0.97)')}
                  onMouseUp={e    => (e.currentTarget.style.transform = 'scale(1)')}
                  onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                  onTouchEnd={e   => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>{cfg.icon}</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: cfg.accent, marginBottom: 2 }}>{name}</p>
                  <p style={{ fontSize: 11, color: `${cfg.accent}99`, fontWeight: 500 }}>
                    {topicCounts[name]} MCQs{mastery > 0 ? ` · ${mastery}% mastery` : ''}
                  </p>
                  <MasteryBar value={mastery} color={cfg.accent} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}