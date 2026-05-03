"""
fix_cat2_retry.py
=================
Retries only the 11 failed questions from fix_cat2_pipeline.py
with a longer delay between Gemini calls.

Run:
  python fix_cat2_retry.py           ← dry run
  python fix_cat2_retry.py --commit  ← writes to DB
"""

import json
import sys

# Inject the 11 failed mcq_ids directly
FAILED_IDS = [
    "ENV_RPT_Q012",
    "GEO_RIV_Q014",
    "GEO_SOIL_Q013",
    "GEO_SOIL_Q015",
    "GEO_VEG_Q004",
    "GEO_VEG_Q006",
    "GEO_VEG_Q012",
    "HIS_ANC1_Q007",
    "HIS_ANC2_Q017",
    "POL_HIS_Q015",
    "POL_PARL_Q025",
]

# Load cat2 and filter to only failed questions
with open("cat2_needs_api.json") as f:
    data = json.load(f)

failed_questions = [q for q in data["questions"] if q["mcq_id"] in FAILED_IDS]

# Override with filtered list and longer delay
data["questions"] = failed_questions
data["count"] = len(failed_questions)

with open("cat2_retry.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"Created cat2_retry.json with {len(failed_questions)} questions")
print("Now patching pipeline to use longer delay and cat2_retry.json...")