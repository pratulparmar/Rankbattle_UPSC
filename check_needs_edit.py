from dotenv import load_dotenv; load_dotenv()
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Overall score distribution
print("=== NEEDS_EDIT Score Distribution ===")
rows = db.execute(text("""
    SELECT
        ROUND((audit->>'overall')::numeric, 1) as overall,
        COUNT(*) as cnt
    FROM mcq_bank
    WHERE audit->>'verdict' = 'NEEDS_EDIT'
    GROUP BY overall
    ORDER BY overall ASC
""")).fetchall()
for r in rows:
    bar = '█' * int(r.cnt / 3)
    print(f"  {r.overall}: {bar} {r.cnt}")

# Which dimension is lowest on average
print("\n=== Average Scores per Dimension (NEEDS_EDIT) ===")
row = db.execute(text("""
    SELECT
        ROUND(AVG((audit->>'factual_accuracy')::numeric), 2) as fa,
        ROUND(AVG((audit->>'difficulty')::numeric), 2) as diff,
        ROUND(AVG((audit->>'relevance_2026')::numeric), 2) as rel,
        ROUND(AVG((audit->>'statement_independence')::numeric), 2) as si,
        ROUND(AVG((audit->>'distractor_quality')::numeric), 2) as dq,
        ROUND(AVG((audit->>'explanation_depth')::numeric), 2) as ed
    FROM mcq_bank
    WHERE audit->>'verdict' = 'NEEDS_EDIT'
""")).fetchone()
print(f"  Factual Accuracy:       {row.fa}")
print(f"  Difficulty:             {row.diff}")
print(f"  Relevance 2026:         {row.rel}")
print(f"  Statement Independence: {row.si}")
print(f"  Distractor Quality:     {row.dq}")
print(f"  Explanation Depth:      {row.ed}")

# Sample 3 critiques
print("\n=== Sample Critiques ===")
rows = db.execute(text("""
    SELECT mcq_id, subject, audit->>'overall' as overall, audit->>'critique' as critique
    FROM mcq_bank
    WHERE audit->>'verdict' = 'NEEDS_EDIT'
    ORDER BY (audit->>'overall')::float ASC
    LIMIT 3
""")).fetchall()
for r in rows:
    print(f"\n{r.mcq_id} | {r.subject} | overall={r.overall}")
    print(f"  {r.critique[:200]}")

db.close()
