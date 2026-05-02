"""
4-Model UPSC Question Audit Pipeline
=====================================
DeepSeek  → factual triage (cheap first pass)
Gemini    → factual accuracy + relevance 2026
GPT-4o    → difficulty calibration + distractor quality
Claude    → statement independence + explanation depth + final verdict

Run:
    python audit_pipeline.py              # audit all unaudited questions
    python audit_pipeline.py --reaudit   # re-audit everything
    python audit_pipeline.py --limit 50  # audit first 50 only
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
import argparse

import anthropic
from google import genai as genai_new
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── API clients ────────────────────────────────────────────────────────────────

_anthropic = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_openai    = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
_deepseek  = AsyncOpenAI(api_key=os.environ["DEEPSEEK_API_KEY"], base_url="https://api.deepseek.com")
gemini_client = genai_new.Client(api_key=os.environ["GEMINI_API_KEY"])


# ── Score dataclass ────────────────────────────────────────────────────────────

@dataclass
class AuditScore:
    # Per-dimension scores (1-5)
    factual_accuracy:       float = 0.0   # are TRUE/FALSE verdicts correct?
    relevance_2026:         float = 0.0   # likely to appear in UPSC 2026?
    difficulty:             float = 0.0   # 1=trivial, 3=prelims-level, 5=too obscure
    statement_independence: float = 0.0   # do statements test different facts?
    distractor_quality:     float = 0.0   # are wrong options genuinely tempting?
    explanation_depth:      float = 0.0   # is explanation substantive + sourced?

    # Weighted overall (computed)
    overall: float = 0.0

    # Verdict
    verdict: str = "PENDING"   # PASS / NEEDS_EDIT / REJECT

    # Actionable critique
    critique: str = ""

    # Metadata
    audited_by: list = field(default_factory=list)
    audited_at: str  = ""
    model_scores: dict = field(default_factory=dict)  # raw scores per model

    def compute_overall(self) -> None:
        weights = {
            "factual_accuracy":       0.30,
            "relevance_2026":         0.20,
            "difficulty":             0.20,
            "statement_independence": 0.10,
            "distractor_quality":     0.10,
            "explanation_depth":      0.10,
        }
        self.overall = round(sum(
            getattr(self, k) * w for k, w in weights.items()
        ), 2)

    def compute_verdict(self) -> None:
        if self.factual_accuracy <= 1.5:
            self.verdict = "REJECT"
        elif self.overall < 3.0 or self.factual_accuracy < 2.5:
            self.verdict = "REJECT"
        elif self.overall < 3.8 or self.difficulty < 2.0 or self.difficulty > 4.5:
            self.verdict = "NEEDS_EDIT"
        else:
            self.verdict = "PASS"


# ── Prompt builders ────────────────────────────────────────────────────────────

def _build_question_block(q: dict) -> str:
    options = q["options"] if isinstance(q["options"], list) else json.loads(q["options"])
    opts_text = "\n".join(f"  {chr(65+i)}) {o}" for i, o in enumerate(options))
    correct = chr(65 + q["correct_index"])
    expl = q["explanation"] if isinstance(q["explanation"], dict) else json.loads(q.get("explanation") or "{}")

    return f"""MCQ ID: {q['mcq_id']}
Subject: {q['subject']}
Topic: {q.get('topic_id', 'N/A')}

STEM:
{q['stem']}

OPTIONS:
{opts_text}

CORRECT ANSWER: {correct}

EXPLANATION:
- concept_anchor: {expl.get('concept_anchor', 'N/A')}
- statement_wise: {json.dumps(expl.get('statement_wise', {}), ensure_ascii=False)}
- common_trap: {expl.get('common_trap', 'N/A')}
- elimination_hint: {expl.get('elimination_hint', 'N/A')}"""


DEEPSEEK_PROMPT = """You are a UPSC Prelims expert examiner doing a quick triage audit.

Evaluate this question on TWO dimensions only. Be strict. Return ONLY valid JSON.

Scoring scale: 1=very poor, 2=poor, 3=acceptable, 4=good, 5=excellent

{question_block}

Return ONLY this JSON (no markdown, no explanation):
{{
  "factual_accuracy": <1-5>,
  "difficulty": <1-5>,
  "factual_issues": "<specific factual errors if any, else 'none'>",
  "difficulty_notes": "<why this difficulty score>"
}}

