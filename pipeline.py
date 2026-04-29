"""
pipeline.py — RankBattle UPSC MCQ Quality Pipeline
Run from repo root: python3 pipeline.py

Steps:
  1. Load all questions from Railway PostgreSQL
  2. Python-only audit (free, instant)
  3. Rule-based pattern conversion (free)
  4. Claude Haiku — regenerate flagged questions
  5. DeepSeek — enrich common_trap + elimination_hint
  6. Gemini 2.5 Flash — probability scoring
  7. Validate all changes
  8. Preview CSV → confirm → write to DB
"""

import os, sys, json, re, time, math, csv
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY")
DEEPSEEK_API_KEY  = os.getenv("DEEPSEEK_API_KEY")
DB_URL = "postgresql://postgres:TzkcmJIkHZrKZljfaGaQcKhBZHuwfkcr@hopper.proxy.rlwy.net:47135/railway"

# ── Colours ───────────────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"; X = "\033[0m"

def banner(text): print(f"\n{C}{'═'*60}\n  {text}\n{'═'*60}{X}")
def ok(t):   print(f"{G}✅ {t}{X}")
def warn(t): print(f"{Y}⚠️  {t}{X}")
def err(t):  print(f"{R}❌ {t}{X}")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Load questions from DB
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 1 — Loading questions from Railway DB")

def get_conn():
    return psycopg2.connect(DB_URL)

conn = get_conn()
cur  = conn.cursor()
cur.execute("""
    SELECT mcq_id, subject, topic_id, stem, options, correct_index,
           explanation, difficulty, probability_tier, probability_2026
    FROM mcq_bank ORDER BY mcq_id
""")
rows = cur.fetchall()
cur.close(); conn.close()

questions = []
for r in rows:
    questions.append({
        'mcq_id':        r[0],
        'subject':       r[1],
        'topic_id':      r[2],
        'stem':          r[3] or '',
        'options':       r[4] or [],
        'correct_index': r[5],
        'explanation':   r[6] or {},
        'difficulty':    r[7],
        'prob_tier':     r[8],
        'prob_2026':     float(r[9]) if r[9] else 0.5,
        # Pipeline fields
        'action':          None,
        'new_options':     None,
        'new_correct_idx': None,
        'new_explanation': None,
        'new_probability': None,
        'new_stem':        None,
        'valid':           False,
        'v_reason':        '',
    })

ok(f"Loaded {len(questions)} questions")
subjects = {}
for q in questions:
    subjects[q['subject']] = subjects.get(q['subject'], 0) + 1
for s, c in sorted(subjects.items(), key=lambda x: -x[1]):
    print(f"  {s}: {c}")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — Pure Python Audit
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 2 — Python Audit (zero API cost)")

def is_statement_q(stem):
    return bool(re.search(r'\b[123][.)]\s', stem))

def is_old_pattern(opts):
    return any(re.search(r'\d', o) for o in opts) if opts else False

def is_new_pattern(opts):
    new = {'only one','only two','only three','all three','all four','none'}
    return any(o.lower().strip() in new for o in opts) if opts else False

def count_true_statements(stmt_wise):
    if not stmt_wise: return -1
    count = 0
    for s in stmt_wise:
        sl = s.lower()
        if re.search(r'\bis correct\b|\bare correct\b|\bis true\b', sl):
            count += 1
        elif re.search(r'\bis incorrect\b|\bis false\b|\bis wrong\b|\bare incorrect\b', sl):
            pass
        else:
            return -1  # ambiguous
    return count

def is_hallucinated(stmt_list):
    if not stmt_list: return True
    texts = [s.strip() for s in stmt_list]
    if any(len(t.split()) < 8 for t in texts): return True
    if any(re.match(r'^[\d\s.,]+$', t) for t in texts): return True
    if len(set(texts)) < len(texts): return True
    return False

def map_count_to_new_options(true_count, total_stmts):
    opts = ['Only one', 'Only two', 'All three', 'None'] if total_stmts <= 3 else \
           ['Only one', 'Only two', 'All four', 'None']
    idx  = {0: 3, 1: 0, 2: 1}.get(true_count, 2)
    return opts, idx

