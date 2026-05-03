"""
fix_cat2_pipeline.py
====================
Fixes 129 Cat2 questions using a two-model pipeline:

  Step A — Gemini 2.5 Flash
    Reads full stem + statements from DB
    Verifies each statement as TRUE or FALSE with reason
    This is the fact-checking layer — Claude cannot contradict these verdicts

  Step B — Claude claude-sonnet-4-6
    Receives Gemini's locked verdicts as hard constraints
    Rewrites options to exact Format A
    Rewrites full explanation to match verdicts
    Cannot invent new facts

  Step C — DB write
    Updates options, correct_index, explanation in mcq_bank

Run:
  python fix_cat2_pipeline.py           ← dry run (no DB writes)
  python fix_cat2_pipeline.py --commit  ← writes to DB
  python fix_cat2_pipeline.py --limit 10  ← test on first 10 questions
"""

import json
import os
import sys
import time
import re
import psycopg2
import anthropic
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.core.config import settings

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────

DRY_RUN  = "--commit" not in sys.argv
LIMIT    = None
for arg in sys.argv:
    if arg.startswith("--limit="):
        LIMIT = int(arg.split("=")[1])

GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

FORMAT_A = ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"]

VERDICT_TO_INDEX = {
    (True,  False): 0,  # 1 only
    (False, True):  1,  # 2 only
    (True,  True):  2,  # Both 1 and 2
    (False, False): 3,  # Neither 1 nor 2
}

# Delay between questions to avoid rate limits
GEMINI_DELAY_SEC  = 8
CLAUDE_DELAY_SEC  = 1


# ── DB helpers ─────────────────────────────────────────────────────────────────

def fetch_full_questions(mcq_ids: list, conn) -> dict:
    """Fetch full stem, options, explanation from DB for given mcq_ids."""
    cur = conn.cursor()
    cur.execute("""
        SELECT mcq_id, stem, options, correct_index, subject, topic_id, explanation
        FROM mcq_bank
        WHERE mcq_id = ANY(%s)
    """, (mcq_ids,))
    rows = cur.fetchall()
    cur.close()
    return {
        row[0]: {
            "mcq_id":        row[0],
            "stem":          row[1],
            "options":       row[2] if isinstance(row[2], list) else json.loads(row[2] or "[]"),
            "correct_index": row[3],
            "subject":       row[4],
            "topic_id":      row[5],
            "explanation":   row[6] if isinstance(row[6], dict) else json.loads(row[6] or "{}"),
        }
        for row in rows
    }


def extract_statements(stem: str) -> list[str]:
    """
    Pull numbered statements out of the stem.
    Returns list of statement strings without the leading number.
    """
    pattern = re.compile(r"^\s*\d+[\.\)]\s*(.+?)(?=\s*\d+[\.\)]|\s*$)", re.MULTILINE | re.DOTALL)
    matches = pattern.findall(stem)
    # Fallback: split on newlines if pattern fails
    if len(matches) < 2:
        lines = [l.strip() for l in stem.split("\n") if l.strip()]
        matches = [re.sub(r"^\d+[\.\)]\s*", "", l) for l in lines if re.match(r"^\d+", l)]
    return [m.strip() for m in matches if m.strip()]


# ── Step A — Gemini fact-checker ───────────────────────────────────────────────

GEMINI_SYSTEM = """You are a UPSC fact-checking expert. 
Your job is to verify statements about Indian polity, economy, history, geography, 
environment, and science & technology.

For each statement given, respond with ONLY a JSON object.
No preamble, no markdown, no explanation outside the JSON.

Format:
{
  "statement_1": {
    "verdict": true,
    "reason": "one sentence factual justification with source"
  },
  "statement_2": {
    "verdict": false,
    "reason": "one sentence factual justification with source"
  }
}

Rules:
- verdict must be boolean true or false
- reason must be a single sentence with a concrete factual basis
- Do NOT hedge — give a definitive verdict
- Base verdicts on verified facts only, not assumptions
"""


