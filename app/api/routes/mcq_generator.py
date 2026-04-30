"""
MCQ Generator API Routes
========================
Wires the refinement pipeline into FastAPI.

Endpoints
---------
POST /mcq/refine/one          — refine a single question by mcq_id
POST /mcq/refine/batch        — refine a list of mcq_ids
GET  /mcq/refine/status/{job} — poll a running batch job
POST /mcq/generate            — generate NEW questions from a topic prompt
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

# Local imports — adjust these to match your existing project structure
from app.services.mcq.pipeline import (
    BatchStats,
    RefinementFailure,
    RefinementPipeline,
    RefinementSuccess,
)
from app.services.mcq.schemas import RawMCQ, RefinedMCQRecord

# Replace these with your actual DB session / auth dependencies
# from app.db import get_db
# from app.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mcq", tags=["mcq"])

# One pipeline instance reused across requests
_pipeline = RefinementPipeline()

# In-memory job store (replace with Redis / DB for production)
_jobs: Dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RefineOneRequest(BaseModel):
    mcq_id: str

class RefineOneResponse(BaseModel):
    mcq_id: str
    success: bool
    attempts: int
    warnings: List[str] = []
    error: Optional[str] = None
    record: Optional[dict] = None


class RefineBatchRequest(BaseModel):
    mcq_ids: List[str]
    dry_run: bool = False   # if True, validate but don't write to DB


class RefineBatchResponse(BaseModel):
    job_id: str
    queued: int
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str         # "running" | "complete" | "failed"
    progress: Optional[dict] = None
    stats: Optional[dict] = None
    failures: List[dict] = []


class GenerateRequest(BaseModel):
    subject: str
    topic: str
    num_statements: int = 3     # 2 or 3
    difficulty: str = "medium"  # easy | medium | hard
    count: int = 5              # how many questions to generate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_raw_mcqs(mcq_ids: List[str]) -> List[RawMCQ]:
    """
    Fetch raw questions from DB by mcq_id.

    TODO: replace with your actual SQLAlchemy / asyncpg query.
    Placeholder returns a dummy record for each id so the endpoint is
    immediately testable without DB wiring.
    """
    # Example real implementation:
    # async with get_db() as db:
    #     rows = await db.fetch(
    #         "SELECT mcq_id, stem, options, correct_index, subject, topic_id, explanation "
    #         "FROM mcq_bank WHERE mcq_id = ANY($1)",
    #         mcq_ids,
    #     )
    # return [RawMCQ(**dict(r)) for r in rows]

    # Stub — remove when DB is wired
    return [
        RawMCQ(
            mcq_id=mid,
            stem=f"[DB stub] stem for {mid}",
            options=["Option A", "Option B", "Option C", "Option D"],
            correct_index=0,
            subject="Stub Subject",
        )
        for mid in mcq_ids
    ]


async def _write_refined_records(records: List[RefinedMCQRecord]) -> None:
    """
    Upsert refined records back into the questions table.

    TODO: replace with your actual DB write.
    """
    # Example:
    # async with get_db() as db:
    #     for r in records:
    #         await db.execute(
    #             """
    #             UPDATE mcq_bank
    #             SET stem = $1,
    #                 options = $2,
    #                 correct_index = $3,
    #                 explanation = $4,
    #                 subject = $5,
    #                 refinement_version = $6
    #             WHERE mcq_id = $7
    #             """,
    #             r.stem, r.options, r.correct_index,
    #             r.explanation.dict(), r.subject,
    #             r.refinement_version, r.mcq_id,
    #         )
    logger.info("DB write stub: would upsert %d records", len(records))


# ---------------------------------------------------------------------------
# Single-question endpoint
# ---------------------------------------------------------------------------

@router.post("/refine/one", response_model=RefineOneResponse)
async def refine_one(req: RefineOneRequest):
    """
    Refine a single question. Returns immediately with the result.
    Use this for ad-hoc quality checks or dashboard triggers.
    """
    raws = await _fetch_raw_mcqs([req.mcq_id])
    if not raws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"mcq_id '{req.mcq_id}' not found",
        )

    outcome = await _pipeline.refine_one(raws[0])

    if isinstance(outcome, RefinementSuccess):
        await _write_refined_records([outcome.record])
        return RefineOneResponse(
            mcq_id=outcome.mcq_id,
            success=True,
            attempts=outcome.attempts,
            warnings=outcome.warnings,
            record=outcome.record.dict(),
        )

    return RefineOneResponse(
        mcq_id=outcome.mcq_id,
        success=False,
        attempts=outcome.attempts,
        error=outcome.error,
    )


