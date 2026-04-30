"""
MCQ Pipeline Validator
======================
Three-pass validation layer that runs AFTER schema validation.

Pass 1 — Structural:  directive, statement count, phantom numbers
Pass 2 — Logic:       option-statement count coherence
Pass 3 — Factual:     known entity checks (NPT, DAE, constitutional facts)

Each pass returns a list of ValidationError objects so callers can
feed them back into the model for targeted correction.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

from app.services.mcq.schemas import RefinedMCQOutput


# ---------------------------------------------------------------------------
# Error type
# ---------------------------------------------------------------------------

@dataclass
class ValidationError:
    pass_name: str          # "structural" | "logic" | "factual"
    field: str              # which field is problematic
    message: str            # human-readable problem description
    severity: str = "error" # "error" | "warning"

    def as_feedback(self) -> str:
        return f"[{self.pass_name.upper()} — {self.field}] {self.message}"


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)

    def feedback_string(self) -> str:
        """Formatted feedback to include in a retry prompt."""
        lines = ["The previous output had the following issues. Fix ALL of them:"]
        for e in self.errors:
            lines.append(f"  ✗ {e.as_feedback()}")
        for w in self.warnings:
            lines.append(f"  ⚠ {w.as_feedback()}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Known-fact registry (extend as needed)
# ---------------------------------------------------------------------------

# Pairs: (pattern_in_statements, expected_truth, correction_hint)
FACTUAL_CHECKS = [
    (
        re.compile(
            r"\bindia\b.{0,80}(?:"
            r"(?:\bNPT\b.{0,40}\bsignatory\b)"   # NPT before signatory
            r"|(?:\bsignatory\b.{0,60}\bNPT\b)"  # signatory before NPT
            r")",
            re.I | re.S,
        ),
        False,
        "India is NOT a signatory to the NPT. Remove or negate this claim.",
    ),
    (
        re.compile(r"\bDAE\b.{0,60}(ministry of science|science and technology)", re.I),
        False,
        "DAE reports to the Prime Minister's Office, NOT any Ministry.",
    ),
    (
        re.compile(r"\bDAE\b.{0,60}prime minister", re.I),
        True,
        None,  # correct — no error
    ),
    (
        re.compile(r"\bCTBT\b.{0,60}india.{0,40}signatory", re.I),
        False,
        "India has NOT ratified the CTBT.",
    ),
    (
        re.compile(r"\bNSG\b.{0,60}india.{0,40}member", re.I),
        False,
        "India is NOT a member of the Nuclear Suppliers Group (NSG) as of 2025.",
    ),
    (
        re.compile(r"\bDMH.?11\b.{0,80}(PAU|Punjab Agricultural|Ludhiana)", re.I),
        False,
        "DMH-11 was developed at Delhi University's CGMCP, not PAU Ludhiana.",
    ),
    (
        re.compile(r"\bDMH.?11\b.{0,80}delhi university", re.I),
        True,
        None,
    ),
    (
        re.compile(r"\bRTE\b.{0,40}article\s*21\b", re.I),
        False,
        "RTE Act is grounded in Article 21A, not Article 21.",
    ),
    (
        re.compile(r"\bRTE\b.{0,40}article\s*21A\b", re.I),
        True,
        None,
    ),
]

# Patterns that suggest a technical term was truncated
TRUNCATION_PATTERNS = [
    re.compile(r"\.\.\.", re.I),                   # ellipsis
    re.compile(r"\b[A-Z]{2,}-\s*$", re.M),        # "DMH-" at line end
    re.compile(r"\b\w+\s*\.\s*\.\s*\.", re.I),    # spaced dots
]

# Patterns for phantom numbering bleeding into statement text
PHANTOM_PATTERNS = [
    re.compile(r"^\s*\d+\s*[\.\)]\s+", re.M),    # "1. " or "1) " at start
    re.compile(r"^\s*[ivxIVX]+\s*[\.\)]\s+", re.M),  # roman numerals
]

# Directive should NOT start with "Statement" or "1."
DIRECTIVE_BAD_STARTS = re.compile(r"^\s*(\d+[\.\)]|Statement\s+\d)", re.I)


# ---------------------------------------------------------------------------
# Pass implementations
# ---------------------------------------------------------------------------

def _pass_structural(mcq: RefinedMCQOutput) -> List[ValidationError]:
    errors: List[ValidationError] = []

    # 1. Directive ends with ? or :
    if not re.search(r"[?:]$", mcq.directive.strip()):
        errors.append(ValidationError(
            pass_name="structural",
            field="directive",
            message=(
                f"Directive must end with '?' or ':'. "
                f"Got: {mcq.directive!r}"
            ),
        ))

    # 2. Directive doesn't look like a numbered statement
    if DIRECTIVE_BAD_STARTS.match(mcq.directive):
        errors.append(ValidationError(
            pass_name="structural",
            field="directive",
            message=(
                f"Directive appears to be formatted as a numbered statement: "
                f"{mcq.directive!r}"
            ),
        ))

    # 3. Directive not embedded in any statement
    short_directive = mcq.directive.lower().strip()[:20]
    for i, stmt in enumerate(mcq.statements, 1):
        if short_directive and short_directive in stmt.lower():
            errors.append(ValidationError(
                pass_name="structural",
                field=f"statements[{i}]",
                message=(
                    f"Directive text appears inside Statement {i}. "
                    "Move it to the `directive` field only."
                ),
            ))

    # 4. Phantom numbering in statements
    for i, stmt in enumerate(mcq.statements, 1):
        for pat in PHANTOM_PATTERNS:
            if pat.search(stmt):
                errors.append(ValidationError(
                    pass_name="structural",
                    field=f"statements[{i}]",
                    message=f"Phantom numbering detected in Statement {i}: {stmt!r}",
                ))
                break

    # 5. Truncation in any statement
    for i, stmt in enumerate(mcq.statements, 1):
        for pat in TRUNCATION_PATTERNS:
            if pat.search(stmt):
                errors.append(ValidationError(
                    pass_name="structural",
                    field=f"statements[{i}]",
                    message=(
                        f"Possible truncated term in Statement {i}: {stmt!r}. "
                        "Complete all technical terms, botanical names, and acronyms."
                    ),
                ))
                break

    # 6. statement_wise keys must match statement count
    sw = mcq.explanation.statement_wise
    expected_keys = {str(j) for j in range(1, len(mcq.statements) + 1)}
    actual_keys = set(sw.keys())
    if actual_keys != expected_keys:
        errors.append(ValidationError(
            pass_name="structural",
            field="explanation.statement_wise",
            message=(
                f"statement_wise has keys {sorted(actual_keys)} but "
                f"expected {sorted(expected_keys)} to match {len(mcq.statements)} statements."
            ),
        ))

    return errors


def _pass_logic(mcq: RefinedMCQOutput) -> List[ValidationError]:
    errors: List[ValidationError] = []
    n = len(mcq.statements)
    option_text = " ".join(mcq.options.values()).lower()

    if n == 2:
        if "all three" in option_text:
            errors.append(ValidationError(
                pass_name="logic",
                field="options",
                message=(
                    "2-statement question MUST NOT use 'All three'. "
                    "Use: Only one | Only two | Both | Neither"
                ),
            ))
        if "none of the" in option_text and "neither" not in option_text:
            errors.append(ValidationError(
                pass_name="logic",
                field="options",
                severity="warning",
                message=(
                    "2-statement question uses 'None of the above'. "
                    "Prefer 'Neither 1 nor 2' for UPSC pattern consistency."
                ),
            ))

    if n == 3:
        if "neither" in option_text:
            errors.append(ValidationError(
                pass_name="logic",
                field="options",
                message=(
                    "3-statement question MUST NOT use 'Neither'. "
                    "Use 'None of the above' or 'None' instead."
                ),
            ))
        if "all three" not in option_text and "all 3" not in option_text:
            errors.append(ValidationError(
                pass_name="logic",
                field="options",
                severity="warning",
                message=(
                    "3-statement question is missing 'All three' option. "
                    "Standard 3-statement pattern: Only one | Only two | All three | None"
                ),
            ))

    # Correct answer key must be present
    if mcq.correct_answer not in mcq.options:
        errors.append(ValidationError(
            pass_name="logic",
            field="correct_answer",
            message=f"correct_answer '{mcq.correct_answer}' not in options keys.",
        ))

    return errors


def _pass_factual(mcq: RefinedMCQOutput) -> List[ValidationError]:
    errors: List[ValidationError] = []
    all_statement_text = " ".join(mcq.statements)

    for pattern, expected_true, hint in FACTUAL_CHECKS:
        match = pattern.search(all_statement_text)
        if match and not expected_true and hint:
            errors.append(ValidationError(
                pass_name="factual",
                field="statements",
                message=f"Potential factual error detected: {hint} (matched: {match.group()!r})",
            ))

    # Explanation fields minimum length
    if len(mcq.explanation.concept_anchor) < 20:
        errors.append(ValidationError(
            pass_name="factual",
            field="explanation.concept_anchor",
            message="concept_anchor is too short — must be ≥ 20 characters with a substantive hook.",
        ))
    if len(mcq.explanation.why_others_wrong) < 20:
        errors.append(ValidationError(
            pass_name="factual",
            field="explanation.why_others_wrong",
            message="why_others_wrong is too short — must specifically address each wrong option.",
        ))

    return errors


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def validate(mcq: RefinedMCQOutput) -> ValidationResult:
    """
    Run all three validation passes on a refined MCQ.

    Returns a ValidationResult. Callers should check `is_valid` and use
    `feedback_string()` to construct retry prompts.
    """
    all_errors: List[ValidationError] = []
    all_warnings: List[ValidationError] = []

    for check_fn in (_pass_structural, _pass_logic, _pass_factual):
        results = check_fn(mcq)
        for r in results:
            if r.severity == "error":
                all_errors.append(r)
            else:
                all_warnings.append(r)

    return ValidationResult(
        is_valid=len(all_errors) == 0,
        errors=all_errors,
        warnings=all_warnings,
    )


def validate_raw_dict(data: dict) -> ValidationResult:
    """
    Convenience wrapper: parse a raw dict then validate.
    Returns an error result if parsing itself fails.
    """
    try:
        from app.services.mcq.schemas import ExplanationBlock, RefinedMCQOutput  # local import to avoid circular
        mcq = RefinedMCQOutput(**data)
        return validate(mcq)
    except Exception as exc:
        error = ValidationError(
            pass_name="schema",
            field="(parse)",
            message=f"Pydantic schema validation failed: {exc}",
        )
        return ValidationResult(is_valid=False, errors=[error])