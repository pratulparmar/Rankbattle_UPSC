"""Best-effort visitor logging for the public demo.

Records who is checking out the app: whatever the visitor optionally shares
(name / organisation) plus server-side IP -> geo/org enrichment. Never raises
and never blocks the request meaningfully (2.5s hard cap on the IP lookup).
"""
from datetime import datetime
import requests

from app.models.models import Visit


def _client_ip(request) -> str | None:
    h = request.headers
    xff = (h.get("x-forwarded-for") or "").split(",")[0].strip()
    return h.get("cf-connecting-ip") or (xff or None) or (
        request.client.host if request.client else None
    )


def _is_private(ip: str | None) -> bool:
    if not ip:
        return True
    return (
        ip == "::1"
        or ip.startswith("127.")
        or ip.startswith("10.")
        or ip.startswith("192.168.")
        or ip.startswith("::ffff:127.")
        or ip == "localhost"
        or any(ip.startswith(f"172.{o}.") for o in range(16, 32))
    )


def _enrich(ip: str | None) -> dict:
    if _is_private(ip):
        return {}
    try:
        r = requests.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,country,regionName,city,isp,org,as"},
            timeout=2.5,
        )
        d = r.json()
        if d.get("status") != "success":
            return {}
        return {
            "city": d.get("city"),
            "region": d.get("regionName"),
            "country": d.get("country"),
            "ip_org": d.get("org") or d.get("isp") or d.get("as"),
        }
    except Exception:
        return {}


def record_visit(request, db, user_id=None, name=None, org=None) -> None:
    """Insert one Visit row. Swallows all errors so it can never break entry."""
    try:
        ip = _client_ip(request)
        geo = _enrich(ip)
        db.add(
            Visit(
                user_id=user_id,
                name=name or None,
                org=org or None,
                ip=ip,
                user_agent=request.headers.get("user-agent"),
                referrer=request.headers.get("referer") or request.headers.get("referrer"),
                created_at=datetime.utcnow(),
                **geo,
            )
        )
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[visits] failed to record visit: {e}")
