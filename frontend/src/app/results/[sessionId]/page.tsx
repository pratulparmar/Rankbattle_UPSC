'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { QuestionBody } from '@/lib/parseQuestionText';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Explanation {
  concept_anchor?:   string;
  statement_wise?:   Record<string, string> | string[];
  why_others_wrong?: string | string[];
  common_trap?:      string;
  elimination_hint?: string;
  trap_analysis?:    string;
}

interface QuestionResult {
  mcq_id:         string;
  question_text:  string;
  options:        string[];
  correct_index:  number;
  selected_index: number | null;
  is_correct:     boolean | null;
  subject?:       string;
  topic_id?:      string;
  explanation?:   Explanation | null;
}

interface StoredResult {
  session_id:       string;
  total_q:          number;
  attempted:        number;
  correct:          number;
  wrong:            number;
  skipped:          number;
  raw_score:        number;
  final_score:      number;
  accuracy:         number;
  time_taken_mins:  number;
  question_results: QuestionResult[];
}

const LABELS = ['A', 'B', 'C', 'D'] as const;
const API    = process.env.NEXT_PUBLIC_API_URL || 'https://rankbattleupsc-production.up.railway.app';

function grade(pct: number) {
  if (pct >= 80) return { label: 'Excellent',  color: '#16a34a', bg: '#f0fdf4', border: '#86efac' };
  if (pct >= 65) return { label: 'Good',        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  if (pct >= 50) return { label: 'Average',     color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  return               { label: 'Needs Work',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
}

// ─── Expert Analysis Panel ────────────────────────────────────────────────────
function ExpertAnalysis({ exp, isWrong }: { exp: Explanation | null | undefined; isWrong: boolean }) {
  const [open, setOpen] = useState(isWrong); // auto-expand for wrong answers

  const conceptAnchor  = exp?.concept_anchor  || null;
  // Handle both old array format and new object/string format
  const statementWise: Record<string, string> = (() => {
    const sw = exp?.statement_wise;
    if (!sw) return {};
    if (Array.isArray(sw)) return Object.fromEntries(sw.map((v, i) => [String(i+1), v]));
    return sw as Record<string, string>;
  })();
  const whyOthers: string = (() => {
    const wo = exp?.why_others_wrong;
    if (!wo) return '';
    if (Array.isArray(wo)) return wo.join(' ');
    return wo as string;
  })();
  const trap           = exp?.common_trap || exp?.trap_analysis || null;
  const elimHint       = exp?.elimination_hint || null;

  const hasContent = conceptAnchor || Object.keys(statementWise).length > 0 || whyOthers.length > 0;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: open ? '#f0f0ff' : '#f8f9ff',
          border: '1px solid #e0e7ff',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          padding: '10px 14px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: '#4338ca',
          transition: 'all 0.15s',
        }}
      >
        <span>🎓 Expert Analysis {isWrong ? '— see where you went wrong' : ''}</span>
        <span style={{
          fontSize: 16,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'none',
          display: 'inline-block',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          background: '#fafaff',
          border: '1px solid #e0e7ff',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* Explanation / Concept Anchor */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 8,
            padding: '10px 12px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#059669',
              letterSpacing: '0.08em', marginBottom: 6,
            }}>
              📖 EXPLANATION
            </div>
            <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, margin: 0 }}>
              {conceptAnchor || 'Explanation coming soon.'}
            </p>
          </div>

          {/* Statement-wise analysis */}
          {Object.keys(statementWise).length > 0 && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#2563eb',
                letterSpacing: '0.08em', marginBottom: 8,
              }}>
                📋 STATEMENT-WISE BREAKDOWN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(statementWise).map(([k, s]) => {
                  const isCorrectStmt  = s.toUpperCase().startsWith('TRUE');
                  const isIncorrect = s.toUpperCase().startsWith('FALSE');
                  return (
                    <div key={k} style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: isCorrectStmt
                        ? 'rgba(16,185,129,0.07)'
                        : isIncorrect
                          ? 'rgba(239,68,68,0.07)'
                          : 'transparent',
                    }}>
                      <span style={{
                        fontSize: 12,
                        flexShrink: 0,
                        marginTop: 1,
                        color: isCorrectStmt ? '#059669' : isIncorrect ? '#dc2626' : '#94a3b8',
                      }}>
                        {isCorrectStmt ? '✓' : isIncorrect ? '✗' : '•'}
                      </span>
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UPSC Trap */}
          {trap ? (
            <div style={{
              background: '#fef9c3',
              border: '1px solid #fde047',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#ca8a04',
                letterSpacing: '0.08em', marginBottom: 6,
              }}>
                ⚠️ UPSC TRAP
              </div>
              <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.65, margin: 0 }}>
                {trap}
              </p>
            </div>
          ) : isWrong && (
            <div style={{
              background: '#fef9c3',
              border: '1px dashed #fde047',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#ca8a04',
                letterSpacing: '0.08em', marginBottom: 6,
              }}>
                ⚠️ UPSC TRAP
              </div>
              <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
                Trap analysis coming soon for this question.
              </p>
            </div>
          )}

          {/* Why Others Wrong / Elimination Strategy */}
          {whyOthers && (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#ea580c',
                letterSpacing: '0.08em', marginBottom: 8,
              }}>
                🔍 ELIMINATION STRATEGY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[whyOthers].map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: '#ea580c', flexShrink: 0, marginTop: 2 }}>×</span>
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elimination hint if present */}
          {elimHint && (
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #7dd3fc',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#0284c7',
                letterSpacing: '0.08em', marginBottom: 6,
              }}>
                💡 ELIMINATION HINT
              </div>
              <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.65, margin: 0 }}>{elimHint}</p>
            </div>
          )}

          {/* No content fallback */}
          {!hasContent && (
            <div style={{
              textAlign: 'center', padding: '12px 0',
              fontSize: 12, color: '#94a3b8', fontStyle: 'italic',
            }}>
              Detailed explanation coming soon for this question.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Question Review Card ─────────────────────────────────────────────────────
function QuestionCard({ q, idx }: { q: QuestionResult; idx: number }) {
  const hasCorrect = q.correct_index !== undefined && q.correct_index !== null;
  const skipped    = q.selected_index === null;
  const isWrong    = q.is_correct === false;

  const badge = skipped
    ? { text: 'Skipped', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
    : q.is_correct
      ? { text: '✓ Correct', bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' }
      : { text: '✗ Wrong',   bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      borderLeft: `3px solid ${skipped ? '#e2e8f0' : q.is_correct ? '#059669' : '#dc2626'}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const,
      }}>
        <span style={{
          background: badge.bg, color: badge.color,
          border: `1px solid ${badge.border}`,
          borderRadius: 6, fontSize: 12, fontWeight: 700, padding: '2px 8px', flexShrink: 0,
        }}>
          {badge.text}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Q{idx + 1}</span>
        {q.subject && (
          <span style={{
            fontSize: 11, color: '#94a3b8',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 20, padding: '1px 8px',
          }}>{q.subject}</span>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Question text */}
        <QuestionBody
          text={q.question_text}
          style={{ marginBottom: 14 }}
        />

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {q.options?.map((opt, i) => {
            const isCorrect  = hasCorrect && i === q.correct_index;
            const isChosen   = i === q.selected_index;
            const isWrongPick = isChosen && !isCorrect;
            const missedThis = !isChosen && isCorrect && !q.is_correct && !skipped;

            let bg = '#f8fafc', border = '#e2e8f0', lbg = '#e2e8f0', lcolor = '#64748b', tag = '';

            if (isCorrect && isChosen) {
              bg = '#d1fae5'; border = '#059669'; lbg = '#059669'; lcolor = '#fff'; tag = '✓ Your answer';
            } else if (isWrongPick) {
              bg = '#fee2e2'; border = '#dc2626'; lbg = '#dc2626'; lcolor = '#fff'; tag = '✗ Your choice';
            } else if (missedThis) {
              bg = '#fefce8'; border = '#ca8a04'; lbg = '#ca8a04'; lcolor = '#fff'; tag = '✓ Correct answer';
            } else if (isCorrect && skipped) {
              bg = '#d1fae5'; border = '#059669'; lbg = '#059669'; lcolor = '#fff'; tag = '✓ Correct answer';
            }

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: bg, border: `1.5px solid ${border}`,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: lbg, color: lcolor, fontWeight: 700, fontSize: 12,
                }}>
                  {LABELS[i]}
                </span>
                <span style={{ flex: 1, fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>{opt}</span>
                {tag && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: lbg, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                    {tag}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Expert Analysis — always rendered, auto-open for wrong */}
        <ExpertAnalysis exp={q.explanation} isWrong={isWrong} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router        = useRouter();

  const [result,        setResult]        = useState<StoredResult | null>(null);
  const [tab,           setTab]           = useState<'summary' | 'review'>('summary');
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError,   setReviewError]   = useState('');
  const [filter,        setFilter]        = useState<'all' | 'wrong' | 'correct' | 'skipped'>('all');

  useEffect(() => {
    const raw = sessionStorage.getItem(`result_${sessionId}`);
    if (raw) { try { setResult(JSON.parse(raw)); } catch { /* ignore */ } }
  }, [sessionId]);

  const handleReviewTab = async () => {
    setTab('review');
    if (!result) return;
    const alreadyHas = result.question_results?.some(q => q.correct_index !== undefined);
    if (alreadyHas) return;

    setLoadingReview(true);
    setReviewError('');
    try {
      const token = localStorage.getItem('token') ?? '';
      const res   = await fetch(`${API}/sessions/${sessionId}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data   = await res.json();
      const merged = { ...result, question_results: data.question_results ?? [] };
      setResult(merged);
      sessionStorage.setItem(`result_${sessionId}`, JSON.stringify(merged));
    } catch {
      setReviewError('Could not load answer review. Try again.');
    } finally {
      setLoadingReview(false);
    }
  };

  if (!result) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', flexDirection: 'column', gap: 16, padding: 24,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        Result data not found. This can happen if you refreshed the page.
      </p>
      <button onClick={() => router.push('/dashboard')} style={{
        background: '#2563eb', color: '#fff', border: 'none',
        borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
      }}>
        Back to Dashboard
      </button>
    </div>
  );

  const {
    total_q, attempted, correct, wrong, skipped,
    raw_score, accuracy, time_taken_mins, question_results,
  } = result;

  const maxScore = total_q * 2;
  const pct      = maxScore > 0 ? Math.round((raw_score / maxScore) * 100) : 0;
  const g        = grade(pct);

  const subjectMap: Record<string, { correct: number; total: number }> = {};
  question_results?.forEach(q => {
    const sub = q.subject ?? 'General';
    if (!subjectMap[sub]) subjectMap[sub] = { correct: 0, total: 0 };
    subjectMap[sub].total++;
    if (q.is_correct) subjectMap[sub].correct++;
  });

  const allQs      = question_results ?? [];
  const filteredQs = filter === 'all'     ? allQs
    : filter === 'wrong'   ? allQs.filter(q => q.is_correct === false)
    : filter === 'correct' ? allQs.filter(q => q.is_correct === true)
    : allQs.filter(q => q.selected_index === null);

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Sticky header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20, color: '#1e293b', margin: 0 }}>Test Results</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {total_q} Questions · {time_taken_mins.toFixed(1)} mins
          </p>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{
          background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe',
          borderRadius: 10, padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          Dashboard →
        </button>
      </header>

      {/*
        ── PADDING FIX ────────────────────────────────────────────────────────
        paddingBottom: 96 = 80px BottomNav height + 16px breathing room
        This ensures the last card/button is never hidden behind the fixed nav.
      */}
      <div style={{ padding: '20px 20px 96px', maxWidth: 720, margin: '0 auto' }}>

        {/* Score card */}
        <div style={{
          background: '#fff', borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{
            background: 'linear-gradient(135deg,#1e40af,#4f46e5)',
            padding: '28px 24px', textAlign: 'center', color: '#fff',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', opacity: 0.75, marginBottom: 6, textTransform: 'uppercase' as const }}>
              UPSC Marking · +2 / −0.66
            </div>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1, letterSpacing: '-1px' }}>
              {raw_score >= 0 ? `+${raw_score.toFixed(2)}` : raw_score.toFixed(2)}
            </div>
            <div style={{ fontSize: 15, opacity: 0.7, marginTop: 4 }}>out of {maxScore}</div>
            <div style={{
              display: 'inline-block', marginTop: 14,
              background: g.bg, color: g.color, border: `1.5px solid ${g.border}`,
              borderRadius: 99, padding: '5px 18px', fontWeight: 700, fontSize: 13,
            }}>
              {g.label}
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Score Breakdown
            </p>
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
              { label: 'Correct',  val: correct,                   color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Wrong',    val: wrong,                     color: '#dc2626', bg: '#fef2f2' },
              { label: 'Skipped',  val: skipped,                   color: '#64748b', bg: '#f8fafc' },
              { label: 'Accuracy', val: `${accuracy.toFixed(1)}%`, color: '#7c3aed', bg: '#faf5ff' },
            ].map((s, i) => (
              <div key={s.label} style={{
                background: s.bg, padding: '16px 8px', textAlign: 'center',
                borderTop: '1px solid #f1f5f9',
                borderLeft: i > 0 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject breakdown */}
        {Object.keys(subjectMap).length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Subject Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(subjectMap).map(([sub, s]) => {
                const spct   = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                const scolor = spct >= 70 ? '#059669' : spct >= 45 ? '#d97706' : '#dc2626';
                return (
                  <div key={sub}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{sub}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scolor }}>{s.correct}/{s.total}</span>
                    </div>
                    <div style={{ height: 7, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${spct}%`, background: scolor, borderRadius: 99, transition: 'width 0.7s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([
            { id: 'summary', label: '📊 Summary' },
            { id: 'review',  label: `📋 Review (${allQs.length})` },
          ] as const).map(t => (
            <button key={t.id}
              onClick={() => t.id === 'review' ? handleReviewTab() : setTab('summary')}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                border: tab === t.id ? 'none' : '1.5px solid #e2e8f0',
                background: tab === t.id ? '#2563eb' : '#fff',
                color: tab === t.id ? '#fff' : '#475569',
              }}>
              {t.label}
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
                <div key={s.label} style={{
                  background: s.highlight ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${s.highlight ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{s.label}</div>
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

        {/* Review tab */}
        {tab === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {loadingReview && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: '#64748b', fontSize: 14 }}>Loading review…</p>
              </div>
            )}

            {reviewError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                <p style={{ color: '#dc2626', margin: '0 0 10px', fontSize: 14 }}>{reviewError}</p>
                <button onClick={handleReviewTab} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Retry</button>
              </div>
            )}

            {/* Filter chips */}
            {!loadingReview && allQs.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
                {([
                  { id: 'all',     label: `All (${allQs.length})`,                               color: '#2563eb' },
                  { id: 'wrong',   label: `Wrong (${allQs.filter(q => q.is_correct === false).length})`, color: '#dc2626' },
                  { id: 'correct', label: `Correct (${allQs.filter(q => q.is_correct === true).length})`, color: '#059669' },
                  { id: 'skipped', label: `Skipped (${allQs.filter(q => q.selected_index === null).length})`, color: '#64748b' },
                ] as const).map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${filter === f.id ? f.color : '#e2e8f0'}`,
                    background: filter === f.id ? f.color : '#fff',
                    color: filter === f.id ? '#fff' : '#64748b',
                  }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {!loadingReview && !reviewError && filteredQs.length === 0 && (
              <div style={{ background: '#f8fafc', borderRadius: 16, padding: 32, textAlign: 'center', color: '#64748b' }}>
                No questions in this filter.
              </div>
            )}

            {!loadingReview && filteredQs.map((q, i) => (
              <QuestionCard key={q.mcq_id ?? i} q={q} idx={allQs.indexOf(q)} />
            ))}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => router.push('/test/start')} style={{
            flex: 1, minHeight: 48, borderRadius: 12,
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
            background: '#2563eb', color: '#fff', border: 'none',
          }}>
            New Test
          </button>
          <button onClick={() => router.push('/analytics')} style={{
            flex: 1, minHeight: 48, borderRadius: 12,
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
            background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0',
          }}>
            Analytics
          </button>
        </div>
      </div>

      <BottomNav />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}