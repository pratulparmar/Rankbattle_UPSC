'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getAnalytics, getWeakAreas } from '@/lib/api'

// API shape: { subject, topic_id, total_attempts, correct, accuracy }
interface TopicStat {
  subject: string
  topic_id: string
  total_attempts: number
  correct: number
  accuracy: number
}

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [topics, setTopics] = useState<TopicStat[]>([])
  const [weakAreas, setWeakAreas] = useState<TopicStat[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])
  useEffect(() => {
    Promise.all([getAnalytics(), getWeakAreas()])
      .then(([aRes, wRes]) => {
        setTopics(Array.isArray(aRes.data) ? aRes.data : [])
        setWeakAreas(Array.isArray(wRes.data) ? wRes.data : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (!mounted) return null

  // Aggregate by subject
  const bySubject: Record<string, { total: number; correct: number }> = {}
  topics.forEach(t => {
    if (!bySubject[t.subject]) bySubject[t.subject] = { total: 0, correct: 0 }
    bySubject[t.subject].total   += t.total_attempts
    bySubject[t.subject].correct += t.correct
  })

  const totalAttempts = topics.reduce((s, t) => s + t.total_attempts, 0)
  const totalCorrect  = topics.reduce((s, t) => s + t.correct, 0)
  const totalWrong    = totalAttempts - totalCorrect
  const overallAcc    = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">🏆 RankBattle UPSC</h1>
        <button onClick={() => router.push('/dashboard')}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
          ← Dashboard
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Analytics</h2>

        {loading ? (
          <div className="text-gray-400">Loading analytics...</div>
        ) : topics.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No data yet</h3>
            <p className="text-gray-400 text-sm mb-6">Complete a mock test to see your analytics</p>
            <button onClick={() => router.push('/test/start')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg">
              Start First Test →
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-blue-500">{totalAttempts}</div>
                <div className="text-xs text-gray-500 mt-1">Questions Attempted</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{totalCorrect}</div>
                <div className="text-xs text-gray-500 mt-1">Correct</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{totalWrong}</div>
                <div className="text-xs text-gray-500 mt-1">Incorrect</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-orange-500">{overallAcc}%</div>
                <div className="text-xs text-gray-500 mt-1">Overall Accuracy</div>
              </div>
            </div>

            {/* Overall accuracy bar */}
            <div className="bg-white rounded-xl border p-5 mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Overall Performance</h3>
              <div className="flex gap-3 mb-3 text-sm">
                <span className="text-green-600 font-medium">✓ {totalCorrect} correct</span>
                <span className="text-gray-300">·</span>
                <span className="text-red-500 font-medium">✗ {totalWrong} incorrect</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all" style={{ width: `${overallAcc}%` }} />
                <div className="bg-red-400 h-full transition-all"
                  style={{ width: `${totalAttempts > 0 ? Math.round((totalWrong / totalAttempts) * 100) : 0}%` }} />
              </div>
            </div>

            {/* Subject breakdown */}
            <div className="bg-white rounded-xl border p-5 mb-6">
              <h3 className="font-semibold text-gray-700 mb-4">📚 Subject Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(bySubject).map(([subject, data]) => {
                  const acc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                  return (
                    <div key={subject}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{subject}</span>
                        <span className="text-gray-500">{data.correct}/{data.total} · {acc}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${acc >= 60 ? 'bg-green-500' : acc >= 40 ? 'bg-orange-400' : 'bg-red-500'}`}
                          style={{ width: `${acc}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Weak areas */}
            {weakAreas.length > 0 && (
              <div className="bg-white rounded-xl border p-5 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">🎯 Weak Areas (need improvement)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {weakAreas.slice(0, 6).map((area, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-red-700">{area.topic_id}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{area.subject}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-600">{area.accuracy}%</div>
                        <div className="text-xs text-gray-400">{area.total_attempts} attempts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic details table */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Topic Details</h3>
              <div className="space-y-2">
                {topics.sort((a, b) => a.accuracy - b.accuracy).map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{t.topic_id}</span>
                      <span className="text-gray-400 ml-2 text-xs">{t.subject}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">{t.correct}/{t.total_attempts}</span>
                      <span className={`font-bold ${t.accuracy >= 60 ? 'text-green-600' : t.accuracy >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                        {t.accuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
