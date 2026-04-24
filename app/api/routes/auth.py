
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.core.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=req.email, name=req.name,
                password=hash_password(req.password),
                created_at=datetime.utcnow())
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token({"sub": str(user.user_id)})}

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_access_token({"sub": str(user.user_id)})}
