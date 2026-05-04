"""
add_free_tier_columns.py
========================
Adds free tier tracking columns to users table.
Run once on Railway DB.

Run:
  python add_free_tier_columns.py
"""
import psycopg2
from app.core.config import settings

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_mock_used      BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS subjects_used       JSONB   DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS coach_messages_used INTEGER DEFAULT 0;
""")

conn.commit()
cur.close()
conn.close()
print("✅ Free tier columns added to users table")
print("   full_mock_used      BOOLEAN DEFAULT FALSE")
print("   subjects_used       JSONB   DEFAULT []")
print("   coach_messages_used INTEGER DEFAULT 0")