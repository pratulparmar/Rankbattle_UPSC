
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid, random
from app.db.database import get_db
from app.models.models import MCQ, MockSession, Attempt, User
from app.schemas.schemas import SessionStartRequest, SessionOut, SessionSubmitRequest, SessionResult, MCQOut
from app.core.auth import decode_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/sessions", tags=["sessions"])
bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = decode_token(creds.credentials)
        user = db.query(User).filter(User.user_id == uuid.UUID(payload["sub"])).first()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except Exception:
        raise HTTPException(401, "Invalid token")

@router.post("/start", response_model=SessionOut)
def start_session(req: SessionStartRequest, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    q = db.query(MCQ).filter(MCQ.verification_passed == True).filter((MCQ.audit == None) | (MCQ.audit["verdict"].astext != "RETIRED"))
    if req.subject_filter: q = q.filter(MCQ.subject == req.subject_filter)
    if req.topic_filter:   q = q.filter(MCQ.topic_id == req.topic_filter)
    if req.tier_filter:    q = q.filter(MCQ.probability_tier == req.tier_filter)
    all_mcqs = q.all()
    if len(all_mcqs) < req.total_q:
        raise HTTPException(400, f"Only {len(all_mcqs)} MCQs available, requested {req.total_q}")
    selected = random.sample(all_mcqs, req.total_q)
    session = MockSession(
        session_id=uuid.uuid4(), user_id=user.user_id,
        mode=req.mode, subject_filter=req.subject_filter,
        topic_filter=req.topic_filter, total_q=req.total_q,
        duration_mins=req.duration_mins, started_at=datetime.now(timezone.utc),
        status="IN_PROGRESS"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionOut(
        session_id=session.session_id,
        questions=[MCQOut.model_validate(m) for m in selected],
        total_q=req.total_q, duration_mins=req.duration_mins,
        started_at=session.started_at
    )

@router.post("/{session_id}/submit", response_model=SessionResult)
def submit_session(session_id: str, req: SessionSubmitRequest,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(MockSession).filter(
        MockSession.session_id == uuid.UUID(session_id),
        MockSession.user_id == user.user_id
    ).first()
    if not session: raise HTTPException(404, "Session not found")
    if session.status == "SUBMITTED": raise HTTPException(400, "Already submitted")

    correct = wrong = skipped = 0
    for a in req.attempts:
        mcq = db.query(MCQ).filter(MCQ.mcq_id == a.mcq_id).first()
        if not mcq: continue
        if a.selected_index is None:
            is_correct = None; skipped += 1
        elif a.selected_index == mcq.correct_index:
            is_correct = True; correct += 1
        else:
            is_correct = False; wrong += 1
        db.add(Attempt(
            attempt_id=uuid.uuid4(), session_id=session.session_id,
            user_id=user.user_id, mcq_id=a.mcq_id,
            selected_index=a.selected_index, is_correct=is_correct,
            time_spent_secs=a.time_spent_secs,
            marked_review=a.marked_review, rag_viewed=a.rag_viewed
        ))

    raw_score = (correct * 2) - (wrong * 0.66)
    final_score = max(0, raw_score)
    accuracy = round(correct / max(correct + wrong, 1) * 100, 2)
    now = datetime.now(timezone.utc)
    started = session.started_at if session.started_at else now
    time_taken = round((now - started).total_seconds() / 60, 1)
    session.status = "SUBMITTED"
    session.submitted_at = now
    session.score = final_score
    db.commit()
    return SessionResult(
        session_id=session.session_id, total_q=session.total_q,
        attempted=correct + wrong, correct=correct, wrong=wrong,
        skipped=skipped, raw_score=raw_score, final_score=final_score,
        accuracy=accuracy, time_taken_mins=time_taken
    )


@router.get("/{session_id}/results")
def get_session_results(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = db.query(MockSession).filter(
        MockSession.session_id == session_id,
        MockSession.user_id == user.user_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    attempts = db.query(Attempt).filter(Attempt.session_id == session_id).all()
    attempt_map = {str(a.mcq_id): a for a in attempts}
    mcq_ids = [a.mcq_id for a in attempts]
    mcqs = db.query(MCQ).filter(MCQ.mcq_id.in_(mcq_ids)).all()

    results = []
    for mcq in mcqs:
        attempt = attempt_map.get(str(mcq.mcq_id))
        results.append({
            "mcq_id":        str(mcq.mcq_id),
            "question_text": mcq.stem,
            "options":       mcq.options,
            "correct_index": mcq.correct_index,
            "selected_index": attempt.selected_index if attempt else None,
            "is_correct":    attempt.is_correct if attempt else None,
            "subject":       mcq.subject,
            "topic_id":      mcq.topic_id,
            "explanation":    mcq.explanation,
        })

    return {"session_id": str(session_id), "question_results": results}


@router.get("/{session_id}/results")
def get_session_results(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = db.query(MockSession).filter(
        MockSession.session_id == session_id,
        MockSession.user_id == user.user_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    attempts = db.query(Attempt).filter(Attempt.session_id == session_id).all()
    attempt_map = {str(a.mcq_id): a for a in attempts}
    mcq_ids = [a.mcq_id for a in attempts]
    mcqs = db.query(MCQ).filter(MCQ.mcq_id.in_(mcq_ids)).all()

    results = []
    for mcq in mcqs:
        attempt = attempt_map.get(str(mcq.mcq_id))
        results.append({
            "mcq_id":        str(mcq.mcq_id),
            "question_text": mcq.stem,
            "options":       mcq.options,
            "correct_index": mcq.correct_index,
            "selected_index": attempt.selected_index if attempt else None,
            "is_correct":    attempt.is_correct if attempt else None,
            "subject":       mcq.subject,
            "topic_id":      mcq.topic_id,
        })

    return {"session_id": str(session_id), "question_results": results}

@router.get("/", response_model=list)
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sessions = db.query(MockSession).filter(MockSession.user_id == user.user_id).order_by(MockSession.started_at.desc()).limit(50).all()
    return [{"session_id": str(s.session_id), "mode": s.mode, "subject_filter": s.subject_filter, "total_q": s.total_q, "final_score": s.score, "status": s.status, "started_at": s.started_at.isoformat() if s.started_at else None, "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None} for s in sessions]
