"""
merge_cat2.py
=============
Merges the 83 Cat1 mismatches into cat2_needs_api.json
so the Gemini + Claude pipeline handles all 129 questions.

Run:
  python merge_cat2.py
"""

import json


def main():
    with open("cat2_needs_api.json") as f:
        cat2 = json.load(f)

    with open("cat1_verification.json") as f:
        verification = json.load(f)

    original_count = cat2["count"]
    mismatches     = verification["mismatches"]

    # Normalize mismatch entries to match cat2 structure
    for q in mismatches:
        q["classification_reason"] = (
            f"Cat1 mismatch — correct_index conflicts with explanation verdicts: "
            + ", ".join(
                f"stmt{c['stmt']} expected {'TRUE' if c['expected'] else 'FALSE'} "
                f"got {'TRUE' if c['got'] else 'FALSE'}"
                for c in q.get("conflicts", [])
            )
        )

    cat2["questions"].extend(mismatches)
    cat2["count"] = len(cat2["questions"])

    with open("cat2_needs_api.json", "w") as f:
        json.dump(cat2, f, indent=2)

    print("── Cat2 Updated ──────────────────────────────────────────────────")
    print(f"Original Cat2 (garbage options):  {original_count}")
    print(f"Added from Cat1 mismatches:       {len(mismatches)}")
    print(f"Total for Gemini+Claude pipeline: {cat2['count']}")
    print("\n✅ Saved to cat2_needs_api.json")
    print("\nNext steps:")
    print("  1. python fix_cat1.py --commit    ← commit the 93 clean questions")
    print("  2. python fix_cat2_pipeline.py    ← run Gemini+Claude on 129 questions")


if __name__ == "__main__":
    main()