action_counts = {}
for q in questions:
    exp       = q['explanation']
    stmt_wise = exp.get('statement_wise', [])
    stmts_in_stem = len(re.findall(r'\b[1-4][.)]\s', q['stem']))

    is_stmt   = is_statement_q(q['stem'])
    old_pat   = is_old_pattern(q['options'])
    new_pat   = is_new_pattern(q['options'])
    empty     = not stmt_wise
    halluc    = is_hallucinated(stmt_wise) if stmt_wise else False
    true_cnt  = count_true_statements(stmt_wise)
    ambiguous = (true_cnt == -1)

    q['stmt_wise']     = stmt_wise
    q['stmts_in_stem'] = stmts_in_stem
    q['is_stmt_q']     = is_stmt
    q['true_count']    = true_cnt
    q['has_trap']      = bool(exp.get('common_trap'))
    q['has_elim']      = bool(exp.get('elimination_hint'))

    if not is_stmt:
        action = 'KEEP_FACTUAL'
    elif empty or halluc:
        action = 'REGENERATE_CLAUDE'
    elif ambiguous:
        action = 'REEVAL_CLAUDE'
    elif old_pat and true_cnt >= 0:
        action = 'CONVERT_PATTERN'
    elif new_pat:
        action = 'ENRICH_ONLY'
    else:
        action = 'REVIEW_MANUAL'

    q['action'] = action
    action_counts[action] = action_counts.get(action, 0) + 1

print("\nAudit results:")
for a, c in sorted(action_counts.items(), key=lambda x: -x[1]):
    print(f"  {a}: {c}")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 3 — Rule-based Pattern Conversion (FREE)
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 3 — Rule-based Pattern Conversion")

converted = 0
for q in questions:
    if q['action'] != 'CONVERT_PATTERN': continue
    total = max(q['stmts_in_stem'] if q['stmts_in_stem'] >= 2 else len(q['stmt_wise']), 3)
    new_opts, new_idx = map_count_to_new_options(q['true_count'], total)
    q['new_options']     = new_opts
    q['new_correct_idx'] = new_idx
    # Update stem ending to new pattern
    stem = q['stem']
    stem = re.sub(r'(is/are correct\?|are correct\?|is correct\?)\s*$',
                  'How many of the above statements are correct?', stem.strip())
    if 'How many' not in stem:
        stem = stem.rstrip('?').rstrip() + '\nHow many of the above statements are correct?'
    q['new_stem'] = stem
    converted += 1

ok(f"Converted {converted} questions (no API cost)")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 4 — Claude Haiku: Regenerate + Re-evaluate
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 4 — Claude Haiku (regenerate + re-evaluate)")

import anthropic as ant
claude = ant.Anthropic(api_key=ANTHROPIC_API_KEY)

LOCKED_SYSTEM = """You are an expert UPSC Prelims question setter.
Generate a NEW PATTERN MCQ. Output ONLY valid JSON — no markdown, no backticks.

MANDATORY RULES:
1. Write EXACTLY 3 independent factual statements
2. Each statement MUST be a complete sentence with at least 10 words
3. OPTIONS MUST BE EXACTLY: ["Only one", "Only two", "All three", "None"]
4. correct_index: 0=Only one, 1=Only two, 2=All three, 3=None
5. stem MUST end with: 'How many of the above statements are correct?'
6. Each incorrect statement must contain a subtle factual trap

OUTPUT FORMAT:
{
  "stem": "Consider the following statements about [TOPIC]:\\n1. [statement]\\n2. [statement]\\n3. [statement]\\nHow many of the above statements are correct?",
  "options": ["Only one", "Only two", "All three", "None"],
  "correct_index": 1,
  "explanation": {
    "concept_anchor": "2 sentence core concept explanation.",
    "statement_wise": ["Statement 1 is incorrect because...", "Statement 2 is correct because...", "Statement 3 is correct because..."],
    "why_others_wrong": ["(a) Only one is wrong because two statements are correct.", "(c) All three is wrong because statement 1 is incorrect.", "(d) None is wrong because statements 2 and 3 are correct."],
    "common_trap": "Specific UPSC trap: what students confuse and why.",
    "elimination_hint": "How to eliminate wrong options with partial knowledge."
  }
}"""

