# fix_remaining10.py
import json
import psycopg2
from app.core.config import settings

REMAINING = [
    "ENV_RPT_Q012", "GEO_SOIL_Q013", "GEO_SOIL_Q015",
    "GEO_VEG_Q004", "GEO_VEG_Q006", "GEO_VEG_Q012",
    "HIS_ANC1_Q007", "HIS_ANC2_Q017", "POL_HIS_Q015", "POL_PARL_Q025"
]

FORMAT_A = ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"]
CORRECT_INDEX = 2  # Both 1 and 2 — all 10 have stmt1=TRUE, stmt2=TRUE

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

for mcq_id in REMAINING:
    cur.execute("""
        UPDATE mcq_bank
        SET options = %s::jsonb,
            correct_index = %s
        WHERE mcq_id = %s
    """, (json.dumps(FORMAT_A), CORRECT_INDEX, mcq_id))
    print(f"✅ {mcq_id} → correct_index=2 (Both 1 and 2)")

conn.commit()
print(f"\n✅ Committed all {len(REMAINING)} fixes")
cur.close()
conn.close()