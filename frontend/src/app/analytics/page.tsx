"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Safety helpers ─────────────────────────────────────────────────────────────
const safeNum = (v: any, fb = 0): number => (v == null || isNaN(Number(v)) ? fb : Number(v));
const safePct = (n: any, d: any): number | null => {
  const nn = safeNum(n), nd = safeNum(d);
  if (!nd) return null;
  return Math.round((nn / nd) * 100);
};

// ── Tag maps ───────────────────────────────────────────────────────────────────
const TAG_NAMES: Record<string, string> = {
  POL_ELC:"Elections & Process", POL_FED:"Federalism", POL_SB:"State Bills",
  POL_PARL:"Parliament", POL_EX:"Executive", POL_LOC:"Local Govt",
  POL_AMD:"Amendments", POL_DPSP:"Directive Principles",
  POL_EMR:"Emergency", POL_PRE:"President & VP",
  POL_FR:"Fundamental Rights", POL_STATE:"State Legislatures",
  POL_JUD:"Judiciary", POL_CB:"Constitutional Bodies",
  GEO_CLM:"Climatology", GEO_OCN:"Oceanography", GEO_RIV:"Rivers & Lakes",
  GEO_AGR:"Agricultural Geography", GEO_WLD:"World Geography",
  GEO_IND:"Indian Geography", GEO_MIN:"Minerals & Resources", GEO_MON:"Monsoon",
  ECO_MP:"Monetary Policy", ECO_INF:"Inflation", ECO_FIN:"Public Finance",
  ECO_AGR:"Agricultural Economy", ECO_NIA:"National Income",
  ECO_SRV:"Services Sector", ECO_IND:"Industrial Policy",
  ECO_FP:"Fiscal Policy", ECO_PLN:"Economic Planning",
  ECO_BNK:"Banking System", ECO_EXT:"External Trade",
  HIS_ANC2:"Ancient History", HIS_MOD:"Modern India",
  HIS_MOD2:"Modern India II", HIS_MOD3:"Modern India III",
  HIS_MOD4:"Modern India IV", HIS_ART1:"Art & Culture",
  HIS_ART2:"Art & Culture II",
  ENV_LAW:"Environmental Law", ENV_INT:"International Env",
  ENV_CON:"Conservation", ENV_SPEC:"Biodiversity",
  ENV_CC:"Climate Change", ENV_POL:"Pollution",
  ENV_SDG:"SDGs", ENV_BIO:"Ecology",
  ENV_REN:"Renewable Energy", ENV_RPT:"Env Reports", ENV_ECO:"Ecosystems",
  ST_EMG:"Emerging Tech", ST_AGR:"Agri-Tech",
  ST_BIO:"Biotechnology", ST_IT:"IT & Cyber",
  ST_HLT:"Health Tech", ST_DEF:"Defence Tech", ST_SPACE:"Space",
};
const tagName = (t: string) => TAG_NAMES[t] || t;

