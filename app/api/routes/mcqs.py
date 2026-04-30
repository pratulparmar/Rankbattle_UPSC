from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from sqlalchemy.dialects.postgresql import JSONB
from typing import Optional, List
from app.db.database import get_db
from app.models.models import MCQ
from app.schemas.schemas import MCQOut

router = APIRouter(prefix="/mcqs", tags=["mcqs"])

def exclude_retired(q):
    """Filter out RETIRED questions from any query."""
    return q.filter(
        (MCQ.audit == None) |
        (MCQ.audit['verdict'].astext != 'RETIRED')
    )

@router.get("", response_model=List[MCQOut])
def get_mcqs(
    subject: Optional[str] = Query(None),
    topic_id: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    limit: int = Query(10, le=100),
    db: Session = Depends(get_db)
):
    q = exclude_retired(db.query(MCQ))
    if subject:    q = q.filter(MCQ.subject == subject)
    if topic_id:   q = q.filter(MCQ.topic_id == topic_id)
    if tier:       q = q.filter(MCQ.probability_tier == tier)
    if difficulty: q = q.filter(MCQ.difficulty == difficulty)
    return q.limit(limit).all()

@router.get("/subjects")
def get_subjects(db: Session = Depends(get_db)):
    rows = exclude_retired(db.query(MCQ.subject, MCQ.topic_id, func.count(MCQ.mcq_id))) \
        .group_by(MCQ.subject, MCQ.topic_id) \
        .order_by(MCQ.subject, MCQ.topic_id).all()
    tree = {}
    for subject, topic_id, count in rows:
        if subject not in tree:
            tree[subject] = []
        tree[subject].append({"topic_id": topic_id, "count": count})
    return tree
