'use client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getAnalytics, getWeakAreas } from '@/lib/api'

const ANALYTICS = [
  { subject: 'Polity', color: '#C0392B', user: 72, topper: 88, peer: 65 },
  { subject: 'History', color: '#6B3A2A', user: 58, topper: 82, peer: 61 },
  { subject: 'Geography', color: '#2E7D52', user: 81, topper: 90, peer: 70 },
  { subject: 'Economy', color: '#1A5276', user: 64, topper: 85, peer: 62 },
  { subject: 'Sci & Tech', color: '#4A235A', user: 77, topper: 88, peer: 68 },
]

export default function Analytics() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])

  useEffect(() => { setTimeout(() => setVis(true), 300) }, [])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}><p style={{ color: 'var(--ink-soft)' }}>Loading...</p></div>

  return (
    <div className="min-h-screen fade-in" style={{ background: 'var(--paper)', paddingBottom: 24 }}>
      <div style={{ background: 'linear-gradient(160deg, #3D2E22, #1A1410)', padding: '52px 22px 28px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 2.5, fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>PERFORMANCE</p>
        <h2 className="serif" style={{ color: 'white', fontSize: 26, fontWeight: 600, marginBottom: 18 }}>Subject Analytics</h2>
        <div style={{ display: 'flex', gap: 24 }}>
          {[{ l: 'Overall', v: '71%', c: '#E8B422' }, { l: 'vs Topper', v: '−15%', c: '#E74C3C' }, { l: 'vs Peers', v: '+6%', c: '#2ECC71' }].map((s, i) => (
            <div key={i}>
              <p className="mono" style={{ color: s.c, fontSize: 22, fontWeight: 700 }}>{s.v}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 1.5 }}>{s.l.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '18px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
          {[{ l: 'You', c: 'var(--terra)' }, { l: 'Topper', c: 'var(--ochre)' }, { l: 'Peer Avg', c: 'var(--paper-deeper)' }].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.c, border: i === 2 ? '1px solid var(--ink-faint)' : 'none' }}/>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500 }}>{l.l}</span>
            </div>
          ))}
        </div>

        <div className="paper-card" style={{ padding: '20px', marginBottom: 14 }}>
          {ANALYTICS.map((d, i) => (
            <div key={i} style={{ marginBottom: i < ANALYTICS.length - 1 ? 20 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-mid)' }}>{d.subject}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span className="mono" style={{ fontSize: 12, color: d.color, fontWeight: 700 }}>{d.user}%</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ochre)', fontWeight: 600 }}>{d.topper}%</span>
                </div>
              </div>
              {[{ w: d.user, bg: d.color }, { w: d.topper, bg: 'linear-gradient(90deg, #C8960C, #E8B422)', op: 0.7 }, { w: d.peer, bg: 'var(--paper-deeper)', border: '1px solid var(--ink-faint)' }].map((bar, bi) => (
                <div key={bi} style={{ height: 9, background: 'var(--paper-deeper)', borderRadius: 999, overflow: 'hidden', marginBottom: bi < 2 ? 5 : 0 }}>
                  <div style={{ width: vis ? `${bar.w}%` : '0%', height: '100%', background: bar.bg, opacity: bar.op ?? 1, borderRadius: 999, transition: `width ${0.7 + bi * 0.1}s cubic-bezier(0.34,1.56,0.64,1)` }}/>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Weak areas */}
        <div className="paper-card" style={{ padding: '18px' }}>
          <p style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 14 }}>WEAK AREAS — FOCUS NOW</p>
          {[{ t: "Governor's Powers", s: 'Polity', g: -16 }, { t: 'Medieval History', s: 'History', g: -24 }, { t: 'Economic Reforms', s: 'Economy', g: -21 }].map((w, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--paper-dark)' : 'none' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{w.t}</p>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{w.s}</p>
              </div>
              <div style={{ background: 'rgba(192,57,43,0.1)', borderRadius: 8, padding: '5px 10px' }}>
                <span className="mono" style={{ fontSize: 12, color: '#C0392B', fontWeight: 700 }}>{w.g}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
