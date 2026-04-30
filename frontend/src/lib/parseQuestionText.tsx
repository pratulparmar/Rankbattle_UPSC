import React from 'react';

const BADGE_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626'];

interface QuestionBodyProps {
  text: string;
  style?: React.CSSProperties;
}

function parseStem(text: string) {
  // DB format is always: "1. ...\n2. ...\n3. ...\n\nDirective?"
  // Split on double newline to separate statements block from directive
  const parts = text.split(/\n\n+/);
  
  const directivePart = parts.length > 1 ? parts[parts.length - 1].trim() : '';
  const statementBlock = parts.length > 1 ? parts.slice(0, -1).join('\n\n') : text;

  // Split statement block into individual statements on newlines
  const statementLines = statementBlock
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const preamble: string[] = [];
  const statements: string[] = [];

  for (const line of statementLines) {
    if (/^[1-9]\.\s+\S/.test(line)) {
      statements.push(line.replace(/^[1-9]\.\s+/, '').trim());
    } else {
      preamble.push(line);
    }
  }

  return {
    preamble: preamble.join(' ').trim(),
    statements,
    directive: directivePart,
  };
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

  if (!text) return <p style={base}>{text}</p>;

  const { preamble, statements, directive } = parseStem(text);

  if (statements.length === 0) {
    return <p style={base}>{text}</p>;
  }

  return (
    <div style={base}>
      {preamble && (
        <p style={{ margin: '0 0 10px 0', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
          {preamble}
        </p>
      )}

      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        marginBottom: directive ? 10 : 0,
      }}>
        {statements.map((stmt, i) => {
          const color = BADGE_COLORS[i % BADGE_COLORS.length];
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 6,
                background: `${color}15`, color,
                fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                border: `1px solid ${color}30`,
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: '#1e293b', lineHeight: 1.65 }}>
                {stmt}
              </span>
            </div>
          );
        })}
      </div>

      {directive && (
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#475569', fontStyle: 'italic' }}>
          {directive}
        </p>
      )}
    </div>
  );
}
