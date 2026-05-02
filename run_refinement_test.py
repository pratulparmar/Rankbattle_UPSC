"""
Refinement Test Run — 20 questions, before/after comparison
Usage: python run_refinement_test.py
"""
import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()

from app.db.database import SessionLocal
from sqlalchemy import text
from app.services.mcq.pipeline import RefinementPipeline
from app.services.mcq.schemas import RawMCQ

BATCH_SIZE = 20

def fetch_questions(db, limit=20):
    rows = db.execute(text(f"""
        SELECT mcq_id, stem, options, correct_index, subject, topic_id, explanation
        FROM mcq_bank
        LIMIT {limit}
    """)).fetchall()
    result = []
    for r in rows:
        options = r.options if isinstance(r.options, list) else json.loads(r.options)
        result.append(RawMCQ(
            mcq_id=str(r.mcq_id),
            stem=r.stem,
            options=options,
            correct_index=r.correct_index,
            subject=r.subject,
            topic_id=r.topic_id,
            explanation=r.explanation,
        ))
    return result

def print_before_after(raw, outcome):
    from app.services.mcq.pipeline import RefinementSuccess, RefinementFailure

    print("\n" + "="*80)
    print(f"MCQ ID: {raw.mcq_id}  |  Subject: {raw.subject}")
    print("="*80)

    print("\n── BEFORE ──────────────────────────────────────────────────────────")
    print(f"STEM:\n{raw.stem}")
    print(f"\nOPTIONS: {raw.options}")
    print(f"CORRECT INDEX: {raw.correct_index}")
    if raw.explanation:
        exp = raw.explanation if isinstance(raw.explanation, dict) else {}
        print(f"EXPLANATION KEYS: {list(exp.keys())}")

    if isinstance(outcome, RefinementSuccess):
        rec = outcome.record
        print("\n── AFTER ───────────────────────────────────────────────────────────")
        print(f"STEM:\n{rec.stem}")
        print(f"\nOPTIONS: {rec.options}")
        print(f"CORRECT INDEX: {rec.correct_index}")
        print(f"\nEXPLANATION:")
        print(f"  concept_anchor:   {rec.explanation.concept_anchor}")
        print(f"  statement_wise:   {rec.explanation.statement_wise}")
        print(f"  common_trap:      {rec.explanation.common_trap}")
        print(f"  elimination_hint: {rec.explanation.elimination_hint}")
        print(f"\n✅ SUCCESS in {outcome.attempts} attempt(s) | warnings: {len(outcome.warnings)}")
    else:
        print("\n── FAILED ──────────────────────────────────────────────────────────")
        print(f"❌ FAILED after {outcome.attempts} attempts")
        print(f"ERROR: {outcome.error[:300]}")

async def main():
    db = SessionLocal()
    try:
        print(f"Fetching {BATCH_SIZE} questions from mcq_bank...")
        raws = fetch_questions(db, BATCH_SIZE)
        print(f"Got {len(raws)} questions. Starting refinement...\n")

        pipeline = RefinementPipeline()
        
        success_count = 0
        fail_count = 0

        for i, raw in enumerate(raws, 1):
            print(f"\nRefining {i}/{len(raws)}: {raw.mcq_id}...", end="", flush=True)
            outcome = await pipeline.refine_one(raw)
            print(" done.")
            print_before_after(raw, outcome)

            from app.services.mcq.pipeline import RefinementSuccess
            if isinstance(outcome, RefinementSuccess):
                success_count += 1
            else:
                fail_count += 1

        print("\n" + "="*80)
        print(f"SUMMARY: {success_count} succeeded, {fail_count} failed out of {len(raws)}")
        print("="*80)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
