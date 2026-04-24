
import uuid
from sqlalchemy import Column, Text, SmallInteger, Float, Boolean, Integer, Date, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base

class MCQ(Base):
    __tablename__ = "mcq_bank"
    mcq_id              = Column(Text, primary_key=True)
    topic_id            = Column(Text, index=True)
    subject             = Column(Text, index=True)
    stem                = Column(Text)
    options             = Column(JSONB)
    correct_index       = Column(SmallInteger)
    explanation         = Column(JSONB)
    difficulty          = Column(Text, index=True)
    probability_2026    = Column(Float)
    probability_tier    = Column(Text, index=True)
    source_fact_ids     = Column(JSONB)
    source_ca_ids       = Column(JSONB)
    pattern_id          = Column(Text)
    generated_by        = Column(Text)
    verified_by         = Column(Text)
    verification_notes  = Column(Text)
    verification_passed = Column(Boolean)
    testable_unit_id    = Column(Text)
    created_at          = Column(TIMESTAMP)

class User(Base):
    __tablename__ = "users"
    user_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email       = Column(Text, unique=True, nullable=False)
    name        = Column(Text)
    password    = Column(Text, nullable=False)
    created_at  = Column(TIMESTAMP)
    streak      = Column(Integer, default=0)
    last_active = Column(Date)
    sessions    = relationship("MockSession", back_populates="user")

class MockSession(Base):
    __tablename__ = "mock_sessions"
    session_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    mode            = Column(Text)
    subject_filter  = Column(Text)
    topic_filter    = Column(Text)
    total_q         = Column(Integer)
    duration_mins   = Column(Integer)
    started_at      = Column(TIMESTAMP)
    submitted_at    = Column(TIMESTAMP)
    score           = Column(Float)
    status          = Column(Text, default="IN_PROGRESS")
    user            = relationship("User", back_populates="sessions")
    attempts        = relationship("Attempt", back_populates="session")

class Attempt(Base):
    __tablename__ = "attempts"
    attempt_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id      = Column(UUID(as_uuid=True), ForeignKey("mock_sessions.session_id"))
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    mcq_id          = Column(Text, ForeignKey("mcq_bank.mcq_id"))
    selected_index  = Column(SmallInteger, nullable=True)
    is_correct      = Column(Boolean)
    time_spent_secs = Column(Integer)
    marked_review   = Column(Boolean, default=False)
    rag_viewed      = Column(Boolean, default=False)
    session         = relationship("MockSession", back_populates="attempts")

class SubjectAnalytics(Base):
    __tablename__ = "subject_analytics"
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), primary_key=True)
    subject         = Column(Text)
    topic_id        = Column(Text, primary_key=True)
    total_attempts  = Column(Integer, default=0)
    correct         = Column(Integer, default=0)
    avg_time_secs   = Column(Float, default=0)
    last_updated    = Column(TIMESTAMP)
