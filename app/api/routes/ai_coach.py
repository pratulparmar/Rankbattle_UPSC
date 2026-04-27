from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User
from app.core.auth import decode_token
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types
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

2. Step 1: Give a simple explanation
   • Use analogy, keep it NCERT-level simple, avoid jargon initially

3. Step 2: Highlight confusion zones
   • Mention typical UPSC traps
   • Contrast similar concepts if needed

4. Step 3: Active Recall Questions
   • Ask 3–5 conceptual questions
   • Include 1–2 UPSC Prelims-style MCQs (with options)
   • Include at least 1 tricky elimination-based question

5. Step 4: Refinement Cycles (2–3 iterations)
   • Improve explanation based on user responses
   • Add deeper insights gradually

6. Step 5: Application & Thinking
   • Give a real-world or exam scenario

7. Step 6: Teaching Test
   • Ask user to explain back in simple terms

8. Step 7: Teaching Snapshot
   • 2–3 line core idea
   • 3 bullet key facts
   • 1 memory trick / analogy
   • 1 UPSC trap reminder
</Instructions>

<Constraints>
- Always use analogies
- No heavy jargon initially
- Prioritize conceptual clarity over rote learning
- Questions must simulate UPSC thinking (elimination, traps, multi-statement logic)
- Gradually increase difficulty
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
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Gemini API key not configured")

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

    # Build conversation history
    history = []
    for msg in body.history[-12:]:
        role = "model" if msg.role == "assistant" else "user"
        history.append(types.Content(role=role, parts=[types.Part(text=msg.content)]))

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            contents=history + [types.Content(role="user", parts=[types.Part(text=body.message)])],
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1024,
                temperature=0.7,
            )
        )
        return {"reply": response.text}
    except Exception as e:
        raise HTTPException(502, f"Gemini error: {str(e)}")
