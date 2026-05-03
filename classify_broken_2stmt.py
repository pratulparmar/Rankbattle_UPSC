"""
classify_broken_2stmt.py
========================
Reads broken_2stmt.json and classifies each question into:

  Category 1 — Auto-fixable
    Options are Format A variants (wrong casing/wording only)
    correct_index is unambiguous — just remap text, no API needed

  Category 2 — Needs API
    Options are genuinely broken (garbage 4th option, count-based,
    non-standard) — needs Gemini + Claude pipeline

Outputs:
  cat1_autofix.json     ← direct DB fix, no API
  cat2_needs_api.json   ← Gemini + Claude pipeline

Run:
  python classify_broken_2stmt.py
"""

import json
import re

# ── Format A canonical values ──────────────────────────────────────────────────

FORMAT_A = {
    "A": "1 only",
    "B": "2 only",
    "C": "Both 1 and 2",
    "D": "Neither 1 nor 2",
}

# ── Pattern matchers for Category 1 ───────────────────────────────────────────
# Each tuple: (option_index, compiled_regex)
# If all 4 options match their respective pattern → Category 1

CAT1_PATTERNS = [
    # Option A — means "statement 1 only"
    re.compile(
        r"^(only\s*(1|one|statement\s*1|stmt\s*1)"
        r"|only\s*statement\s*1[\w\s,]*"
        r"|1\s*only)$",
        re.I
    ),
    # Option B — means "statement 2 only"
    re.compile(
        r"^(only\s*(2|two|statement\s*2|stmt\s*2)"
        r"|only\s*statement\s*2[\w\s,]*"
        r"|2\s*only)$",
        re.I
    ),
    # Option C — means "both"
    re.compile(
        r"^(both(\s*(1\s*and\s*2|statements?(\s*(1\s*and\s*2|are\s*correct|together[\w\s]*))?))?|"
        r"both\s*statements?\s*(1\s*and\s*2|are\s*correct|together[\w\s]*)|"
        r"both\s*are\s*correct)$",
        re.I
    ),
    # Option D — means "neither"
    re.compile(
        r"^(neither(\s*(1\s*nor\s*2|statement\s*1\s*nor\s*(statement\s*)?2|"
        r"statement(s)?\s*(is|are)\s*correct|[\w\s]*))?|"
        r"none(\s*of\s*(the\s*)?(above|them))?)$",
        re.I
    ),
]

# ── Garbage option patterns (auto-fail to Category 2) ─────────────────────────
GARBAGE_PATTERNS = re.compile(
    r"^(<unknown>|not applicable|cannot be determined|"
    r"insufficient information|n/?a|unclear|depends)$",
    re.I
)


# ── Classifier ─────────────────────────────────────────────────────────────────

def classify(question: dict) -> tuple[str, str]:
    """
    Returns ("cat1", reason) or ("cat2", reason).
    """
    options = question["options"]

    if len(options) != 4:
        return "cat2", f"Expected 4 options, got {len(options)}"

    # Check for garbage options first
    for i, opt in enumerate(options):
        if GARBAGE_PATTERNS.match(opt.strip()):
            return "cat2", f"Garbage option at index {i}: '{opt}'"

    # Check each option against its Category 1 pattern
    mismatches = []
    for i, (opt, pattern) in enumerate(zip(options, CAT1_PATTERNS)):
        if not pattern.match(opt.strip()):
            mismatches.append(f"index {i}: '{opt}'")

    if mismatches:
        return "cat2", f"Non-standard options: {', '.join(mismatches)}"

    return "cat1", "Options are Format A variants — safe to remap"


def remap_correct_index(question: dict) -> int:
    """
    For Cat1 questions, the correct_index maps directly since
    option order is preserved (A=1only, B=2only, C=Both, D=Neither).
    Returns the same correct_index unchanged.
    """
    return question["correct_index"]


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with open("broken_2stmt.json") as f:
        data = json.load(f)

    broken = data["broken_questions"]
    print(f"Total broken questions to classify: {len(broken)}\n")

    cat1 = []
    cat2 = []

    for q in broken:
        category, reason = classify(q)

        entry = {**q, "classification_reason": reason}

        if category == "cat1":
            entry["remapped_options"] = list(FORMAT_A.values())
            entry["correct_index_unchanged"] = q["correct_index"]
            cat1.append(entry)
        else:
            cat2.append(entry)

    # ── Print summary ──────────────────────────────────────────────────────────
    print("── Classification Results ────────────────────────────────────────")
    print(f"Category 1 (auto-fix, no API):  {len(cat1)}")
    print(f"Category 2 (needs Gemini+Claude): {len(cat2)}")

    print("\n── Category 1 Sample ─────────────────────────────────────────────")
    for q in cat1[:3]:
        print(f"  [{q['mcq_id']}] {q['options']} → {q['remapped_options']}")
        print(f"  Reason: {q['classification_reason']}")
        print(f"  Correct index: {q['correct_index_unchanged']} → '{q['remapped_options'][q['correct_index_unchanged']]}'")
        print()

    print("── Category 2 Sample ─────────────────────────────────────────────")
    for q in cat2[:3]:
        print(f"  [{q['mcq_id']}] {q['options']}")
        print(f"  Reason: {q['classification_reason']}")
        print()

    # ── Save outputs ───────────────────────────────────────────────────────────
    cat1_output = {
        "count": len(cat1),
        "questions": cat1,
    }
    cat2_output = {
        "count": len(cat2),
        "questions": cat2,
    }

    with open("cat1_autofix.json", "w") as f:
        json.dump(cat1_output, f, indent=2)

    with open("cat2_needs_api.json", "w") as f:
        json.dump(cat2_output, f, indent=2)

    print("✅ Saved cat1_autofix.json")
    print("✅ Saved cat2_needs_api.json")
    print("\nNext steps:")
    print("  Step 2B → python fix_cat1.py          (direct DB fix, no API)")
    print("  Step 3  → python fix_cat2_pipeline.py  (Gemini + Claude)")


if __name__ == "__main__":
    main()