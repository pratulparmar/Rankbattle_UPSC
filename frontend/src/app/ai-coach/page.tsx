'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WeakArea {
  subject: string;
  topic_id: string;
  accuracy: number;
}

const API = process.env.NEXT_PUBLIC_API_URL
  || 'https://rankbattleupsc-production.up.railway.app';

const OPENING = "I am ready. What topic do you want to master and how well do you understand it?\n\n🟢 Beginner — never studied it\n🟡 Intermediate — read it once\n🔵 Advanced — studied well, need depth\n🔄 Revision mode — quick recap before exam";

const SUGGESTED = [
  "Fundamental Rights — Intermediate",
  "Monsoon System — Beginner",
  "Economic Reforms post-1991 — Revision mode",
  "Preamble of the Constitution — Advanced",
  "Biodiversity & Conservation — Beginner",
];

export default function AICoachPage() {
  const { token } = useAuth();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: OPENING,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetch(`${API}/analytics/me/weak-areas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setWeakAreas(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/ai-coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: messages,
          weak_areas: weakAreas,
        }),
      });

      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: "⚠️ Couldn't reach the server. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#f8fafc', fontFamily: 'Inter, sans-serif',
      paddingBottom: '64px',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 12px rgba(37,99,235,0.35)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20,
        }}>🎯</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            AI Coach · Feynman Mode
          </div>
          <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12 }}>
            {weakAreas.length > 0
              ? `Personalised · ${weakAreas.length} weak areas loaded`
              : 'Deep learning · UPSC Prelims oriented'}
          </div>
        </div>
        {/* Step tracker badge */}
        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 20,
          padding: '4px 10px', fontSize: 11, color: '#fff', fontWeight: 600,
        }}>
          7-Step Loop
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>

        {/* Suggested starters — only on fresh chat */}
        {messages.length === 1 && (
          <div>
            <div style={{
              fontSize: 11, color: '#94a3b8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>Quick start</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, padding: '10px 14px', textAlign: 'left',
                  fontSize: 13, color: '#334155', cursor: 'pointer',
                  transition: 'all 0.15s', lineHeight: 1.4,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  📚 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end', gap: 8,
          }}>
            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: '#2563eb', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 15,
              }}>🎯</div>
            )}

            <div style={{
              maxWidth: '80%',
              background: msg.role === 'user' ? '#2563eb' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#1e293b',
              borderRadius: msg.role === 'user'
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              padding: '12px 16px',
              fontSize: 14, lineHeight: 1.7,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            }}>🎯</div>
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '18px 18px 18px 4px',
              padding: '13px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#93c5fd',
                    animation: 'bounce 1.2s ease-in-out infinite',
                    animationDelay: `${j * 0.18}s`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px 14px 12px', background: '#fff',
        borderTop: '1px solid #e2e8f0',
        position: 'sticky', bottom: '64px',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
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
            placeholder="Type a topic + your level, or just ask anything..."
            rows={1}
            style={{
              flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 12,
              padding: '11px 14px', fontSize: 14,
              fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
              lineHeight: 1.5, overflowY: 'auto',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#2563eb')}
            onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              background: loading || !input.trim() ? '#cbd5e1' : '#2563eb',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div style={{
          fontSize: 11, color: '#94a3b8', marginTop: 5, textAlign: 'center',
        }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}