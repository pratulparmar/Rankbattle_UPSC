'use client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubjects } from '@/lib/api'

const SUBJECT_ICONS: Record<string, string> = {
  'Economy': '📈',
  'Environment': '🌿',
  'Geography': '🗺️',
  'History': '🏛️',
  'Polity': '⚖️',
  'Science & Tech': '🔬',
}

const SUBJECT_COLORS: Record<string, string> = {
  'Economy': 'bg-green-50 border-green-200 hover:bg-green-100',
  'Environment': 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  'Geography': 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  'History': 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
  'Polity': 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  'Science & Tech': 'bg-red-50 border-red-200 hover:bg-red-100',
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
        const data = res.data // { Economy: [...], Polity: [...], ... }
        const names = Object.keys(data)
        const counts: Record<string, number> = {}
        names.forEach(name => {
          counts[name] = data[name].reduce((sum: number, t: any) => sum + t.count, 0)
        })
        setSubjects(names)
        setTopicCounts(counts)
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingSubjects(false))
  }, [])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">🏆 RankBattle UPSC</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">👤 {user?.name}</span>
          <button
            onClick={logout}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Hero */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-1">Ready to practice?</h2>
          <p className="text-orange-100 text-sm mb-4">1479 MCQs · 6 subjects · 71 topics · UPSC negative marking</p>
          <button
            onClick={() => router.push('/test/start')}
            className="bg-white text-orange-500 font-semibold px-6 py-2.5 rounded-lg hover:bg-orange-50 transition"
          >
            Start Full Mock Test →
          </button>
        </div>

        {/* Subject Grid */}
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Practice by Subject</h3>
        {loadingSubjects ? (
          <div className="text-gray-400 text-sm">Loading subjects...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {subjects.map((name) => (
              <button
                key={name}
                onClick={() => router.push(`/test/start?subject=${encodeURIComponent(name)}`)}
                className={`border-2 rounded-xl p-5 text-left transition ${SUBJECT_COLORS[name] || 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              >
                <div className="text-3xl mb-2">{SUBJECT_ICONS[name] || '📚'}</div>
                <div className="font-semibold text-gray-800">{name}</div>
                <div className="text-xs text-gray-500 mt-1">{topicCounts[name]} MCQs · Practice →</div>
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">1479</div>
            <div className="text-xs text-gray-500 mt-1">Total MCQs</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">6</div>
            <div className="text-xs text-gray-500 mt-1">Subjects</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-green-500">71</div>
            <div className="text-xs text-gray-500 mt-1">Topics</div>
          </div>
        </div>
      </div>
    </div>
  )
}
