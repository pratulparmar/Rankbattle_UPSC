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

  // Log result so we can see exact API fields
  console.log('Result data:', result)

  const correct = result.correct ?? result.correct_count ?? result.total_correct ?? 0
  const incorrect = result.incorrect ?? result.incorrect_count ?? result.total_incorrect ?? result.wrong ?? 0
  const skipped = result.skipped ?? result.unattempted ?? result.total_skipped ?? 0
  const score = result.score ?? result.total_score ?? result.marks ?? 0
  const total = result.total_questions ?? result.total ?? 100
  const accuracy = result.accuracy ?? (correct > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0)
  const maxScore = total * 2
  const scorePercent = Math.round((score / maxScore) * 100)
  const isPass = scorePercent >= 33

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
            <div className="text-3xl font-bold text-red-500">{incorrect}</div>
            <div className="text-sm text-gray-500 mt-1">Incorrect</div>
            <div className="text-xs text-red-500 mt-0.5">-{(incorrect * 0.66).toFixed(2)}</div>
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

        {/* Subject Breakdown if available */}
        {result.subject_breakdown && Object.keys(result.subject_breakdown).length > 0 && (
          <div className="bg-white rounded-xl border p-5 mb-6">
            <h3 className="font-semibold text-gray-700 mb-4">Subject Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(result.subject_breakdown).map(([subject, data]: [string, any]) => {
                const acc = data.accuracy ?? 0
                return (
                  <div key={subject}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{subject}</span>
                      <span className="font-medium">{Number(acc).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(acc, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
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