# ---------------------------------------------------------------------------
# Batch endpoint
# ---------------------------------------------------------------------------

@router.post("/refine/batch", response_model=RefineBatchResponse, status_code=202)
async def refine_batch(req: RefineBatchRequest, background_tasks: BackgroundTasks):
    """
    Kick off a background refinement job for up to 500 questions.
    Poll /mcq/refine/status/{job_id} for progress.
    """
    if len(req.mcq_ids) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch size capped at 500. Split into smaller batches.",
        )

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "progress": {"done": 0, "total": len(req.mcq_ids)}}

    background_tasks.add_task(_run_batch_job, job_id, req.mcq_ids, req.dry_run)

    return RefineBatchResponse(
        job_id=job_id,
        queued=len(req.mcq_ids),
        message=f"Batch job {job_id} started. Poll /mcq/refine/status/{job_id} for progress.",
    )


async def _run_batch_job(job_id: str, mcq_ids: List[str], dry_run: bool) -> None:
    try:
        raws = await _fetch_raw_mcqs(mcq_ids)

        def progress_cb(done: int, total: int) -> None:
            _jobs[job_id]["progress"] = {"done": done, "total": total}

        successes, failures = await _pipeline.refine_batch(raws, on_progress=progress_cb)

        if not dry_run and successes:
            await _write_refined_records([s.record for s in successes])

        stats = BatchStats.from_outcomes(successes, failures)
        _jobs[job_id].update({
            "status": "complete",
            "stats": stats.__dict__,
            "failures": [
                {"mcq_id": f.mcq_id, "error": f.error, "attempts": f.attempts}
                for f in failures
            ],
        })
    except Exception as exc:
        logger.exception("Batch job %s crashed: %s", job_id, exc)
        _jobs[job_id].update({"status": "failed", "error": str(exc)})


# ---------------------------------------------------------------------------
# Job status endpoint
# ---------------------------------------------------------------------------

@router.get("/refine/status/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress"),
        stats=job.get("stats"),
        failures=job.get("failures", []),
    )


# ---------------------------------------------------------------------------
# Question generator endpoint (new questions, not refinement)
# ---------------------------------------------------------------------------

GENERATION_SYSTEM = """\
You are a Senior UPSC Prelims question writer.
Generate exactly the requested number of BRAND NEW, original MCQs on the given topic.
Each question must follow the UPSC statement-based pattern.
Output ONLY a JSON array of objects. No prose. No markdown fences.
Each object must have: topic, subject, statements (array), directive,
options (object A-D), correct_answer (letter), explanation (object with
concept_anchor, statement_wise, why_others_wrong, common_trap, elimination_hint).
"""

@router.post("/generate")
async def generate_questions(req: GenerateRequest):
    """
    Generate brand-new UPSC MCQs for a given subject + topic.
    Uses the same structured output schema as the refinement pipeline.
    """
    from app.services.mcq.schemas import RefinedMCQOutput
    import anthropic
    import json

    client = anthropic.AsyncAnthropic()

    user_msg = (
        f"Generate {req.count} UPSC Prelims MCQs.\n"
        f"Subject: {req.subject}\n"
        f"Topic: {req.topic}\n"
        f"Statements per question: {req.num_statements}\n"
        f"Difficulty: {req.difficulty}\n\n"
        "Return a JSON array of question objects. No markdown. No prose."
    )

    response = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=4096,
        system=GENERATION_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw_text = response.content[0].text.strip()
    # Strip markdown fences if model wraps output
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        questions_raw = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Model returned invalid JSON: {exc}. Raw: {raw_text[:300]}",
        )

    validated = []
    errors = []
    for i, q in enumerate(questions_raw):
        try:
            mcq = RefinedMCQOutput(**q)
            validated.append(mcq.dict())
        except Exception as exc:
            errors.append({"index": i, "error": str(exc)})

    return {
        "generated": len(validated),
        "validation_errors": errors,
        "questions": validated,
    }