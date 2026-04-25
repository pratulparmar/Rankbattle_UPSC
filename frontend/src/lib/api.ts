import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const register = (email: string, password: string, name: string) =>
  api.post('/auth/register', { email, password, name })

export const getSubjects = () => api.get('/mcqs/subjects')

export const getMCQs = (subject?: string, topic?: string, limit = 100) =>
  api.get('/mcqs', { params: { subject, topic, limit } })

export const startSession = (subject?: string, topic?: string, total_q = 100) =>
  api.post('/sessions/start', {
    mode: 'mock',
    subject_filter: subject || null,
    topic_filter: topic || null,
    total_q,
    duration_mins: 120,
  })

export const submitSession = (
  sessionId: string,
  answers: Record<string, { selectedIndex: number | null; markedForReview: boolean; visited: boolean }>,
  timeSpent: Record<string, number> = {}
) => {
  const attempts = Object.entries(answers).map(([mcq_id, a]) => ({
    mcq_id,
    selected_index: (a.selectedIndex !== null && a.selectedIndex >= 0) ? a.selectedIndex : null,
    time_spent_secs: timeSpent[mcq_id] || 0,
    marked_review: a.markedForReview ?? false,
    rag_viewed: false,
  }))
  return api.post(`/sessions/${sessionId}/submit`, { attempts })
}

export const getAnalytics = () => api.get('/analytics/me')
export const getWeakAreas = () => api.get('/analytics/me/weak-areas')

export default api