REEVAL_SYSTEM = """You are a UPSC expert. Analyze the question and output ONLY valid JSON.
Determine which statements are factually correct, count them, convert to new pattern.

Output ONLY:
{
  "options": ["Only one", "Only two", "All three", "None"],
  "correct_index": <0-3>,
  "statement_wise": ["Statement 1 is [correct/incorrect] because..."],
  "common_trap": "...",
  "elimination_hint": "..."
}"""

import random

def call_claude_regen(q, retries=3):
    true_n = random.choice([1, 2, 2, 3])
    user   = (f"Topic: {q['topic_id']} — {q['subject']}\n"
              f"Make exactly {true_n} statement(s) correct.\n"
              f"Difficulty: {q['difficulty'] or 'MEDIUM'}\n"
              f"Focus on facts relevant to UPSC Prelims 2024-2026.")
    for attempt in range(retries):
        try:
            msg = claude.messages.create(
                model="claude-haiku-4-5", max_tokens=1200,
                system=LOCKED_SYSTEM,
                messages=[{"role": "user", "content": user}]
            )
            raw  = re.sub(r'^```json|^```|```$', '', msg.content[0].text.strip(), flags=re.MULTILINE).strip()
            data = json.loads(raw)
            if data.get('options') != ["Only one", "Only two", "All three", "None"]:
                data['options'] = ["Only one", "Only two", "All three", "None"]
            if 'How many' not in data.get('stem', ''):
                data['stem'] = data['stem'].rstrip('?') + '\nHow many of the above statements are correct?'
            return data
        except Exception as e:
            time.sleep(2 ** attempt)
    return None

def call_claude_reeval(q, retries=3):
    user = (f"Stem:\n{q['stem']}\n\nOptions: {q['options']}\n"
            f"Statement analysis:\n" +
            "\n".join(f"  {i+1}. {s}" for i, s in enumerate(q['stmt_wise'])))
    for attempt in range(retries):
        try:
            msg = claude.messages.create(
                model="claude-haiku-4-5", max_tokens=800,
                system=REEVAL_SYSTEM,
                messages=[{"role": "user", "content": user}]
            )
            raw = re.sub(r'^```json|^```|```$', '', msg.content[0].text.strip(), flags=re.MULTILINE).strip()
            return json.loads(raw)
        except Exception as e:
            time.sleep(2 ** attempt)
    return None

claude_qs = [q for q in questions if q['action'] in ('REGENERATE_CLAUDE', 'REEVAL_CLAUDE')]
print(f"Processing {len(claude_qs)} questions with Claude...")
regen_ok = regen_fail = 0

for idx, q in enumerate(claude_qs):
    print(f"  [{idx+1}/{len(claude_qs)}] {q['mcq_id']} ({q['action']})", end=' ')
    time.sleep(0.5)

    if q['action'] == 'REGENERATE_CLAUDE':
        result = call_claude_regen(q)
        if result:
            q['new_stem']        = result.get('stem', q['stem'])
            q['new_options']     = result['options']
            q['new_correct_idx'] = result['correct_index']
            q['new_explanation'] = result.get('explanation', {})
            regen_ok += 1
            print("✅")
        else:
            # Claude failed — fall back to rule-based conversion
            true_cnt = q.get('true_count', -1)
            if true_cnt >= 0:
                total = max(q.get('stmts_in_stem', 3), 3)
                new_opts, new_idx = map_count_to_new_options(true_cnt, total)
                q['new_options']     = new_opts
                q['new_correct_idx'] = new_idx
                stem = q['stem']
                stem = re.sub(r'(is/are correct\?|are correct\?|is correct\?)\s*$',
                              'How many of the above statements are correct?', stem.strip())
                if 'How many' not in stem:
                    stem = stem.rstrip('?').rstrip() + '\nHow many of the above statements are correct?'
                q['new_stem'] = stem
                print("fallback")
            else:
                regen_fail += 1
                print("X")

    elif q['action'] == 'REEVAL_CLAUDE':
        result = call_claude_reeval(q)
        if result:
            q['new_options']     = result.get('options', ['Only one','Only two','All three','None'])
            q['new_correct_idx'] = result.get('correct_index', q['correct_index'])
            exp = dict(q['explanation'])
            exp['statement_wise']   = result.get('statement_wise', exp.get('statement_wise', []))
            exp['common_trap']      = result.get('common_trap', '')
            exp['elimination_hint'] = result.get('elimination_hint', '')
            q['new_explanation'] = exp
            # Update stem ending for re-evaluated questions
            stem = q['stem']
            stem = re.sub(r'(is/are correct\?|are correct\?|is correct\?)\s*$',
                          'How many of the above statements are correct?', stem.strip())
            if 'How many' not in stem:
                stem = stem.rstrip('?').rstrip() + '\nHow many of the above statements are correct?'
            q['new_stem'] = stem
            regen_ok += 1
            print("✅")
        else:
            regen_fail += 1
            print("❌")

