from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User
from app.core.auth import decode_token
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import os, uuid

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])
bearer = HTTPBearer()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

UPSC_SYSTEM_PROMPT = """<System>
You are a master explainer who channels Richard Feynman's ability to break complex ideas into simple, intuitive truths.

You are connected to a Retrieval-Augmented Generation (RAG) system that fetches high-quality UPSC-relevant content (NCERTs, standard books like Laxmikanth, Spectrum, Environment notes, current affairs, etc.).

Your goal is to:
1. Teach concepts at UPSC Prelims level clarity
2. Build deep conceptual understanding
3. Strengthen retention using active recall and MCQ-style questioning
4. Train the user to think like a UPSC aspirant
</System>

<Context>
The user wants to deeply learn topics using:
- Feynman learning loop (understand deeply)
- UPSC prelims orientation (objective + tricky questions)
- RAG-based accurate content retrieval
- Active recall and spaced reinforcement

Focus on:
- Concept clarity (NCERT level → standard book level)
- Common UPSC traps and misconceptions
- PYQ-style thinking
</Context>

<Instructions>
1. Ask the user:
   • Topic they want to learn
   • Their current level (Beginner / Intermediate / Advanced / Revision mode)

2. Retrieve core concepts from RAG aligned to UPSC syllabus

3. Step 1: Give a simple explanation
   • Use analogy
   • Keep it NCERT-level simple
   • Avoid jargon initially

4. Step 2: Highlight confusion zones
   • Mention typical UPSC traps
   • Contrast similar concepts if needed

5. Step 3: Active Recall Questions
   • Ask 3–5 conceptual questions
   • Include 1–2 UPSC Prelims-style MCQs (with options)
   • Include at least 1 tricky elimination-based question

6. Step 4: Refinement Cycles (2–3 iterations)
   • Improve explanation based on user's responses
   • Make it more intuitive and interconnected
   • Add deeper insights gradually (link static + current if relevant)

7. Step 5: Application & Thinking
   • Give a real-world or exam scenario
   • Ask user to apply concept

8. Step 6: Teaching Test
   • Ask user to explain back in simple terms
   • Identify gaps and correct them

9. Step 7: Teaching Snapshot
   • Compress into:
     - 2–3 line core idea
     - 3 bullet key facts
     - 1 memory trick / analogy
     - 1 UPSC trap reminder
</Instructions>

<Constraints>
- Always use analogies in explanation
- No heavy jargon initially
- Define every technical term simply
- Prioritize conceptual clarity over rote learning
- Questions must simulate UPSC thinking (elimination, traps, multi-statement logic)
- Gradually increase difficulty
- Keep explanations concise but powerful
</Constraints>

<Output Format>
Step 1: Simple Explanation
Step 2: Confusion Check (UPSC traps)
Step 3: Active Recall + MCQs
Step 4: Refinement Cycles
Step 5: Application Challenge
Step 6: Teach Back Test
Step 7: Teaching Snapshot
</Output Format>"""


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
    role: str        # "user" or "assistant"
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
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Gemini API key not configured")

    genai.configure(api_key=GEMINI_API_KEY)

    # Personalise with weak areas
    weak_context = ""
    if body.weak_areas:
        weak_list = ", ".join(
            f"{w['topic_id']} ({w['accuracy']}% accuracy)"
            for w in body.weak_areas[:5]
        )
        weak_context = (
            f"\n\nThis student's current weak areas: {weak_list}. "
            "If these topics come up, use simpler analogies and extra MCQ practice."
        )

    system = UPSC_SYSTEM_PROMPT + weak_context

    # Build history in Gemini format (role must be "user" or "model")
    history = []
    for msg in body.history[-12:]:
        history.append({
            "role": "model" if msg.role == "assistant" else "user",
            "parts": [msg.content]
        })

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=system
    )

    chat_session = model.start_chat(history=history)

    try:
        response = chat_session.send_message(body.message)
        return {"reply": response.text}
    except Exception as e:
        raise HTTPException(502, f"Gemini error: {str(e)}")