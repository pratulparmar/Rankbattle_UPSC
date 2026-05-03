"""
verify_cat1.py
==============
Before committing cat1 fixes, verifies that correct_index
matches the statement_wise TRUE/FALSE verdicts in explanation.

Flags any question where they disagree.

Run:
  python verify_cat1.py
"""

import json
import psycopg2
from app.core.config import settings

FORMAT_A = ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"]

# What each correct_index means in terms of statement verdicts
# index 0 → "1 only"        → stmt1=TRUE,  stmt2=FALSE
# index 1 → "2 only"        → stmt1=FALSE, stmt2=TRUE
# index 2 → "Both 1 and 2"  → stmt1=TRUE,  stmt2=TRUE
# index 3 → "Neither 1 nor 2"→ stmt1=FALSE, stmt2=FALSE

EXPECTED_VERDICTS = {
    0: {"1": True,  "2": False},
    1: {"1": False, "2": True},
    2: {"1": True,  "2": True},
    3: {"1": False, "2": False},
}


def parse_verdict(text: str) -> bool | None:
    """
    Parse TRUE/FALSE from a statement_wise verdict string.
    Returns True, False, or None if unparseable.
    """
    t = text.strip().upper()
    if t.startswith("TRUE"):
        return True
    if t.startswith("FALSE"):
        return False
    # Handle "CORRECT" / "INCORRECT" variants
    if t.startswith("CORRECT"):
        return True
    if t.startswith("INCORRECT"):
        return False
    return None


def main():
    with open("cat1_autofix.json") as f:
        data = json.load(f)

    questions = data["questions"]
    print(f"Verifying {len(questions)} Cat1 questions...\n")

    conn = psycopg2.connect(settings.DATABASE_URL)
    cur = conn.cursor()

    # Fetch full explanation for all cat1 mcq_ids
    mcq_ids = [q["mcq_id"] for q in questions]
    cur.execute("""
        SELECT mcq_id, options, correct_index, explanation
        FROM mcq_bank
        WHERE mcq_id = ANY(%s)
    """, (mcq_ids,))

    db_rows = {row[0]: row for row in cur.fetchall()}
    cur.close()
    conn.close()

    ok        = []
    mismatch  = []
    no_expl   = []
    unparseable = []

    for q in questions:
        mcq_id        = q["mcq_id"]
        correct_index = q["correct_index_unchanged"]
        new_correct   = FORMAT_A[correct_index]

        row = db_rows.get(mcq_id)
        if not row:
            no_expl.append({"mcq_id": mcq_id, "reason": "Not found in DB"})
            continue

        _, _, _, explanation = row

        # Parse explanation
        if not explanation:
            no_expl.append({"mcq_id": mcq_id, "reason": "No explanation in DB"})
            continue

        if isinstance(explanation, str):
            explanation = json.loads(explanation)

        statement_wise = explanation.get("statement_wise", {})
        if not statement_wise:
            no_expl.append({"mcq_id": mcq_id, "reason": "Empty statement_wise"})
            continue

        # Get expected verdicts for this correct_index
        expected = EXPECTED_VERDICTS.get(correct_index)
        if not expected:
            mismatch.append({
                "mcq_id":        mcq_id,
                "correct_index": correct_index,
                "new_correct":   new_correct,
                "reason":        f"correct_index {correct_index} out of range 0-3",
            })
            continue

        # Cross-check each statement verdict
        conflicts = []
        for stmt_num, expected_true in expected.items():
            verdict_text = statement_wise.get(stmt_num, "")
            if not verdict_text:
                continue
            parsed = parse_verdict(verdict_text)
            if parsed is None:
                unparseable.append({
                    "mcq_id":       mcq_id,
                    "stmt":         stmt_num,
                    "verdict_text": verdict_text[:80],
                })
                continue
            if parsed != expected_true:
                conflicts.append({
                    "stmt":          stmt_num,
                    "expected":      expected_true,
                    "got":           parsed,
                    "verdict_text":  verdict_text[:80],
                })

        if conflicts:
            mismatch.append({
                "mcq_id":        mcq_id,
                "subject":       q["subject"],
                "topic_id":      q["topic_id"],
                "old_options":   q["options"],
                "new_options":   FORMAT_A,
                "correct_index": correct_index,
                "new_correct":   new_correct,
                "conflicts":     conflicts,
                "stem_preview":  q["stem_preview"],
            })
        else:
            ok.append(mcq_id)

    # ── Report ──────────────────────────────────────────────────────────────────
    print("── Verification Results ──────────────────────────────────────────")
    print(f"✅ Clean (safe to commit):         {len(ok)}")
    print(f"❌ Mismatch (need manual review):  {len(mismatch)}")
    print(f"⚠️  No/empty explanation:           {len(no_expl)}")
    print(f"⚠️  Unparseable verdict:            {len(unparseable)}")

    if mismatch:
        print("\n── Mismatched Questions ──────────────────────────────────────────")
        for q in mismatch:
            print(f"\n  [{q['mcq_id']}] {q['subject']} / {q['topic_id']}")
            print(f"  Stem:        {q['stem_preview']}...")
            print(f"  Old options: {q['old_options']}")
            print(f"  New correct: index {q['correct_index']} → '{q['new_correct']}'")
            for c in q["conflicts"]:
                expected_str = "TRUE" if c["expected"] else "FALSE"
                got_str      = "TRUE" if c["got"] else "FALSE"
                print(f"  ⚠️  Statement {c['stmt']}: expected {expected_str}, explanation says {got_str}")
                print(f"      Verdict: {c['verdict_text']}")

    if unparseable:
        print("\n── Unparseable Verdicts (manual check needed) ────────────────────")
        for u in unparseable:
            print(f"  [{u['mcq_id']}] stmt {u['stmt']}: {u['verdict_text']}")

    # ── Save results ────────────────────────────────────────────────────────────
    results = {
        "clean_count":       len(ok),
        "mismatch_count":    len(mismatch),
        "no_expl_count":     len(no_expl),
        "unparseable_count": len(unparseable),
        "clean_ids":         ok,
        "mismatches":        mismatch,
        "no_explanation":    no_expl,
        "unparseable":       unparseable,
    }

    with open("cat1_verification.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n✅ Full results saved to cat1_verification.json")

    # ── Recommendation ──────────────────────────────────────────────────────────
    print("\n── Recommendation ────────────────────────────────────────────────")
    if not mismatch:
        print("✅ All clean — safe to run: python fix_cat1.py --commit")
    else:
        print(f"⚠️  {len(mismatch)} questions need review before committing.")
        print("   Check cat1_verification.json for full details.")
        print("   These will be moved to Cat2 for Gemini+Claude pipeline.")


if __name__ == "__main__":
    main()