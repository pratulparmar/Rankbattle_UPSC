import asyncio, json
from dotenv import load_dotenv
load_dotenv()

from app.db.database import SessionLocal
from sqlalchemy import text
from app.services.mcq.pipeline import RefinementPipeline, RefinementSuccess, BatchStats
from app.services.mcq.schemas import RawMCQ, RefinedMCQRecord

MCQ_IDS = [
    "ECO_AGR_Q001","ECO_AGR_Q003","ST_IT_Q028","ECO_AGR_Q005","ST_EMG_Q006",
    "ECO_AGR_Q007","ECO_AGR_Q008","ECO_BNK_Q004","GEO_MORPH_Q009","ECO_NIA_Q016",
    "ECO_NIA_Q017","ECO_NIA_Q004","ECO_AGR_Q011","ECO_AGR_Q017","ECO_NIA_Q021",
    "ECO_AGR_Q021","ECO_AGR_Q023","POL_SB_Q028","ECO_NIA_Q009","ECO_INF_Q001"
]

def fetch(db, ids):
    rows = db.execute(text("SELECT mcq_id, stem, options, correct_index, subject, topic_id, explanation FROM mcq_bank WHERE mcq_id = ANY(:ids)"), {"ids": ids}).fetchall()
    result = []
    for r in rows:
        options = r.options if isinstance(r.options, list) else json.loads(r.options)
        result.append(RawMCQ(mcq_id=str(r.mcq_id), stem=r.stem, options=options, correct_index=r.correct_index, subject=r.subject, topic_id=r.topic_id, explanation=r.explanation))
    return result

def write(db, records):
    for r in records:
        db.execute(text("""
            UPDATE mcq_bank SET stem=:stem, options=:options, correct_index=:correct_index,
            explanation=:explanation, subject=:subject WHERE mcq_id=:mcq_id
        """), {"stem": r.stem, "options": json.dumps(r.options), "correct_index": r.correct_index,
               "explanation": json.dumps(r.explanation.dict()), "subject": r.subject, "mcq_id": r.mcq_id})
    db.commit()

async def main():
    db = SessionLocal()
    try:
        raws = fetch(db, MCQ_IDS)
        print(f"Fetched {len(raws)} questions. Refining...")
        pipeline = RefinementPipeline()
        successes, failures = await pipeline.refine_batch(raws)
        if successes:
            write(db, [s.record for s in successes])
            print(f"✅ Written {len(successes)} records to DB")
        if failures:
            print(f"❌ {len(failures)} failures: {[f.mcq_id for f in failures]}")
    finally:
        db.close()

asyncio.run(main())
