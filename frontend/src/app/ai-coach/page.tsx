'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import PaywallModal from '@/components/PaywallModal';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

interface WeakArea {
  subject: string;
  topic_id: string;
  accuracy: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL;

const OPENING = `What topic do you want to master today, and what's your current level with it?`;

const SUGGESTED = [
  'Fundamental Rights — Intermediate',
  'Monsoon System — Beginner',
  'Economic Reforms post-1991 — Revision mode',
  'Preamble of the Constitution — Advanced',
  'Biodiversity & Conservation — Beginner',
];

const LEVEL_CHIPS = ['Beginner', 'Intermediate', 'Advanced', 'Revision mode'];

// ── Render rich content ────────────────────────────────────────────────────────
function RichContent({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        if (/^#{1,3}\s/.test(line)) line = line.replace(/^#{1,3}\s+/, '');
        if (/^---+$/.test(line.trim()) || /^\*{3}$/.test(line.trim())) return null;

        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <span key={li} style={{ display: 'block', minHeight: line ? undefined : '0.5em' }}>
            {parts.map((part, pi) =>
              pi % 2 === 1
                ? <strong key={pi} style={{ color: '#93c5fd', fontWeight: 650 }}>{part}</strong>
                : <span key={pi}>{part}</span>
            )}
            {isStreaming && li === lines.length - 1 && (
              <span className="coach-cursor" />
            )}
          </span>
        );
      }).filter(Boolean)}
    </>
  );
}