// ── Color helpers ──────────────────────────────────────────────────────────────
function masteryColor(pct: number | null): string {
  if (pct == null) return "#94a3b8";
  if (pct >= 70)   return "#10b981";
  if (pct >= 45)   return "#f59e0b";
  return "#ef4444";
}

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#6366f1" }: { data: number[]; color?: string }) {
  const w = 120, h = 36, pad = 4;
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyPts = pts.join(" ");
  const lastPt  = pts[pts.length - 1];
  const areaD   = `M${pts.join("L")} L${w - pad},${h} L${pad},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sg)" />
      <polyline points={polyPts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.split(",")[0]} cy={lastPt.split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

// ── Mastery Bar ────────────────────────────────────────────────────────────────
function MasteryBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: "#f1f5f9", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

// ── Severity pill ──────────────────────────────────────────────────────────────
function SeverityPill({ s }: { s: "high" | "medium" | "low" }) {
  const map = {
    high:   { bg: "#fef2f2", color: "#dc2626", label: "High priority" },
    medium: { bg: "#fefce8", color: "#ca8a04", label: "Worth noting"  },
    low:    { bg: "#f0fdf4", color: "#16a34a", label: "Low risk"      },
  };
  const { bg, color, label } = map[s];
  return (
    <span style={{ background: bg, color, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();

  const [rows,      setRows]      = useState<any[]>([]);
  const [weakAreas, setWeakAreas] = useState<any[]>([]);
  const [sessions,  setSessions]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const token   = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    Promise.all([
      fetch(`${API}/analytics/me`,            { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/analytics/me/weak-areas`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/sessions`,                { headers }).then(r => r.json()).catch(() => []),
    ]).then(([analyticsRows, weak, sess]) => {
      setRows(Array.isArray(analyticsRows) ? analyticsRows : []);
      setWeakAreas(Array.isArray(weak) ? weak : []);
      const sessArr: any[] = Array.isArray(sess) ? sess : (sess?.sessions ?? []);
      setSessions(sessArr);
    }).finally(() => setLoading(false));
  }, [token]);

  // ── Aggregate topics → subjects ────────────────────────────────────────────
  const subjectMap: Record<string, { name: string; correct: number; total: number; trend: number }> = {};
  for (const r of rows) {
    const key = r.subject || "Other";
    if (!subjectMap[key]) subjectMap[key] = { name: key, correct: 0, total: 0, trend: 0 };
    subjectMap[key].correct += safeNum(r.correct);
    subjectMap[key].total   += safeNum(r.total_attempts);
  }
  const subjects = Object.values(subjectMap).map(s => ({
    ...s,
    accuracy: safePct(s.correct, s.total),
  })).sort((a, b) => safeNum(b.accuracy) - safeNum(a.accuracy));

  const totalCorrect   = subjects.reduce((a, s) => a + s.correct, 0);
  const totalAttempted = subjects.reduce((a, s) => a + s.total,   0);
  const overallAcc     = safePct(totalCorrect, totalAttempted);

  // ── Session trend ──────────────────────────────────────────────────────────
  const recent = [...sessions].slice(-9);
  const trendData: number[] = recent.map(s => safePct(
    safeNum(s.correct_answers ?? s.correct),
    safeNum(s.total_questions ?? s.total_q ?? 100)
  ) ?? 0);

  const last50Acc    = trendData.length >= 4 ? Math.round(trendData.slice(0, Math.floor(trendData.length / 2)).reduce((a, v) => a + v, 0) / Math.floor(trendData.length / 2)) : null;
  const current50Acc = trendData.length >= 2 ? Math.round(trendData.slice(Math.floor(trendData.length / 2)).reduce((a, v) => a + v, 0) / Math.ceil(trendData.length / 2)) : null;
  const delta        = last50Acc != null && current50Acc != null ? current50Acc - last50Acc : null;
  const improving    = delta != null && delta > 0;

  // ── Common mistakes (derived from weakAreas + subjects) ────────────────────
  interface Mistake { label: string; description: string; severity: "high" | "medium" | "low"; }
  const mistakes: Mistake[] = [];

  // Over-attempting with low accuracy
  const lowAccSubjects = subjects.filter(s => (s.accuracy ?? 100) < 35 && s.total > 8);
  for (const s of lowAccSubjects.slice(0, 2)) {
    mistakes.push({
      label:       `Over-attempting in ${s.name}`,
      description: `${s.accuracy}% accuracy with ${s.total} attempts. You may be guessing. Consider skipping 50/50 questions.`,
      severity:    "high",
    });
  }

  // Underutilised strong subject
  const strongUnderusedSubjects = subjects.filter(s => (s.accuracy ?? 0) > 75 && s.total < 10);
  for (const s of strongUnderusedSubjects.slice(0, 1)) {
    mistakes.push({
      label:       `Leaving ${s.name} untouched`,
      description: `${s.accuracy}% accuracy but only ${s.total} attempts. This is your strongest subject — do more of it.`,
      severity:    "medium",
    });
  }

  // Accuracy dipping
  if (delta != null && delta < -5) {
    mistakes.push({
      label:       "Accuracy is slipping",
      description: `Down ${Math.abs(delta)} points over your last sessions. Check if recent Current Affairs gaps are causing it.`,
      severity:    "low",
    });
  }

  // ── Top 3 priorities (from weakAreas) ─────────────────────────────────────
  const top3 = [...weakAreas]
    .sort((a, b) => safeNum(a.accuracy, 100) - safeNum(b.accuracy, 100))
    .slice(0, 3);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#64748b", fontSize: 14, fontFamily: "system-ui" }}>Loading analytics…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: "#1e293b", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .card { background: #fff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 8px rgba(0,0,0,0.04); }
        .subj-row { transition: background 0.15s; cursor: pointer; }
        .subj-row:hover { background: #f8fafc; }
        .mistake-card { transition: transform 0.15s; }
        .mistake-card:hover { transform: translateY(-1px); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, fontWeight: 600, padding: "0 0 12px", display: "flex", alignItems: "center", gap: 4 }}
        >
          ← Back
        </button>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
          Performance · Last {totalAttempted || 0} Questions
        </p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, color: "#0f172a", lineHeight: 1.1 }}>
          Your Analytics
        </h1>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Quick Snapshot ── */}
        <div className="card" style={{ padding: "20px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Quick Snapshot
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 0 }}>
            {[
              { label: "Accuracy",  value: overallAcc != null ? `${overallAcc}%` : "—",    sub: "overall",              color: "#6366f1" },
              null,
              { label: "Correct",   value: totalCorrect || "—",                             sub: `of ${totalAttempted} attempted`, color: "#10b981" },
              null,
              { label: "Skipped",   value: sessions.length > 0 ? (sessions.reduce((a, s) => a + safeNum(s.skipped), 0) || "—") : "—", sub: "not attempted", color: "#f59e0b" },
            ].map((item, i) =>
              item === null
                ? <div key={i} style={{ background: "#f1f5f9", width: 1 }} />
                : (
                  <div key={i} style={{ textAlign: "center", padding: "0 8px" }}>
                    <div style={{ fontSize: 28, fontWeight: 300, color: item.color, fontFamily: "'DM Serif Display', serif", lineHeight: 1 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.sub}</div>
                  </div>
                )
            )}
          </div>
        </div>

        {/* ── Progress Trend ── */}
        {trendData.length >= 2 && (
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
                  Are You Improving?
                </p>
                {delta != null && (
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: improving ? "#10b981" : "#ef4444",
                    background: improving ? "#f0fdf4" : "#fef2f2",
                    padding: "4px 10px", borderRadius: 99,
                  }}>
                    {improving ? "↑" : "↓"} {Math.abs(delta)}% vs earlier sessions
                  </span>
                )}
              </div>
              <Sparkline data={trendData} color={improving ? "#10b981" : "#ef4444"} />
            </div>

            {last50Acc != null && current50Acc != null && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Earlier sessions", accuracy: last50Acc,    muted: true  },
                  { label: "Recent sessions",  accuracy: current50Acc, muted: false },
                ].map((block, i) => (
                  <div key={i} style={{
                    background: block.muted ? "#f8fafc" : "#f0fdf4",
                    borderRadius: 14, padding: "14px",
                    border: `1px solid ${block.muted ? "#e2e8f0" : "#bbf7d0"}`,
                  }}>
                    <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>{block.label}</p>
                    <div style={{ fontSize: 24, fontWeight: 300, fontFamily: "'DM Serif Display', serif", color: block.muted ? "#64748b" : "#10b981" }}>
                      {block.accuracy}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, padding: "12px 14px", background: "#f8fafc", borderRadius: 12, margin: 0 }}>
              {improving
                ? `You've gained ${delta} accuracy points recently. Keep the momentum going.`
                : delta != null
                  ? `Accuracy dipped ${Math.abs(delta)} points recently. Check your recent subject mix.`
                  : "Complete more sessions to see your trend here."
              }
            </p>
          </div>
        )}

        {/* ── Subject Mastery ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 20px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
              Subject Mastery
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Tap any subject to see details.</p>
          </div>

          {subjects.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📖</div>
              <p style={{ color: "#64748b", fontSize: 13 }}>No attempts yet. Complete a test to see scores here.</p>
            </div>
          ) : subjects.map((s, i) => {
            const color  = masteryColor(s.accuracy);
            const isOpen = expandedSubject === s.name;
            const isLast = i === subjects.length - 1;

            return (
              <div key={s.name}>
                <div
                  className="subj-row"
                  onClick={() => setExpandedSubject(isOpen ? null : s.name)}
                  style={{ padding: "14px 20px", borderBottom: isLast && !isOpen ? "none" : "1px solid #f1f5f9" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
                      {s.accuracy != null ? `${s.accuracy}%` : "—"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{s.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>
                          {s.correct}/{s.total}
                        </span>
                      </div>
                      <MasteryBar pct={s.accuracy ?? 0} color={color} />
                    </div>
                    <span style={{ fontSize: 16, color: "#94a3b8", marginLeft: 4, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>›</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "14px 20px 16px", background: "#fafbfc", borderBottom: isLast ? "none" : "1px solid #f1f5f9" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Attempted", value: s.total   },
                        { label: "Correct",   value: s.correct },
                        { label: "Accuracy",  value: s.accuracy != null ? `${s.accuracy}%` : "—" },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: "#1e293b", fontFamily: "'DM Serif Display', serif" }}>{stat.value}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Weak topics within this subject */}
                    {(() => {
                      const subjectWeakTopics = weakAreas.filter(w => {
                        const prefix = (w.topic_id || "").split("_")[0];
                        const subjectPrefixMap: Record<string, string> = {
                          POL: "Polity", GEO: "Geography", ECO: "Economy",
                          HIS: "History", ENV: "Environment", ST: "Science & Tech",
                        };
                        return subjectPrefixMap[prefix] === s.name;
                      });
                      if (!subjectWeakTopics.length) return null;
                      return (
                        <div style={{ marginTop: 10 }}>
                          <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                            Weak Topics
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {subjectWeakTopics.slice(0, 5).map((w: any) => (
                              <span key={w.topic_id} style={{
                                background: "#fef2f2", color: "#dc2626",
                                border: "1px solid #fecaca", borderRadius: 99,
                                padding: "3px 10px", fontSize: 11, fontWeight: 500,
                              }}>
                                {tagName(w.topic_id)} · {Math.round(safeNum(w.accuracy))}%
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Top 3 Priorities ── */}
        {top3.length > 0 && (
          <div className="card" style={{ padding: "20px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
              Top 3 Priorities
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Focus here first this week.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {top3.map((p: any, idx: number) => {
                const acc   = Math.round(safeNum(p.accuracy));
                const color = masteryColor(acc);
                const rank  = idx + 1;
                const rankBg    = rank === 1 ? "#fef2f2" : rank === 2 ? "#fefce8" : "#f0fdf4";
                const rankColor = rank === 1 ? "#dc2626" : rank === 2 ? "#ca8a04" : "#16a34a";
                return (
                  <div key={p.topic_id} style={{ display: "flex", gap: 14, padding: "14px", background: "#f8fafc", borderRadius: 16, border: "1px solid #f1f5f9" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: rankBg, color: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>
                      {rank}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{tagName(p.topic_id)}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color }}>{acc}%</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.5 }}>
                        {p.total_attempts} attempts, below 50% accuracy
                      </p>
                      <p style={{ fontSize: 12, color: "#475569", fontStyle: "italic", padding: "8px 10px", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", lineHeight: 1.5, margin: 0 }}>
                        💡 Revisit NCERT basics for this topic before attempting more questions.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Common Mistakes ── */}
        {mistakes.length > 0 && (
          <div className="card" style={{ padding: "20px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
              Common Mistakes
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Patterns that are costing you marks.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mistakes.map((m, i) => (
                <div key={i} className="mistake-card" style={{
                  padding: "14px 16px", borderRadius: 16,
                  border: `1px solid ${m.severity === "high" ? "#fecaca" : m.severity === "medium" ? "#fde68a" : "#bbf7d0"}`,
                  background: m.severity === "high" ? "#fff5f5" : m.severity === "medium" ? "#fffbeb" : "#f0fdf4",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>{m.label}</span>
                    <SeverityPill s={m.severity} />
                  </div>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Attempt Rate Insight ── */}
        {totalAttempted > 0 && (
          <div className="card" style={{
            padding: "20px",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "none",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>
              Attempt Rate Insight
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(99,102,241,0.2)", border: "2px solid rgba(99,102,241,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                🎯
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 300, color: "#fff", fontFamily: "'DM Serif Display', serif" }}>
                  {safePct(totalAttempted, sessions.reduce((a, s) => a + safeNum(s.total_q ?? s.total_questions ?? 100), 0)) ?? overallAcc ?? "—"}% attempt rate
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {totalCorrect} correct of {totalAttempted} attempted
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.08)" }}>
              {lowAccSubjects.length > 0 ? (
                <>
                  <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 10, margin: "0 0 10px" }}>
                    Watch out for{" "}
                    <span style={{ color: "#f87171", fontWeight: 600 }}>
                      {lowAccSubjects.map(s => s.name).join(", ")}
                    </span>. Low accuracy with high attempts means you're losing marks to negative marking.
                  </p>
                  <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
                    Suggestion: For subjects below 40% accuracy, skip if you can't eliminate at least 2 options. Your expected value is negative.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7, margin: 0 }}>
                  Your attempt strategy looks balanced. Keep maintaining accuracy above 50% before attempting any question.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Recent Sessions ── */}
        {sessions.length > 0 && (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 0" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
                Recent Sessions
              </p>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Your last {Math.min(sessions.length, 5)} tests.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {[...sessions].reverse().slice(0, 5).map((s: any, i: number) => {
                const correct = safeNum(s.correct_answers ?? s.correct);
                const total   = safeNum(s.total_questions ?? s.total_q ?? 100);
                const acc     = safePct(correct, total);
                const color   = masteryColor(acc);
                const date    = s.submitted_at ?? s.started_at;
                const dateStr = date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
                const isLast  = i === Math.min(sessions.length, 5) - 1;

                return (
                  <div key={s.session_id ?? i} style={{ padding: "14px 20px", borderBottom: isLast ? "none" : "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>
                        {s.mode === "FULL_MOCK" ? "Full Mock" : s.subject_filter ? `${s.subject_filter} Test` : "Practice Test"}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8" }}>{dateStr} · {total}Q</p>
                      <div style={{ marginTop: 6, height: 3, width: 80, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${acc ?? 0}%`, background: color, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 300, color, fontFamily: "'DM Serif Display', serif" }}>
                        {acc != null ? `${acc}%` : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{correct}/{total} correct</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}