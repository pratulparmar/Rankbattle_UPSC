"use client";
/**
 * frontend/src/app/analytics/page.tsx
 * 
 * Fixes applied vs previous version:
 *  ✅ Correct endpoints: /analytics/me  and  /analytics/me/weak-areas
 *  ✅ Accuracy from backend is already 0-100 (not a 0-1 ratio)
 *  ✅ Subjects are aggregated from /analytics/me rows (grouped by subject)
 *  ✅ Sessions: calls GET /sessions (endpoint added in sessions.py patch)
 *  ✅ NaN% fully eliminated
 *  ✅ Feynman via /ai-coach/chat SSE stream
 *  ✅ Warm terracotta palette matching your existing app
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

const API = "https://rankbattleupsc-production.up.railway.app";

// ─── Safety helpers ───────────────────────────────────────────────────────────
const safeNum  = (v: any, fb = 0): number => (v == null || isNaN(Number(v)) ? fb : Number(v));
const safePct  = (n: any, d: any): number | null => {
  const nn = safeNum(n), nd = safeNum(d);
  if (!nd) return null;
  return Math.round((nn / nd) * 100);
};
// Backend already returns accuracy as 0-100; just round it safely
const safeAcc  = (v: any): number | null => (v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));
const fmt      = (v: number | null, s = "%") => (v == null ? "—" : `${v}${s}`);

// ─── Tag → readable name map ──────────────────────────────────────────────────
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
  ENV_REN:"Renewable Energy", ENV_RPT:"Env Reports",
  ENV_ECO:"Ecosystems",
  ST_EMG:"Emerging Tech", ST_AGR:"Agri-Tech",
  ST_BIO:"Biotechnology", ST_IT:"IT & Cyber",
  ST_HLT:"Health Tech", ST_DEF:"Defence Tech", ST_SPACE:"Space",
};

const TAG_GROUPS: Record<string, string> = {
  POL:"Polity & Governance", GEO:"Geography",
  ECO:"Economy", HIS:"History & Culture",
  ENV:"Environment", ST:"Science & Tech",
};

const tagName    = (t: string) => TAG_NAMES[t] || t;
const tagGroup   = (t: string) => { const p = (t||"").split("_")[0]; return TAG_GROUPS[p] || p || "Other"; };

// ─── Colour system — matches your terracotta app palette ─────────────────────
const C = {
  pageBg: "#f7f3ed", card: "#ffffff", border: "#e8ddd0",
  text: "#1a0f08", muted: "#7a5c3f", dim: "#b0906c",
  terra: "#c55a1e", gold: "#d4a017",
  dark: "#2c1a0e", darkMid: "#4a2c1a",
  green: "#2a7d4f", rose: "#c0392b",
  amber: "#d97706", indigo: "#4f46e5", violet: "#7c3aed",
};

const scoreColor = (v: number | null) => {
  if (v == null) return C.dim;
  if (v >= 70)   return C.green;
  if (v >= 45)   return C.amber;
  return C.rose;
};

// ─── SVG Ring ─────────────────────────────────────────────────────────────────
function Ring({ value, size = 60 }: { value: number | null; size?: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 120); return () => clearTimeout(t); }, []);
  const sw    = 5;
  const R     = (size - sw * 2) / 2;
  const cx    = size / 2;
  const circ  = 2 * Math.PI * R;
  const v     = safeNum(value, 0);
  const color = scoreColor(value);
  const off   = circ - (v / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={R} fill="none" stroke={C.border} strokeWidth={sw} />
      <circle cx={cx} cy={cx} r={R} fill="none"
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={go ? off : circ}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
      <text x={cx} y={cx + 4} textAnchor="middle" fill={color}
        style={{ fontSize: size * 0.21 + "px", fontWeight: 700, fontFamily: "Georgia, serif" }}>
        {value != null ? `${v}%` : "—"}
      </text>
    </svg>
  );
}

// ─── Subject card ─────────────────────────────────────────────────────────────
function SubjectCard({ name, correct, total, accuracy }: {
  name: string; correct: number; total: number; accuracy: number | null;
}) {
  const color = scoreColor(accuracy);
  const label = accuracy == null ? "No data"
    : accuracy >= 70 ? "Strong" : accuracy >= 45 ? "Developing" : "Needs Work";
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 14, display: "flex", alignItems: "center", gap: 14,
      transition: "transform .15s, box-shadow .15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(44,26,14,.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      <Ring value={accuracy} size={60} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {total > 0 ? `${correct} / ${total} correct` : "No attempts yet"}
        </div>
        <span style={{
          display: "inline-block", marginTop: 6,
          background: `${color}12`, color, border: `1px solid ${color}28`,
          borderRadius: 20, padding: "1px 9px",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ width: 3, height: 40, background: C.border, borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <div style={{
          width: "100%", height: `${accuracy ?? 0}%`, background: color, borderRadius: 2,
          marginTop: `${100 - (accuracy ?? 0)}%`, transition: "height 1s ease, margin-top 1s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Topic chip ───────────────────────────────────────────────────────────────
function Chip({ tag, accuracy }: { tag: string; accuracy: number | null }) {
  const color = scoreColor(accuracy);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: `${color}0d`, border: `1px solid ${color}22`,
      borderRadius: 20, padding: "4px 10px 4px 8px",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: C.muted }}>{tagName(tag)}</span>
      <strong style={{ fontSize: 10, color }}>{accuracy != null ? `${Math.round(accuracy)}%` : "—"}</strong>
    </span>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ s }: { s: any }) {
  const correct = safeNum(s.correct_answers ?? s.correct);
  const total   = safeNum(s.total_questions ?? s.total_q ?? 100);
  const score   = s.final_score ?? s.score ?? null;
  const acc     = safePct(correct, total);
  const color   = scoreColor(acc);
  const date    = s.submitted_at ?? s.started_at ?? s.created_at;
  const dateStr = date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const type    = s.mode === "FULL_MOCK" ? "Full Mock Test"
    : s.mode ? `${s.mode.replace("_", " ")} · ${s.subject_filter ?? "Mixed"}` : "Test";

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{type}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{dateStr} · {total} questions</div>
        {acc != null && (
          <div style={{ marginTop: 5, height: 3, width: 80, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${acc}%`, background: color, borderRadius: 2 }} />
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>
          {score != null ? Math.round(score) : "—"}
        </div>
        <div style={{ fontSize: 10, color: C.dim }}>{acc != null ? `${acc}% acc` : "No data"}</div>
      </div>
    </div>
  );
}

// ─── Feynman card ─────────────────────────────────────────────────────────────
function FCard({ item, idx }: { item: any; idx: number }) {
  const pc = item.priority === "critical" ? C.rose : C.amber;
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${pc}`,
      borderRadius: 14, padding: "14px 14px 14px 18px", display: "flex", gap: 12,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: `${pc}20`, fontFamily: "Georgia, serif", lineHeight: 1, flexShrink: 0 }}>
        {String(idx + 1).padStart(2, "0")}
      </div>
      <div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.topic}</span>
          <span style={{
            background: `${pc}12`, color: pc, border: `1px solid ${pc}28`,
            borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          }}>{(item.priority || "HIGH").toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginTop: 5 }}>{item.reason}</div>
        {item.tag && (
          <span style={{
            display: "inline-block", marginTop: 8,
            background: `${C.indigo}0d`, color: C.indigo, border: `1px solid ${C.indigo}20`,
            borderRadius: 6, padding: "2px 8px", fontSize: 10,
          }}>{item.tag}</span>
        )}
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
const SL = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.13em", fontWeight: 700 }}>{title}</div>
    {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const router = useRouter();
  const [tab,           setTab]           = useState<"subjects"|"sessions">("subjects");
  // Raw rows from /analytics/me — shape: {subject, topic_id, total_attempts, correct, accuracy}
  const [rows,          setRows]          = useState<any[]>([]);
  const [weakAreas,     setWeakAreas]     = useState<any[]>([]);
  const [sessions,      setSessions]      = useState<any[]>([]);
  const [feynman,       setFeynman]       = useState<any[]>([]);
  const [feynmanStream, setFeynmanStream] = useState("");
  const [weeklyTrend,   setWeeklyTrend]   = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);

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
      // /analytics/me returns per-topic rows — normalise to array
      const rowArr: any[] = Array.isArray(analyticsRows) ? analyticsRows : [];
      setRows(rowArr);

      // Weak areas — accuracy is already 0-100 from backend
      const weakArr: any[] = Array.isArray(weak) ? weak : [];
      setWeakAreas(weakArr);

      // Sessions — backend may return flat array or { sessions: [] }
      const sessArr: any[] = Array.isArray(sess) ? sess
        : (sess?.sessions ?? sess?.recent_sessions ?? []);
      setSessions(sessArr);

      // Build trend from recent sessions
      const trend = [...sessArr].slice(-7).map((s: any, i: number) => ({
        d: `S${i + 1}`,
        score: safePct(
          safeNum(s.correct_answers ?? s.correct),
          safeNum(s.total_questions ?? s.total_q ?? 100)
        ) ?? 0,
      }));
      setWeeklyTrend(trend);
    }).finally(() => setLoading(false));
  }, [token]);

  // ── Aggregate rows → subjects ───────────────────────────────────────────────
  // Each row = one topic. Group by subject, sum correct + total.
  const subjectMap: Record<string, { name: string; correct: number; total: number }> = {};
  for (const r of rows) {
    const key = r.subject || "Other";
    if (!subjectMap[key]) subjectMap[key] = { name: key, correct: 0, total: 0 };
    subjectMap[key].correct += safeNum(r.correct);
    subjectMap[key].total   += safeNum(r.total_attempts);
  }
  const subjects = Object.values(subjectMap).map(s => ({
    ...s,
    accuracy: safePct(s.correct, s.total),
  }));

  const totalCorrect   = subjects.reduce((a, s) => a + s.correct, 0);
  const totalAttempted = subjects.reduce((a, s) => a + s.total, 0);
  const overallAcc     = safePct(totalCorrect, totalAttempted);

  // ── Group weak areas by subject ─────────────────────────────────────────────
  const grouped: Record<string, any[]> = {};
  for (const w of weakAreas) {
    const g = tagGroup(w.topic_id || "");
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(w);
  }

  // ── Feynman stream ──────────────────────────────────────────────────────────
  const fetchFeynman = useCallback(async () => {
    if (feynmanLoad) return;
    if (!weakAreas.length) {
      setFeynmanError("Keep practising to unlock your Feynman Review!");
      setTimeout(() => setFeynmanError(""), 3500);
      return;
    }
    setFeynmanLoad(true);
    setFeynmanDone(false);
    setFeynmanText("");
    setFeynmanError("");
    setShowFeynman(true);

    const worstTopics = [...weakAreas]
      .sort((a: any, b: any) => safeNum(a.accuracy, 100) - safeNum(b.accuracy, 100))
      .slice(0, 6)
      .map((w: any) => `${tagName(w.topic_id || "")} (${Math.round(safeNum(w.accuracy, 0))}% accuracy)`)
      .join(", ");

    const prompt =
      `My weakest UPSC topics right now are: ${worstTopics}.\n\n` +
      `Pick the 3 most critical ones. For each topic give me:\n` +
      `1. A Feynman Explanation — explain it so simply that a 10-year-old could understand it. Use a real-life analogy from everyday Indian life.\n` +
      `2. One Pro Tip — a specific trap UPSC sets in Prelims for this topic and how to avoid it.\n\n` +
      `Keep each explanation to 3-4 sentences. Be direct, warm, and practical.`;

    try {
      const res = await fetch(`${API}/ai-coach/chat`, {
        method: "POST", headers,
        body: JSON.stringify({ message: prompt, weak_areas: weakAreas.slice(0, 5) }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      if (!res.body) throw new Error("No stream received");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const obj  = JSON.parse(payload);
            if (obj?.error) throw new Error(obj.error);
            const text = obj?.chunk ?? obj?.delta?.text ?? obj?.text ?? "";
            raw += text;
            setFeynmanText(raw);
          } catch { /* skip non-JSON lines */ }
        }
      }
      if (!raw.trim()) throw new Error("Empty response");
      setFeynmanDone(true);
    } catch (e: any) {
      setFeynmanText("");
      setFeynmanError("Coach is busy, try again in a moment.");
      setShowFeynman(false);
      setTimeout(() => setFeynmanError(""), 3500);
    } finally {
      setFeynmanLoad(false);
    }
  }, [weakAreas, feynmanLoad, headers]);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.pageBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ color: C.muted, fontSize: 14, fontFamily: "Georgia, serif" }}>Loading your analytics…</div>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fu { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fa { animation: fu 0.4s ease both; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${C.dark} 0%, ${C.darkMid} 100%)`, padding: "28px 16px 22px" }}>
        <button onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard")} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div style={{ fontSize: 10, color: "#a08060", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 4 }}>
          PERFORMANCE ANALYTICS
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#f7e8d4", lineHeight: 1.25, fontFamily: "Georgia, serif" }}>
          Your Progress<br /><span style={{ color: C.gold }}>Command Centre</span>
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[
            { label: "ACCURACY",  val: fmt(overallAcc),            color: C.gold    },
            { label: "CORRECT",   val: String(totalCorrect || "—"),  color: "#a0d4b0" },
            { label: "ATTEMPTED", val: String(totalAttempted || "—"),color: "#a0b8d4" },
            { label: "SESSIONS",  val: String(sessions.length || "—"),color: "#d4a8c8"},
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: "rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "8px 6px", textAlign: "center",
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color, fontFamily: "Georgia, serif", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 8, color: "#8a6a4a", marginTop: 3, letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trend sparkline */}
        {weeklyTrend.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9, color: "#8a6a4a", letterSpacing: "0.1em", marginBottom: 4 }}>RECENT SESSION TREND</div>
            <ResponsiveContainer width="100%" height={50}>
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.gold} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={C.gold} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="score" stroke={C.gold} strokeWidth={2} fill="url(#tg)" dot={false} />
                <Tooltip contentStyle={{ background: "#1a0f08", border: "none", borderRadius: 8, fontSize: 11 }}
                  itemStyle={{ color: C.gold }} labelStyle={{ color: "#a08060" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${C.border}`,
        background: C.card, padding: "0 16px",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        {(["subjects", "sessions"] as const).map(key => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            borderBottom: tab === key ? `2px solid ${C.terra}` : "2px solid transparent",
            color: tab === key ? C.terra : C.dim,
            fontWeight: tab === key ? 700 : 500,
            fontSize: 13, padding: "14px 0", transition: "all .15s",
          }}>
            {key === "subjects" ? "📚 Subjects" : "📋 Sessions"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: "16px 16px 80px" }}>

        {/* ══ SUBJECTS TAB ══ */}
        {tab === "subjects" && (
          <>
            {/* Subject mastery */}
            <div className="fa">
              <SL title="SUBJECT MASTERY" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {subjects.length === 0 ? (
                  <div style={{
                    background: C.card, border: `1px dashed ${C.border}`,
                    borderRadius: 14, padding: "28px 16px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📖</div>
                    <div style={{ color: C.muted, fontSize: 13 }}>No attempts yet.</div>
                    <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Complete a test to see scores here.</div>
                  </div>
                ) : subjects.sort((a, b) => safeNum(b.accuracy) - safeNum(a.accuracy)).map((s, i) => (
                  <SubjectCard key={i} name={s.name} correct={s.correct} total={s.total} accuracy={s.accuracy} />
                ))}
              </div>
            </div>

            {/* Weak area chips */}
            {Object.keys(grouped).length > 0 && (
              <div className="fa" style={{ marginTop: 24 }}>
                <SL title="WEAK AREAS" sub="Below 50% accuracy · grouped by subject" />
                {Object.entries(grouped).map(([grp, items]) => (
                  <div key={grp} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <div style={{ height: 1, width: 10, background: C.border }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: "nowrap" }}>{grp}</span>
                      <div style={{ height: 1, flex: 1, background: C.border }} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                      {items.map((w: any) => (
                        <Chip key={w.topic_id} tag={w.topic_id || ""} accuracy={safeAcc(w.accuracy)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Accuracy vs attempt */}
            {totalAttempted > 0 && (
              <div className="fa" style={{ marginTop: 24 }}>
                <SL title="STRATEGY SNAPSHOT" />
                <div style={{
                  background: C.card, border: `1px solid ${C.green}22`,
                  borderRadius: 14, padding: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Accuracy vs. Attempt Rate</div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Risk-reward of your guessing strategy</div>
                    </div>
                    <span style={{ fontSize: 18 }}>🎯</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                    {[
                      { label: "OVERALL ACCURACY", val: fmt(overallAcc), pct: overallAcc ?? 0, color: C.green  },
                      { label: "CORRECT / TOTAL",   val: `${totalCorrect}/${totalAttempted}`, pct: overallAcc ?? 0, color: C.indigo },
                    ].map(({ label, val, pct: p, color }) => (
                      <div key={label} style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.1em", fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "Georgia, serif", marginTop: 3 }}>{val}</div>
                        <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    marginTop: 12, background: `${C.indigo}08`,
                    border: `1px solid ${C.indigo}18`, borderRadius: 10,
                    padding: "9px 12px", fontSize: 11, color: C.muted, lineHeight: 1.65,
                  }}>
                    💡 With UPSC's −⅓ penalty, skip questions where your confidence is below ~33%.
                  </div>
                </div>
              </div>
            )}

            {/* Feynman Review */}
            <div className="fa" style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <SL title="FEYNMAN REVIEW" sub="AI Coach simplifies your weak topics" />
                <span style={{ background: `${C.indigo}0d`, color: C.indigo, border: `1px solid ${C.indigo}22`, borderRadius: 8, padding: "2px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>AI COACH</span>
              </div>

              {feynmanError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚠️</span> {feynmanError}
                </div>
              )}

              {!feynmanDone && !feynmanLoad && !showFeynman && (
                <button onClick={fetchFeynman} style={{ width: "100%", background: weakAreas.length ? `linear-gradient(135deg, ${C.dark}, ${C.darkMid})` : C.border, color: weakAreas.length ? C.gold : C.dim, border: "none", borderRadius: 12, padding: 15, fontSize: 14, fontWeight: 600, cursor: weakAreas.length ? "pointer" : "not-allowed" }}>
                  {weakAreas.length ? "✨ Generate Feynman Review" : "Keep practising to unlock your Feynman Review!"}
                </button>
              )}

              {showFeynman && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(44,26,14,0.08)" }}>
                  <div style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.darkMid})`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{feynmanDone ? "Your Feynman Review" : "⟳ AI Coach is thinking…"}</div>
                      <div style={{ fontSize: 10, color: "#a08060", marginTop: 2 }}>{feynmanDone ? "Simplified explanations for your weakest topics" : "Streaming live…"}</div>
                    </div>
                    <button onClick={() => { setShowFeynman(false); setFeynmanDone(false); setFeynmanText(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>

                  <div style={{ padding: 16, maxHeight: 480, overflowY: "auto" as const }}>
                    {feynmanText ? (
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                        {feynmanText.split(/(\*\*[^*]+\*\*)/).map((part: string, i: number) =>
                          part.startsWith("**") && part.endsWith("**")
                            ? <strong key={i} style={{ color: C.terra }}>{part.slice(2, -2)}</strong>
                            : <span key={i}>{part}</span>
                        )}
                        {!feynmanDone && <span style={{ display: "inline-block", width: 2, height: 14, background: C.terra, marginLeft: 2, verticalAlign: "middle", animation: "pulse 0.8s infinite" }} />}
                      </div>
                    ) : (
                      <div style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Thinking...</div>
                    )}
                  </div>

                  {feynmanDone && (
                    <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowFeynman(false); setFeynmanDone(false); setFeynmanText(""); }} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.muted, cursor: "pointer" }}>Close</button>
                      <button onClick={() => { setFeynmanDone(false); setFeynmanText(""); fetchFeynman(); }} style={{ flex: 1, background: `linear-gradient(135deg, ${C.dark}, ${C.darkMid})`, border: "none", borderRadius: 10, padding: 10, fontSize: 12, color: C.gold, fontWeight: 600, cursor: "pointer" }}>↺ Regenerate</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ SESSIONS TAB ══ */}
        {tab === "sessions" && (
          <div className="fa">
            <SL title="RECENT SESSIONS" />
            {sessions.length === 0 ? (
              <div style={{
                background: C.card, border: `1px dashed ${C.border}`,
                borderRadius: 14, padding: "32px 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ color: C.muted, fontSize: 13 }}>No sessions yet.</div>
                <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Complete a test to see history here.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...sessions].reverse().map((s: any, i: number) => (
                  <SessionCard key={s.session_id ?? i} s={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav /> 
    </div>
  );
}