def gemini_verify_statements(
    statements: list[str],
    subject: str,
    topic_id: str,
    client
) -> dict | None:
    """
    Call Gemini to verify each statement.
    Returns dict with statement_1, statement_2 verdicts or None on failure.
    """
    stmt_text = "\n".join(f"Statement {i+1}: {s}" for i, s in enumerate(statements))
    prompt = f"""Subject: {subject} ({topic_id})

{stmt_text}

Verify each statement as true or false. Return ONLY JSON."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=GEMINI_SYSTEM,
                temperature=0,
            ),
            contents=prompt,
        )
        raw = response.text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        return json.loads(raw)

    except json.JSONDecodeError as e:
        print(f"    ⚠️  Gemini JSON parse failed: {e}")
        return None
    except Exception as e:
        print(f"    ⚠️  Gemini API error: {e}")
        return None


# ── Step B — Claude rewriter ───────────────────────────────────────────────────

CLAUDE_SYSTEM = """You are a UPSC question formatter. 
You receive a question with LOCKED statement verdicts from a fact-checker.
You must NOT change or contradict the verdicts.

Your job:
1. Set correct_index based on the verdicts
2. Rewrite options to exact Format A
3. Rewrite the explanation to match the verdicts precisely

Format A for 2-statement questions (MANDATORY — no deviation):
  index 0 → "1 only"          (statement 1 TRUE,  statement 2 FALSE)
  index 1 → "2 only"          (statement 1 FALSE, statement 2 TRUE)
  index 2 → "Both 1 and 2"    (statement 1 TRUE,  statement 2 TRUE)
  index 3 → "Neither 1 nor 2" (statement 1 FALSE, statement 2 FALSE)

Output ONLY valid JSON. No markdown. No preamble.

Output format:
{
  "correct_index": 0,
  "options": ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],
  "explanation": {
    "concept_anchor": "1-2 sentence factual hook from NCERT/PIB",
    "statement_wise": {
      "1": "TRUE — one sentence reason",
      "2": "FALSE — one sentence reason"
    },
    "why_others_wrong": "why each of the 3 wrong options fails",
    "common_trap": "the specific misconception students fall for",
    "elimination_hint": "fastest logical path to the correct option"
  }
}"""


def claude_rewrite(
    statements: list[str],
    subject: str,
    topic_id: str,
    gemini_verdicts: dict,
    original_explanation: dict,
    client: anthropic.Anthropic
) -> dict | None:
    """
    Call Claude to rewrite options + explanation using Gemini's locked verdicts.
    Returns dict with correct_index, options, explanation or None on failure.
    """
    stmt1_verdict = gemini_verdicts.get("statement_1", {})
    stmt2_verdict = gemini_verdicts.get("statement_2", {})

    v1 = stmt1_verdict.get("verdict")
    v2 = stmt2_verdict.get("verdict")
    r1 = stmt1_verdict.get("reason", "")
    r2 = stmt2_verdict.get("reason", "")

    stmt_text = "\n".join(f"Statement {i+1}: {s}" for i, s in enumerate(statements))

    user_msg = f"""Subject: {subject} ({topic_id})

{stmt_text}

LOCKED VERDICTS FROM FACT-CHECKER (do not contradict):
  Statement 1: {'TRUE' if v1 else 'FALSE'} — {r1}
  Statement 2: {'TRUE' if v2 else 'FALSE'} — {r2}

Original explanation context (use as reference only, rewrite to match verdicts):
  concept_anchor: {original_explanation.get('concept_anchor', 'N/A')}

