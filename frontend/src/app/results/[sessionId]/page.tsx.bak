'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [result, setResult] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = sessionStorage.getItem(`result_${sessionId}`)
    if (stored) setResult(JSON.parse(stored))
  }, [sessionId])

  if (!mounted) return null

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-gray-600 mb-2">Results not found</div>
        <div className="text-sm text-gray-400 mb-6">Session may have expired</div>
        <button onClick={() => router.push('/dashboard')}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  // API shape: { session_id, total_q, attempted, correct, wrong, skipped, raw_score, final_score, accuracy, time_taken_mins }
  const correct   = result.correct ?? 0
  const wrong     = result.wrong ?? 0
  const skipped   = result.skipped ?? 0
  const score     = result.final_score ?? result.raw_score ?? 0
  const total     = result.total_q ?? 100
  const accuracy  = result.accuracy ?? 0
  const maxScore  = total * 2
  const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const isPass    = scorePercent >= 33

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{isPass ? '🎉' : '📚'}</div>
          <h1 className="text-3xl font-bold text-gray-800">Test Completed!</h1>
          <p className="text-gray-500 mt-1 text-sm">Session: {sessionId?.slice(0,8)}...</p>
        </div>

        {/* Score Card */}
        <div className={`rounded-2xl p-8 mb-6 text-white text-center ${isPass ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}>
          <div className="text-6xl font-bold mb-2">{Number(score).toFixed(2)}</div>
          <div className="text-lg opacity-90">out of {maxScore} marks</div>
          <div className="text-3xl font-bold mt-3">{scorePercent}%</div>
          <div className="opacity-80 mt-1">{isPass ? 'Good Performance!' : 'Keep Practicing!'}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-5 text-center">
            <div className="text-3xl font-bold text-green-500">{correct}</div>
            <div className="text-sm text-gray-500 mt-1">Correct</div>
            <div className="text-xs text-green-500 mt-0.5">+{(correct * 2).toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl border p-5 text-center">
            <div className="text-3xl font-bold text-red-500">{wrong}</div>
            <div className="text-sm text-gray-500 mt-1">Incorrect</div>
            <div className="text-xs text-red-500 mt-0.5">-{(wrong * 0.66).toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl border p-5 text-center">
            <div className="text-3xl font-bold text-gray-400">{skipped}</div>
            <div className="text-sm text-gray-500 mt-1">Skipped</div>
            <div className="text-xs text-gray-400 mt-0.5">±0</div>
          </div>
        </div>

        {/* Accuracy Bar */}
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Accuracy</span>
            <span className="text-sm font-bold text-gray-800">{Number(accuracy).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full ${isPass ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(accuracy, 100)}%` }} />
          </div>
        </div>

        {/* Time taken */}
        {result.time_taken_mins != null && (
          <div className="bg-white rounded-xl border p-5 mb-6 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">⏱ Time Taken</span>
            <span className="text-sm font-bold text-gray-800">{result.time_taken_mins} min</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button onClick={() => router.push('/test/start')}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition">
            Try Again
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl border transition">
            Dashboard
          </button>
          <button onClick={() => router.push('/analytics')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition">
            Analytics →
          </button>
        </div>
      </div>
    </div>
  )
}
