from dotenv import load_dotenv; load_dotenv()
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# How many questions will actually be served to users right now
count = db.execute(text("""
    SELECT COUNT(*) FROM mcq_bank
    WHERE verification_passed = true
    AND (audit IS NULL OR audit->>'verdict' = 'PASS')
""")).scalar()

by_subject = db.execute(text("""
    SELECT subject, COUNT(*) as cnt
    FROM mcq_bank
    WHERE verification_passed = true
    AND (audit IS NULL OR audit->>'verdict' = 'PASS')
    GROUP BY subject ORDER BY subject
""")).fetchall()

print(f"Total questions served to users: {count}")
print()
for r in by_subject:
    print(f"  {r.subject}: {r.cnt}")

db.close()
