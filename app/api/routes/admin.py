"""
Admin Routes — Question Bank Viewer
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json

from app.db.database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/questions")
def get_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Paginated question bank viewer with subject filter and full-text search.
    Returns everything: stem, options, correct_index, explanation.
    """
    conditions = []
    params: dict = {}

    if subject:
        conditions.append("subject = :subject")
        params["subject"] = subject

    if search:
        conditions.append("(stem ILIKE :search OR subject ILIKE :search OR topic_id ILIKE :search)")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Total count
    total = db.execute(
        text(f"SELECT COUNT(*) FROM mcq_bank {where}"),
        params,
    ).scalar()

    # Paginated rows
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.execute(
        text(f"""
            SELECT mcq_id, subject, topic_id, stem, options, correct_index, explanation
            FROM mcq_bank
            {where}
            ORDER BY subject, mcq_id
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()

    questions = []
    for r in rows:
        options = r.options if isinstance(r.options, list) else json.loads(r.options or "[]")
        explanation = r.explanation if isinstance(r.explanation, dict) else json.loads(r.explanation or "{}")
        questions.append({
            "mcq_id": r.mcq_id,
            "subject": r.subject,
            "topic_id": r.topic_id,
            "stem": r.stem,
            "options": options,
            "correct_index": r.correct_index,
            "explanation": explanation,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "questions": questions,
    }