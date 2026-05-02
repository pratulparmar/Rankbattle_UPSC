from dotenv import load_dotenv; load_dotenv()
from app.db.database import SessionLocal
from sqlalchemy import text

RETIRE_IDS = [
    'ECO_INF_Q006','ECO_MP_Q006','GEO_MON_Q003',
    'ECO_PLN_Q002','ECO_INF_Q004','POL_JUD_Q003','GEO_MORPH_Q005'
]

db = SessionLocal()
result = db.execute(text("""
    UPDATE mcq_bank
    SET audit = audit || jsonb_build_object(
        'verdict', 'RETIRED',
        'retired_reason', 'Future date hallucination — unfixable'
    )
    WHERE mcq_id = ANY(:ids)
"""), {'ids': RETIRE_IDS})
db.commit()
print(f'Retired {result.rowcount} questions')
db.close()
