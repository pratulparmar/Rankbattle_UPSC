"""
fix_cat1.py
===========
Commits only the 93 verified clean Cat1 questions to DB.
Skips the 83 mismatches (those go to Cat2 pipeline).

Run:
  python fix_cat1.py            ← dry run
  python fix_cat1.py --commit   ← writes to DB
"""

import json
import sys
import psycopg2
from app.core.config import settings

DRY_RUN = "--commit" not in sys.argv

FORMAT_A = ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"]


def main():
    with open("cat1_autofix.json") as f:
        data = json.load(f)

    with open("cat1_verification.json") as f:
        verification = json.load(f)

    # Only process verified clean questions — skip mismatches
    clean_ids = set(verification["clean_ids"])
    questions = [q for q in data["questions"] if q["mcq_id"] in clean_ids]

    print(f"Total Cat1:               {len(data['questions'])}")
    print(f"Verified clean (to fix):  {len(questions)}")
    print(f"Mismatches (skipped):     {len(data['questions']) - len(questions)}")
    print(f"Mode: {'DRY RUN — no DB writes' if DRY_RUN else '⚠️  COMMIT — writing to DB'}\n")

    conn = psycopg2.connect(settings.DATABASE_URL)
    cur = conn.cursor()

    fixed = 0
    errors = []

    for q in questions:
        mcq_id        = q["mcq_id"]
        old_options   = q["options"]
        new_options   = FORMAT_A
        correct_index = q["correct_index_unchanged"]
        new_correct   = FORMAT_A[correct_index]

        print(f"[{mcq_id}]")
        print(f"  Before: {old_options}")
        print(f"  After:  {new_options}")
        print(f"  Correct index {correct_index} → '{new_correct}'")

        if not DRY_RUN:
            try:
                cur.execute("""
                    UPDATE mcq_bank
                    SET options = %s::jsonb
                    WHERE mcq_id = %s
                """, (json.dumps(new_options), mcq_id))
                fixed += 1
            except Exception as e:
                errors.append({"mcq_id": mcq_id, "error": str(e)})
                print(f"  ❌ Error: {e}")
                continue

        print()

    if not DRY_RUN:
        if errors:
            print(f"\n⚠️  {len(errors)} errors — rolling back")
            conn.rollback()
            with open("cat1_errors.json", "w") as f:
                json.dump(errors, f, indent=2)
            print("❌ Errors saved to cat1_errors.json")
        else:
            conn.commit()
            print(f"\n✅ Committed {fixed} updates to DB")
    else:
        print(f"\nDry run complete — {len(questions)} questions would be updated")
        print("Run with --commit to apply changes")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()