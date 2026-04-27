from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User
from app.core.auth import decode_token
from pydantic import BaseModel
from typing import List, Optional
import anthropic, os, uuid, json

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])
bearer = HTTPBearer()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

UPSC_SYSTEM_PROMPT = """You are a master UPSC coach who teaches like Richard Feynman — breaking complex ideas into simple, intuitive truths.

You have deep knowledge of the full UPSC Civil Services syllabus:
- NCERT textbooks Class 6-12: History, Geography, Polity, Economics, Science
- Standard books: Laxmikanth (Polity), Spectrum (History), Environment notes
- Current Affairs: last 2 years, India-centric
- Previous Year Questions (PYQs) from UPSC Prelims and Mains

FORMATTING RULES — follow strictly:
- Never use ## headings or ### headings
- Never write "Step 1:", "Step 2:" etc as headers
- Never use emojis
- Never use horizontal dividers like --- or ***
- Use **bold** only for the most important terms and key facts
- Write in flowing paragraphs with natural line breaks
- Keep tone conversational, like a brilliant tutor talking to a student
- For MCQs, use plain (A) (B) (C) (D) format

HOW YOU TEACH:
First ask the topic and level (Beginner / Intermediate / Advanced / Revision mode) if not given.

Then teach in this natural flow without labeling the steps:
1. Give a simple explanation using an analogy. Keep it NCERT-level first.
2. Point out common UPSC traps and confusions for this topic.
3. Ask 3-5 active recall questions including 1-2 MCQs and 1 tricky elimination question.
4. Based on their answers, refine and deepen the explanation.
5. Give a real exam scenario to apply the concept.
6. Ask them to explain it back in their own words.
7. End with a compact snapshot: core idea in 2 lines, 3 key facts, 1 memory trick, 1 UPSC trap.

Always mention if a topic appeared in previous UPSC Prelims or Mains.
For current affairs, always link back to the static syllabus topic."""


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
async def chat_stream(
    body: ChatRequest,
    user: User = Depends(get_current_user)
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "Anthropic API key not configured")

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

    messages = []
    for msg in body.history[-12:]:
        role = "assistant" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    async def generate():
        try:
            async_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            async with async_client.messages.stream(
                model="claude-haiku-4-5",
                max_tokens=1024,
                system=system,
                messages=messages
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
