/**
 * parseQuestionText.tsx
 * Place in: frontend/src/lib/parseQuestionText.tsx
 *
 * Parses bunched-up statement questions into clean JSX.
 *
 * Handles these real UPSC patterns found in the wild:
 *   "Consider: 1. Rakhigarhi is in Haryana 2. It was excavated by ASI 3. ..."
 *   "Which of the following is correct?1. Statement A2. Statement B"
 *   "1. Only GDP includes...2. GNP equals..."
 *
 * Returns a React element — drop it anywhere in place of a raw <p>.
 */

import React from 'react';

// ─── Detect if text contains numbered statements ───────────────────────────
// Matches: "1.", "2.", "1)", "2)" at word boundaries, including mid-sentence runs
const STATEMENT_RE = /(?:^|\s)(\d+)[.)]\s+/g;

function hasNumberedStatements(text: string): boolean {
  // Reset regex state
  STATEMENT_RE.lastIndex = 0;
  const matches = [...text.matchAll(/(?:^|\s)(\d+)[.)]\s+/g)];
  return matches.length >= 2; // at least 2 numbered items = list
}

// ─── Split text into [preamble, ...statements] ─────────────────────────────
function splitStatements(text: string): { preamble: string; statements: string[] } {
  // Find the first "1." or "1)" occurrence
  const firstMatch = text.match(/(?:^|\s)(1[.)]\s+)/);
  if (!firstMatch || firstMatch.index === undefined) {
    return { preamble: text, statements: [] };
  }

  const splitIdx = firstMatch.index + (firstMatch[0].startsWith(' ') ? 1 : 0);
  const preamble = text.slice(0, splitIdx).trim();
  const rest     = text.slice(splitIdx);

  // Split by numbered markers — handles "1. ... 2. ... 3. ..."
  const parts = rest.split(/\s*(?=\d+[.)]\s+)/);
  const statements = parts
    .map(p => p.trim())
    .filter(Boolean);

  return { preamble, statements };
}

// ─── Colour each statement's number badge ──────────────────────────────────
const BADGE_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626'];

// ─── Main component ────────────────────────────────────────────────────────
interface QuestionBodyProps {
  text: string;
  style?: React.CSSProperties;
}

export function QuestionBody({ text, style }: QuestionBodyProps) {
  const base: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.65,
    color: '#1e293b',
    margin: 0,
    ...style,
  };

  if (!text || !hasNumberedStatements(text)) {
    // Plain question — no numbered statements detected
    return <p style={base}>{text}</p>;
  }

  const { preamble, statements } = splitStatements(text);

  return (
    <div style={base}>
      {/* Preamble — e.g. "Consider the following statements:" */}
      {preamble && (
        <p style={{ margin: '0 0 10px 0', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
          {preamble}
        </p>
      )}

      {/* Numbered statements as clean list */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: preamble ? 0 : 2,
      }}>
        {statements.map((stmt, i) => {
          // Extract the number prefix and the statement body
          // Split on first whitespace after the number+punctuation
          const dotIdx = stmt.search(/[.)]/);
          const num    = dotIdx > 0 ? stmt.slice(0, dotIdx).trim() : String(i + 1);
          const body   = dotIdx > 0
            ? stmt.slice(dotIdx + 1).trim()
            : stmt;
          const color = BADGE_COLORS[i % BADGE_COLORS.length];

          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {/* Number badge */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `${color}15`,
                color,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
                border: `1px solid ${color}30`,
              }}>
                {num}
              </span>

              {/* Statement text */}
              <span style={{ flex: 1, fontSize: 14, color: '#1e293b', lineHeight: 1.65 }}>
                {body}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 * In test/[sessionId]/page.tsx — replace line 375-377:
 *
 *   BEFORE:
 *     {q?.question_text
 *       ? <p style={S.qText}>{q.question_text}</p>
 *       : <Skeleton w="100%" h={60} r={8} />}
 *
 *   AFTER:
 *     import { QuestionBody } from '@/lib/parseQuestionText';
 *     ...
 *     {q?.question_text
 *       ? <QuestionBody text={q.question_text} style={S.qText} />
 *       : <Skeleton w="100%" h={60} r={8} />}
 *
 * In results/[sessionId]/page.tsx — replace line 312:
 *
 *   BEFORE:
 *     <p style={{ fontSize: 15, lineHeight: 1.65, color: '#1e293b', margin: '0 0 14px', fontWeight: 500 }}>
 *       {q.question_text}
 *     </p>
 *
 *   AFTER:
 *     import { QuestionBody } from '@/lib/parseQuestionText';
 *     ...
 *     <QuestionBody
 *       text={q.question_text}
 *       style={{ marginBottom: 14 }}
 *     />
 */