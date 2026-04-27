'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface StoredResult {
  session_id: string;
  total_q: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  raw_score: number;
  final_score: number;
  accuracy: number;
  time_taken_mins: number;
  question_results: {
    mcq_id: string;
    question_text: string;
    options: string[];
    subject?: string;
    selected_index: number | null;
  }[];
}

const LABELS = ['A', 'B', 'C', 'D'] as const;

function grade(pct: number) {
  if (pct >= 80) return { label: 'Excellent',  color: '#16a34a', bg: '#f0fdf4', border: '#86efac' };
  if (pct >= 65) return { label: 'Good',        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  if (pct >= 50) return { label: 'Average',     color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  return               { label: 'Needs Work',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
}

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router        = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [tab, setTab]       = useState<'summary' | 'review'>('summary');

  useEffect(() => {
    const raw = sessionStorage.getItem(`result_${sessionId}`);
    if (raw) {
      try { setResult(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, [sessionId]);

  if (!result) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 320 }}>
        Result data not found. This can happen if you refreshed the page.
      </p>
      <button onClick={() => router.push('/dashboard')}
        style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Back to Dashboard
      </button>
    </div>
  );

  const { total_q, attempted, correct, wrong, skipped, raw_score, accuracy, time_taken_mins, question_results } = result;
  const maxScore = total_q * 2;
  const pct      = maxScore > 0 ? Math.round((raw_score / maxScore) * 100) : 0;
  const g        = grade(pct);

  // Subject breakdown from question_results
  const subjectMap: Record<string, { attempted: number; total: number }> = {};
  question_results.forEach(q => {
    const sub = q.subject ?? 'General';
    if (!subjectMap[sub]) subjectMap[sub] = { attempted: 0, total: 0 };
    subjectMap[sub].total++;
    if (q.selected_index !== null) subjectMap[sub].attempted++;
  });

  // Attempted questions for review tab
  const attemptedQs = question_results.filter(q => q.selected_index !== null);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20, color: '#1e293b', margin: 0 }}>Test Results</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {total_q} Questions · {time_taken_mins.toFixed(1)} mins
          </p>
        </div>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Dashboard →
        </button>
      </header>

      <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>

        {/* Score Card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 20 }}>

          {/* Hero band */}
          <div style={{ background: 'linear-gradient(135deg,#1e40af,#4f46e5)', padding: '28px 24px', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>
              UPSC Marking · +2 / −0.66
            </div>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1, letterSpacing: '-1px' }}>
              {raw_score >= 0 ? `+${raw_score.toFixed(2)}` : raw_score.toFixed(2)}
            </div>
            <div style={{ fontSize: 15, opacity: 0.7, marginTop: 4 }}>out of {maxScore}</div>
            <div style={{ display: 'inline-block', marginTop: 14, background: g.bg, color: g.color, border: `1.5px solid ${g.border}`, borderRadius: 99, padding: '5px 18px', fontWeight: 700, fontSize: 13 }}>
              {g.label}
            </div>
          </div>

          {/* Formula breakdown */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Breakdown</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{correct} Correct × 2</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>+{(correct * 2).toFixed(2)}</span>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{wrong} Wrong × 0.66</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>−{(wrong * 0.66).toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '2px dashed #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>Net Score</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: raw_score >= 0 ? '#16a34a' : '#dc2626' }}>
                {raw_score >= 0 ? '+' : ''}{raw_score.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 4-stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[
              { label: 'Correct',   val: correct,                 color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Wrong',     val: wrong,                   color: '#dc2626', bg: '#fef2f2' },
              { label: 'Skipped',   val: skipped,                 color: '#64748b', bg: '#f8fafc' },
              { label: 'Accuracy',  val: `${accuracy.toFixed(1)}%`, color: '#7c3aed', bg: '#faf5ff' },
            ].map((s, i) => (
              <div key={s.label} style={{ background: s.bg, padding: '16px 8px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderLeft: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject breakdown */}
        {Object.keys(subjectMap).length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Subject Distribution
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(subjectMap).map(([sub, s]) => {
                const pct = Math.round((s.attempted / s.total) * 100);
                return (
                  <div key={sub}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{sub}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{s.attempted}/{s.total} attempted</span>
                    </div>
                    <div style={{ height: 7, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['summary', 'review'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', border: tab === t ? 'none' : '1.5px solid #e2e8f0', background: tab === t ? '#2563eb' : '#fff', color: tab === t ? '#fff' : '#475569' }}>
              {t === 'summary' ? '📊 Summary' : `📋 Attempted (${attemptedQs.length})`}
            </button>
          ))}
        </div>

        {/* Summary tab */}
        {tab === 'summary' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {[
                { label: 'Total Questions', val: String(total_q) },
                { label: 'Attempted',       val: String(attempted) },
                { label: 'Time Taken',      val: `${time_taken_mins.toFixed(1)} mins` },
                { label: 'Net Score',       val: raw_score.toFixed(2), highlight: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.highlight ? '#eff6ff' : '#f8fafc', border: `1px solid ${s.highlight ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.highlight ? '#2563eb' : '#1e293b' }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6, margin: 0 }}>
                <strong>Formula:</strong> ({correct} × 2) − ({wrong} × 0.66) = <strong>{raw_score.toFixed(2)}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Review tab — all attempted questions */}
        {tab === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {attemptedQs.length === 0 ? (
              <div style={{ background: '#f8fafc', borderRadius: 16, padding: 32, textAlign: 'center', color: '#64748b' }}>
                No questions were attempted.
              </div>
            ) : attemptedQs.map((q, i) => (
              <div key={q.mcq_id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 700, padding: '2px 8px' }}>Q{i + 1}</span>
                  {q.subject && <span style={{ fontSize: 12, color: '#94a3b8' }}>{q.subject}</span>}
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1e293b', margin: '0 0 12px', fontWeight: 500 }}>{q.question_text}</p>
                  {/* Show selected answer */}
                  {q.selected_index !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                      <span style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, fontFamily: 'monospace' }}>
                        {LABELS[q.selected_index]}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, color: '#1e293b' }}>{q.options[q.selected_index]}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>Your answer</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => router.push('/test/start')}
            style={{ flex: 1, minHeight: 48, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none' }}>
            New Test
          </button>
          <button onClick={() => router.push('/analytics')}
            style={{ flex: 1, minHeight: 48, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0' }}>
            Analytics
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}