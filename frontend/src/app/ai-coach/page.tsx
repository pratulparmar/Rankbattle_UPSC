'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WeakArea {
  subject: string;
  topic_id: string;
  accuracy: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://rankbattleupsc-production.up.railway.app';

const OPENING = "What topic do you want to master today, and what is your current level with it?\n\nBeginner — never studied it\nIntermediate — read it once\nAdvanced — studied well, need depth\nRevision mode — quick recap before exam";

const SUGGESTED = [
  "Fundamental Rights — Intermediate",
  "Monsoon System — Beginner",
  "Economic Reforms post-1991 — Revision mode",
  "Preamble of the Constitution — Advanced",
  "Biodiversity & Conservation — Beginner",
];

// Render message content: **bold** → neon highlight, clean up markdown artifacts
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Skip lines that are just step headers or dividers
    if (/^#{1,3}\s/.test(line)) line = line.replace(/^#{1,3}\s+/, '');
    if (/^---+$/.test(line.trim())) return null;
    if (/^\*{3}$/.test(line.trim())) return null;

    // Split by **bold** markers
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, pi) => {
      if (pi % 2 === 1) {
        // This is bold — render as neon highlight
        return (
          <mark key={pi} style={{
            background: '#fef08a',
            color: '#1a1a1a',
            borderRadius: 3,
            padding: '0 2px',
            fontWeight: 700,
          }}>
            {part}
          </mark>
        );
      }
      return <span key={pi}>{part}</span>;
    });

    return (
      <span key={li}>
        {rendered}
        {li < lines.length - 1 && '\n'}
      </span>
    );
  }).filter(Boolean);
}

export default function AICoachPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: OPENING }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);

  useEffect(() => {
    if (!isLoading && !token) { router.push('/login'); return; }
    if (!token) return;
    fetch(`${API}/analytics/me/weak-areas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setWeakAreas(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token, isLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Add empty assistant message to stream into
    const assistantIdx = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

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
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantIdx] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: 'assistant',
          content: "Could not reach the server. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#f8fafc', fontFamily: 'Inter, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 12px rgba(37,99,235,0.35)', flexShrink: 0,
      }}>
        <button onClick={() => router.push('/dashboard')} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>AI Coach · Feynman Mode</div>
          <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12 }}>
            {weakAreas.length > 0
              ? `Personalised · ${weakAreas.length} weak areas loaded`
              : 'Deep learning · UPSC Prelims oriented'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0,
      }}>

        {/* Suggested topics — only on fresh chat */}
        {messages.length === 1 && (
          <div>
            <div style={{
              fontSize: 11, color: '#94a3b8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>Quick start</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                  padding: '10px 14px', textAlign: 'left', fontSize: 13,
                  color: '#334155', cursor: 'pointer',
                }}>
                  {q}
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
            {msg.role === 'assistant' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: '#2563eb',
                flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700,
              }}>AI</div>
            )}
            <div style={{
              maxWidth: '82%',
              background: msg.role === 'user' ? '#2563eb' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#1e293b',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 16px', fontSize: 14, lineHeight: 1.75,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
              {/* Blinking cursor while streaming this message */}
              {loading && i === messages.length - 1 && msg.role === 'assistant' && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#2563eb', marginLeft: 2, verticalAlign: 'middle',
                  animation: 'blink 1s step-end infinite',
                }} />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input — always visible */}
      <div style={{
        padding: '10px 14px 12px', background: '#fff',
        borderTop: '1px solid #e2e8f0', flexShrink: 0,
        marginBottom: 64, // space for BottomNav
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
            placeholder="Type a topic + your level, or ask anything..."
            rows={1}
            style={{
              flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 12,
              padding: '11px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif',
              resize: 'none', outline: 'none', lineHeight: 1.5,
              overflowY: 'auto', transition: 'border-color 0.15s',
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {loading
              ? <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
            }
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      <BottomNav />

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}