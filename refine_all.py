import asyncio, json, time
from dotenv import load_dotenv
load_dotenv()

from app.db.database import SessionLocal
from sqlalchemy import text
from app.services.mcq.pipeline import RefinementPipeline, BatchStats
from app.services.mcq.schemas import RawMCQ

def fetch_all(db):
    rows = db.execute(text("SELECT mcq_id, stem, options, correct_index, subject, topic_id, explanation FROM mcq_bank")).fetchall()
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
        raws = fetch_all(db)
        total = len(raws)
        print(f"Total questions: {total}. Starting full refinement...\n")

        start = time.time()
        pipeline = RefinementPipeline()

        def progress(done, total):
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate if rate > 0 else 0
            print(f"  {done}/{total} | {rate:.1f} q/s | ETA {eta/60:.1f} min", end="\r", flush=True)

        successes, failures = await pipeline.refine_batch(raws, on_progress=progress)

        print(f"\n\nWriting {len(successes)} records to DB...")
        write(db, [s.record for s in successes])

        stats = BatchStats.from_outcomes(successes, failures)
        print(f"\n{'='*60}")
        print(f"DONE")
        print(f"  Total:     {stats.total}")
        print(f"  Succeeded: {stats.succeeded}")
        print(f"  Failed:    {stats.failed}")
        print(f"  Multi-attempt: {stats.multi_attempt}")
        print(f"  Avg attempts:  {stats.avg_attempts_on_success}")
        if stats.failure_mcq_ids:
            print(f"  Failed IDs: {stats.failure_mcq_ids}")
            # Save failures to file for retry
            with open("failed_mcq_ids.txt", "w") as f:
                f.write("\n".join(stats.failure_mcq_ids))
            print(f"  (saved to failed_mcq_ids.txt)")
        print(f"{'='*60}")

    finally:
        db.close()

asyncio.run(main())
