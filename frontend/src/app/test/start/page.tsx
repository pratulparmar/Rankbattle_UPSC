'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { startSession } from '@/lib/api'

function StartTestInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subject = searchParams.get('subject') || ''
  const [count, setCount] = useState(subject ? 25 : 100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await startSession(subject || undefined, undefined, count)
      const data = res.data
      const sessionId = data.session_id || data.id
      const questions = data.questions || []
      // Save questions to sessionStorage so test page can load them instantly
      sessionStorage.setItem('session_questions', JSON.stringify({ sid: sessionId, questions }))
      router.push(`/test/${sessionId}`)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) setError(detail.map((d: any) => d.msg).join(', '))
      else setError(typeof detail === 'string' ? detail : err.message || 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">{subject ? '📚' : '🏆'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{subject || 'Full Mock Test'}</h1>
          <p className="text-gray-500 text-sm mt-1">{subject ? 'Subject-wise practice' : 'UPSC style · 2 hours · Negative marking'}</p>
        </div>
        <div className="space-y-4">
          <div className="bg-orange-50 rounded-xl p-4 text-sm text-gray-700 space-y-2">
            <div className="flex justify-between"><span>Questions</span><strong>{count}</strong></div>
            <div className="flex justify-between"><span>Duration</span><strong>{subject ? '30 mins' : '2 hours'}</strong></div>
            <div className="flex justify-between"><span>Correct</span><strong className="text-green-600">+2 marks</strong></div>
            <div className="flex justify-between"><span>Wrong</span><strong className="text-red-500">-0.66 marks</strong></div>
            <div className="flex justify-between"><span>Skipped</span><strong className="text-gray-500">0 marks</strong></div>
          </div>
          {!subject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
              <select value={count} onChange={e => setCount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
                <option value={100}>100 Questions (Full)</option>
              </select>
            </div>
          )}
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}
          <button onClick={handleStart} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
            {loading ? 'Starting...' : 'Start Test →'}
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm transition">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StartTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <StartTestInner />
    </Suspense>
  )
}
