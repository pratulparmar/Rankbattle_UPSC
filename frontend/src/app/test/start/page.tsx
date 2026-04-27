'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// ─── Config driven by URL param: ?type=topic or ?type=full ────────────────────
const TEST_CONFIG = {
  topic: {
    label:      'Topic Test',
    questions:  25,
    duration:   '30 minutes',
    durationMin: 30,
    color:      '#2563eb',
    lightBg:    '#eff6ff',
    border:     '#bfdbfe',
    icon:       '📘',
    description: 'A focused test on a specific subject. Ideal for targeted practice and revision.',
  },
  full: {
    label:      'Full Mock Test',
    questions:  100,
    duration:   '120 minutes',
    durationMin: 120,
    color:      '#7c3aed',
    lightBg:    '#f5f3ff',
    border:     '#ddd6fe',
    icon:       '📋',
    description: 'Simulates the actual UPSC Prelims paper with full 100-question format under exam conditions.',
  },
};

const INSTRUCTIONS = [
  { icon: '🔄', text: 'Do not refresh or navigate away — your progress will be lost.' },
  { icon: '⏱', text: 'The timer starts immediately. The test auto-submits when time runs out.' },
  { icon: '☑️', text: 'Each question has exactly one correct answer. Select and move on.' },
  { icon: '★',  text: 'Use "Mark for Review" to flag questions you want to revisit.' },
  { icon: '✎',  text: 'You can change your answer any time before submitting.' },
  { icon: '⚡', text: 'Unattempted questions carry zero marks — no negative marking for skipping.' },
  { icon: '📵', text: 'Ensure stable internet. The test cannot be paused once started.' },
];

const MARKING = [
  { label: 'Correct Answer',   marks: '+2.00',  color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  { label: 'Wrong Answer',     marks: '−0.66',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { label: 'Not Attempted',    marks: '0',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
];

export default function TestStartPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { token }    = useAuth();

  // default to 'full' if no param — matches your dashboard "Start Mock Test"
  const type   = (params.get('type') as 'topic' | 'full') ?? 'full';
  const config = TEST_CONFIG[type] ?? TEST_CONFIG.full;

  const [starting, setStarting] = useState(false);
  const [error,    setError]    = useState('');

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://rankbattleupsc-production.up.railway.app';

  // ── Start session ─────────────────────────────────────────────────────────────
  async function startTest() {
    if (!token) { setError('Not authenticated. Please log in.'); return; }
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/sessions/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode:           type === 'full' ? 'FULL_MOCK' : 'TOPIC_TEST',
          total_q:        config.questions,
          duration_mins:  config.durationMin,
          subject_filter: null,
          topic_filter:   null,
          tier_filter:    null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      // The session start response contains questions — store them so the test
      // page doesn't need a second round-trip.
      if (data.questions?.length) {
        sessionStorage.setItem(`session_${data.session_id}`, JSON.stringify(data.questions));
      }
      router.push(`/test/${data.session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start test. Try again.');
      setStarting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <div style={container}>

        {/* ── Back link ────────────────────────────────────────────────────────── */}
        <button onClick={() => router.push('/dashboard')} style={backBtn}>
          ← Back to Dashboard
        </button>

        {/* ── Hero card ────────────────────────────────────────────────────────── */}
        <div style={heroCard(config.color)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={iconCircle(config.color)}>{config.icon}</div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                Ready to begin
              </p>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.3px' }}>
                {config.label}
              </h1>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, margin: '16px 0 0' }}>
            {config.description}
          </p>
        </div>

        {/* ── Exam Overview ─────────────────────────────────────────────────────── */}
        <Section title="Exam Overview">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <StatTile icon="⏱" label="Duration"       value={config.duration}             color={config.color} bg={config.lightBg} border={config.border} />
            <StatTile icon="❓" label="Questions"      value={String(config.questions)}    color={config.color} bg={config.lightBg} border={config.border} />
            <StatTile icon="📊" label="Max Marks"      value={String(config.questions * 2)} color={config.color} bg={config.lightBg} border={config.border} />
          </div>
        </Section>

        {/* ── Marking Scheme ────────────────────────────────────────────────────── */}
        <Section title="Marking Scheme">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MARKING.map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: m.bg, border: `1.5px solid ${m.border}` }}>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 17, color: m.color }}>{m.marks}</span>
              </div>
            ))}
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                <strong>Net Score</strong> = (Correct × 2) − (Incorrect × 0.66). Skipped questions carry no penalty.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Instructions ──────────────────────────────────────────────────────── */}
        <Section title="General Instructions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {INSTRUCTIONS.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 4px', borderBottom: i < INSTRUCTIONS.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{ins.icon}</span>
                <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Error ─────────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, paddingBottom: 32 }}>
          <button
            onClick={startTest}
            disabled={starting}
            style={startBtn(config.color, starting)}
          >
            {starting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Starting Test…
              </span>
            ) : `Start ${config.label} →`}
          </button>
          <button onClick={() => router.push('/dashboard')} style={secondaryBtn}>
            Cancel — Back to Dashboard
          </button>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{title}</h2>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

function StatTile({ icon, label, value, color, bg, border }: { icon: string; label: string; value: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px 0',
  display: 'flex', alignItems: 'center', gap: 4,
};

const heroCard = (color: string): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${color}, ${color}dd)`,
  borderRadius: 20,
  padding: '24px 20px',
  boxShadow: `0 8px 32px ${color}40`,
});

const iconCircle = (color: string): React.CSSProperties => ({
  width: 52, height: 52, borderRadius: 14,
  background: 'rgba(255,255,255,0.2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 26, flexShrink: 0,
});

const startBtn = (color: string, disabled: boolean): React.CSSProperties => ({
  width: '100%', minHeight: 54, borderRadius: 14,
  background: disabled ? '#94a3b8' : color,
  color: '#fff', border: 'none',
  fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : `0 4px 16px ${color}50`,
  transition: 'all 0.2s',
  letterSpacing: '0.01em',
});

const secondaryBtn: React.CSSProperties = {
  width: '100%', minHeight: 48, borderRadius: 14,
  background: '#fff', color: '#64748b',
  border: '1.5px solid #e2e8f0',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
};