"""
locustfile.py
=============
Load test for RankBattle UPSC API.
Simulates real user behaviour: login → start test → answer → submit → results

Run:
  locust --headless -u 50 -r 5 --run-time 2m --host https://rankbattleupsc-production.up.railway.app
  
  -u 50     = 50 concurrent users
  -r 5      = spawn 5 users per second
  --run-time 2m = run for 2 minutes
"""

import random
import json
from locust import HttpUser, task, between, events

TEST_USERS = [
    {"email": f"loadtest_{i}@gmail.com", "password": "LoadTest@2026", "name": f"Load Tester {i}"}
    for i in range(100)
]

SUBJECTS = ["Polity", "Economy", "History", "Geography", "Environment", "Science & Tech"]


class UPSCUser(HttpUser):
    wait_time = between(1, 3)  # think time between actions
    token     = None
    session_id = None
    questions  = []

    def on_start(self):
        """Called when a simulated user starts — register + login."""
        user = random.choice(TEST_USERS)

        # Try login first (user may already exist from previous run)
        res = self.client.post("/auth/login", json={
            "email":    user["email"],
            "password": user["password"],
        }, name="/auth/login", catch_response=True)

        if res.status_code == 401:
            # Register then login
            self.client.post("/auth/register", json=user, name="/auth/register")
            res = self.client.post("/auth/login", json={
                "email":    user["email"],
                "password": user["password"],
            }, name="/auth/login")

        if res.status_code == 200:
            self.token = res.json().get("access_token")
        else:
            # Fall back to guest
            res = self.client.post("/auth/guest", name="/auth/guest")
            if res.status_code == 200:
                self.token = res.json().get("access_token")

    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def browse_subjects(self):
        """Most common action — browsing subjects."""
        self.client.get("/mcqs/subjects", name="/mcqs/subjects")

    @task(2)
    def browse_mcqs(self):
        """Browse questions for a subject."""
        subject = random.choice(SUBJECTS)
        self.client.get(
            "/mcqs",
            params={"subject": subject, "limit": 10},
            name="/mcqs?subject=[subject]"
        )

    @task(5)
    def full_test_flow(self):
        """Core flow: start session → answer questions → submit → get results."""
        if not self.token:
            return

        subject = random.choice(SUBJECTS)

        # Start session (10 questions for speed)
        res = self.client.post("/sessions/start", json={
            "mode":           "mock",
            "subject_filter": subject,
            "total_q":        10,
            "duration_mins":  20,
        }, headers=self.auth_headers(), name="/sessions/start")

        if res.status_code != 200:
            return

        data       = res.json()
        session_id = str(data.get("session_id"))
        questions  = data.get("questions", [])

        if not questions:
            return

        # Simulate answering (with think time)
        attempts = []
        for i, q in enumerate(questions):
            attempts.append({
                "mcq_id":          q["mcq_id"],
                "selected_index":  random.randint(0, 3) if random.random() > 0.2 else None,
                "time_spent_secs": random.randint(20, 90),
                "marked_review":   random.random() > 0.8,
                "rag_viewed":      False,
            })

        # Submit
        res = self.client.post(
            f"/sessions/{session_id}/submit",
            json={"attempts": attempts},
            headers=self.auth_headers(),
            name="/sessions/[id]/submit"
        )

        if res.status_code != 200:
            return

        # Get results
        self.client.get(
            f"/sessions/{session_id}/results",
            headers=self.auth_headers(),
            name="/sessions/[id]/results"
        )

    @task(2)
    def check_analytics(self):
        """Check personal analytics."""
        if not self.token:
            return
        self.client.get(
            "/analytics/me",
            headers=self.auth_headers(),
            name="/analytics/me"
        )

    @task(1)
    def check_daily(self):
        """Read daily content."""
        if not self.token:
            return
        self.client.get(
            "/daily",
            headers=self.auth_headers(),
            name="/daily"
        )

    @task(1)
    def check_profile(self):
        """Check own profile."""
        if not self.token:
            return
        self.client.get(
            "/auth/me",
            headers=self.auth_headers(),
            name="/auth/me"
        )