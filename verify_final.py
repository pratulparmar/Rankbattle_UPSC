# verify_final.py
import json
import re
import psycopg2
from app.core.config import settings

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT mcq_id, stem, options
    FROM mcq_bank
    WHERE verification_passed = true
      AND audit->>'verdict' = 'PASS'
    ORDER BY subject, mcq_id
""")

rows = cur.fetchall()

FORMAT_A = {"1 only", "2 only", "both 1 and 2", "neither 1 nor 2"}
STATEMENT_PATTERN = re.compile(r"^\s*\d+[\.\)]\s+\S", re.MULTILINE)

still_broken = []

for mcq_id, stem, options in rows:
    if isinstance(options, str):
        options = json.loads(options)

    n = len(STATEMENT_PATTERN.findall(stem))
    if n != 2:
        continue

    actual = {o.strip().lower() for o in options}
    if actual != FORMAT_A:
        still_broken.append({
            "mcq_id":  mcq_id,
            "options": options
        })

cur.close()
conn.close()

print(f"Total still broken: {len(still_broken)}")

if not still_broken:
    print("✅ All 2-statement questions now use Format A — clean!")
else:
    for q in still_broken:
        print(f"  [{q['mcq_id']}] {q['options']}")