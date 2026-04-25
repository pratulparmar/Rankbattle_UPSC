'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTestStore } from '@/store/testStore'
import { submitSession } from '@/lib/api'

export default function TestPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { questions, answers, timeSpent, setSession, setAnswer, toggleReview,
    markVisited, tickTimer, tickQuestion, setCurrentQ, timeLeft } = useTestStore()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem('session_questions')
    if (stored) {
      const { sid, questions: qs } = JSON.parse(stored)
      if (sid === sessionId) setSession(sessionId, qs)
    }
  }, [sessionId])

  useEffect(() => {
    if (questions.length === 0) return
    const interval = setInterval(() => {
      tickTimer()
      tickQuestion()
    }, 1000)
    return () => clearInterval(interval)
  }, [questions.length])

  useEffect(() => {
    if (timeLeft === 0 && questions.length > 0) handleSubmit()
  }, [timeLeft])

  useEffect(() => {
    if (questions[currentIdx]) setCurrentQ(questions[currentIdx].mcq_id)
  }, [currentIdx, questions])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    const payload: Record<string, number> = {}
    Object.entries(answers).forEach(([qId, a]) => {
      if (a.selectedIndex !== null && a.selectedIndex >= 0) payload[qId] = a.selectedIndex
    })
    try {
      const res = await submitSession(sessionId, payload, timeSpent)
      // Save result to sessionStorage for results page
      sessionStorage.setItem(`result_${sessionId}`, JSON.stringify(res.data))
    } catch (err) {
      console.error('Submit error:', err)
    }
    router.push(`/results/${sessionId}`)
  }, [answers, timeSpent, sessionId])

  if (!mounted) return null

  const hrs = Math.floor(timeLeft / 3600)
  const mins = Math.floor((timeLeft % 3600) / 60)
  const secs = timeLeft % 60
  const isWarning = timeLeft < 600

  const getDotColor = (qId: string) => {
    const a = answers[qId]
    if (!a) return 'bg-gray-200 text-gray-600'
    if (a.markedForReview) return 'bg-purple-500 text-white'
    if (a.selectedIndex !== null && a.selectedIndex >= 0) return 'bg-green-500 text-white'
    if (a.visited) return 'bg-red-400 text-white'
    return 'bg-gray-200 text-gray-600'
  }

  if (questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-gray-500 mb-4">Loading questions...</div>
        <button onClick={() => router.push('/dashboard')} className="text-orange-500 underline text-sm">Back to dashboard</button>
      </div>
    </div>
  )

  const currentQ = questions[currentIdx]
  if (!currentQ) return null
  const currentAnswer = answers[currentQ.mcq_id]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <span className="font-bold text-gray-800">🏆 RankBattle UPSC</span>
        <div className={`font-mono text-lg font-bold px-4 py-1.5 rounded-lg ${isWarning ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-800'}`}>
          {String(hrs).padStart(2,'0')}:{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
        </div>
        <button
          onClick={() => { if (confirm('Submit test? This cannot be undone.')) handleSubmit() }}
          disabled={submitting}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Test'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto max-w-3xl">
          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{currentQ.subject}</span>
            {currentQ.topic_id && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{currentQ.topic_id}</span>}
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Q {currentIdx + 1} of {questions.length}</span>
            {currentQ.difficulty && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full capitalize">{currentQ.difficulty}</span>}
          </div>

          <div className="bg-white rounded-xl border p-6 mb-4">
            <p className="text-gray-800 text-base leading-relaxed whitespace-pre-line">{currentQ.stem}</p>
          </div>

          <div className="space-y-3">
            {currentQ.options.map((opt: string, idx: number) => (
              <button key={idx}
                onClick={() => { setAnswer(currentQ.mcq_id, idx); markVisited(currentQ.mcq_id) }}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition text-sm
                  ${currentAnswer?.selectedIndex === idx
                    ? 'border-orange-400 bg-orange-50 text-orange-800 font-medium'
                    : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50 text-gray-700'}`}
              >
                <span className="font-bold mr-3">{['A','B','C','D'][idx]}.</span>{opt}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { toggleReview(currentQ.mcq_id); markVisited(currentQ.mcq_id) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                ${currentAnswer?.markedForReview ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'}`}>
              🔖 {currentAnswer?.markedForReview ? 'Marked' : 'Mark for Review'}
            </button>
            <button onClick={() => setAnswer(currentQ.mcq_id, -1)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
              Clear
            </button>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
              className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm disabled:opacity-40">
              ← Previous
            </button>
            <button onClick={() => { markVisited(currentQ.mcq_id); setCurrentIdx(i => Math.min(questions.length - 1, i + 1)) }}
              disabled={currentIdx === questions.length - 1}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>

        <div className="w-64 bg-white border-l p-4 overflow-y-auto flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Question Palette</h3>
          <div className="space-y-1 mb-4 text-xs text-gray-500">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-500 inline-block"/><span>Answered</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-purple-500 inline-block"/><span>Marked for Review</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-400 inline-block"/><span>Not Answered</span></div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-gray-200 inline-block"/><span>Not Visited</span></div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, idx) => (
              <button key={q.mcq_id} onClick={() => { setCurrentIdx(idx); markVisited(q.mcq_id) }}
                className={`w-9 h-9 rounded text-xs font-bold transition ${getDotColor(q.mcq_id)} ${idx === currentIdx ? 'ring-2 ring-blue-500' : ''}`}>
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
            <div className="flex justify-between"><span>Answered</span><span className="font-medium text-green-600">{Object.values(answers).filter(a => a.selectedIndex !== null && a.selectedIndex >= 0).length}</span></div>
            <div className="flex justify-between"><span>Not Answered</span><span className="font-medium text-red-500">{Object.values(answers).filter(a => a.selectedIndex === null && a.visited).length}</span></div>
            <div className="flex justify-between"><span>Not Visited</span><span className="font-medium text-gray-400">{Object.values(answers).filter(a => !a.visited).length}</span></div>
            <div className="flex justify-between"><span>Marked</span><span className="font-medium text-purple-500">{Object.values(answers).filter(a => a.markedForReview).length}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