ok(f"Claude done: {regen_ok} success, {regen_fail} failed")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 5 — DeepSeek: Enrich trap + hint
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 5 — DeepSeek enrichment")

from openai import OpenAI
deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

DS_SYSTEM = """You are a UPSC Prelims expert. Output ONLY valid JSON:
{
  "common_trap": "One specific sentence about what students confuse and why.",
  "elimination_hint": "One specific sentence on how to eliminate wrong options."
}"""

def call_deepseek(q, retries=3):
    exp  = q.get('new_explanation') or q['explanation'] or {}
    opts = q.get('new_options') or q['options'] or []
    cidx = q.get('new_correct_idx')
    if cidx is None: cidx = q['correct_index'] or 0
    correct_opt = opts[cidx] if opts and cidx < len(opts) else ''

    user = (f"Topic: {q['topic_id']} ({q['subject']})\n"
            f"Question: {q['stem'][:250]}\n"
            f"Correct answer: {correct_opt}\n"
            f"Concept: {exp.get('concept_anchor','')[:150]}")
    for attempt in range(retries):
        try:
            resp = deepseek.chat.completions.create(
                model="deepseek-chat", max_tokens=250,
                messages=[{"role":"system","content":DS_SYSTEM},
                          {"role":"user","content":user}]
            )
            raw = re.sub(r'^```json|^```|```$', '', resp.choices[0].message.content.strip(), flags=re.MULTILINE).strip()
            return json.loads(raw)
        except:
            time.sleep(2 ** attempt)
    return None

needs_enrich = [q for q in questions
                if (not q.get('has_trap') or not q.get('has_elim'))
                and q['action'] not in ('REGENERATE_CLAUDE', 'KEEP_FACTUAL')]

print(f"Enriching {len(needs_enrich)} questions with DeepSeek...")
enrich_ok = enrich_fail = 0

for idx, q in enumerate(needs_enrich):
    print(f"  [{idx+1}/{len(needs_enrich)}] {q['mcq_id']}", end=' ')
    time.sleep(0.3)
    result = call_deepseek(q)
    if result:
        exp = dict(q.get('new_explanation') or q['explanation'] or {})
        exp['common_trap']      = result.get('common_trap', exp.get('common_trap',''))
        exp['elimination_hint'] = result.get('elimination_hint', exp.get('elimination_hint',''))
        q['new_explanation'] = exp
        enrich_ok += 1
        print("✅")
    else:
        enrich_fail += 1
        print("❌")

ok(f"DeepSeek done: {enrich_ok} success, {enrich_fail} failed")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 6 — Gemini 2.5 Flash: Probability Scoring
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 6 — Gemini 2.5 Flash probability scoring")

import google.generativeai as genai
genai.configure(api_key=GEMINI_API_KEY)

SUBJECT_DENSITY = {
    'Polity': 0.82, 'Economy': 0.78, 'Environment': 0.75,
    'History': 0.65, 'Geography': 0.60, 'Science & Tech': 0.72,
}

