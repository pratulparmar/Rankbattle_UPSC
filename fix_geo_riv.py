# fix_geo_riv.py
import json
import psycopg2
from app.core.config import settings

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

new_options = ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"]
new_correct_index = 2  # Both 1 and 2 — both statements TRUE

cur.execute("""
    UPDATE mcq_bank
    SET options = %s::jsonb,
        correct_index = %s
    WHERE mcq_id = 'GEO_RIV_Q014'
""", (json.dumps(new_options), new_correct_index))

conn.commit()
print("✅ GEO_RIV_Q014 fixed")
print(f"   Options: {new_options}")
print(f"   Correct index: {new_correct_index} → 'Both 1 and 2'")

cur.close()
conn.close()
