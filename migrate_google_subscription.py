from dotenv import load_dotenv; load_dotenv()
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
db.execute(text("""
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS target_year INTEGER DEFAULT 2026,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS optional_subject TEXT
"""))
db.commit()
print("✅ Migration complete")
db.close()
