from __future__ import annotations
from typing import Any, Dict

SYSTEM_PROMPT = """\
You are a Senior UPSC Prelims Subject Matter Expert and question-quality specialist.

YOUR ONLY OUTPUT is a call to the `output_refined_mcq` tool.
Do NOT write prose, preamble, explanations, scratchpad reasoning,
or any text outside the tool call. Not even a single word.

REFINEMENT RULES (violating any = rejection)

1. DIRECTIVE SEPARATION
   `directive` is a STANDALONE field — never a statement.
   It must end with "?" or ":".
   It must NOT contain list numbering.

2. NO TRUNCATION — EVER
   Never shorten technical terms, botanical names, or acronyms.
   Complete truncated strings using your knowledge base.
   DMH-11 = Dhara Mustard Hybrid-11.
   Never use "..." inside any field value.

3. STATEMENT INTEGRITY
   2 or 3 statements — no more, no less.
   Each statement must be factually independent and verifiable.
   Remove phantom numbering (e.g., "1." bleeding into statement text).

4. OPTIONS MUST MATCH STATEMENT COUNT — STRICTLY
   2 statements → MUST use EXACTLY these four options in this order:
     A: 1 only
     B: 2 only
     C: Both 1 and 2
     D: Neither 1 nor 2
   NEVER use "Only one" or "Only two" for 2-statement questions.
   NEVER use "Both" without "1 and 2" for 2-statement questions.

   3 statements → MUST use EXACTLY these four options in this order:
     A: Only one
     B: Only two
     C: All three
     D: None
   NEVER use "Neither" for 3-statement questions.
   NEVER use "All three" for 2-statement questions.

5. FACTUAL ACCURACY
   NPT: India is NOT a signatory.
   DAE reports to the Prime Minister's Office, not any Ministry.
   Verify constitutional article numbers, committee names, scheme launches.

6. EXPLANATION QUALITY
   concept_anchor: 1-2 sentence PIB/NCERT-sourced hook.
   statement_wise: one crisp verdict per statement — TRUE/FALSE + 1-line reason.
   why_others_wrong: why each distractor fails.
   common_trap: the specific misconception test-takers fall for.
   elimination_hint: the fastest logical path to the correct option.

ZERO TOLERANCE
- Zero prose output.
- Zero truncated terms.
- Zero directive-inside-statement.
- Zero option-count mismatches.
- Zero phantom numbering in statement text.
- Zero count-based options ("Only one", "Only two") in 2-statement questions.
"""

FEW_SHOT_EXAMPLES = [
    {
        "role": "user",
        "content": (
            "Refine this raw question:\n\n"
            "stem: Consider the following statements about India's nuclear doctrine:\n"
            "1. India is a signatory to the Nuclear Non-Proliferation Treaty (NPT).\n"
            "2. The Department of Atomic Energy (DAE) functions under the Ministry of Science and Technology.\n"
            "Which of the above statements is/are correct?\n\n"
            "Options: A) 1 only  B) 2 only  C) Both  D) Neither\n"
            "Correct: D\nSubject: Polity & Governance"
        ),
    },
    {
        "role": "assistant",
        "content": [
            {
                "type": "tool_use",
                "id": "ex1",
                "name": "output_refined_mcq",
                "input": {
                    "topic": "Nuclear Policy",
                    "subject": "Polity & Governance",
                    "statements": [
                        "India is a signatory to the Nuclear Non-Proliferation Treaty (NPT).",
                        "The Department of Atomic Energy (DAE) operates under the Ministry of Science and Technology.",
                    ],
                    "directive": "Which of the above statements is/are correct?",
                    "options": {
                        "A": "1 only",
                        "B": "2 only",
                        "C": "Both 1 and 2",
                        "D": "Neither 1 nor 2"
                    },
                    "correct_answer": "D",
                    "explanation": {
                        "concept_anchor": "India maintains a voluntary moratorium on nuclear testing but has not joined the NPT. DAE was established in 1954 and reports directly to the Prime Minister.",
                        "statement_wise": {
                            "1": "FALSE — India is NOT an NPT signatory; it conducted tests in 1974 and 1998 outside the treaty framework.",
                            "2": "FALSE — DAE functions under the Prime Minister's Office, not the Ministry of Science and Technology.",
                        },
                        "why_others_wrong": "Options A, B, C all require at least one statement to be correct. Both statements contain factual errors, making D the only valid choice.",
                        "common_trap": "Candidates conflate India's CTBT stance with NPT membership, and assume DAE falls under a science ministry.",
                        "elimination_hint": "Recalling that DAE is directly under the PM eliminates Statement 2 immediately and narrows you to D.",
                    },
                },
            }
        ],
    },
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "ex1",
                "content": "Accepted.",
            }
        ],
    },
    {
        "role": "assistant",
        "content": "Understood. Ready for the next question.",
    },
    {
        "role": "user",
        "content": (
            "Refine this raw question:\n\n"
            "stem: Consider the following statements about DMH-11:\n"
            "1. DMH-11 is India's first transgenic food crop approved for environmental release.\n"
            "2. It uses barnase-barstar-bar gene system for hybridisation.\n"
            "3. It was developed by Punjab Agricultural University.\n"
            "How many of the above are correct?\n\n"
            "Options: A) Only one  B) Only two  C) All three  D) None\n"
            "Correct: B\nSubject: Science & Technology"
        ),
    },
    {
        "role": "assistant",
        "content": [
            {
                "type": "tool_use",
                "id": "ex2",
                "name": "output_refined_mcq",
                "input": {
                    "topic": "GM Crops & Biotechnology",
                    "subject": "Science & Technology",
                    "statements": [
                        "Dhara Mustard Hybrid-11 (DMH-11) is India's first transgenic food crop to receive approval for environmental release.",
                        "DMH-11 uses the barnase-barstar-bar gene system derived from Bacillus amyloliquefaciens for hybridisation.",
                        "DMH-11 was developed by the Punjab Agricultural University, Ludhiana.",
                    ],
                    "directive": "How many of the above statements are correct?",
                    "options": {
                        "A": "Only one",
                        "B": "Only two",
                        "C": "All three",
                        "D": "None of the above"
                    },
                    "correct_answer": "B",
                    "explanation": {
                        "concept_anchor": "DMH-11 received GEAC approval for environmental release in 2022, making it India's first transgenic food crop to do so. It was developed at Delhi University's CGMCP.",
                        "statement_wise": {
                            "1": "TRUE — DMH-11 received GEAC approval for environmental release in October 2022.",
                            "2": "TRUE — It uses the barnase, barstar, and bar gene system from Bacillus amyloliquefaciens.",
                            "3": "FALSE — DMH-11 was developed at Delhi University's CGMCP, not PAU Ludhiana.",
                        },
                        "why_others_wrong": "Option A fails because two statements are correct. Option C fails because Statement 3 is wrong. Option D fails because two are correct.",
                        "common_trap": "Candidates attribute DMH-11 to PAU Ludhiana due to its reputation for crop research.",
                        "elimination_hint": "Knowing DMH-11's gene system is correct locks you into at least two correct, then verify Statement 3's institution to confirm B.",
                    },
                },
            }
        ],
    },
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "ex2",
                "content": "Accepted.",
            }
        ],
    },
    {
        "role": "assistant",
        "content": "Understood. Ready for the next question.",
    },
]

