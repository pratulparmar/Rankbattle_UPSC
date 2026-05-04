"""
test_api.py
===========
Full API test suite for RankBattle UPSC.
Tests every endpoint the frontend calls, in realistic user flow order.

Run:
  pip install requests tabulate
  python test_api.py
"""

import json
import time
import sys
import requests
from tabulate import tabulate
from datetime import datetime

# ── Config ─────────────────────────────────────────────────────────────────────

BASE_URL = "https://rankbattleupsc-production.up.railway.app"
TEST_EMAIL    = f"testuser_{int(time.time())}@gmail.com"
TEST_PASSWORD = "TestPass@2026"
TEST_NAME     = "Test Aspirant"

# ── Result tracker ─────────────────────────────────────────────────────────────

results = []
state   = {}  # shared state across tests (token, session_id etc.)


def record(name, passed, response_ms, status_code, detail=""):
    emoji = "✅" if passed else "❌"
    results.append({
        "Test":     f"{emoji} {name}",
        "Status":   status_code,
        "Time(ms)": response_ms,
        "Detail":   detail[:80] if detail else "",
    })
    print(f"  {'PASS' if passed else 'FAIL'} [{status_code}] {name} — {response_ms}ms"
          + (f" | {detail[:60]}" if detail else ""))


def post(path, body=None, token=None, expected=200):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    t = time.time()
    try:
        r = requests.post(f"{BASE_URL}{path}", json=body, headers=headers, timeout=15)
        ms = round((time.time() - t) * 1000)
        return r, ms
    except Exception as e:
        ms = round((time.time() - t) * 1000)
        return None, ms


