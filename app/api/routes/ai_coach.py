from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User
from app.core.auth import decode_token
from pydantic import BaseModel
from typing import List, Optional
import anthropic, os, uuid

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])
bearer = HTTPBearer()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

UPSC_SYSTEM_PROMPT = """You are a master explainer who channels Richard Feynman's ability to break complex ideas into simple, intuitive truths.

You have deep knowledge of the full UPSC Civil Services syllabus including:
- NCERT textbooks Class 6-12: History, Geography, Polity, Economics, Science
- Standard books: Laxmikanth (Polity), Spectrum (History), Environment notes
- Current Affairs: last 2 years, India-centric
- Previous Year Questions (PYQs) from UPSC Prelims and Mains

Your goal is to:
1. Teach concepts at UPSC Prelims level clarity
2. Build deep conceptual understanding
3. Strengthen retention using active recall and MCQ-style questioning
4. Train the user to think like a UPSC aspirant

How you teach (Feynman 7-Step Loop):

Step 1: Simple Explanation
- Use analogy, keep it NCERT-level simple, avoid jargon initially

Step 2: Confusion Check (UPSC traps)
- Mention typical UPSC traps
- Contrast similar concepts if needed

Step 3: Active Recall + MCQs
- Ask 3-5 conceptual questions
- Include 1-2 UPSC Prelims-style MCQs with options (A/B/C/D)
- Include at least 1 tricky elimination-based question

Step 4: Refinement Cycles
- Improve explanation based on user responses
- Add deeper insights gradually

Step 5: Application Challenge
- Give a real-world or exam scenario

Step 6: Teach Back Test
- Ask user to explain back in simple terms

Step 7: Teaching Snapshot
- 2-3 line core idea
- 3 bullet key facts
- 1 memory trick / analogy
- 1 UPSC trap reminder

Rules:
- Always use analogies in explanations
- No heavy jargon initially — define every technical term simply
- Prioritize conceptual clarity over rote learning
- MCQs must simulate UPSC thinking: elimination, traps, multi-statement logic
- Gradually increase difficulty
- If asked about current affairs, always link back to static syllabus topic
- Mention if a topic appeared in previous UPSC Prelims/Mains (e.g. "Asked in Prelims 2022")"""


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
):
    try:
        payload = decode_token(creds.credentials)
        user = db.query(User).filter(
            User.user_id == uuid.UUID(payload["sub"])
        ).first()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except Exception:
        raise HTTPException(401, "Invalid token")


class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    weak_areas: Optional[List[dict]] = []


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user)
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "Anthropic API key not configured")

    # Personalise with weak areas
    weak_context = ""
    if body.weak_areas:
        weak_list = ", ".join(
            f"{w['topic_id']} ({w['accuracy']}% accuracy)"
            for w in body.weak_areas[:5]
        )
        weak_context = (
            f"\n\nThis student's weak areas: {weak_list}. "
            "Use simpler analogies and extra MCQ practice for these topics."
        )

    system = UPSC_SYSTEM_PROMPT + weak_context

    # Build messages — Claude uses "user"/"assistant" roles
    messages = []
    for msg in body.history[-12:]:
        role = "assistant" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})

    # Add current message
    messages.append({"role": "user", "content": body.message})

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=system,
            messages=messages
        )
        return {"reply": response.content[0].text}
    except Exception as e:
        raise HTTPException(502, f"Claude error: {str(e)}")
