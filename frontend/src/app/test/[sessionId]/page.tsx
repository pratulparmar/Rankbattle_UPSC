'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  question_text: string;
  options: string[];
  subject?: string;
}

interface AnswerState {
  selected_index: number | null;
  marked_review: boolean;
  rag_viewed: boolean;
}

const LABELS   = ['A', 'B', 'C', 'D'] as const;
const EMPTY_A: AnswerState = { selected_index: null, marked_review: false, rag_viewed: false };

function getTimerSeconds(n: number) { return n <= 25 ? 30 * 60 : 120 * 60; }

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape-sniff: backend may return questions in several shapes. Try them all.
// ─────────────────────────────────────────────────────────────────────────────
function extractQuestions(data: unknown): Question[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  // Shape A: array at root
  if (Array.isArray(data)) return normalizeQuestions(data);

  // Shape B: { questions: [...] }
  if (Array.isArray(d.questions)) return normalizeQuestions(d.questions as unknown[]);

  // Shape C: { session: { questions: [...] } }
  const session = d.session as Record<string, unknown> | undefined;
  if (session && Array.isArray(session.questions)) return normalizeQuestions(session.questions as unknown[]);

  // Shape D: { data: [...] }
  if (Array.isArray(d.data)) return normalizeQuestions(d.data as unknown[]);

  return [];
}

