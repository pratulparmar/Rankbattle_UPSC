from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import uuid, os, hmac, hashlib
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.core.auth import hash_password, verify_password, create_access_token, decode_token
from app.services.email_service import send_welcome_email, send_receipt_email

router = APIRouter(prefix="/auth", tags=["auth"])

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "upsc-rankbattle")
RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


# ── Auth dependency ────────────────────────────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")
    return user


def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token using Google public keys (no service account needed)."""
    return verify_firebase_token_rest(id_token)


def verify_firebase_token_rest(id_token: str) -> dict:
    """Fallback: verify Firebase token via Google public keys."""
    import requests
    from jose import jwt as jose_jwt

    # Get Google's public keys
    certs_url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    certs = requests.get(certs_url).json()

    # Decode header to get key id
    try:
        header = jose_jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        cert = certs.get(kid)
        if not cert:
            raise HTTPException(401, "Firebase token key not found")

        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        import base64

        cert_bytes = cert.encode()
        x509_cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
        public_key = x509_cert.public_key()

        decoded = jose_jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
        )
        return decoded
    except Exception as e:
        raise HTTPException(401, f"Token verification failed: {e}")


# ── Existing endpoints ─────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=req.email, name=req.name,
        password=hash_password(req.password),
        created_at=datetime.utcnow(),
    )
    db.add(user); db.commit(); db.refresh(user)
    send_welcome_email(user.email, user.name) 
    return {"access_token": create_access_token({"sub": str(user.user_id), "name": user.name})}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_access_token({"sub": str(user.user_id), "name": user.name})}


@router.post("/guest", response_model=TokenResponse)
def guest_login(db: Session = Depends(get_db)):
    GUEST_EMAIL = "guest@rankbattle.demo"
    GUEST_NAME  = "Guest Aspirant"
    user = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not user:
        user = User(
            email=GUEST_EMAIL, name=GUEST_NAME,
            password=hash_password("guest_demo_2024"),
            created_at=datetime.utcnow(),
        )
        db.add(user); db.commit(); db.refresh(user)
    token = create_access_token({"sub": str(user.user_id), "name": GUEST_NAME, "guest": True})
    return {"access_token": token}


# ── Firebase endpoints ─────────────────────────────────────────────────────────

class FirebaseTokenRequest(BaseModel):
    id_token: str


@router.post("/firebase/google", response_model=TokenResponse)
def firebase_google(req: FirebaseTokenRequest, db: Session = Depends(get_db)):
    """Exchange Firebase Google ID token for our JWT."""
    decoded    = verify_firebase_token(req.id_token)
    google_id  = decoded.get("uid") or decoded.get("sub")
    email      = decoded.get("email", "")
    name       = decoded.get("name", email.split("@")[0])
    avatar_url = decoded.get("picture", "")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id  = google_id
            user.avatar_url = avatar_url
        else:
            user = User(
                email=email, name=name,
                password=hash_password(str(uuid.uuid4())),
                google_id=google_id, avatar_url=avatar_url,
                created_at=datetime.utcnow(),
            )
            db.add(user)
    db.commit(); db.refresh(user)
    return {"access_token": create_access_token({"sub": str(user.user_id), "name": user.name})}


@router.post("/firebase/phone", response_model=TokenResponse)
def firebase_phone(req: FirebaseTokenRequest, db: Session = Depends(get_db)):
    """Exchange Firebase Phone ID token for our JWT."""
    decoded    = verify_firebase_token(req.id_token)
    uid        = decoded.get("uid") or decoded.get("sub")
    phone      = decoded.get("phone_number", "")

    # Find by google_id (reuse field for firebase uid) or phone
    user = db.query(User).filter(User.google_id == uid).first()
    if not user:
        user = db.query(User).filter(User.phone == phone).first()
        if user:
            user.google_id = uid
        else:
            # New user via phone — create minimal account
            user = User(
                email=f"phone_{uid}@rankbattle.internal",
                name=phone,
                password=hash_password(str(uuid.uuid4())),
                google_id=uid,
                phone=phone,
                created_at=datetime.utcnow(),
            )
            db.add(user)
    db.commit(); db.refresh(user)
    return {"access_token": create_access_token({"sub": str(user.user_id), "name": user.name or phone})}


# ── Profile ────────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name:             Optional[str] = None
    phone:            Optional[str] = None
    target_year:      Optional[int] = None
    state:            Optional[str] = None
    optional_subject: Optional[str] = None


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id":          str(current_user.user_id),
        "email":            current_user.email,
        "name":             current_user.name,
        "avatar_url":       getattr(current_user, "avatar_url", None),
        "phone":            getattr(current_user, "phone", None),
        "target_year":      getattr(current_user, "target_year", 2026),
        "state":            getattr(current_user, "state", None),
        "optional_subject": getattr(current_user, "optional_subject", None),
        "is_subscribed":    getattr(current_user, "is_subscribed", False),
        "subscribed_at":    str(current_user.subscribed_at) if getattr(current_user, "subscribed_at", None) else None,
        "streak":           current_user.streak or 0,
        "created_at":       str(current_user.created_at),
        "full_mock_used":      getattr(current_user, "full_mock_used", False) or False,
        "subjects_used":       getattr(current_user, "subjects_used", []) or [],
        "coach_messages_used": getattr(current_user, "coach_messages_used", 0) or 0,
    }


@router.put("/me")
def update_profile(
    req: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.name is not None:             current_user.name             = req.name
    if req.phone is not None:            current_user.phone            = req.phone
    if req.target_year is not None:      current_user.target_year      = req.target_year
    if req.state is not None:            current_user.state            = req.state
    if req.optional_subject is not None: current_user.optional_subject = req.optional_subject
    db.commit(); db.refresh(current_user)
    return {"success": True}


# ── Razorpay ───────────────────────────────────────────────────────────────────

class PhoneRequest(BaseModel):
    phone: str


@router.post("/subscription/save-phone")
def save_phone(
    req: PhoneRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.phone or len(req.phone) < 10:
        raise HTTPException(400, "Valid phone number required")
    current_user.phone = req.phone
    db.commit()
    return {"success": True}

# REPLACE WITH:
@router.post("/subscription/create-order")
def create_order(
    plan: str = "sprint",         # ← query param: "sprint" | "monthly"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not RAZORPAY_KEY_ID:
        raise HTTPException(503, "Razorpay not configured")

    # ── Plan amounts (paise) ──────────────────────────────────────────────────
    PLAN_AMOUNTS = {
        "sprint":  75900,   # ₹759 one-time
        "monthly": 99900,   # ₹999/month
    }
    PLAN_LABELS = {
        "sprint":  "Prelims '26 Sprint",
        "monthly": "30-Day Booster",
    }

    if plan not in PLAN_AMOUNTS:
        raise HTTPException(400, f"Invalid plan '{plan}'. Must be 'sprint' or 'monthly'.")

    amount = PLAN_AMOUNTS[plan]

    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    order = client.order.create({
        "amount":   amount,
        "currency": "INR",
        "notes": {
            "user_id": str(current_user.user_id),
            "email":   current_user.email,
            "plan":    plan,
        },
    })
    return {
        "order_id": order["id"],
        "amount":   amount,
        "currency": "INR",
        "key":      RAZORPAY_KEY_ID,
        "name":     current_user.name,
        "email":    current_user.email,
        "phone":    getattr(current_user, "phone", "") or "",
        "plan":     plan,
        "plan_label": PLAN_LABELS[plan],
    }


class VerifyPayment(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str


@router.post("/subscription/verify")
def verify_payment(
    req: VerifyPayment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    body     = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, req.razorpay_signature):
        raise HTTPException(400, "Payment verification failed")

    current_user.is_subscribed   = True
    current_user.subscribed_at   = datetime.utcnow()
    current_user.subscription_id = req.razorpay_payment_id
    db.commit()
 
    # Fetch plan from Razorpay order notes
    try:
        import razorpay
        rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order     = rz_client.order.fetch(req.razorpay_order_id)
        plan      = order.get("notes", {}).get("plan", "sprint")
    except Exception:
        plan = "sprint"
 
    send_receipt_email(
        user_email  = current_user.email,
        user_name   = current_user.name or "Aspirant",
        plan        = plan,
        payment_id  = req.razorpay_payment_id,
    )
 
    return {"success": True, "message": "Subscription activated!"}