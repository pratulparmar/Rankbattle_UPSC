'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL

const SUBJECTS = ['All', 'Economy', 'Environment', 'Geography', 'History', 'Polity', 'Science & Tech']

interface Question {
  mcq_id: string
  subject: string
  topic_id: string
  stem: string
  options: string[]
  correct_index: number
  explanation: {
    concept_anchor?: string
    statement_wise?: Record<string, string>
    why_others_wrong?: string
    common_trap?: string
    elimination_hint?: string
  }
}

interface PaginatedResponse {
  total: number
  page: number
  page_size: number
  questions: Question[]
}

export default function AdminQuestionsPage() {
  const { token, isLoading } = useAuth()
  const router = useRouter()

  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [subject, setSubject] = useState('All')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !token) router.push('/login')
  }, [isLoading, token, router])

  const fetchQuestions = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        ...(subject !== 'All' && { subject }),
        ...(search && { search }),
      })
      const res = await fetch(`${API}/admin/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data: PaginatedResponse = await res.json()
      setQuestions(data.questions)
      setTotal(data.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token, page, pageSize, subject, search])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const totalPages = Math.ceil(total / pageSize)

  // Parse stem into statements + directive
  const parseStem = (stem: string) => {
    const lines = stem.split('\n').map(l => l.trim()).filter(Boolean)
    const statements: string[] = []
    let directive = ''
    for (const line of lines) {
      if (/^\d+\.\s/.test(line)) {
        statements.push(line.replace(/^\d+\.\s*/, ''))
      } else if (line.endsWith('?') || line.endsWith(':')) {
        directive = line
      }
    }
    return { statements, directive }
  }

  if (isLoading) return null

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,252,245,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(160,82,45,0.12)',
        padding: '14px 20px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => router.push('/dashboard')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4 }}>←</button>
              <div>
                <h1 className="serif" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  Question Bank
                </h1>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0 }}>
                  {total.toLocaleString()} questions
                </p>
              </div>
            </div>
            <div style={{
              background: 'rgba(160,82,45,0.1)', borderRadius: 20,
              padding: '4px 12px', fontSize: 12, color: 'var(--terra)', fontWeight: 600,
            }}>
              Admin View
            </div>
          </div>

          {/* Search */}
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
            placeholder="Search questions... (press Enter)"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12,
              border: '1.5px solid rgba(160,82,45,0.2)',
              background: 'var(--paper)', fontSize: 14, color: 'var(--ink)',
              outline: 'none', marginBottom: 10, boxSizing: 'border-box',
            }}
          />

          {/* Subject filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => { setSubject(s); setPage(1) }}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1.5px solid',
                  borderColor: subject === s ? 'var(--terra)' : 'rgba(160,82,45,0.2)',
                  background: subject === s ? 'var(--terra)' : 'transparent',
                  color: subject === s ? '#fff' : 'var(--ink-soft)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-faint)' }}>
            Loading questions...
          </div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-faint)' }}>
            No questions found.
          </div>
        ) : questions.map((q, idx) => {
          const isOpen = expanded === q.mcq_id
          const { statements, directive } = parseStem(q.stem)
          const globalIdx = (page - 1) * pageSize + idx + 1

          return (
            <div key={q.mcq_id} className="paper-card" style={{
              marginBottom: 12, padding: 0, overflow: 'hidden',
              border: isOpen ? '1.5px solid rgba(160,82,45,0.3)' : '1.5px solid rgba(160,82,45,0.1)',
              transition: 'border-color 0.2s',
            }}>
              {/* Question header — always visible */}
              <div
                onClick={() => setExpanded(isOpen ? null : q.mcq_id)}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
              >
                {/* Index */}
                <div style={{
                  minWidth: 32, height: 32, borderRadius: 10,
                  background: 'rgba(160,82,45,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--terra)', flexShrink: 0,
                }}>
                  {globalIdx}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Subject + Topic badges */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                      color: 'var(--terra)', background: 'rgba(160,82,45,0.08)',
                      padding: '2px 8px', borderRadius: 20,
                    }}>{q.subject}</span>
                    {q.topic_id && (
                      <span style={{
                        fontSize: 10, color: 'var(--ink-faint)',
                        background: 'rgba(0,0,0,0.04)',
                        padding: '2px 8px', borderRadius: 20,
                      }}>{q.topic_id}</span>
                    )}
                    <span style={{
                      fontSize: 10, color: 'var(--ink-faint)',
                      padding: '2px 4px',
                    }}>{q.mcq_id}</span>
                  </div>

                  {/* Stem preview */}
                  <p style={{
                    fontSize: 14, color: 'var(--ink)', margin: 0, lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: isOpen ? undefined : 2,
                    WebkitBoxOrient: 'vertical' as const,
                  }}>
                    {statements.length > 0 ? statements[0] : q.stem.slice(0, 120)}
                    {!isOpen && statements.length > 1 && ` (+${statements.length - 1} more)`}
                  </p>
                </div>

                {/* Correct answer badge */}
                <div style={{
                  minWidth: 28, height: 28, borderRadius: 8,
                  background: 'rgba(46,125,50,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#2E7D32', flexShrink: 0,
                }}>
                  {String.fromCharCode(65 + q.correct_index)}
                </div>

                <div style={{ fontSize: 16, color: 'var(--ink-faint)', flexShrink: 0, marginTop: 2 }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  borderTop: '1px solid rgba(160,82,45,0.1)',
                  padding: '16px',
                  background: 'rgba(160,82,45,0.02)',
                }}>
                  {/* All statements */}
                  {statements.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 8 }}>STATEMENTS</p>
                      {statements.map((s, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 10, marginBottom: 6,
                          padding: '8px 12px', borderRadius: 10,
                          background: q.explanation?.statement_wise?.[String(i+1)]?.startsWith('TRUE')
                            ? 'rgba(46,125,50,0.06)' : 'rgba(192,57,43,0.05)',
                          border: '1px solid',
                          borderColor: q.explanation?.statement_wise?.[String(i+1)]?.startsWith('TRUE')
                            ? 'rgba(46,125,50,0.15)' : 'rgba(192,57,43,0.12)',
                        }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                            color: q.explanation?.statement_wise?.[String(i+1)]?.startsWith('TRUE') ? '#2E7D32' : '#C0392B',
                          }}>
                            {q.explanation?.statement_wise?.[String(i+1)]?.startsWith('TRUE') ? '✓' : '✗'} {i+1}.
                          </span>
                          <span style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Directive */}
                  {directive && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: 'rgba(160,82,45,0.06)',
                      marginBottom: 14, fontSize: 14,
                      fontWeight: 600, color: 'var(--ink)',
                      fontStyle: 'italic',
                    }}>
                      {directive}
                    </div>
                  )}

                  {/* Options */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 8 }}>OPTIONS</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {q.options.map((opt, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', borderRadius: 10,
                          display: 'flex', gap: 8, alignItems: 'center',
                          background: i === q.correct_index ? 'rgba(46,125,50,0.1)' : 'rgba(0,0,0,0.03)',
                          border: '1.5px solid',
                          borderColor: i === q.correct_index ? 'rgba(46,125,50,0.3)' : 'rgba(0,0,0,0.08)',
                        }}>
                          <span style={{
                            fontSize: 13, fontWeight: 700,
                            color: i === q.correct_index ? '#2E7D32' : 'var(--ink-faint)',
                            minWidth: 18,
                          }}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>{opt}</span>
                          {i === q.correct_index && (
                            <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div style={{ borderTop: '1px solid rgba(160,82,45,0.1)', paddingTop: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-soft)', marginBottom: 10 }}>EXPLANATION</p>

                      {q.explanation.concept_anchor && (
                        <ExplField label="Concept Anchor" value={q.explanation.concept_anchor} color="#1565C0" bg="rgba(21,101,192,0.05)" />
                      )}
                      {q.explanation.statement_wise && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Statement-wise</p>
                          {Object.entries(q.explanation.statement_wise).map(([k, v]) => (
                            <div key={k} style={{
                              fontSize: 13, color: 'var(--ink)', lineHeight: 1.5,
                              padding: '4px 10px', marginBottom: 4, borderRadius: 8,
                              background: v.startsWith('TRUE') ? 'rgba(46,125,50,0.05)' : 'rgba(192,57,43,0.05)',
                              borderLeft: `3px solid ${v.startsWith('TRUE') ? '#2E7D32' : '#C0392B'}`,
                            }}>
                              <strong>{k}.</strong> {v}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.explanation.why_others_wrong && (
                        <ExplField label="Why Others Wrong" value={q.explanation.why_others_wrong} color="#E65100" bg="rgba(230,81,0,0.05)" />
                      )}
                      {q.explanation.common_trap && (
                        <ExplField label="Common Trap" value={q.explanation.common_trap} color="#6A1B9A" bg="rgba(106,27,154,0.05)" />
                      )}
                      {q.explanation.elimination_hint && (
                        <ExplField label="Elimination Hint" value={q.explanation.elimination_hint} color="#00695C" bg="rgba(0,105,92,0.05)" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <PagBtn label="←" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number
              if (totalPages <= 7) p = i + 1
              else if (page <= 4) p = i + 1
              else if (page >= totalPages - 3) p = totalPages - 6 + i
              else p = page - 3 + i
              return (
                <PagBtn key={p} label={String(p)} active={p === page} onClick={() => setPage(p)} />
              )
            })}
            <PagBtn label="→" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
            <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 8 }}>
              {(page-1)*pageSize+1}–{Math.min(page*pageSize, total)} of {total}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function ExplField({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: bg, borderLeft: `3px solid ${color}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color, marginBottom: 3 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}

function PagBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 34, height: 34, borderRadius: 10, fontSize: 13, fontWeight: 600,
        border: '1.5px solid',
        borderColor: active ? 'var(--terra)' : 'rgba(160,82,45,0.2)',
        background: active ? 'var(--terra)' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--ink-faint)' : 'var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}>
      {label}
    </button>
  )
}