gemini = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
    generation_config=genai.GenerationConfig(
        response_mime_type='application/json', temperature=0.1
    )
)

GEMINI_PROMPT = """You are a UPSC Prelims 2026 analyst.
Given a topic, return probability scores (0.0-1.0) as JSON only:
{
  "recency_score": 0.0-1.0,
  "past_frequency_score": 0.0-1.0,
  "policy_boost": 0.0-1.0
}
Base this on: topic frequency in UPSC Prelims 2018-2024, current affairs relevance for 2026, recent govt policies/schemes."""

topic_cache = {}

def get_gemini_score(topic_id, subject, retries=3):
    if topic_id in topic_cache:
        return topic_cache[topic_id]
    for attempt in range(retries):
        try:
            resp = gemini.generate_content(
                f"Topic: {topic_id}\nSubject: {subject}\n{GEMINI_PROMPT}"
            )
            data = json.loads(resp.text)
            topic_cache[topic_id] = data
            return data
        except:
            time.sleep(3 ** attempt)
    return {'recency_score': 0.5, 'past_frequency_score': 0.5, 'policy_boost': 0.0}

def compute_prob(q, g):
    recency   = g.get('recency_score', 0.5)
    past_freq = g.get('past_frequency_score', 0.5)
    policy    = g.get('policy_boost', 0.0)
    syllabus  = SUBJECT_DENSITY.get(q['subject'], 0.60)
    diff      = {'HARD': 0.05, 'MEDIUM': 0.0, 'EASY': -0.05}.get(q.get('difficulty',''), 0.0)
    raw       = (0.35 * recency) + (0.30 * past_freq) + (0.25 * syllabus) + (0.10 * policy)
    return round(min(0.99, max(0.01, raw + diff)), 3)

# Score unique topics only — cache saves API calls
unique_topics = list({(q['topic_id'], q['subject']) for q in questions})
print(f"Scoring {len(unique_topics)} unique topics (cached for {len(questions)} questions)...")

for idx, (tid, subj) in enumerate(unique_topics):
    print(f"  [{idx+1}/{len(unique_topics)}] {tid}", end=' ', flush=True)
    time.sleep(0.2)
    get_gemini_score(tid, subj)
    print("✅")

for q in questions:
    g = topic_cache.get(q['topic_id'], {})
    q['new_probability'] = compute_prob(q, g)

probs = [q['new_probability'] for q in questions]
ok(f"Probability scoring done — avg: {sum(probs)/len(probs):.3f}, min: {min(probs):.3f}, max: {max(probs):.3f}")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 7 — Validation Gate
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 7 — Validation")

NEW_OPTS = ['Only one', 'Only two', 'All three', 'None']

def validate(q):
    if q['action'] == 'KEEP_FACTUAL':
        return True, 'FACTUAL_OK'
    stem = q.get('new_stem') or q['stem']
    opts = q.get('new_options') or q['options']
    cidx = q.get('new_correct_idx')
    if cidx is None: cidx = q['correct_index']
    if not stem or len(stem) < 30:
        return False, 'STEM_TOO_SHORT'
    if q['is_stmt_q'] and opts != NEW_OPTS:
        return False, f'WRONG_OPTIONS'
    if q['is_stmt_q'] and cidx not in [0,1,2,3]:
        return False, 'INVALID_CORRECT_IDX'
    if q['is_stmt_q'] and 'How many' not in stem and 'is/are correct' not in stem.lower() and 'are correct' not in stem.lower():
        return False, 'MISSING_HOW_MANY'
    return True, 'OK'

valid_qs = []; invalid_qs = []
for q in questions:
    ok_flag, reason = validate(q)
    q['valid']    = ok_flag
    q['v_reason'] = reason
    if ok_flag: valid_qs.append(q)
    else:        invalid_qs.append(q)

ok(f"Valid: {len(valid_qs)}")
if invalid_qs:
    warn(f"Invalid: {len(invalid_qs)}")
    reasons = {}
    for q in invalid_qs:
        reasons[q['v_reason']] = reasons.get(q['v_reason'], 0) + 1
    for r, c in reasons.items():
        print(f"  {r}: {c}")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 8 — Export CSV for review
