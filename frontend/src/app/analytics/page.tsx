'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  score_pct: number;
}

interface QuestionResult {
  question_id: number;
  question_text: string;
  options: string[];
  correct_index: number;
  selected_index: number | null;
  subject?: string;
  explanation?: string;
}

interface SessionResult {
  session_id: string;
  score: number;
  total: number;
  accuracy: number;
  created_at: string;
  question_results: QuestionResult[];
}

interface AnalyticsData {
  subjects: SubjectStat[];
  weak_areas: string[];
  recent_sessions: SessionResult[];
}

interface FeynmanModalState {
  open: boolean;
  questionId: number | null;
  questionText: string;
  explanation: string;
  loading: boolean;
  error: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subjects' | 'sessions'>('subjects');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [feynman, setFeynman] = useState<FeynmanModalState>({
    open: false, questionId: null, questionText: '', explanation: '', loading: false, error: '',
  });

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://rankbattleupsc-production.up.railway.app';

  // ── Fetch Analytics ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${BASE}/analytics/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BASE}/analytics/weak-areas`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([me, weak]) => {
        setData({
          subjects: me.subjects ?? me ?? [],
          weak_areas: Array.isArray(weak) ? weak : weak.weak_areas ?? [],
          recent_sessions: me.recent_sessions ?? [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, BASE]);

  // ── Feynman Review — RAG call ────────────────────────────────────────────────

  const openFeynman = useCallback(async (q: QuestionResult) => {
    setFeynman({ open: true, questionId: q.question_id, questionText: q.question_text, explanation: '', loading: true, error: '' });

    try {
      const res = await fetch(`${BASE}/mcqs/${q.question_id}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected_index: q.selected_index }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFeynman(prev => ({
        ...prev,
        loading: false,
        explanation: json.explanation ?? json.content ?? 'No explanation returned.',
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeynman(prev => ({ ...prev, loading: false, error: `RAG fetch failed: ${msg}` }));
    }
  }, [BASE, token]);

  const closeFeynman = () =>
    setFeynman({ open: false, questionId: null, questionText: '', explanation: '', loading: false, error: '' });

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="mono text-sm" style={{ color: 'var(--terra)' }}>Loading analytics…</p>
      </div>
    </div>
  );

  const subjects = data?.subjects ?? [];
  const weakAreas = data?.weak_areas ?? [];
  const sessions = data?.recent_sessions ?? [];

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-5 pt-5 pb-4"
        style={{ background: 'rgba(249,247,242,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(160,82,45,0.15)' }}
      >
        <h1 className="serif font-bold text-2xl" style={{ color: 'var(--ink)' }}>
          Analytics
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(26,20,16,0.5)' }}>
          Performance · Weak Areas · Feynman Reviews
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {(['subjects', 'sessions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold mono capitalize transition-all"
              style={{
                background: activeTab === tab ? 'var(--terra)' : 'rgba(160,82,45,0.08)',
                color: activeTab === tab ? '#fff' : 'var(--terra)',
                border: activeTab === tab ? 'none' : '1px solid rgba(160,82,45,0.2)',
              }}
            >
              {tab === 'subjects' ? '📚 Subjects' : '📋 Sessions'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">

        {/* ── Weak Areas Banner ──────────────────────────────────────────────────── */}
        {weakAreas.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-5 fade-in"
            style={{ background: 'rgba(160,82,45,0.08)', border: '1px solid rgba(160,82,45,0.2)' }}
          >
            <p className="serif text-sm font-semibold mb-2" style={{ color: 'var(--terra)' }}>
              ⚠ Weak Areas to Focus
            </p>
            <div className="flex flex-wrap gap-2">
              {weakAreas.map(area => (
                <span
                  key={area}
                  className="mono text-xs px-3 py-1 rounded-full"
                  style={{ background: 'rgba(160,82,45,0.12)', color: 'var(--terra)' }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Subjects Tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'subjects' && (
          <div className="space-y-3 fade-in">
            {subjects.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'rgba(26,20,16,0.4)' }}>
                No subject data yet. Complete a test first.
              </div>
            ) : subjects.map(sub => {
              const pct = Math.round(sub.score_pct ?? (sub.correct / sub.total) * 100);
              const color = pct >= 70 ? 'var(--success)' : pct >= 45 ? 'var(--ochre)' : 'var(--terra)';
              return (
                <div
                  key={sub.subject}
                  className="paper-card rounded-2xl p-4"
                  style={{ border: '1px solid rgba(160,82,45,0.15)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="serif font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                      {sub.subject}
                    </span>
                    <span className="mono text-sm font-bold" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(160,82,45,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs" style={{ color: 'rgba(26,20,16,0.45)' }}>
                      {sub.correct}/{sub.total} correct
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: pct >= 70 ? 'var(--success)' : pct >= 45 ? 'var(--ochre)' : 'var(--terra)' }}
                    >
                      {pct >= 70 ? 'Strong' : pct >= 45 ? 'Developing' : 'Needs Work'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Sessions Tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 fade-in">
            {sessions.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'rgba(26,20,16,0.4)' }}>
                No sessions yet. Start a mock test!
              </div>
            ) : sessions.map(session => {
              const isOpen = expandedSession === session.session_id;
              const wrong = session.question_results?.filter(q => q.selected_index !== q.correct_index) ?? [];
              const date = new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              const accPct = Math.round((session.score / session.total) * 100);

              return (
                <div
                  key={session.session_id}
                  className="paper-card rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(160,82,45,0.15)' }}
                >
                  {/* Session summary row */}
                  <button
                    className="w-full flex items-center justify-between p-4 text-left"
                    onClick={() => setExpandedSession(isOpen ? null : session.session_id)}
                  >
                    <div>
                      <p className="mono font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                        {date} · {session.score}/{session.total}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(26,20,16,0.5)' }}>
                        {wrong.length} incorrect · Tap to review
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="mono font-bold text-base"
                        style={{ color: accPct >= 70 ? 'var(--success)' : accPct >= 45 ? 'var(--ochre)' : 'var(--terra)' }}
                      >
                        {accPct}%
                      </span>
                      <span style={{ color: 'var(--terra)', fontSize: 18, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* Expanded incorrect questions */}
                  {isOpen && (
                    <div className="border-t px-4 pb-4 space-y-4" style={{ borderColor: 'rgba(160,82,45,0.12)' }}>
                      {wrong.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: 'var(--success)' }}>
                          🎉 Perfect score on this session!
                        </p>
                      ) : wrong.map((q, i) => (
                        <div
                          key={q.question_id}
                          className="rounded-xl p-4 mt-4"
                          style={{ background: 'rgba(160,82,45,0.05)', border: '1px solid rgba(160,82,45,0.15)' }}
                        >
                          {/* Q number + subject */}
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="mono text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(160,82,45,0.12)', color: 'var(--terra)' }}
                            >
                              Q{i + 1}
                            </span>
                            {q.subject && (
                              <span className="text-xs" style={{ color: 'rgba(26,20,16,0.45)' }}>{q.subject}</span>
                            )}
                          </div>

                          {/* Question text */}
                          <p className="serif text-sm leading-relaxed mb-3" style={{ color: 'var(--ink)' }}>
                            {q.question_text}
                          </p>

                          {/* Correct vs selected */}
                          <div className="space-y-1.5 mb-3">
                            {q.options.map((opt, idx) => {
                              const isCorrect = idx === q.correct_index;
                              const isChosen = idx === q.selected_index;
                              if (!isCorrect && !isChosen) return null;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                                  style={{
                                    background: isCorrect ? 'rgba(46,125,82,0.1)' : 'rgba(160,82,45,0.1)',
                                    border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--terra)'}`,
                                  }}
                                >
                                  <span
                                    className="mono text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                                    style={{
                                      background: isCorrect ? 'var(--success)' : 'var(--terra)',
                                      color: '#fff',
                                    }}
                                  >
                                    {OPTION_LABELS[idx]}
                                  </span>
                                  <span className="text-xs flex-1" style={{ color: 'var(--ink)' }}>{opt}</span>
                                  <span className="text-xs font-semibold" style={{ color: isCorrect ? 'var(--success)' : 'var(--terra)' }}>
                                    {isCorrect ? '✓ Correct' : '✗ Your ans'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* ── Feynman Review Button ─────────────────────────────────────────── */}
                          <button
                            onClick={() => openFeynman(q)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
                            style={{
                              background: 'linear-gradient(135deg, rgba(200,150,12,0.15), rgba(160,82,45,0.1))',
                              border: '1.5px solid var(--ochre)',
                              color: 'var(--ochre)',
                              minHeight: 44,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>🧠</span>
                            Feynman Review
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Feynman Modal ──────────────────────────────────────────────────────── */}
      {feynman.open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(26,20,16,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) closeFeynman(); }}
        >
          <div
            className="rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto fade-in"
            style={{ background: 'var(--paper)', boxShadow: '0 -12px 60px rgba(0,0,0,0.25)' }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(160,82,45,0.3)' }} />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 20 }}>🧠</span>
                  <span
                    className="mono text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(200,150,12,0.15)', color: 'var(--ochre)' }}
                  >
                    Feynman Review
                  </span>
                </div>
                <p className="serif text-sm font-semibold leading-snug" style={{ color: 'var(--ink)', maxWidth: '90%' }}>
                  {feynman.questionText}
                </p>
              </div>
              <button
                onClick={closeFeynman}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-lg"
                style={{ background: 'rgba(160,82,45,0.1)', color: 'var(--terra)' }}
              >
                ×
              </button>
            </div>

            <div
              className="h-px mb-4"
              style={{ background: 'linear-gradient(90deg, var(--ochre), transparent)' }}
            />

            {/* Content */}
            {feynman.loading ? (
              <div className="text-center py-10">
                <div className="w-8 h-8 border-2 border-[var(--ochre)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="mono text-sm" style={{ color: 'var(--ochre)' }}>
                  RAG is reasoning through this…
                </p>
              </div>
            ) : feynman.error ? (
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(160,82,45,0.08)', border: '1px solid rgba(160,82,45,0.2)' }}
              >
                <p className="serif text-sm" style={{ color: 'var(--terra)' }}>{feynman.error}</p>
                <button
                  className="mt-3 text-xs mono underline"
                  style={{ color: 'var(--terra)' }}
                  onClick={closeFeynman}
                >
                  Close and try again
                </button>
              </div>
            ) : (
              <div>
                <div
                  className="rounded-2xl p-5"
                  style={{ background: 'rgba(200,150,12,0.06)', border: '1px solid rgba(200,150,12,0.2)' }}
                >
                  <p
                    className="serif leading-relaxed text-sm"
                    style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}
                  >
                    {feynman.explanation}
                  </p>
                </div>

                <p
                  className="text-xs text-center mt-4"
                  style={{ color: 'rgba(26,20,16,0.4)' }}
                >
                  Explain this concept to someone else — that's the Feynman technique
                </p>

                <button
                  className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--terra)', color: '#fff', border: 'none' }}
                  onClick={closeFeynman}
                >
                  Got it ✓
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}