from __future__ import annotations

import re
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator


DIRECTIVE_PATTERN = re.compile(r"[?:]$")
TRUNCATION_SUSPECTS = re.compile(
    r"""(?:\.\.\.|\b[A-Z]{2,}-\s*(?!\w)|\bDMH\b(?![-\s]*\d))""",
    re.VERBOSE | re.UNICODE,
)
PHANTOM_NUMBER_PATTERN = re.compile(r"^\s*\d+[.)]\s*")

# Exact Format A for 2-statement questions (lowercased)
FORMAT_A_OPTIONS = {"1 only", "2 only", "both 1 and 2", "neither 1 nor 2"}


class RawMCQ(BaseModel):
    mcq_id: str
    stem: str = Field(..., min_length=10)
    options: List[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    subject: Optional[str] = None
    topic_id: Optional[str] = None
    explanation: Optional[Dict] = None

    @field_validator("stem")
    @classmethod
    def stem_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("stem cannot be blank")
        return v.strip()


class ExplanationBlock(BaseModel):
    concept_anchor: str = Field(..., min_length=20)
    statement_wise: Dict[str, str] = Field(...)
    why_others_wrong: str = Field(..., min_length=20)
    common_trap: str = Field(..., min_length=10)
    elimination_hint: str = Field(..., min_length=10)

    @field_validator("statement_wise")
    @classmethod
    def keys_are_digits(cls, v: Dict[str, str]) -> Dict[str, str]:
        for k in v:
            if not k.isdigit():
                raise ValueError(f"statement_wise keys must be digit strings, got '{k}'")
        return v


class RefinedMCQOutput(BaseModel):
    topic: str = Field(..., min_length=2)
    subject: str = Field(..., min_length=2)
    statements: List[str] = Field(..., min_length=2, max_length=3)
    directive: str
    options: Dict[str, str]
    correct_answer: str = Field(..., pattern=r"^[A-D]$")
    explanation: ExplanationBlock

    @field_validator("statements", mode="before")
    @classmethod
    def validate_statements(cls, v: List[str]) -> List[str]:
        result = []
        for s in v:
            if PHANTOM_NUMBER_PATTERN.match(s):
                raise ValueError(f"Phantom numbering at statement start: {s!r}")
            m = TRUNCATION_SUSPECTS.search(s)
            if m:
                raise ValueError(f"Possible truncated term '{m.group()}' in: {s!r}")
            result.append(s.strip())
        return result

    @field_validator("directive")
    @classmethod
    def directive_valid(cls, v: str) -> str:
        v = v.strip()
        if not DIRECTIVE_PATTERN.search(v):
            raise ValueError(f"Directive must end with '?' or ':' — got: {v!r}")
        if re.match(r"^\d+[.)]\s", v):
            raise ValueError(f"Directive looks like a numbered statement: {v!r}")
        return v

    @field_validator("options")
    @classmethod
    def options_have_abcd(cls, v: Dict[str, str]) -> Dict[str, str]:
        missing = {"A", "B", "C", "D"} - set(v.keys())
        if missing:
            raise ValueError(f"Options missing keys: {missing}")
        return v

    @model_validator(mode="after")
    def cross_field_checks(self) -> "RefinedMCQOutput":
        n = len(self.statements)
        option_texts = " ".join(self.options.values()).lower()
        actual_options = {v.strip().lower() for v in self.options.values()}

        if n == 2:
            # ✅ Hard enforce Format A — exact match required
            if actual_options != FORMAT_A_OPTIONS:
                raise ValueError(
                    f"2-statement question MUST use Format A options exactly: "
                    f"'1 only' | '2 only' | 'Both 1 and 2' | 'Neither 1 nor 2'. "
                    f"Got: {sorted(actual_options)}."
                )

        if n == 2 and "all three" in option_texts:
            raise ValueError("'All three' invalid for 2-statement question.")

        if n == 3 and "neither" in option_texts and "none" not in option_texts:
            raise ValueError("Use 'None' not 'Neither' for 3-statement questions.")

        directive = self.directive.lower().strip()[:30]
        for i, s in enumerate(self.statements, 1):
            if directive and directive in s.lower():
                raise ValueError(f"Directive appears embedded in Statement {i}.")

        if self.explanation:
            sw_keys = set(self.explanation.statement_wise.keys())
            expected = {str(i) for i in range(1, n + 1)}
            if sw_keys != expected:
                raise ValueError(
                    f"statement_wise keys {sw_keys} must match statement count {expected}"
                )

        return self


class RefinedMCQRecord(BaseModel):
    mcq_id: str
    stem: str
    options: List[str]
    correct_index: int
    subject: str
    topic_id: Optional[str]
    explanation: ExplanationBlock
    refinement_version: str = "2.0"

    @classmethod
    def from_refined(cls, original: RawMCQ, refined: RefinedMCQOutput) -> "RefinedMCQRecord":
        option_order = ["A", "B", "C", "D"]
        options_list = [refined.options[k] for k in option_order]
        correct_index = option_order.index(refined.correct_answer)
        statement_lines = "\n".join(f"{i}. {s}" for i, s in enumerate(refined.statements, 1))
        stem = f"{statement_lines}\n\n{refined.directive}"
        return cls(
            mcq_id=original.mcq_id,
            stem=stem,
            options=options_list,
            correct_index=correct_index,
            subject=refined.subject,
            topic_id=original.topic_id,
            explanation=refined.explanation,
        )