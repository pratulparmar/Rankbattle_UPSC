#!/usr/bin/env python3
"""
patch_question_render.py
Run from repo root: python3 patch_question_render.py

Adds QuestionBody import + replaces raw text renders in:
  1. frontend/src/app/test/[sessionId]/page.tsx
  2. frontend/src/app/results/[sessionId]/page.tsx
"""

import re

# ── 1. Test page ──────────────────────────────────────────────────────────────
test_path = "frontend/src/app/test/[sessionId]/page.tsx"

with open(test_path, "r") as f:
    test = f.read()

# Add import after the first 'use client' + existing imports block
if "parseQuestionText" not in test:
    test = test.replace(
        "import { useAuth } from '@/lib/auth';",
        "import { useAuth } from '@/lib/auth';\nimport { QuestionBody } from '@/lib/parseQuestionText';"
    )
    print("✅ Test page: import added")
else:
    print("ℹ️  Test page: import already present")

# Replace raw text render
old_render = """{q?.question_text
            ? <p style={S.qText}>{q.question_text}</p>
            : <Skeleton w="100%" h={60} r={8} />}"""

new_render = """{q?.question_text
            ? <QuestionBody text={q.question_text} style={S.qText} />
            : <Skeleton w="100%" h={60} r={8} />}"""

if old_render in test:
    test = test.replace(old_render, new_render)
    print("✅ Test page: render replaced")
else:
    # Try a looser match in case whitespace differs
    pattern = r'\{q\?\.question_text\s*\?\s*<p style=\{S\.qText\}>\{q\.question_text\}</p>\s*:\s*<Skeleton[^/]*/>\}'
    if re.search(pattern, test):
        test = re.sub(pattern, new_render.strip(), test)
        print("✅ Test page: render replaced (regex)")
    else:
        print("⚠️  Test page: render NOT found — check line 375-377 manually")

with open(test_path, "w") as f:
    f.write(test)

# ── 2. Results page ───────────────────────────────────────────────────────────
results_path = "frontend/src/app/results/[sessionId]/page.tsx"

with open(results_path, "r") as f:
    results = f.read()

# Add import
if "parseQuestionText" not in results:
    results = results.replace(
        "import BottomNav from '@/components/BottomNav';",
        "import BottomNav from '@/components/BottomNav';\nimport { QuestionBody } from '@/lib/parseQuestionText';"
    )
    print("✅ Results page: import added")
else:
    print("ℹ️  Results page: import already present")

# Replace raw question text render in QuestionCard
old_q = """        <p style={{ fontSize: 15, lineHeight: 1.65, color: '#1e293b', margin: '0 0 14px', fontWeight: 500 }}>
          {q.question_text}
        </p>"""

new_q = """        <QuestionBody
          text={q.question_text}
          style={{ marginBottom: 14 }}
        />"""

if old_q in results:
    results = results.replace(old_q, new_q)
    print("✅ Results page: render replaced")
else:
    print("⚠️  Results page: render NOT found — check line 312 manually")

with open(results_path, "w") as f:
    f.write(results)

print("\nDone. Run: git add -A && git commit -m 'feat: structured statement parsing, new pattern prompt'")