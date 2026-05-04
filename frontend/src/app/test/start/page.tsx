'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import PaywallModal from '@/components/PaywallModal';

// ─── Marking scheme ───────────────────────────────────────────────────────────
const MARKING = [
  { label: 'Correct Answer', marks: '+2.00', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  { label: 'Wrong Answer',   marks: '−0.66', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Not Attempted',  marks: '0',     color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
];

const INSTRUCTIONS = [
  { icon: '🔄', text: 'Do not refresh or navigate away — your progress will be lost.' },
  { icon: '⏱',  text: 'The timer starts immediately. The test auto-submits when time runs out.' },
  { icon: '☑️', text: 'Each question has exactly one correct answer. Select and move on.' },
  { icon: '★',  text: 'Use "Mark for Review" to flag questions you want to revisit.' },
  { icon: '✎',  text: 'You can change your answer any time before submitting.' },
  { icon: '⚡', text: 'Unattempted questions carry zero marks — no negative marking for skipping.' },
  { icon: '📵', text: 'Ensure stable internet. The test cannot be paused once started.' },
];

function buildConfig(params: URLSearchParams) {
  const type    = params.get('type') ?? 'full';
  const subject = params.get('subject') ?? null;
  const count   = parseInt(params.get('count') ?? '0');
  const isFull  = type === 'full' && !subject;
  const questions = count > 0 ? count : isFull ? 100 : 25;
  const durationMin = isFull ? 120 : Math.min(120, Math.max(20, Math.round(questions * 1.2)));
  const durationStr = durationMin >= 60
    ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}`.trim()
    : `${durationMin} minutes`;

  const color   = isFull ? '#7c3aed' : subject ? '#c55a1e' : '#2563eb';
  const lightBg = isFull ? '#f5f3ff' : subject ? '#fdf6f0' : '#eff6ff';
  const border  = isFull ? '#ddd6fe' : subject ? '#f5d5c0' : '#bfdbfe';
  const icon    = isFull ? '📋'      : subject ? '📘'      : '📝';

  const label = isFull
    ? 'Full Mock Test'
    : subject ? `${subject} Practice` : 'Topic Test';

  const description = isFull
    ? 'Simulates the actual UPSC Prelims paper with full 100-question format under exam conditions.'
    : subject
      ? `A focused ${questions}-question session on ${subject}. Perfect for targeted practice and revision.`
      : `A focused ${questions}-question test. Ideal for targeted practice and revision.`;

  return {
    type, subject, questions, durationMin, durationStr,
    label, description, color, lightBg, border, icon,
    mode: isFull ? 'FULL_MOCK' : 'TOPIC_TEST',
    isFull,
  };
}

// ─── Inner component ──────────────────────────────────────────────────────────
function TestStartInner() {
  const router    = useRouter();
  const params    = useSearchParams();
  const { token } = useAuth();
  const config    = buildConfig(params);

  const [starting,      setStarting]      = useState(false);
  const [error,         setError]         = useState('');
  const [paywallReason, setPaywallReason] = useState<'full_mock' | 'subject_repeat' | 'subjects_limit' | 'coach' | null>(null);

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://rankbattleupsc-production.up.railway.app';

  async function startTest() {
    if (!token) { setError('Not authenticated. Please log in.'); return; }
    setStarting(true);
    setError('');

    try {
      const res = await fetch(`${BASE}/sessions/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode:           config.mode,
          total_q:        config.questions,
          duration_mins:  config.durationMin,
          subject_filter: config.subject,
          topic_filter:   null,
          tier_filter:    null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;

        // ── Free tier limit responses ────────────────────────────────────────
        if (detail?.code === 'FREE_LIMIT_FULL_MOCK') {
          setPaywallReason('full_mock');
          setStarting(false);
          return;
        }
        if (detail?.code === 'FREE_LIMIT_SUBJECT_REPEAT') {
          setPaywallReason('subject_repeat');
          setStarting(false);
          return;
        }
        if (detail?.code === 'FREE_LIMIT_SUBJECTS') {
          setPaywallReason('subjects_limit');
          setStarting(false);
          return;
        }

        throw new Error(detail?.message ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      if (data.questions?.length) {
        sessionStorage.setItem(`session_${data.session_id}`, JSON.stringify(data.questions));
      }
      router.push(`/test/${data.session_id}`);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start test. Try again.');
      setStarting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* Back */}
        <button onClick={() => router.back()} style={S.backBtn}>← Back</button>

        {/* Hero */}
        <div style={{
          background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)`,
          borderRadius: 20, padding: '24px 20px',
          boxShadow: `0 8px 32px ${config.color}40`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, flexShrink: 0,
            }}>
              {config.icon}
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                Ready to begin
              </p>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.3px' }}>
                {config.label}
              </h1>
            </div>
          </div>
          {config.subject && (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 12px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em' }}>
                SUBJECT FILTER: {config.subject.toUpperCase()}
              </span>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, margin: '12px 0 0' }}>
            {config.description}
          </p>
        </div>

        {/* Free tier banner — shown for non-subscribed users */}
        {config.isFull && (
          <div style={{
            background: '#f0fdf4', border: '1.5px solid #86efac',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', margin: 0 }}>
                Free Full Mock Included
              </p>
              <p style={{ fontSize: 12, color: '#4ade80', margin: '2px 0 0' }}>
                You get 1 free full mock test. Subscribe for unlimited access.
              </p>
            </div>
          </div>
        )}
        {!config.isFull && config.subject && (
          <div style={{
            background: '#fff7ed', border: '1.5px solid #fed7aa',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>🎁</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: 0 }}>
                Free Subject Test
              </p>
              <p style={{ fontSize: 12, color: '#ea580c', margin: '2px 0 0' }}>
                You get 1 free test per subject (3 subjects total). Subscribe for unlimited access.
              </p>
            </div>
          </div>
        )}

        {/* Exam Overview */}
        <div style={S.section}>
          <div style={S.sectionHead}>EXAM OVERVIEW</div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { icon: '⏱', label: 'Duration',  value: config.durationStr },
                { icon: '❓', label: 'Questions', value: String(config.questions) },
                { icon: '📊', label: 'Max Marks', value: String(config.questions * 2) },
              ].map(t => (
                <div key={t.label} style={{
                  background: config.lightBg, border: `1.5px solid ${config.border}`,
                  borderRadius: 14, padding: '14px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: config.color, lineHeight: 1.1 }}>{t.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Marking Scheme */}
        <div style={S.section}>
          <div style={S.sectionHead}>MARKING SCHEME</div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MARKING.map(m => (
              <div key={m.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderRadius: 12, background: m.bg,
                border: `1.5px solid ${m.border}`,
              }}>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 17, color: m.color }}>{m.marks}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={S.section}>
          <div style={S.sectionHead}>INSTRUCTIONS</div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {INSTRUCTIONS.map((ins, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '10px 4px',
                borderBottom: i < INSTRUCTIONS.length - 1 ? '1px solid #f1f5f9' : 'none',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{ins.icon}</span>
                <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 32 }}>
          <button onClick={startTest} disabled={starting} style={{
            width: '100%', minHeight: 54, borderRadius: 14,
            background: starting ? '#94a3b8' : config.color,
            color: '#fff', border: 'none', fontSize: 16, fontWeight: 700,
            cursor: starting ? 'not-allowed' : 'pointer',
            boxShadow: starting ? 'none' : `0 4px 16px ${config.color}50`,
          }}>
            {starting
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Starting…
                </span>
              : `Start ${config.label} →`
            }
          </button>
          <button onClick={() => router.back()} style={{
            width: '100%', minHeight: 48, borderRadius: 14,
            background: '#fff', color: '#64748b',
            border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        reason={paywallReason}
        subject={config.subject ?? undefined}
        onClose={() => setPaywallReason(null)}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:        { minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' } as React.CSSProperties,
  container:   { maxWidth: 600, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 } as React.CSSProperties,
  backBtn:     { background: 'none', border: 'none', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px 0' } as React.CSSProperties,
  section:     { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' } as React.CSSProperties,
  sectionHead: { padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' } as React.CSSProperties,
};

// ─── Export with Suspense ─────────────────────────────────────────────────────
export default function TestStartPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading…</p>
        </div>
      </div>
    }>
      <TestStartInner />
    </Suspense>
  );
}