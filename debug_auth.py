# debug_auth.py
import requests

BASE_URL = "https://rankbattleupsc-production.up.railway.app"

try:
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": "debug_test@gmail.com",
        "password": "TestPass@2026",
        "name": "Debug User"
    }, timeout=15)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")
except Exception as e:
    print(f"Exception type: {type(e).__name__}")
    print(f"Exception: {e}")
