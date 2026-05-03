# check_geo_riv.py
import json
import psycopg2
from app.core.config import settings

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT mcq_id, stem, options, correct_index, explanation
    FROM mcq_bank
    WHERE mcq_id = 'GEO_RIV_Q014'
""")

row = cur.fetchone()
print(f"mcq_id: {row[0]}")
print(f"\nStem:\n{row[1]}")
print(f"\nOptions: {row[2]}")
print(f"\nCorrect index: {row[3]}")
print(f"\nExplanation:\n{json.dumps(row[4], indent=2)}")

cur.close()
conn.close()