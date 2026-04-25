'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getAnalytics, getWeakAreas } from '@/lib/api'

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any[]>([])
  const [weakAreas, setWeakAreas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])
  useEffect(() => {
    Promise.all([getAnalytics(), getWeakAreas()])
      .then(([aRes, wRes]) => {
        setAnalytics(Array.isArray(aRes.data) ? aRes.data : [aRes.data])
        setWeakAreas(Array.isArray(wRes.data) ? wRes.data : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (!mounted) return null

  const totalSessions = analytics.length
  const totalCorrect = analytics.reduce((s, a) => s + (a.correct ?? 0), 0)
  const totalIncorrect = analytics.reduce((s, a) => s + (a.incorrect ?? 0), 0)
  const totalScore = analytics.reduce((s, a) => s + (a.score ?? 0), 0)
  const overallAccuracy = totalCorrect + totalIncorrect > 0
    ? Math.round((totalCorrect / (totalCorrect + totalIncorrect)) * 100) : 0

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
        ) : analytics.length === 0 ? (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-blue-500">{totalSessions}</div>
                <div className="text-xs text-gray-500 mt-1">Tests Taken</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-orange-500">{totalScore.toFixed(0)}</div>
                <div className="text-xs text-gray-500 mt-1">Total Score</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{overallAccuracy}%</div>
                <div className="text-xs text-gray-500 mt-1">Accuracy</div>
              </div>
              <div className="bg-white rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">{totalCorrect}</div>
                <div className="text-xs text-gray-500 mt-1">Correct Answers</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-5 mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Overall Performance</h3>
              <div className="flex gap-2 mb-3 text-sm">
                <span className="text-green-600 font-medium">✓ {totalCorrect} correct</span>
                <span className="text-gray-300">·</span>
                <span className="text-red-500 font-medium">✗ {totalIncorrect} incorrect</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full" style={{width: `${overallAccuracy}%`}} />
                <div className="bg-red-400 h-full" style={{width: `${totalCorrect+totalIncorrect>0?Math.round((totalIncorrect/(totalCorrect+totalIncorrect))*100):0}%`}} />
              </div>
            </div>
            {weakAreas.length > 0 && (
              <div className="bg-white rounded-xl border p-5 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">🎯 Weak Areas</h3>
                <div className="grid grid-cols-2 gap-3">
                  {weakAreas.slice(0,6).map((area: any, idx: number) => (
                    <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <div className="text-sm font-medium text-red-700">{area.topic_id ?? area.subject}</div>
                      <div className="text-xs text-red-500 mt-0.5">Accuracy: {area.accuracy?.toFixed(0) ?? 0}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Session History</h3>
              <div className="space-y-3">
                {analytics.slice().reverse().map((session: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Session #{analytics.length - idx}</div>
                      <div className="text-xs text-gray-400">{session.correct??0}✓ {session.incorrect??0}✗</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-orange-500">{Number(session.score??0).toFixed(2)}</div>
                      <div className="text-xs text-gray-400">/ {(session.total_questions??100)*2} marks</div>
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