Rewrite the question with correct Format A options and matching explanation.
Output ONLY JSON."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=CLAUDE_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(raw)

        # Hard-enforce correct_index from Gemini verdicts
        # Claude's correct_index must match Gemini — override if different
        expected_index = VERDICT_TO_INDEX.get((bool(v1), bool(v2)))
        if expected_index is not None and result.get("correct_index") != expected_index:
            print(f"    ⚠️  Claude correct_index {result.get('correct_index')} overridden to {expected_index} (Gemini verdict)")
            result["correct_index"] = expected_index

        # Always enforce exact Format A options
        result["options"] = FORMAT_A

        return result

    except json.JSONDecodeError as e:
        print(f"    ⚠️  Claude JSON parse failed: {e}")
        return None
    except Exception as e:
        print(f"    ⚠️  Claude API error: {e}")
        return None


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # Load questions
    with open("cat2_retry.json") as f:
        data = json.load(f)

    questions = data["questions"]
    if LIMIT:
        questions = questions[:LIMIT]

    print(f"Cat2 questions to process: {len(questions)}")
    print(f"Mode: {'DRY RUN' if DRY_RUN else '⚠️  COMMIT — writing to DB'}")
    if LIMIT:
        print(f"Limit: first {LIMIT} questions only")
    print()

    # Init clients
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

    claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Fetch full questions from DB
    conn = psycopg2.connect(settings.DATABASE_URL)
    mcq_ids = [q["mcq_id"] for q in questions]
    db_rows = fetch_full_questions(mcq_ids, conn)
    print(f"Fetched {len(db_rows)} full questions from DB\n")

    # Process
    results  = []
    failed   = []
    cur = conn.cursor()

    for i, q in enumerate(questions, 1):
        mcq_id  = q["mcq_id"]
        db_row  = db_rows.get(mcq_id)

        if not db_row:
            print(f"[{i}/{len(questions)}] {mcq_id} — ❌ Not found in DB, skipping")
            failed.append({"mcq_id": mcq_id, "reason": "Not found in DB"})
            continue

        subject  = db_row["subject"]
        topic_id = db_row["topic_id"]
        stem     = db_row["stem"]
        expl     = db_row["explanation"] or {}

        print(f"[{i}/{len(questions)}] {mcq_id} ({subject})")

        # Extract statements from full stem
        statements = extract_statements(stem)
        if len(statements) < 2:
            print(f"    ❌ Could not extract 2 statements, skipping")
            failed.append({"mcq_id": mcq_id, "reason": "Could not extract statements"})
            continue

        print(f"    Stmt1: {statements[0][:60]}...")
        print(f"    Stmt2: {statements[1][:60]}...")

        # ── Step A: Gemini verification ────────────────────────────────────────
        print(f"    🔍 Gemini verifying...")
        time.sleep(GEMINI_DELAY_SEC)

        verdicts = gemini_verify_statements(statements, subject, topic_id, gemini_client)
        if not verdicts:
            print(f"    ❌ Gemini failed, skipping")
            failed.append({"mcq_id": mcq_id, "reason": "Gemini verification failed"})
            continue

        v1 = verdicts.get("statement_1", {}).get("verdict")
        v2 = verdicts.get("statement_2", {}).get("verdict")
        print(f"    ✓ Gemini: stmt1={'TRUE' if v1 else 'FALSE'}, stmt2={'TRUE' if v2 else 'FALSE'}")

        # ── Step B: Claude rewrite ─────────────────────────────────────────────
        print(f"    ✏️  Claude rewriting...")
        time.sleep(CLAUDE_DELAY_SEC)

        rewrite = claude_rewrite(
            statements, subject, topic_id,
            verdicts, expl, claude_client
        )
        if not rewrite:
            print(f"    ❌ Claude failed, skipping")
            failed.append({"mcq_id": mcq_id, "reason": "Claude rewrite failed"})
            continue

        new_correct_index = rewrite["correct_index"]
        new_options       = rewrite["options"]
        new_explanation   = rewrite["explanation"]
        new_correct_label = FORMAT_A[new_correct_index]

        print(f"    ✓ Claude: correct_index={new_correct_index} → '{new_correct_label}'")
        print(f"    Options: {new_options}")

        result_entry = {
            "mcq_id":        mcq_id,
            "subject":       subject,
            "old_options":   db_row["options"],
            "old_correct":   db_row["correct_index"],
            "new_options":   new_options,
            "new_correct":   new_correct_index,
            "new_explanation": new_explanation,
        }
        results.append(result_entry)

        # ── Step C: DB write ───────────────────────────────────────────────────
        if not DRY_RUN:
            try:
                cur.execute("""
                    UPDATE mcq_bank
                    SET options      = %s::jsonb,
                        correct_index = %s,
                        explanation  = %s::jsonb
                    WHERE mcq_id = %s
                """, (
                    json.dumps(new_options),
                    new_correct_index,
                    json.dumps(new_explanation),
                    mcq_id,
                ))
                print(f"    ✅ Written to DB")
            except Exception as e:
                print(f"    ❌ DB write failed: {e}")
                failed.append({"mcq_id": mcq_id, "reason": f"DB write failed: {e}"})
                conn.rollback()
                continue

        print()

    # ── Commit + save results ──────────────────────────────────────────────────
    if not DRY_RUN and results:
        conn.commit()
        print(f"\n✅ Committed {len(results)} questions to DB")

    cur.close()
    conn.close()

    # Save full results log
    output = {
        "processed":  len(results),
        "failed":     len(failed),
        "dry_run":    DRY_RUN,
        "results":    results,
        "failures":   failed,
    }
    with open("cat2_results.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"✅ Processed: {len(results)}")
    print(f"❌ Failed:    {len(failed)}")
    print(f"📄 Full log:  cat2_results.json")

    if failed:
        print("\nFailed questions:")
        for f in failed:
            print(f"  {f['mcq_id']}: {f['reason']}")


if __name__ == "__main__":
    main()