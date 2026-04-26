from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import uuid

from app.db.database import get_db
from app.models.models import User
from app.core.auth import decode_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer()
router = APIRouter(prefix="/daily", tags=["daily"])


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = decode_token(creds.credentials)
        user = db.query(User).filter(User.user_id == uuid.UUID(payload["sub"])).first()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except Exception:
        raise HTTPException(401, "Invalid token")


def get_todays_content():
    today = date.today()
    return {
        "date": today.strftime("%A, %d %B %Y").upper(),
        "edition": "Ivory Edition",
        "volume": "Vol. I",
        "tagline": "A Quiet Companion for UPSC Preparation",
        "sections": [
            {
                "id": "brief",
                "title": "THE DAILY BRIEF",
                "type": "headlines",
                "items": [
                    {"headline": "Cabinet Approves National Water Mission Phase II", "summary": "The Union Cabinet cleared a Rs 28,000 crore initiative to improve water conservation across 13 river basins.", "tags": ["Governance", "Environment", "GS-3"], "importance": "high"},
                    {"headline": "India Ratifies Kunming-Montreal Global Biodiversity Framework", "summary": "India formally ratified the 30x30 target, protecting 30% of land and ocean areas by 2030.", "tags": ["Environment", "International Relations", "GS-3"], "importance": "high"},
                    {"headline": "Supreme Court Upholds Right to Digital Access", "summary": "A five-judge bench held that internet access falls within Article 21 (Right to Life).", "tags": ["Polity", "Fundamental Rights", "GS-2"], "importance": "high"},
                    {"headline": "India Forex Reserves Cross $650 Billion", "summary": "RBI data shows reserves touched an all-time high, providing over 12 months of import cover.", "tags": ["Economy", "GS-3"], "importance": "medium"}
                ]
            },
            {
                "id": "editorial",
                "title": "EDITORIAL ANALYSIS",
                "type": "editorial",
                "article": {
                    "source": "The Hindu",
                    "headline": "Federalism Under Strain: The Governor's Role in State Politics",
                    "intro": "Recent controversies surrounding Governors in opposition-ruled states have reignited the debate on constitutional propriety.",
                    "paragraphs": [
                        "The framers of the Constitution envisioned the Governor as a constitutional head who acts on the aid and advice of the elected Council of Ministers.",
                        "The Sarkaria Commission (1983) and Punchhi Commission (2010) both cautioned against misuse of gubernatorial discretion.",
                        "What is needed is a binding code of conduct for Governors backed by legislative reform, including fixed non-renewable terms under Article 156."
                    ],
                    "upsc_angle": "GS-2: Constitutional Bodies, Federalism, Centre-State Relations.",
                    "key_terms": ["Article 153-161", "Sarkaria Commission", "Punchhi Commission", "Article 200", "Doctrine of Pleasure"]
                }
            },
            {
                "id": "current_affairs",
                "title": "CURRENT AFFAIRS FOCUS",
                "type": "cards",
                "items": [
                    {"topic": "Prelims Fact", "icon": "📌", "content": "India has 82 Ramsar wetland sites — the highest in Asia."},
                    {"topic": "Mains Connect", "icon": "✍️", "content": "Q: 'The Governor is a constitutional head but not a rubber stamp.' Critically examine. (GS-2, 15 marks)"},
                    {"topic": "Map Pointer", "icon": "🗺️", "content": "Kaziranga National Park (Assam) — UNESCO World Heritage Site, home to 2/3rd of world's one-horned rhinoceros."},
                    {"topic": "Economy Indicator", "icon": "📈", "content": "Fiscal deficit target for 2025-26 is 4.4% of GDP, down from 4.9% — part of FRBM Act consolidation path."}
                ]
            },
            {
                "id": "vocab",
                "title": "WORD OF THE DAY",
                "type": "vocabulary",
                "word": "Subsidiarity",
                "pronunciation": "sub-sid-ee-AR-i-tee",
                "meaning": "A principle that matters should be handled by the smallest, most local competent authority.",
                "in_context": "The GST compensation cess debate reflects a subsidiarity argument — states contend revenue decisions should remain closer to state legislatures.",
                "related_terms": ["Fiscal Federalism", "Devolution", "Concurrent List", "Finance Commission"]
            }
        ]
    }


@router.get("")
def get_daily_edition(current_user=Depends(get_current_user)):
    return get_todays_content()


@router.get("/preview")
def get_daily_preview():
    content = get_todays_content()
    return {
        "date": content["date"],
        "edition": content["edition"],
        "tagline": content["tagline"],
        "sections": [{"id": s["id"], "title": s["title"]} for s in content["sections"]]
    }