// ── Coach Avatar ───────────────────────────────────────────────────────────────
function CoachAvatar({ glowing }: { glowing?: boolean }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, position: 'relative',
      boxShadow: glowing
        ? '0 0 0 3px rgba(99,102,241,0.15), 0 0 16px rgba(99,102,241,0.3)'
        : 'none',
      transition: 'box-shadow 0.3s ease',
    }}>
      <span style={{ fontSize: 15 }}>🧠</span>
      {glowing && (
        <span style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: '1.5px solid rgba(99,102,241,0.25)',
          animation: 'coachPulse 2s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

// ── Level chips that appear after opening message ──────────────────────────────
function LevelChips({ onSelect }: { onSelect: (level: string) => void }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {LEVEL_CHIPS.map(level => (
        <button
          key={level}
          onClick={() => onSelect(level)}
          style={{
            padding: '7px 14px', borderRadius: 99,
            border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.08)',
            color: '#a5b4fc', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(99,102,241,0.2)';
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)';
          }}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

// ── Free messages progress bar ─────────────────────────────────────────────────
function FreeBar({ left, total = 5 }: { left: number; total?: number }) {
  const pct = (left / total) * 100;
  const color = left <= 1 ? '#ef4444' : left <= 2 ? '#f59e0b' : '#6366f1';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
        {left} free left
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AICoachPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: OPENING, id: 'opening' }
  ]);
  const [input,            setInput]            = useState('');
  const [loading,          setLoading]          = useState(false);
  const [weakAreas,        setWeakAreas]        = useState<WeakArea[]>([]);
  const [paywallReason,    setPaywallReason]    = useState<'full_mock' | 'subject_repeat' | 'subjects_limit' | 'coach' | null>(null);
  const [freeMessagesLeft, setFreeMessagesLeft] = useState<number | null>(null);
  const [isSubscribed,     setIsSubscribed]     = useState(false);
  const [showSuggested,    setShowSuggested]    = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Tracks whether user is near bottom before a new streaming message starts
  const wasAtBottomRef      = useRef(true);
  const streamingMsgIdRef   = useRef<string | null>(null);
  const streamingMsgTopRef  = useRef<number | null>(null); // scrollTop of message start

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Track user scroll intent
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!loading) wasAtBottomRef.current = isNearBottom();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading, isNearBottom]);

  // Smart scroll during streaming — only scroll if user was at bottom
  useEffect(() => {
    if (!loading) return;
    if (wasAtBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, loading, scrollToBottom]);

  // Scroll to show top of new message when streaming starts
  const anchorStreamStart = useCallback((msgId: string) => {
    streamingMsgIdRef.current = msgId;
    const el = scrollRef.current;
    if (!el) return;
    // Small delay for DOM to paint the new empty bubble
    setTimeout(() => {
      const msgEl = document.getElementById(`msg-${msgId}`);
      if (!msgEl || !el) return;
      const msgTop = msgEl.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      streamingMsgTopRef.current = msgTop;
      // Only scroll to show message start if user was NOT at bottom (reading above)
      if (!wasAtBottomRef.current) {
        el.scrollTo({ top: Math.max(0, msgTop - 16), behavior: 'smooth' });
      }
    }, 40);
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !token) { router.push('/login'); return; }
    if (!token) return;

    fetch(`${API}/analytics/me/weak-areas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setWeakAreas(Array.isArray(d) ? d : [])).catch(() => {});

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setIsSubscribed(!!d.is_subscribed);
        if (!d.is_subscribed) setFreeMessagesLeft(5 - (d.coach_messages_used || 0));
      }).catch(() => {});
  }, [token, isLoading]);

  // ── Textarea auto-resize ───────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    if (!isSubscribed && freeMessagesLeft !== null && freeMessagesLeft <= 0) {
      setPaywallReason('coach');
      return;
    }

    setShowSuggested(false);
    wasAtBottomRef.current = isNearBottom();

    const userMsg: Message = { role: 'user', content: text.trim(), id: `u-${Date.now()}` };
    const assistantId = `a-${Date.now()}`;
    const newMessages = [...messages, userMsg];

    setMessages([...newMessages, { role: 'assistant', content: '', id: assistantId }]);
    setInput('');
    setLoading(true);

    // Anchor the stream start position
    anchorStreamStart(assistantId);

    try {
      const res = await fetch(`${API}/ai-coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim(), history: messages, weak_areas: weakAreas }),
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.detail?.code === 'FREE_LIMIT_COACH') {
          setFreeMessagesLeft(0);
          setPaywallReason('coach');
          setMessages(prev => prev.slice(0, -1));
          return;
        }
      }

      if (!res.ok) throw new Error('Server error');
      if (!res.body) throw new Error('No stream');

      if (!isSubscribed && freeMessagesLeft !== null) {
        setFreeMessagesLeft(prev => Math.max(0, (prev ?? 1) - 1));
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              const final = accumulated;
              setMessages(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(m => m.id === assistantId);
                if (idx !== -1) updated[idx] = { ...updated[idx], content: final };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(m => m.id === assistantId);
        if (idx !== -1) updated[idx] = { ...updated[idx], content: 'Could not reach the server. Please try again.' };
        return updated;
      });
    } finally {
      setLoading(false);
      streamingMsgIdRef.current = null;
      streamingMsgTopRef.current = null;
      // Scroll to bottom when done if user didn't scroll away
      if (wasAtBottomRef.current) scrollToBottom('smooth');
    }
  }, [loading, messages, token, weakAreas, isSubscribed, freeMessagesLeft, isNearBottom, anchorStreamStart, scrollToBottom]);

  const isBlocked = !isSubscribed && freeMessagesLeft === 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#080c14',
      fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

        @keyframes coachPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%       { transform: scale(1.15); opacity: 0.1; }
        }
        @keyframes coachFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes chipEntrance {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .coach-cursor {
          display: inline-block;
          width: 2px; height: 14px;
          background: #818cf8;
          margin-left: 2px;
          vertical-align: middle;
          border-radius: 1px;
          animation: cursorBlink 0.9s step-end infinite;
        }

        .msg-in {
          animation: coachFadeIn 0.25s ease both;
        }

        .glass-bubble {
          background: rgba(30, 41, 59, 0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .user-bubble {
          background: linear-gradient(135deg, #1d4ed8, #3730a3);
          border: 1px solid rgba(99,102,241,0.3);
        }

        .cmd-bar {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          transition: border-color 0.2s;
        }
        .cmd-bar:focus-within {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }

        .suggested-chip {
          animation: chipEntrance 0.3s ease both;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
        }
        .suggested-chip:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.15) !important;
          transform: translateY(-1px);
        }
        .suggested-chip:active {
          transform: translateY(0);
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(8,12,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '12px 16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
          {/* Back */}
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <CoachAvatar glowing={loading} />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
                UPSC Coach
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                {loading ? 'Thinking…' : weakAreas.length > 0
                  ? `${weakAreas.length} weak areas loaded`
                  : 'Feynman method · Prelims-focused'}
              </div>
            </div>
          </div>

          {/* Free badge */}
          {!isSubscribed && freeMessagesLeft !== null && freeMessagesLeft <= 3 && (
            <div style={{
              padding: '4px 10px', borderRadius: 99,
              background: freeMessagesLeft === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
              border: `1px solid ${freeMessagesLeft === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
              fontSize: 11, fontWeight: 600,
              color: freeMessagesLeft === 0 ? '#f87171' : '#a5b4fc',
            }}>
              {freeMessagesLeft === 0 ? 'Limit reached' : `${freeMessagesLeft} free`}
            </div>
          )}
        </div>

        {/* Free progress bar */}
        {!isSubscribed && freeMessagesLeft !== null && freeMessagesLeft < 5 && (
          <FreeBar left={freeMessagesLeft} />
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '20px 16px 12px',
          display: 'flex', flexDirection: 'column', gap: 16,
          minHeight: 0,
        }}
      >
        {/* Suggested topics */}
        {showSuggested && messages.length === 1 && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Quick start
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  className="suggested-chip"
                  onClick={() => sendMessage(q)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '10px 14px',
                    textAlign: 'left', fontSize: 13,
                    color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => {
          const isUser      = msg.role === 'user';
          const isStreaming  = loading && i === messages.length - 1 && !isUser;
          const isOpening   = msg.id === 'opening';

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className="msg-in"
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 10,
                animationDelay: isOpening ? '0s' : '0.05s',
              }}
            >
              {/* Coach avatar */}
              {!isUser && <CoachAvatar glowing={isStreaming} />}

              {/* Bubble */}
              <div
                className={isUser ? 'user-bubble' : 'glass-bubble'}
                style={{
                  maxWidth: '82%',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '13px 16px',
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: isUser ? '#fff' : 'rgba(226,232,240,0.92)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  letterSpacing: '0.01em',
                  position: 'relative',
                }}
              >
                {isUser
                  ? msg.content
                  : <RichContent text={msg.content} isStreaming={isStreaming} />
                }

                {/* Level chips after opening */}
                {isOpening && !loading && (
                  <LevelChips onSelect={level => sendMessage(`My level is: ${level}`)} />
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom anchor */}
        <div style={{ height: 1 }} />
      </div>

      {/* ── Command Bar / Input ── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        marginBottom: 56, // BottomNav
        background: 'transparent',
      }}>

        {isBlocked ? (
          /* Blocked state */
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 16, padding: '16px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: '#fca5a5', fontWeight: 600, marginBottom: 10 }}>
              5 free messages used
            </p>
            <button
              onClick={() => setPaywallReason('coach')}
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 20px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Unlock Unlimited Coaching →
            </button>
          </div>
        ) : (
          /* Command bar */
          <div className="cmd-bar" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 12px' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask anything or pick a topic…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none', outline: 'none',
                resize: 'none',
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'rgba(226,232,240,0.9)',
                lineHeight: 1.6,
                overflowY: 'auto',
                maxHeight: 120,
                caretColor: '#818cf8',
              }}
            />

            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: loading || !input.trim()
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #4f46e5, #2563eb)',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.2s',
                boxShadow: !loading && input.trim() ? '0 2px 12px rgba(79,70,229,0.4)' : 'none',
              }}
            >
              {loading
                ? (
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: 'rgba(255,255,255,0.7)',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                )
                : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={input.trim() ? '#fff' : 'rgba(255,255,255,0.2)'}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )
              }
            </button>
          </div>
        )}

        {/* Hint */}
        {!isBlocked && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 6 }}>
            Enter to send · Shift+Enter for new line
          </p>
        )}
      </div>

      <BottomNav />

      <PaywallModal
        reason={paywallReason}
        onClose={() => setPaywallReason(null)}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::placeholder { color: rgba(148,163,184,0.35); }
      `}</style>
    </div>
  );
}