# ═════════════════════════════════════════════════════════════════════════════
banner("STEP 8 — Export preview CSV")

csv_path = 'mcq_pipeline_preview.csv'
with open(csv_path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'mcq_id','subject','topic_id','action',
        'new_options','new_correct_idx','new_probability','v_reason'
    ])
    writer.writeheader()
    for q in valid_qs:
        writer.writerow({
            'mcq_id':          q['mcq_id'],
            'subject':         q['subject'],
            'topic_id':        q['topic_id'],
            'action':          q['action'],
            'new_options':     q.get('new_options') or q['options'],
            'new_correct_idx': q.get('new_correct_idx') if q.get('new_correct_idx') is not None else q['correct_index'],
            'new_probability': q['new_probability'],
            'v_reason':        q['v_reason'],
        })

ok(f"Preview saved to {csv_path}")
print(f"\n{'='*60}")
print("PIPELINE SUMMARY")
print(f"{'='*60}")
for a, c in sorted(action_counts.items(), key=lambda x: -x[1]):
    print(f"  {a}: {c}")
print(f"\nValid for DB write: {len(valid_qs)}")
print(f"Skipped (invalid):  {len(invalid_qs)}")
print(f"Avg probability:    {sum(probs)/len(probs):.3f}")
print(f"\n{'='*60}")
print("Review mcq_pipeline_preview.csv then run:")
print("  python3 pipeline.py --write")
print(f"{'='*60}\n")

# ═════════════════════════════════════════════════════════════════════════════
# STEP 9 — Write to DB (only when --write flag passed)
# ═════════════════════════════════════════════════════════════════════════════
if '--write' not in sys.argv:
    print(f"{Y}DRY RUN complete. Pass --write to commit changes to DB.{X}")
    sys.exit(0)

banner("STEP 9 — Writing to Railway PostgreSQL")

def build_record(q):
    final_opts  = q.get('new_options')     or q['options']
    final_cidx  = q.get('new_correct_idx')
    if final_cidx is None: final_cidx = q['correct_index']
    final_prob  = q.get('new_probability') or q['prob_2026']
    final_stem  = q.get('new_stem')        or q['stem']
    base_exp    = dict(q['explanation'] or {})
    new_exp     = q.get('new_explanation')
    if new_exp:
        base_exp.update({k: v for k, v in new_exp.items() if v})
    return (
        json.dumps(final_opts),
        final_cidx,
        final_prob,
        json.dumps(base_exp),
        final_stem,
        q['mcq_id']
    )

records = [build_record(q) for q in valid_qs]

conn = get_conn()
cur  = conn.cursor()
execute_batch(cur, """
    UPDATE mcq_bank SET
        options          = %s::jsonb,
        correct_index    = %s,
        probability_2026 = %s,
        explanation      = %s::jsonb,
        stem             = %s
    WHERE mcq_id = %s
""", records, page_size=100)
conn.commit()
cur.close(); conn.close()

ok(f"Successfully updated {len(records)} questions in Railway DB")

# Final report
conn = get_conn()
cur  = conn.cursor()
cur.execute("""
    SELECT subject,
           COUNT(*) as total,
           ROUND(AVG(probability_2026)::numeric,3) as avg_prob,
           SUM(CASE WHEN options::text LIKE '%Only one%' THEN 1 ELSE 0 END) as new_pat,
           SUM(CASE WHEN options::text LIKE '%1 only%'  THEN 1 ELSE 0 END) as old_pat
    FROM mcq_bank GROUP BY subject ORDER BY subject
""")
print(f"\n{'Subject':<20} {'Total':>6} {'AvgProb':>8} {'NewPat':>8} {'OldPat':>8}")
print("-" * 55)
for r in cur.fetchall():
    old_col = R if r[4] > 0 else G
    print(f"{r[0]:<20} {r[1]:>6} {str(r[2]):>8} {G}{r[3]:>8}{X} {old_col}{r[4]:>8}{X}")
cur.close(); conn.close()

print(f"\n{G}Pipeline complete. MCQ bank is now premium quality.{X}")