Difficulty guide: 1=GK trivia anyone knows, 2=easy, 3=ideal Prelims level, 4=hard but fair, 5=too obscure/specialised"""


GEMINI_PROMPT = """You are a senior UPSC subject matter expert and examiner with 15 years experience.

Evaluate this question on TWO dimensions. Be rigorous and cite specific sources when flagging errors.

Scoring scale: 1=very poor, 2=poor, 3=acceptable, 4=good, 5=excellent

{question_block}

Evaluate:
1. FACTUAL ACCURACY (1-5): Are all statement verdicts (TRUE/FALSE) verifiably correct per NCERT/PIB/official sources? Check every single statement.
2. RELEVANCE 2026 (1-5): How likely is this topic to appear in UPSC CSE Prelims 2026? Consider: recent policy changes, budget allocations, current affairs coverage, syllabus prominence.

Return ONLY valid JSON (no markdown fences):
{{
  "factual_accuracy": <1-5>,
  "relevance_2026": <1-5>,
  "factual_issues": "<cite specific errors with correct facts, or 'none'>",
  "relevance_notes": "<why this topic is/isn't relevant for 2026>"
}}"""


GPT4O_PROMPT = """You are an expert UPSC Prelims question designer who has analyzed 10,000+ actual UPSC questions.

Evaluate this question on TWO dimensions. Compare against actual UPSC Prelims question standards.

Scoring scale: 1=very poor, 2=poor, 3=acceptable, 4=good, 5=excellent

{question_block}

Evaluate:
1. DIFFICULTY (1-5): How does this compare to actual UPSC Prelims difficulty? 
   - 1: Too easy, any casual reader would know
   - 2: Below Prelims standard
   - 3: Perfect Prelims level — requires study but is fair
   - 4: Challenging but within Prelims scope
   - 5: Too obscure, even toppers would struggle

2. DISTRACTOR QUALITY (1-5): Are the WRONG options genuinely tempting?
   - Do they represent common misconceptions?
   - Would a moderately prepared student be confused?
   - Are they clearly wrong or subtly wrong?

Return ONLY valid JSON (no markdown fences):
{{
  "difficulty": <1-5>,
  "distractor_quality": <1-5>,
  "difficulty_notes": "<specific comparison to UPSC Prelims standard>",
  "distractor_notes": "<what makes the distractors good/bad>"
}}"""


CLAUDE_PROMPT = """You are a UPSC Prelims question quality auditor specialising in structural analysis.

Evaluate this question on THREE dimensions and write a final synthesis critique.

Scoring scale: 1=very poor, 2=poor, 3=acceptable, 4=good, 5=excellent

{question_block}

Evaluate:
1. STATEMENT INDEPENDENCE (1-5): Do the statements test genuinely different facts?
   - 5: Each statement tests a completely independent fact
   - 3: Some overlap but acceptable
   - 1: Statements are variations of the same fact

2. EXPLANATION DEPTH (1-5): Is the explanation substantive and useful?
   - 5: concept_anchor cites real source, statement_wise gives precise verdicts, common_trap is a real student misconception
   - 3: Explanation is adequate but generic
   - 1: Explanation is vague, unsourced, or incorrect

3. OVERALL SYNTHESIS: Write 2-3 sentences of specific, actionable critique. What exactly needs fixing?

