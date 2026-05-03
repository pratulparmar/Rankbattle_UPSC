# check_remaining10.py
import json
import psycopg2
from app.core.config import settings

REMAINING = [
    "ENV_RPT_Q012", "GEO_SOIL_Q013", "GEO_SOIL_Q015",
    "GEO_VEG_Q004", "GEO_VEG_Q006", "GEO_VEG_Q012",
    "HIS_ANC1_Q007", "HIS_ANC2_Q017", "POL_HIS_Q015", "POL_PARL_Q025"
]

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()
cur.execute("""
    SELECT mcq_id, stem, options, correct_index, explanation
    FROM mcq_bank WHERE mcq_id = ANY(%s)
""", (REMAINING,))

for row in cur.fetchall():
    expl = row[4] if isinstance(row[4], dict) else json.loads(row[4] or "{}")
    sw = expl.get("statement_wise", {})
    v1 = sw.get("1", "")[:6].upper()
    v2 = sw.get("2", "")[:6].upper()
    print(f"[{row[0]}] current_correct={row[3]} | stmt1={v1} | stmt2={v2}")

cur.close()
conn.close()