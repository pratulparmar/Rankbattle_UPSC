
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
from app.db.database import get_db
from app.models.models import Attempt, MCQ, User
from app.core.auth import decode_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uuid

router = APIRouter(prefix="/analytics", tags=["analytics"])
bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = decode_token(creds.credentials)
        user = db.query(User).filter(User.user_id == uuid.UUID(payload["sub"])).first()
        if not user: raise HTTPException(401, "User not found")
        return user
    except Exception:
        raise HTTPException(401, "Invalid token")

@router.get("/me")
def my_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(
        MCQ.subject, MCQ.topic_id,
        func.count(Attempt.attempt_id).label("total"),
        func.coalesce(func.sum(func.cast(Attempt.is_correct, Integer)), 0).label("correct")
    ).join(MCQ, Attempt.mcq_id == MCQ.mcq_id)     .filter(Attempt.user_id == user.user_id)     .group_by(MCQ.subject, MCQ.topic_id).all()
    return [{"subject": s, "topic_id": t, "total_attempts": total,
             "correct": correct, "accuracy": round(correct/total*100, 1) if total else 0}
            for s, t, total, correct in rows]

@router.get("/me/weak-areas")
def weak_areas(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(
        MCQ.subject, MCQ.topic_id,
        func.count(Attempt.attempt_id).label("total"),
        func.coalesce(func.sum(func.cast(Attempt.is_correct, Integer)), 0).label("correct")
    ).join(MCQ, Attempt.mcq_id == MCQ.mcq_id)     .filter(Attempt.user_id == user.user_id)     .group_by(MCQ.subject, MCQ.topic_id)     .having(func.count(Attempt.attempt_id) >= 5).all()
    weak = [{"subject": s, "topic_id": t, "total_attempts": total,
             "accuracy": round(correct/total*100, 1)}
            for s, t, total, correct in rows if correct/total*100 < 50]
    return sorted(weak, key=lambda x: x["accuracy"])
