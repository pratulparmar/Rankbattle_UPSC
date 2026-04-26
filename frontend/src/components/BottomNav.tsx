'use client'
import { useRouter, usePathname } from 'next/navigation'

const NAV = [
  {
    id: 'home', label: 'Home', href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A0522D' : '#9A8070'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'test', label: 'Mock Tests', href: '/test/start',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A0522D' : '#9A8070'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    )
  },
  {
    id: 'analytics', label: 'Analytics', href: '/analytics',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A0522D' : '#9A8070'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  },
  {
    id: 'ai', label: 'AI Coach', href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A0522D' : '#9A8070'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(249,247,242,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(160,82,45,0.15)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '10px 0 24px', zIndex: 200,
    }}>
      {NAV.map(({ id, label, href, icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
        return (
          <button key={id} onClick={() => router.push(href)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              cursor: 'pointer', padding: '6px 18px', borderRadius: 14, border: 'none',
              background: active ? 'rgba(160,82,45,0.1)' : 'transparent',
              transition: 'all 0.2s ease', minWidth: 64,
            }}>
            {icon(active)}
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
              fontFamily: 'Inter, sans-serif',
              color: active ? '#A0522D' : '#9A8070',
            }}>{label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#A0522D' }}/>}
          </button>
        )
      })}
    </nav>
  )
}