REFINEMENT_TOOL: Dict[str, Any] = {
    "name": "output_refined_mcq",
    "description": "Output the refined Grade A UPSC Prelims MCQ in fully structured format. This is your ONLY permitted output.",
    "input_schema": {
        "type": "object",
        "properties": {
            "topic": {"type": "string"},
            "subject": {"type": "string"},
            "statements": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 3,
                "description": "2 or 3 complete, factually accurate statements. No phantom numbering. No truncated terms.",
            },
            "directive": {
                "type": "string",
                "description": "Standalone question lead ending with '?' or ':'. NEVER contains statement text.",
            },
            "options": {
                "type": "object",
                "properties": {
                    "A": {"type": "string"},
                    "B": {"type": "string"},
                    "C": {"type": "string"},
                    "D": {"type": "string"},
                },
                "required": ["A", "B", "C", "D"],
                "description": (
                    "2 statements → MUST use EXACTLY: A='1 only', B='2 only', C='Both 1 and 2', D='Neither 1 nor 2'. "
                    "3 statements → MUST use EXACTLY: A='Only one', B='Only two', C='All three', D='None'. "
                    "NO mixing of formats. NO 'Only one'/'Only two' for 2-statement questions."
                ),
            },
            "correct_answer": {"type": "string", "enum": ["A", "B", "C", "D"]},
            "explanation": {
                "type": "object",
                "properties": {
                    "concept_anchor": {"type": "string"},
                    "statement_wise": {"type": "object", "additionalProperties": {"type": "string"}},
                    "why_others_wrong": {"type": "string"},
                    "common_trap": {"type": "string"},
                    "elimination_hint": {"type": "string"},
                },
                "required": ["concept_anchor", "statement_wise", "why_others_wrong", "common_trap", "elimination_hint"],
            },
        },
        "required": ["topic", "subject", "statements", "directive", "options", "correct_answer", "explanation"],
    },
}

def build_refinement_prompt(raw_stem: str, raw_options: list, subject: str | None) -> str:
    options_text = "\n".join(f"{chr(65+i)}) {opt}" for i, opt in enumerate(raw_options))
    subject_line = f"Subject: {subject}" if subject else "Subject: (infer from content)"
    return (
        f"Refine the following raw UPSC question to Grade A standard.\n\n"
        f"RAW STEM:\n{raw_stem}\n\n"
        f"RAW OPTIONS:\n{options_text}\n\n"
        f"{subject_line}\n\n"
        f"Apply ALL refinement rules. Output ONLY the tool call."
    )