function normalizeQuestions(arr: unknown[]): Question[] {
  return arr
    .filter(Boolean)
    .map((q: unknown) => {
      const item = q as Record<string, unknown>;
      // options may be array or object {A:..., B:..., C:..., D:...}
      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = (item.options as unknown[]).map(String);
      } else if (item.option_a !== undefined) {
        options = [
          String(item.option_a ?? ''),
          String(item.option_b ?? ''),
          String(item.option_c ?? ''),
          String(item.option_d ?? ''),
        ];
      } else if (item.options && typeof item.options === 'object') {
        const o = item.options as Record<string, string>;
        options = [o.A ?? o.a ?? '', o.B ?? o.b ?? '', o.C ?? o.c ?? '', o.D ?? o.d ?? ''];
      }
      return {
        id:            String(item.mcq_id ?? item.id ?? ''),
        question_text: String(item.stem ?? item.question_text ?? item.text ?? ''),
        options,
        subject:       item.subject ? String(item.subject) : undefined,
      } as Question;
    })
    .filter(q => q.question_text.length > 0);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TestSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router        = useRouter();
  const { token }     = useAuth();

  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [answers,    setAnswers]    = useState<AnswerState[]>([]);
  const [current,    setCurrent]    = useState(0);
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [status,     setStatus]     = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [drawer,     setDrawer]     = useState(false);

  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const BASE      = process.env.NEXT_PUBLIC_API_URL ?? 'https://rankbattleupsc-production.up.railway.app';

  // ── Load questions ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !sessionId) return;

    async function load() {
      // ① Try sessionStorage first (set by test-start-page when session was created)
      try {
        const cached = sessionStorage.getItem(`session_${sessionId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const qs = normalizeQuestions(Array.isArray(parsed) ? parsed : []);
          if (qs.length > 0) {
            init(qs);
            return;
          }
        }
      } catch { /* ignore parse errors */ }

      // ② Try multiple endpoints — we don't know which one the backend exposes
      const endpoints = [
        `${BASE}/sessions/${sessionId}`,            // most likely: full session object
        `${BASE}/sessions/${sessionId}/questions`,  // explicit questions endpoint
        `${BASE}/mcqs/session/${sessionId}`,        // alternative mcq route
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const data = await res.json();
          const qs   = extractQuestions(data);
          if (qs.length > 0) {
            console.log(`[TestSession] Loaded ${qs.length} questions from ${url}`);
            init(qs);
            return;
          } else {
            console.warn(`[TestSession] ${url} returned no parseable questions:`, data);
          }
        } catch (e) {
          console.warn(`[TestSession] fetch failed for ${url}:`, e);
        }
      }

      // ③ All endpoints failed
      setErrorMsg(
        'Could not load questions. The session may have expired or the questions endpoint is unreachable. ' +
        `(Session ID: ${sessionId})`
      );
      setStatus('error');
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  function init(qs: Question[]) {
    setQuestions(qs);
    setAnswers(qs.map(() => ({ ...EMPTY_A })));
    setTimeLeft(getTimerSeconds(qs.length));
    setStatus('ready');
  }

  // ── Timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    if (!auto && !confirm('Submit test? This cannot be undone.')) return;
    setSubmitting(true);
    clearInterval(timerRef.current!);
    try {
      const res = await fetch(`${BASE}/sessions/${sessionId}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          attempts: answers.map((a, i) => ({
            mcq_id:          questions[i]?.id,
            selected_index:  a.selected_index,
            time_spent_secs: 0,
            marked_review:   a.marked_review,
            rag_viewed:      a.rag_viewed,
          })),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[Submit error]', JSON.stringify(errBody, null, 2));
        throw new Error(`Submit failed: ${res.status}`);
      }
      const result = await res.json();
      // Save result + full question+answer data for the results page
      sessionStorage.setItem(`result_${sessionId}`, JSON.stringify({
        ...result,
        question_results: questions.map((q, i) => ({
          mcq_id:         q.id,
          question_text:  q.question_text,
          options:        q.options,
          subject:        q.subject,
          selected_index: answers[i]?.selected_index ?? null,
          // correct_index comes from MCQWithAnswer — not in session questions
          // results page will mark correctness from result.correct count
        })),
        answers_map: Object.fromEntries(
          answers.map((a, i) => [questions[i]?.id, a.selected_index])
        ),
      }));
      sessionStorage.removeItem(`session_${sessionId}`);
      router.push(`/results/${sessionId}`);
    } catch (e) {
      console.error('[TestSession] submit error:', e);
      setErrorMsg('Submission failed. Try again.');
      setSubmitting(false);
    }
  }, [answers, questions, sessionId, token, submitting, router, BASE]);

  // ── Answer helpers ────────────────────────────────────────────────────────────
  const selectOption = (idx: number) =>
    setAnswers(prev => {
      const next = [...prev];
      const cur  = next[current] ?? { ...EMPTY_A };
      next[current] = { ...cur, selected_index: cur.selected_index === idx ? null : idx };
      return next;
    });

  const toggleReview = () =>
    setAnswers(prev => {
      const next = [...prev];
      const cur  = next[current] ?? { ...EMPTY_A };
      next[current] = { ...cur, marked_review: !cur.marked_review };
      return next;
    });

  // ── Drawer outside-click ──────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setDrawer(false);
    };
    if (drawer) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [drawer]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const cur      = answers[current] ?? { ...EMPTY_A };
  const q        = questions[current];
  const answered = answers.filter(a => a.selected_index !== null).length;
  const reviewed = answers.filter(a => a.marked_review).length;
  const isLow    = timeLeft > 0 && timeLeft <= 300;
  const totalSec = questions.length > 0 ? getTimerSeconds(questions.length) : 1;
  const progress = ((totalSec - timeLeft) / totalSec) * 100;

  const pColor = (idx: number) => {
    const a = answers[idx] ?? EMPTY_A;
    if (idx === current)           return { bg: '#2563eb', fg: '#fff',     br: '#2563eb' };
    if (a.marked_review)           return { bg: '#fffbeb', fg: '#d97706',  br: '#fcd34d' };
    if (a.selected_index !== null) return { bg: '#f0fdf4', fg: '#16a34a',  br: '#86efac' };
    return                                { bg: '#f8fafc', fg: '#94a3b8',  br: '#e2e8f0' };
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={S.page}>
      {/* Fake header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <Skeleton w={90} h={36} r={10} />
          <Skeleton w={70} h={36} r={10} />
          <Skeleton w={80} h={36} r={10} />
        </div>
        <div style={{ height: 3, background: '#e2e8f0' }} />
      </div>
      <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
        {/* Question card skeleton */}
        <Skeleton w="100%" h={120} r={16} mb={16} />
        {/* Option skeletons */}
        {[1,2,3,4].map(i => <Skeleton key={i} w="100%" h={52} r={12} mb={10} />)}
      </div>
      <style>{CSS}</style>
    </div>
  );

  // ─── Error state ───────────────────────────────────────────────────────────────
  if (status === 'error') return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Questions Not Found</h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>{errorMsg}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setStatus('loading'); setErrorMsg(''); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Retry
          </button>
          <button onClick={() => router.push('/dashboard')} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Dashboard
          </button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── Sticky Header ──────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          {/* Timer */}
          <div style={{ ...S.timerPill, background: isLow ? '#fef2f2' : '#eff6ff', borderColor: isLow ? '#fca5a5' : '#bfdbfe' }}>
            <span style={{ fontSize: 14 }}>{isLow ? '⚠️' : '⏱'}</span>
            <span style={{ ...S.timerText, color: isLow ? '#dc2626' : '#2563eb', animation: isLow ? 'pulse 1s infinite' : 'none' }}>
              {fmt(timeLeft)}
            </span>
          </div>

          {/* Q counter */}
          <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
              Q. {current + 1}<span style={{ color: '#94a3b8', fontWeight: 400 }}>/{questions.length}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {questions.length <= 25 ? 'Topic Test · 30 min' : 'Full Mock · 120 min'}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            style={{ background: submitting ? '#94a3b8' : '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', minHeight: 38 }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>

        {/* Progress */}
        <div style={{ height: 3, background: '#e2e8f0' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#2563eb,#7c3aed)', transition: 'width 1s linear' }} />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────────── */}
      <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>

        {/* Meta row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {q?.subject && <Tag bg="#eff6ff" color="#2563eb" border="#bfdbfe">{q.subject}</Tag>}
            {cur.marked_review && <Tag bg="#fffbeb" color="#d97706" border="#fde68a">★ Marked</Tag>}
          </div>
          <button onClick={() => setDrawer(true)} style={S.paletteBtn}>
            <span>⊞</span> Palette
            <span style={{ background: '#2563eb', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 2 }}>{answered}</span>
          </button>
        </div>

        {/* Question card */}
        <div style={S.qCard}>
          {q?.question_text ? (
            <p style={S.qText}>{q.question_text}</p>
          ) : (
            // Guard: q exists but text is empty — show skeleton
            <Skeleton w="100%" h={60} r={8} />
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {(q?.options?.length ? q.options : ['', '', '', '']).map((opt, idx) => {
            const sel = cur.selected_index === idx;
            const isEmpty = !opt;
            return (
              <button
                key={idx}
                onClick={() => !isEmpty && selectOption(idx)}
                style={{ ...S.optionBtn, border: sel ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: sel ? '#eff6ff' : '#fff', boxShadow: sel ? '0 0 0 4px rgba(37,99,235,0.08)' : '0 1px 4px rgba(0,0,0,0.04)', cursor: isEmpty ? 'default' : 'pointer' }}
                onMouseEnter={e => { if (!sel && !isEmpty) (e.currentTarget as HTMLButtonElement).style.borderColor = '#93c5fd'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.borderColor = sel ? '#2563eb' : '#e2e8f0'; }}
              >
                <span style={{ ...S.optLabel, background: sel ? '#2563eb' : '#f1f5f9', color: sel ? '#fff' : '#64748b' }}>
                  {LABELS[idx]}
                </span>
                {isEmpty
                  ? <Skeleton w="70%" h={16} r={6} />
                  : <span style={{ flex: 1, fontSize: 15, lineHeight: 1.6, color: sel ? '#1e40af' : '#374151', fontWeight: sel ? 500 : 400 }}>{opt}</span>
                }
                {sel && <span style={{ color: '#2563eb', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Bottom nav */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            style={{ ...S.navBtn, flex: 1, background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0', opacity: current === 0 ? 0.35 : 1 }}>
            ← Prev
          </button>
          <button onClick={toggleReview}
            style={{ ...S.navBtn, flex: 1, background: cur.marked_review ? '#fffbeb' : '#fff', color: cur.marked_review ? '#d97706' : '#64748b', border: `1.5px solid ${cur.marked_review ? '#fcd34d' : '#e2e8f0'}` }}>
            {cur.marked_review ? '★ Marked' : '☆ Review'}
          </button>
          <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}
            style={{ ...S.navBtn, flex: 1, background: '#2563eb', color: '#fff', border: 'none', opacity: current === questions.length - 1 ? 0.35 : 1 }}>
            Next →
          </button>
        </div>

        {/* Error banner (non-fatal) */}
        {errorMsg && (
          <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>⚠ {errorMsg}</p>
          </div>
        )}
      </main>

      {/* ── Drawer ─────────────────────────────────────────────────────────────── */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div ref={drawerRef} style={S.drawerSheet}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: '#e2e8f0', margin: '0 auto 20px' }} />

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Answered',   val: answered,                              color: '#16a34a', bg: '#f0fdf4', br: '#bbf7d0' },
                { label: 'Unanswered', val: questions.length - answered - reviewed, color: '#64748b', bg: '#f8fafc', br: '#e2e8f0' },
                { label: 'Review',     val: reviewed,                               color: '#d97706', bg: '#fffbeb', br: '#fde68a' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.br}`, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>Question Palette</span>
              <button onClick={() => setDrawer(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#64748b', fontSize: 16 }}>×</button>
            </div>

            {/* 5-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {questions.map((_, idx) => {
                const p = pColor(idx);
                return (
                  <button key={idx} onClick={() => { setCurrent(idx); setDrawer(false); }}
                    style={{ minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: p.bg, color: p.fg, border: `1.5px solid ${p.br}`, transition: 'all 0.12s', fontFamily: 'monospace' }}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, justifyContent: 'center' }}>
              {[['#2563eb','Current'],['#16a34a','Answered'],['#d97706','Review'],['#94a3b8','Unvisited']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w, h, r, mb }: { w: number | string; h: number; r: number; mb?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: mb ?? 0 }} />
  );
}

function Tag({ bg, color, border, children }: { bg: string; color: string; border: string; children: React.ReactNode }) {
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
      {children}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:       { minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' } as React.CSSProperties,
  header:     { position: 'sticky' as const, top: 0, zIndex: 40, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' },
  headerInner:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12 } as React.CSSProperties,
  timerPill:  { display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '7px 13px', border: '1.5px solid', transition: 'all 0.3s', fontSize: 14 } as React.CSSProperties,
  timerText:  { fontFamily: 'monospace', fontWeight: 700, fontSize: 16, letterSpacing: '0.05em' } as React.CSSProperties,
  paletteBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' } as React.CSSProperties,
  qCard:      { background: '#fff', borderRadius: 16, padding: '22px 20px', marginBottom: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' } as React.CSSProperties,
  qText:      { fontSize: 16, fontWeight: 500, lineHeight: 1.6, color: '#1e293b', margin: 0 } as React.CSSProperties,
  optionBtn:  { width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, textAlign: 'left' as const, transition: 'all 0.15s ease', outline: 'none' },
  optLabel:   { width: 32, height: 32, borderRadius: 8, flexShrink: 0 as unknown as number, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, transition: 'all 0.15s' },
  navBtn:     { minHeight: 48, borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' } as React.CSSProperties,
  drawerSheet:{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '82vh', overflowY: 'auto' as const },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  * { box-sizing: border-box; }
  button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
`;