Return ONLY valid JSON (no markdown fences):
{{
  "statement_independence": <1-5>,
  "explanation_depth": <1-5>,
  "critique": "<2-3 sentences of specific actionable feedback>"
}}"""


# ── Model callers ──────────────────────────────────────────────────────────────

async def call_deepseek(question_block: str) -> dict:
    prompt = DEEPSEEK_PROMPT.format(question_block=question_block)
    resp = await _deepseek.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.1,
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


async def call_gemini(question_block: str) -> dict:
    prompt = GEMINI_PROMPT.format(question_block=question_block)
    resp = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
    )
    raw = resp.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


async def call_gpt4o(question_block: str) -> dict:
    prompt = GPT4O_PROMPT.format(question_block=question_block)
    resp = await _openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content.strip()
    return json.loads(raw)


async def call_claude(question_block: str) -> dict:
    prompt = CLAUDE_PROMPT.format(question_block=question_block)
    resp = await _anthropic.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


# ── Single question auditor ────────────────────────────────────────────────────

async def audit_one(q: dict) -> AuditScore:
    """Run all 4 models on a single question and synthesize scores."""
    question_block = _build_question_block(q)
    score = AuditScore(audited_at=datetime.now(timezone.utc).isoformat())

    # Run all 4 models concurrently
    results = await asyncio.gather(
        call_deepseek(question_block),
        call_gemini(question_block),
        call_gpt4o(question_block),
        call_claude(question_block),
        return_exceptions=True,
    )

    ds_result, gem_result, gpt_result, claude_result = results
    score.model_scores = {}

    # ── DeepSeek: factual_accuracy + difficulty (triage) ──
    if isinstance(ds_result, dict):
        score.model_scores["deepseek"] = ds_result
        score.audited_by.append("deepseek")
    else:
        logger.warning("DeepSeek failed for %s: %s", q["mcq_id"], ds_result)
        ds_result = {}

    # ── Gemini: factual_accuracy + relevance_2026 ──
    if isinstance(gem_result, dict):
        score.model_scores["gemini"] = gem_result
        score.audited_by.append("gemini")
    else:
        logger.warning("Gemini failed for %s: %s", q["mcq_id"], gem_result)
        gem_result = {}

    # ── GPT-4o: difficulty + distractor_quality ──
    if isinstance(gpt_result, dict):
        score.model_scores["gpt4o"] = gpt_result
        score.audited_by.append("gpt4o")
    else:
        logger.warning("GPT-4o failed for %s: %s", q["mcq_id"], gpt_result)
        gpt_result = {}

    # ── Claude: statement_independence + explanation_depth + critique ──
    if isinstance(claude_result, dict):
        score.model_scores["claude"] = claude_result
        score.audited_by.append("claude")
    else:
        logger.warning("Claude failed for %s: %s", q["mcq_id"], claude_result)
        claude_result = {}

    # ── Synthesize scores ──────────────────────────────────────────────────────

    # factual_accuracy: average of DeepSeek + Gemini (both assess this)
    fa_scores = [
        s for s in [
            ds_result.get("factual_accuracy"),
            gem_result.get("factual_accuracy"),
        ] if s is not None
    ]
    score.factual_accuracy = round(sum(fa_scores) / len(fa_scores), 2) if fa_scores else 3.0

    # relevance_2026: Gemini only
    score.relevance_2026 = float(gem_result.get("relevance_2026", 3.0))

    # difficulty: average of DeepSeek + GPT-4o
    diff_scores = [
        s for s in [
            ds_result.get("difficulty"),
            gpt_result.get("difficulty"),
        ] if s is not None
    ]
    score.difficulty = round(sum(diff_scores) / len(diff_scores), 2) if diff_scores else 3.0

    # distractor_quality: GPT-4o only
    score.distractor_quality = float(gpt_result.get("distractor_quality", 3.0))

    # statement_independence: Claude only
    score.statement_independence = float(claude_result.get("statement_independence", 3.0))

    # explanation_depth: Claude only
    score.explanation_depth = float(claude_result.get("explanation_depth", 3.0))

    # critique: Claude's synthesis + any factual issues flagged
    critique_parts = []
    if claude_result.get("critique"):
        critique_parts.append(claude_result["critique"])
    if gem_result.get("factual_issues") and gem_result["factual_issues"].lower() != "none":
        critique_parts.append(f"Gemini flagged: {gem_result['factual_issues']}")
    if ds_result.get("factual_issues") and ds_result["factual_issues"].lower() != "none":
        critique_parts.append(f"DeepSeek flagged: {ds_result['factual_issues']}")
    score.critique = " | ".join(critique_parts) if critique_parts else "No issues flagged."

    # Compute weighted overall and verdict
    score.compute_overall()
    score.compute_verdict()

    return score


# ── Batch auditor ──────────────────────────────────────────────────────────────

BATCH_CONCURRENCY = 3   # conservative — 4 API calls per question

async def audit_batch(
    questions: list[dict],
    db_write_fn,
    *,
    start_time: float,
) -> tuple[int, int, list[str]]:
    """Audit a list of questions with bounded concurrency. Returns (passed, failed, failed_ids)."""
    semaphore = asyncio.Semaphore(BATCH_CONCURRENCY)
    total = len(questions)
    done = 0
    passed = 0
    failed_ids = []
    lock = asyncio.Lock()

    async def _one(q: dict) -> None:
        nonlocal done, passed
        async with semaphore:
            try:
                score = await audit_one(q)
                db_write_fn(q["mcq_id"], score)
                async with lock:
                    done += 1
                    if score.verdict == "PASS":
                        passed += 1
                    elapsed = time.time() - start_time
                    rate = done / elapsed
                    eta = (total - done) / rate if rate > 0 else 0
                    print(
                        f"  {done}/{total} | {score.verdict:10s} | "
                        f"overall={score.overall:.1f} | "
                        f"{rate:.1f} q/s | ETA {eta/60:.1f}m | {q['mcq_id']}",
                        flush=True,
                    )
            except Exception as exc:
                async with lock:
                    done += 1
                    failed_ids.append(q["mcq_id"])
                    logger.error("Audit failed for %s: %s", q["mcq_id"], exc)

    await asyncio.gather(*[_one(q) for q in questions])
    return passed, len(failed_ids), failed_ids


# ── DB helpers ─────────────────────────────────────────────────────────────────

def fetch_questions(db, *, reaudit: bool = False, limit: Optional[int] = None) -> list[dict]:
    from sqlalchemy import text
    cond = "" if reaudit else "WHERE audit IS NULL"
    lim  = f"LIMIT {limit}" if limit else ""
    rows = db.execute(text(f"""
        SELECT mcq_id, subject, topic_id, stem, options, correct_index, explanation
        FROM mcq_bank
        {cond}
        ORDER BY subject, mcq_id
        {lim}
    """)).fetchall()

    result = []
    for r in rows:
        result.append({
            "mcq_id":        r.mcq_id,
            "subject":       r.subject,
            "topic_id":      r.topic_id,
            "stem":          r.stem,
            "options":       r.options if isinstance(r.options, list) else json.loads(r.options or "[]"),
            "correct_index": r.correct_index,
            "explanation":   r.explanation if isinstance(r.explanation, dict) else json.loads(r.explanation or "{}"),
        })
    return result


def make_db_writer(db):
    from sqlalchemy import text

    def write(mcq_id: str, score: AuditScore) -> None:
        data = asdict(score)
        db.execute(
            text("UPDATE mcq_bank SET audit = :audit WHERE mcq_id = :mcq_id"),
            {"audit": json.dumps(data), "mcq_id": mcq_id},
        )
        db.commit()

    return write


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reaudit", action="store_true", help="Re-audit already audited questions")
    parser.add_argument("--limit",   type=int, default=None, help="Only audit first N questions")
    args = parser.parse_args()

    from app.db.database import SessionLocal
    db = SessionLocal()

    try:
        questions = fetch_questions(db, reaudit=args.reaudit, limit=args.limit)
        print(f"\nQuestions to audit: {len(questions)}")
        if not questions:
            print("✅ All questions already audited. Use --reaudit to re-run.")
            return

        start = time.time()
        db_write = make_db_writer(db)

        passed, failed, failed_ids = await audit_batch(questions, db_write, start_time=start)

        elapsed = time.time() - start
        total = len(questions)

        print(f"\n{'='*65}")
        print(f"AUDIT COMPLETE")
        print(f"  Total audited : {total}")
        print(f"  PASS          : {passed}")
        print(f"  NEEDS_EDIT    : {total - passed - failed}")
        print(f"  REJECT        : see DB filter audit->>'verdict' = 'REJECT'")
        print(f"  Errors        : {failed}")
        print(f"  Time          : {elapsed/60:.1f} minutes")
        if failed_ids:
            with open("audit_failed.txt", "w") as f:
                f.write("\n".join(failed_ids))
            print(f"  Failed IDs    : saved to audit_failed.txt")
        print(f"{'='*65}\n")

        # Quick summary by verdict
        from sqlalchemy import text
        summary = db.execute(text("""
            SELECT audit->>'verdict' as verdict, COUNT(*) as cnt
            FROM mcq_bank WHERE audit IS NOT NULL
            GROUP BY verdict ORDER BY verdict
        """)).fetchall()
        print("Current bank status:")
        for r in summary:
            print(f"  {r.verdict:12s}: {r.cnt}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())