
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MCQOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    mcq_id: str
    topic_id: str
    subject: str
    stem: str
    options: List[str]
    difficulty: str
    probability_tier: str

class MCQWithAnswer(MCQOut):
    correct_index: int
    explanation: dict

class SessionStartRequest(BaseModel):
    mode: str
    subject_filter: Optional[str] = None
    topic_filter: Optional[str] = None
    tier_filter: Optional[str] = None
    total_q: Optional[int] = 100
    duration_mins: Optional[int] = 120

class SessionOut(BaseModel):
    session_id: UUID
    questions: List[MCQOut]
    total_q: int
    duration_mins: int
    started_at: datetime

class AttemptIn(BaseModel):
    mcq_id: str
    selected_index: Optional[int] = None
    time_spent_secs: int
    marked_review: bool = False
    rag_viewed: bool = False

class SessionSubmitRequest(BaseModel):
    attempts: List[AttemptIn]

class SessionResult(BaseModel):
    session_id: UUID
    total_q: int
    attempted: int
    correct: int
    wrong: int
    skipped: int
    raw_score: float
    final_score: float
    accuracy: float
    time_taken_mins: float

class TopicStat(BaseModel):
    topic_id: str
    subject: str
    total_attempts: int
    correct: int
    accuracy: float
    avg_time_secs: float
