"""
Admin Routes — Question Bank Viewer
"""
import os
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import json

from app.db.database import get_db
from app.models.models import Visit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/questions")
def get_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Paginated question bank viewer with subject filter and full-text search.
    Returns everything: stem, options, correct_index, explanation.
    """
    conditions = []
    params: dict = {}

    if subject:
        conditions.append("subject = :subject")
        params["subject"] = subject

    if search:
        conditions.append("(stem ILIKE :search OR subject ILIKE :search OR topic_id ILIKE :search)")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Total count
    total = db.execute(
        text(f"SELECT COUNT(*) FROM mcq_bank {where}"),
        params,
    ).scalar()

    # Paginated rows
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.execute(
        text(f"""
            SELECT mcq_id, subject, topic_id, stem, options, correct_index, explanation
            FROM mcq_bank
            {where}
            ORDER BY subject, mcq_id
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()

    questions = []
    for r in rows:
        options = r.options if isinstance(r.options, list) else json.loads(r.options or "[]")
        explanation = r.explanation if isinstance(r.explanation, dict) else json.loads(r.explanation or "{}")
        questions.append({
            "mcq_id": r.mcq_id,
            "subject": r.subject,
            "topic_id": r.topic_id,
            "stem": r.stem,
            "options": options,
            "correct_index": r.correct_index,
            "explanation": explanation,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "questions": questions,
    }


# ── Visitor dashboard ───────────────────────────────────────────────────────
# Private view of who has been checking out the public demo. Guarded by a shared
# secret in the ADMIN_KEY env var — pass ?key=... (or an x-admin-key header).

def _admin_ok(request: Request) -> bool:
    key = os.getenv("ADMIN_KEY")
    if not key:
        return False
    given = request.query_params.get("key") or request.headers.get("x-admin-key")
    return given == key


def _esc(v) -> str:
    s = "" if v is None else str(v)
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&#39;"))


@router.get("/visitors.json")
def visitors_json(request: Request, db: Session = Depends(get_db)):
    if not _admin_ok(request):
        return {"error": "Unauthorized"}
    rows = db.query(Visit).order_by(Visit.created_at.desc()).limit(1000).all()
    return {
        "count": len(rows),
        "visits": [
            {
                "created_at": str(v.created_at),
                "name": v.name, "org": v.org,
                "ip_org": v.ip_org, "city": v.city, "region": v.region,
                "country": v.country, "referrer": v.referrer, "user_agent": v.user_agent,
            } for v in rows
        ],
    }


@router.get("/visitors", response_class=HTMLResponse)
def visitors_page(request: Request, db: Session = Depends(get_db)):
    if not _admin_ok(request):
        return HTMLResponse(
            '<body style="font-family:system-ui;padding:40px">🔒 Unauthorized. '
            'Append <code>?key=YOUR_ADMIN_KEY</code> to the URL.</body>', status_code=401)

    rows = db.query(Visit).order_by(Visit.created_at.desc()).limit(500).all()
    total = db.query(Visit).count()
    named = db.query(Visit).filter(Visit.name.isnot(None)).count()

    body = ""
    for v in rows:
        when = str(v.created_at)[:19] if v.created_at else "—"
        loc = ", ".join([x for x in [v.city, v.region, v.country] if x]) or "—"
        body += (
            "<tr>"
            f"<td>{_esc(when)}</td>"
            f"<td><b>{_esc(v.name or '—')}</b></td>"
            f"<td>{_esc(v.org or '—')}</td>"
            f"<td>{_esc(v.ip_org or '—')}</td>"
            f"<td>{_esc(loc)}</td>"
            f"<td class='muted'>{_esc(v.referrer or '—')}</td>"
            f"<td class='muted small'>{_esc((v.user_agent or '')[:60])}</td>"
            "</tr>"
        )
    if not body:
        body = "<tr><td colspan='7' style='padding:30px;text-align:center;color:#8a8aa0'>No visits yet.</td></tr>"

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RankBattle UPSC · Visitors</title>
<style>
  body{{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1020;color:#e8e8f0}}
  header{{padding:22px 28px;border-bottom:1px solid #26264a}}
  h1{{margin:0;font-size:20px}}
  .stats{{display:flex;gap:28px;margin-top:10px;font-size:13px;color:#9a9aad}}
  .stats b{{color:#e2b04a;font-size:16px}}
  .wrap{{overflow-x:auto;padding:0 12px 40px}}
  table{{border-collapse:collapse;width:100%;font-size:13px;min-width:820px}}
  th,td{{padding:9px 12px;text-align:left;border-bottom:1px solid #20203c;white-space:nowrap}}
  th{{position:sticky;top:0;background:#16162e;color:#b8b8cc;font-weight:600}}
  tr:hover td{{background:#15152a}}
  .muted{{color:#8a8aa0;max-width:280px;overflow:hidden;text-overflow:ellipsis}}
  .small{{font-size:11px}} td b{{color:#fff}}
</style></head><body>
<header>
  <h1>👀 Who checked out RankBattle UPSC</h1>
  <div class="stats">
    <span><b>{total}</b> total visits</span>
    <span><b>{named}</b> left their name</span>
    <span>showing latest {len(rows)}</span>
  </div>
</header>
<div class="wrap"><table>
  <thead><tr><th>When (UTC)</th><th>Name</th><th>Organization</th>
  <th>Network / ISP</th><th>Location</th><th>Referrer</th><th>Device</th></tr></thead>
  <tbody>{body}</tbody>
</table></div></body></html>"""
    return HTMLResponse(html)
