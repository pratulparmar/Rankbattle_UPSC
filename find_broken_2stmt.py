"""
find_broken_2stmt.py
====================
Finds all 2-statement PASS questions in mcq_bank
that do NOT use Format A options:
  '1 only' | '2 only' | 'Both 1 and 2' | 'Neither 1 nor 2'

Run from repo root:
  python find_broken_2stmt.py

Outputs:
  - Total 2-statement PASS questions
  - Count of broken ones
  - Preview of each broken question
  - Saves mcq_ids to broken_2stmt.json for Step 3
"""

import json
import os
import re
import psycopg2
from dotenv import load_dotenv
from app.core.config import settings

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────

DATABASE_URL = settings.DATABASE_URL

FORMAT_A = {"1 only", "2 only", "both 1 and 2", "neither 1 nor 2"}

# Regex to count numbered statements in stem
STATEMENT_PATTERN = re.compile(
    r"^\s*\d+[\.\)]\s+\S",   # lines starting with "1. " or "1) "
    re.MULTILINE
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def count_statements(stem: str) -> int:
    """Count how many numbered statements are in the stem."""
    return len(STATEMENT_PATTERN.findall(stem))


def is_format_a(options: list) -> bool:
    """Check if options exactly match Format A (case-insensitive)."""
    actual = {o.strip().lower() for o in options}
    return actual == FORMAT_A


def is_broken(options: list) -> bool:
    """A 2-statement question is broken if options are NOT Format A."""
    return not is_format_a(options)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("Querying PASS questions from mcq_bank...\n")

    cur.execute("""
        SELECT mcq_id, stem, options, correct_index, subject, topic_id
        FROM mcq_bank
        WHERE verification_passed = true
          AND audit->>'verdict' = 'PASS'
        ORDER BY subject, mcq_id
    """)

    rows = cur.fetchall()
    print(f"Total PASS questions: {len(rows)}")

    two_stmt_total = 0
    broken = []

    for mcq_id, stem, options, correct_index, subject, topic_id in rows:
        # Parse options from JSONB (psycopg2 returns list directly)
        if isinstance(options, str):
            options = json.loads(options)

        n = count_statements(stem)

        if n != 2:
            continue

        two_stmt_total += 1

        if is_broken(options):
            broken.append({
                "mcq_id":        mcq_id,
                "subject":       subject,
                "topic_id":      topic_id,
                "stem_preview":  stem[:120].replace("\n", " "),
                "options":       options,
                "correct_index": correct_index,
            })

    cur.close()
    conn.close()

    # ── Report ─────────────────────────────────────────────────────────────────
    print(f"2-statement questions (PASS): {two_stmt_total}")
    print(f"Broken (wrong option format): {len(broken)}")
    print(f"Already correct (Format A):   {two_stmt_total - len(broken)}")

    if not broken:
        print("\n✅ No broken questions found.")
        return

    print("\n── Broken Questions Preview ──────────────────────────────────────")
    for i, q in enumerate(broken, 1):
        print(f"\n[{i}] mcq_id: {q['mcq_id']}")
        print(f"    Subject:  {q['subject']} / {q['topic_id']}")
        print(f"    Stem:     {q['stem_preview']}...")
        print(f"    Options:  {q['options']}")
        print(f"    Correct:  index {q['correct_index']} → '{q['options'][q['correct_index']]}'")

    # ── Save for Step 3 ────────────────────────────────────────────────────────
    output = {
        "total_pass":       len(rows),
        "two_stmt_total":   two_stmt_total,
        "broken_count":     len(broken),
        "broken_questions": broken,
    }

    with open("broken_2stmt.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Saved to broken_2stmt.json — ready for Step 3")


if __name__ == "__main__":
    main()