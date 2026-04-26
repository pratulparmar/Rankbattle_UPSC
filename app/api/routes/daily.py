from fastapi import APIRouter, Depends
from app.api.routes.auth import get_current_user
from datetime import date

router = APIRouter(prefix="/daily", tags=["daily"])


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
                    {
                        "headline": "Cabinet Approves National Water Mission Phase II",
                        "summary": "The Union Cabinet cleared a ₹28,000 crore initiative to improve water conservation across 13 river basins, focusing on drought-prone districts in Rajasthan, Maharashtra, and Karnataka.",
                        "tags": ["Governance", "Environment", "GS-3"],
                        "importance": "high"
                    },
                    {
                        "headline": "India Ratifies Kunming-Montreal Global Biodiversity Framework",
                        "summary": "India formally ratified the 30x30 target — protecting 30% of land and ocean areas by 2030 — marking a significant commitment under the Convention on Biological Diversity.",
                        "tags": ["Environment", "International Relations", "GS-3"],
                        "importance": "high"
                    },
                    {
                        "headline": "PM-KUSUM Scheme Expanded to 10 Lakh Farmers",
                        "summary": "The Ministry of New and Renewable Energy announced the expansion of the solar pump scheme, aiming to de-dieselise agriculture and reduce input costs for small and marginal farmers.",
                        "tags": ["Agriculture", "Energy", "GS-3"],
                        "importance": "medium"
                    },
                    {
                        "headline": "Supreme Court Upholds Right to Digital Access as Fundamental Right",
                        "summary": "A five-judge constitution bench held that internet access falls within Article 21 (Right to Life), with reasonable restrictions permissible only under established legal procedure.",
                        "tags": ["Polity", "Fundamental Rights", "GS-2"],
                        "importance": "high"
                    },
                    {
                        "headline": "India's Forex Reserves Cross $650 Billion Mark",
                        "summary": "RBI data shows India's foreign exchange reserves touched an all-time high, providing over 12 months of import cover and strengthening the rupee's stability.",
                        "tags": ["Economy", "GS-3"],
                        "importance": "medium"
                    }
                ]
            },
            {
                "id": "editorial",
                "title": "EDITORIAL ANALYSIS",
                "type": "editorial",
                "article": {
                    "source": "The Hindu",
                    "headline": "Federalism Under Strain: The Governor's Role in State Politics",
                    "intro": "Recent controversies surrounding the conduct of Governors in opposition-ruled states have reignited the debate on constitutional propriety and the boundaries of gubernatorial discretion.",
                    "paragraphs": [
                        "The framers of the Constitution envisioned the Governor as a constitutional head — a dignified figurehead who acts on the aid and advice of the elected Council of Ministers. Articles 153–161 lay down the Governor's powers, but the spirit of parliamentary democracy demands that these be exercised with restraint.",
                        "The Sarkaria Commission (1983) and the Punchhi Commission (2010) both cautioned against the misuse of gubernatorial discretion, particularly in matters of withholding assent to state bills and dismissing elected governments. The Supreme Court's ruling in Nabam Rebia v. Deputy Speaker (2016) reinforced that the Governor cannot act as an agent of the Centre.",
                        "What is needed is a binding code of conduct for Governors, backed by legislative reform. The time has come to revisit Article 156 — which makes the Governor's tenure coterminous with the President's pleasure — and introduce fixed, non-renewable terms to insulate the office from political pressures."
                    ],
                    "upsc_angle": "This editorial connects to GS-2: Constitutional Bodies, Federalism, and Centre-State Relations. Key terms: Aid and Advice, Article 200 (withholding assent), Doctrine of Pleasure.",
                    "key_terms": ["Article 153–161", "Sarkaria Commission", "Punchhi Commission", "Article 200", "Doctrine of Pleasure"]
                }
            },
            {
                "id": "current_affairs",
                "title": "CURRENT AFFAIRS FOCUS",
                "type": "cards",
                "items": [
                    {
                        "topic": "Prelims Fact",
                        "icon": "📌",
                        "content": "The Ramsar Convention on Wetlands was signed in 1971 in Ramsar, Iran. India currently has 82 Ramsar sites — the highest in Asia. The latest additions include Nanjarayan Tank (Tamil Nadu) and Karikili Bird Sanctuary (Tamil Nadu)."
                    },
                    {
                        "topic": "Mains Connect",
                        "icon": "✍️",
                        "content": "Q: 'The Governor is a constitutional head but not a rubber stamp.' Critically examine in light of recent controversies. (GS-2, 15 marks)"
                    },
                    {
                        "topic": "Map Pointer",
                        "icon": "🗺️",
                        "content": "Locate on map: Kaziranga National Park (Assam) — UNESCO World Heritage Site, home to 2/3rd of world's one-horned rhinoceros. The Brahmaputra and Mora Diphlu rivers bound the park."
                    },
                    {
                        "topic": "Economy Indicator",
                        "icon": "📈",
                        "content": "India's fiscal deficit target for 2025-26 is set at 4.4% of GDP, down from 4.9% in 2024-25 — reflecting the government's commitment to fiscal consolidation under the FRBM Act path."
                    }
                ]
            },
            {
                "id": "vocab",
                "title": "WORD OF THE DAY",
                "type": "vocabulary",
                "word": "Subsidiarity",
                "pronunciation": "sub-sid-ee-AR-i-tee",
                "meaning": "A principle holding that matters should be handled by the smallest, most local competent authority — used in federalism discourse to argue for greater state autonomy in concurrent list subjects.",
                "in_context": "The debate over GST compensation cess reflects a subsidiarity argument — states contend that revenue decisions affecting local economies should remain closer to state legislatures.",
                "related_terms": ["Fiscal Federalism", "Devolution", "Concurrent List", "Finance Commission"]
            }
        ]
    }


@router.get("")
def get_daily_edition(current_user=Depends(get_current_user)):
    """Get today's Aspirant's Daily edition — requires authentication."""
    return get_todays_content()


@router.get("/preview")
def get_daily_preview():
    """Public preview — returns only the date and section titles."""
    content = get_todays_content()
    return {
        "date": content["date"],
        "edition": content["edition"],
        "tagline": content["tagline"],
        "sections": [{"id": s["id"], "title": s["title"]} for s in content["sections"]]
    }