def get(path, token=None, params=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    t = time.time()
    try:
        r = requests.get(f"{BASE_URL}{path}", headers=headers, params=params, timeout=15)
        ms = round((time.time() - t) * 1000)
        return r, ms
    except Exception as e:
        ms = round((time.time() - t) * 1000)
        return None, ms


def put(path, body=None, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    t = time.time()
    try:
        r = requests.put(f"{BASE_URL}{path}", json=body, headers=headers, timeout=15)
        ms = round((time.time() - t) * 1000)
        return r, ms
    except Exception as e:
        ms = round((time.time() - t) * 1000)
        return None, ms


# ── Test suites ────────────────────────────────────────────────────────────────

def test_health():
    print("\n── Health ────────────────────────────────────────────────────────")
    r, ms = get("/health")
    passed = r is not None and r.status_code == 200
    record("Health check", passed, ms, r.status_code if r else 0,
           r.json().get("status") if r and passed else str(r.text if r else "No response"))


def test_auth():
    print("\n── Auth ──────────────────────────────────────────────────────────")

    # 1. Register new user
    r, ms = post("/auth/register", {
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME
    })
    passed = r is not None and r.status_code == 200 and "access_token" in r.json()
    record("Register new user", passed, ms, r.status_code if r else 0)
    if passed:
        state["token"] = r.json()["access_token"]

    # 2. Login with same credentials
    r, ms = post("/auth/login", {"email": TEST_EMAIL, "password": TEST_PASSWORD})
    passed = r is not None and r.status_code == 200 and "access_token" in r.json()
    record("Login (email/password)", passed, ms, r.status_code if r else 0)
    if passed:
        state["token"] = r.json()["access_token"]

    # 3. Login with wrong password
    r, ms = post("/auth/login", {"email": TEST_EMAIL, "password": "wrongpass"})
    passed = r is not None and r.status_code == 401
    record("Login with wrong password (expect 401)", passed, ms, r.status_code if r else 0)

    # 4. Guest login
    r, ms = post("/auth/guest")
    passed = r is not None and r.status_code == 200 and "access_token" in r.json()
    record("Guest login", passed, ms, r.status_code if r else 0)
    if passed:
        state["guest_token"] = r.json()["access_token"]

    # 5. Get profile
    r, ms = get("/auth/me", token=state.get("token"))
    passed = r is not None and r.status_code == 200 and "email" in r.json()
    record("Get profile (/auth/me)", passed, ms, r.status_code if r else 0,
           r.json().get("email") if passed else "")

    # 6. Update profile
    r, ms = put("/auth/me", {"name": "Updated Aspirant", "target_year": 2026},
                token=state.get("token"))
    passed = r is not None and r.status_code == 200
    record("Update profile (PUT /auth/me)", passed, ms, r.status_code if r else 0)

    # 7. Unauthenticated request (expect 401/403)
    r, ms = get("/auth/me")
    passed = r is not None and r.status_code in (401, 403)
    record("Unauthenticated request (expect 401)", passed, ms, r.status_code if r else 0)

    # 8. Duplicate registration (expect 400)
    r, ms = post("/auth/register", {
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME
    })
    passed = r is not None and r.status_code == 400
    record("Duplicate register (expect 400)", passed, ms, r.status_code if r else 0)


def test_mcqs():
    print("\n── MCQs ──────────────────────────────────────────────────────────")
    token = state.get("token")

    # 1. Get subjects tree
    r, ms = get("/mcqs/subjects")
    passed = r is not None and r.status_code == 200
    detail = f"{len(r.json())} subjects" if passed else ""
    record("Get subjects tree", passed, ms, r.status_code if r else 0, detail)
    if passed:
        subjects = list(r.json().keys())
        state["subjects"] = subjects

    # 2. Get MCQs (no filter)
    r, ms = get("/mcqs", params={"limit": 10})
    passed = r is not None and r.status_code == 200 and len(r.json()) > 0
    record("Get MCQs (no filter)", passed, ms, r.status_code if r else 0,
           f"{len(r.json())} questions" if passed else "")

    # 3. Get MCQs (subject filter)
    r, ms = get("/mcqs", params={"subject": "Polity", "limit": 5})
    passed = r is not None and r.status_code == 200
    record("Get MCQs (subject=Polity)", passed, ms, r.status_code if r else 0,
           f"{len(r.json())} questions" if passed else "")

    # 4. Get MCQs (invalid subject — should return empty not error)
    r, ms = get("/mcqs", params={"subject": "InvalidSubject999"})
    passed = r is not None and r.status_code == 200 and r.json() == []
    record("Get MCQs (invalid subject → empty list)", passed, ms,
           r.status_code if r else 0)


def test_sessions():
    print("\n── Sessions ──────────────────────────────────────────────────────")
    token = state.get("token")

    # 1. Start session (small — 5 questions for speed)
    r, ms = post("/sessions/start", {
        "mode": "mock",
        "subject_filter": "Polity",
        "total_q": 5,
        "duration_mins": 10,
    }, token=token)
    passed = r is not None and r.status_code == 200
    record("Start session", passed, ms, r.status_code if r else 0)

    if passed:
        data = r.json()
        state["session_id"] = str(data.get("session_id"))
        state["questions"]  = data.get("questions", [])
        detail = f"session_id={state['session_id'][:8]}... | {len(state['questions'])} questions"
        print(f"    → {detail}")

        # Verify questions were returned
        has_questions = len(state["questions"]) == 5
        record("Session returns correct question count (5)", has_questions, 0,
               200, f"got {len(state['questions'])}")

        # Verify question structure
        q = state["questions"][0] if state["questions"] else {}
        has_structure = all(k in q for k in ["mcq_id", "stem", "options"])
        record("Question has required fields", has_structure, 0, 200,
               f"fields: {list(q.keys())}")

    # 2. Start session — not enough questions edge case
    r, ms = post("/sessions/start", {
        "mode": "mock",
        "subject_filter": "Polity",
        "total_q": 9999,
        "duration_mins": 120,
    }, token=token)
    passed = r is not None and r.status_code == 400
    record("Start session (too many questions → 400)", passed, ms,
           r.status_code if r else 0)

    # 3. Submit session
    session_id = state.get("session_id")
    questions  = state.get("questions", [])

    if session_id and questions:
        # Simulate answering — answer first 3, skip last 2
        attempts = []
        for i, q in enumerate(questions):
            attempts.append({
                "mcq_id":          q["mcq_id"],
                "selected_index":  i % 4 if i < 3 else None,
                "time_spent_secs": 30 + i * 5,
                "marked_review":   i == 1,
                "rag_viewed":      False,
            })

        r, ms = post(f"/sessions/{session_id}/submit", {"attempts": attempts}, token=token)
        passed = r is not None and r.status_code == 200
        record("Submit session", passed, ms, r.status_code if r else 0)

        if passed:
            result = r.json()
            has_score = "final_score" in result and "accuracy" in result
            record("Submit returns score + accuracy", has_score, 0, 200,
                   f"score={result.get('final_score')} accuracy={result.get('accuracy')}%")

        # 4. Double submit (expect 400)
        r, ms = post(f"/sessions/{session_id}/submit", {"attempts": attempts}, token=token)
        passed = r is not None and r.status_code == 400
        record("Double submit (expect 400)", passed, ms, r.status_code if r else 0)

    # 5. Get results
    if session_id:
        r, ms = get(f"/sessions/{session_id}/results", token=token)
        passed = r is not None and r.status_code == 200
        record("Get session results", passed, ms, r.status_code if r else 0)

        if passed:
            data = r.json()
            qs = data.get("question_results", [])
            record("Results returns question_results", len(qs) > 0, 0, 200,
                   f"{len(qs)} questions in results")

            # Verify snapshot integrity — questions in results match session questions
            session_ids = {q["mcq_id"] for q in state.get("questions", [])}
            result_ids  = {q["mcq_id"] for q in qs}
            snapshot_ok = session_ids == result_ids
            record("Results match session questions (snapshot integrity)",
                   snapshot_ok, 0, 200,
                   "✅ IDs match" if snapshot_ok else f"⚠️  Mismatch: {session_ids ^ result_ids}")

    # 6. Results for wrong user (expect 404)
    if session_id:
        guest_token = state.get("guest_token")
        if guest_token:
            r, ms = get(f"/sessions/{session_id}/results", token=guest_token)
            passed = r is not None and r.status_code in (403, 404)
            record("Results for wrong user (expect 403/404)", passed, ms,
                   r.status_code if r else 0)

    # 7. List sessions
    r, ms = get("/sessions/", token=token)
    passed = r is not None and r.status_code == 200 and isinstance(r.json(), list)
    record("List sessions", passed, ms, r.status_code if r else 0,
           f"{len(r.json())} sessions" if passed else "")


def test_analytics():
    print("\n── Analytics ─────────────────────────────────────────────────────")
    token = state.get("token")

    # 1. Get analytics
    r, ms = get("/analytics/me", token=token)
    passed = r is not None and r.status_code == 200
    record("Get analytics (/analytics/me)", passed, ms, r.status_code if r else 0,
           f"{len(r.json())} topic rows" if passed else "")

    # 2. Get weak areas
    r, ms = get("/analytics/me/weak-areas", token=token)
    passed = r is not None and r.status_code == 200
    record("Get weak areas", passed, ms, r.status_code if r else 0,
           f"{len(r.json())} weak topics" if passed else "")

    # 3. Unauthenticated analytics (expect 401/403)
    r, ms = get("/analytics/me")
    passed = r is not None and r.status_code in (401, 403)
    record("Unauthenticated analytics (expect 401)", passed, ms,
           r.status_code if r else 0)


def test_daily():
    print("\n── Aspirants Daily ───────────────────────────────────────────────")
    token = state.get("token")

    # 1. Daily preview (public)
    r, ms = get("/daily/preview")
    passed = r is not None and r.status_code == 200
    record("Daily preview (unauthenticated)", passed, ms, r.status_code if r else 0)

    # 2. Full daily content (authenticated)
    r, ms = get("/daily", token=token)
    passed = r is not None and r.status_code == 200
    record("Daily content (authenticated)", passed, ms, r.status_code if r else 0,
           f"{len(r.json().get('sections', []))} sections" if passed else "")

    # 3. Daily without auth (expect 401/403)
    r, ms = get("/daily")
    passed = r is not None and r.status_code in (401, 403)
    record("Daily unauthenticated (expect 401)", passed, ms, r.status_code if r else 0)


def test_admin():
    print("\n── Admin ─────────────────────────────────────────────────────────")

    # 1. Question bank (no auth needed per current impl)
    r, ms = get("/admin/questions", params={"page": 1, "page_size": 10})
    passed = r is not None and r.status_code == 200
    record("Admin questions (page 1)", passed, ms, r.status_code if r else 0,
           f"total={r.json().get('total')} page_size={r.json().get('page_size')}" if passed else "")

    # 2. Subject filter
    r, ms = get("/admin/questions", params={"subject": "Economy", "page_size": 5})
    passed = r is not None and r.status_code == 200
    record("Admin questions (subject=Economy)", passed, ms, r.status_code if r else 0)

    # 3. Search
    r, ms = get("/admin/questions", params={"search": "GST", "page_size": 5})
    passed = r is not None and r.status_code == 200
    record("Admin questions (search=GST)", passed, ms, r.status_code if r else 0,
           f"{len(r.json().get('questions', []))} results" if passed else "")


# ── Summary ────────────────────────────────────────────────────────────────────

def print_summary():
    print("\n" + "═" * 70)
    print("  TEST SUMMARY")
    print("═" * 70)
    print(tabulate(results, headers="keys", tablefmt="simple"))

    total   = len(results)
    passed  = sum(1 for r in results if "✅" in r["Test"])
    failed  = total - passed
    avg_ms  = round(sum(r["Time(ms)"] for r in results if r["Time(ms)"] > 0)
                    / max(sum(1 for r in results if r["Time(ms)"] > 0), 1))

    print(f"\n  Total: {total} | ✅ Passed: {passed} | ❌ Failed: {failed}")
    print(f"  Avg response time: {avg_ms}ms")

    slow = [r for r in results if r["Time(ms)"] > 2000]
    if slow:
        print(f"\n  ⚠️  Slow endpoints (>2s):")
        for r in slow:
            print(f"     {r['Test']} — {r['Time(ms)']}ms")

    if failed > 0:
        print(f"\n  ❌ Failed tests:")
        for r in results:
            if "❌" in r["Test"]:
                print(f"     {r['Test']} [{r['Status']}] {r['Detail']}")

    print()
    return failed


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nRankBattle UPSC — API Test Suite")
    print(f"Target: {BASE_URL}")
    print(f"Time:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    test_health()
    test_auth()
    test_mcqs()
    test_sessions()
    test_analytics()
    test_daily()
    test_admin()

    failed_count = print_summary()
    sys.exit(1 if failed_count > 0 else 0)