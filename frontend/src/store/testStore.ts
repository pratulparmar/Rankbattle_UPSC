import { create } from 'zustand'

export interface Question {
  mcq_id: string
  subject: string
  topic_id?: string
  stem: string
  options: string[]
  difficulty?: string
}

export interface Answer {
  selectedIndex: number | null
  markedForReview: boolean
  visited: boolean
}

interface TestStore {
  sessionId: string | null
  questions: Question[]
  answers: Record<string, Answer>
  timeSpent: Record<string, number>
  timeLeft: number
  currentQId: string | null

  setSession: (id: string, questions: Question[]) => void
  setAnswer: (qId: string, idx: number) => void
  toggleReview: (qId: string) => void
  markVisited: (qId: string) => void
  tickTimer: () => void
  tickQuestion: () => void
  setCurrentQ: (qId: string) => void
  resetTest: () => void
}

export const useTestStore = create<TestStore>((set, get) => ({
  sessionId: null,
  questions: [],
  answers: {},
  timeSpent: {},
  timeLeft: 7200,
  currentQId: null,

  setSession: (id, questions) => {
    const answers: Record<string, Answer> = {}
    const timeSpent: Record<string, number> = {}
    questions.forEach((q) => {
      answers[q.mcq_id] = { selectedIndex: null, markedForReview: false, visited: false }
      timeSpent[q.mcq_id] = 0
    })
    set({ sessionId: id, questions, answers, timeSpent, timeLeft: 7200, currentQId: questions[0]?.mcq_id || null })
  },

  setAnswer: (qId, idx) =>
    set((state) => ({
      answers: { ...state.answers, [qId]: { ...state.answers[qId], selectedIndex: idx, visited: true } },
    })),

  toggleReview: (qId) =>
    set((state) => ({
      answers: { ...state.answers, [qId]: { ...state.answers[qId], markedForReview: !state.answers[qId].markedForReview } },
    })),

  markVisited: (qId) =>
    set((state) => ({
      answers: { ...state.answers, [qId]: { ...state.answers[qId], visited: true } },
    })),

  tickTimer: () => set((state) => ({ timeLeft: Math.max(0, state.timeLeft - 1) })),

  tickQuestion: () => set((state) => {
    const qId = state.currentQId
    if (!qId) return {}
    return { timeSpent: { ...state.timeSpent, [qId]: (state.timeSpent[qId] || 0) + 1 } }
  }),

  setCurrentQ: (qId) => set({ currentQId: qId }),

  resetTest: () => set({ sessionId: null, questions: [], answers: {}, timeSpent: {}, timeLeft: 7200, currentQId: null }),
}))
