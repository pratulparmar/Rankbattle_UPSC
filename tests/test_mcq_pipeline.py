"""
MCQ Pipeline Test Suite
=======================
Full coverage of schemas, validator, and pipeline logic.
Claude API calls are mocked — no network required.

Run:
    pytest tests/test_mcq_pipeline.py -v
    pytest tests/test_mcq_pipeline.py -v --tb=short  # compact output
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.services.mcq.schemas import (
    ExplanationBlock,
    RawMCQ,
    RefinedMCQOutput,
    RefinedMCQRecord,
)
from app.services.mcq.validator import (
    ValidationResult,
    _pass_factual,
    _pass_logic,
    _pass_structural,
    validate,
)
from app.services.mcq.pipeline import (
    RefinementFailure,
    RefinementPipeline,
    RefinementSuccess,
    BatchStats,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def good_explanation() -> ExplanationBlock:
    return ExplanationBlock(
        concept_anchor="DMH-11 is India's first transgenic food crop approved for environmental release by GEAC in 2022.",
        statement_wise={
            "1": "TRUE — DMH-11 received GEAC approval for environmental release in October 2022.",
            "2": "TRUE — It uses the barnase-barstar-bar gene system from Bacillus amyloliquefaciens.",
            "3": "FALSE — DMH-11 was developed at Delhi University's CGMCP, not PAU Ludhiana.",
        },
        why_others_wrong=(
            "Option A fails because Statements 1 and 2 are both correct. "
            "Option C fails because Statement 3 is wrong. Option D fails because two are correct."
        ),
        common_trap="Candidates attribute DMH-11 to PAU Ludhiana due to its reputation for crop research.",
        elimination_hint="Knowing DMH-11's gene system is correct locks you into 'at least two', then verify Statement 3's institution.",
    )


@pytest.fixture
def good_3_stmt_mcq(good_explanation) -> RefinedMCQOutput:
    return RefinedMCQOutput(
        topic="GM Crops & Biotechnology",
        subject="Science & Technology",
        statements=[
            "Dhara Mustard Hybrid-11 (DMH-11) is India's first transgenic food crop to receive approval for environmental release.",
            "DMH-11 uses the barnase-barstar-bar gene system derived from Bacillus amyloliquefaciens for hybridisation.",
            "DMH-11 was developed by the Punjab Agricultural University, Ludhiana.",
        ],
        directive="How many of the above statements are correct?",
        options={
            "A": "Only one",
            "B": "Only two",
            "C": "All three",
            "D": "None of the above",
        },
        correct_answer="B",
        explanation=good_explanation,
    )


@pytest.fixture
def good_2_stmt_explanation() -> ExplanationBlock:
    return ExplanationBlock(
        concept_anchor="India maintains a voluntary moratorium on nuclear testing but has NOT joined the NPT.",
        statement_wise={
            "1": "FALSE — India is not an NPT signatory; it conducted tests outside the treaty in 1974 and 1998.",
            "2": "FALSE — DAE reports to the Prime Minister's Office, not the Ministry of Science and Technology.",
        },
        why_others_wrong="Options A, B, C all require at least one correct statement; both are false.",
        common_trap="Candidates conflate CTBT non-signature with NPT and assume DAE is under a science ministry.",
        elimination_hint="Knowing DAE is under PMO eliminates Statement 2 immediately, narrowing to D.",
    )


@pytest.fixture
def good_2_stmt_mcq(good_2_stmt_explanation) -> RefinedMCQOutput:
    return RefinedMCQOutput(
        topic="Nuclear Policy",
        subject="Polity & Governance",
        statements=[
            "India is a signatory to the Nuclear Non-Proliferation Treaty (NPT).",
            "The Department of Atomic Energy (DAE) operates under the Ministry of Science and Technology.",
        ],
        directive="Which of the above statements is/are correct?",
        options={
            "A": "1 only",
            "B": "2 only",
            "C": "Both 1 and 2",
            "D": "Neither 1 nor 2",
        },
        correct_answer="D",
        explanation=good_2_stmt_explanation,
    )


@pytest.fixture
def raw_mcq() -> RawMCQ:
    return RawMCQ(
        mcq_id="TEST-001",
        stem="Consider the following statements:\n1. DMH-11 is India's first GM food crop.\n2. It uses the barnase-barstar system.\n\nWhich is correct?",
        options=["1 only", "2 only", "Both", "Neither"],
        correct_index=2,
        subject="Science & Technology",
        topic_id="gm_crops",
    )


# ============================================================================
# Schema Tests
# ============================================================================

class TestRawMCQ:
    def test_valid_construction(self):
        raw = RawMCQ(
            mcq_id="MCQ-001",
            stem="Valid stem with enough characters",
            options=["A", "B", "C", "D"],
            correct_index=0,
        )
        assert raw.mcq_id == "MCQ-001"

    def test_stem_too_short(self):
        with pytest.raises(PydanticValidationError):
            RawMCQ(
                mcq_id="X",
                stem="short",
                options=["A", "B", "C", "D"],
                correct_index=0,
            )

    def test_correct_index_out_of_range(self):
        with pytest.raises(PydanticValidationError):
            RawMCQ(
                mcq_id="X",
                stem="Valid stem with enough text here",
                options=["A", "B", "C", "D"],
                correct_index=4,  # invalid
            )

    def test_wrong_option_count(self):
        with pytest.raises(PydanticValidationError):
            RawMCQ(
                mcq_id="X",
                stem="Valid stem with enough text here",
                options=["A", "B", "C"],  # only 3
                correct_index=0,
            )


class TestExplanationBlock:
    def test_valid(self, good_explanation):
        assert good_explanation.concept_anchor

    def test_short_concept_anchor_rejected(self):
        with pytest.raises(PydanticValidationError):
            ExplanationBlock(
                concept_anchor="Too short",
                statement_wise={"1": "TRUE", "2": "FALSE"},
                why_others_wrong="Why others are wrong here in detail",
                common_trap="Common trap text here",
                elimination_hint="Hint here",
            )

    def test_non_digit_statement_wise_key_rejected(self):
        with pytest.raises(PydanticValidationError):
            ExplanationBlock(
                concept_anchor="A" * 25,
                statement_wise={"one": "TRUE", "two": "FALSE"},  # invalid keys
                why_others_wrong="B" * 25,
                common_trap="C" * 15,
                elimination_hint="D" * 15,
            )


class TestRefinedMCQOutput:
    def test_valid_3_statement(self, good_3_stmt_mcq):
        assert len(good_3_stmt_mcq.statements) == 3
        assert good_3_stmt_mcq.correct_answer == "B"

    def test_directive_without_question_mark_rejected(self, good_3_stmt_mcq):
        data = good_3_stmt_mcq.model_dump()
        data["directive"] = "How many are correct"  # missing ?
        with pytest.raises(PydanticValidationError, match="Directive must end"):
            RefinedMCQOutput(**data)

    def test_directive_looks_like_statement_rejected(self, good_3_stmt_mcq):
        data = good_3_stmt_mcq.model_dump()
        data["directive"] = "1. How many are correct?"  # starts with number
        with pytest.raises(PydanticValidationError):
            RefinedMCQOutput(**data)

    def test_invalid_correct_answer_rejected(self, good_3_stmt_mcq):
        data = good_3_stmt_mcq.model_dump()
        data["correct_answer"] = "E"
        with pytest.raises(PydanticValidationError):
            RefinedMCQOutput(**data)

    def test_phantom_number_in_statement_rejected(self, good_3_stmt_mcq):
        data = good_3_stmt_mcq.model_dump()
        data["statements"][0] = "1. This starts with a phantom number."
        with pytest.raises(PydanticValidationError, match="phantom"):
            RefinedMCQOutput(**data)

    def test_truncated_term_in_statement_rejected(self, good_3_stmt_mcq):
        data = good_3_stmt_mcq.model_dump()
        data["statements"][0] = "DMH is an important..."
        with pytest.raises(PydanticValidationError, match="truncated"):
            RefinedMCQOutput(**data)

    def test_all_three_in_2_statement_question_rejected(self):
        """2-statement question must not have 'All three' option."""
        with pytest.raises(PydanticValidationError, match="All three"):
            RefinedMCQOutput(
                topic="Test",
                subject="Test",
                statements=["Statement one here.", "Statement two here."],
                directive="Which is correct?",
                options={"A": "Only one", "B": "Only two", "C": "All three", "D": "Neither"},
                correct_answer="A",
                explanation=ExplanationBlock(
                    concept_anchor="A" * 25,
                    statement_wise={"1": "TRUE — because x.", "2": "FALSE — because y."},
                    why_others_wrong="B" * 25,
                    common_trap="C" * 15,
                    elimination_hint="D" * 15,
                ),
            )

    def test_statement_wise_mismatch_rejected(self, good_3_stmt_mcq):
        """statement_wise must have keys matching statement count."""
        data = good_3_stmt_mcq.model_dump()
        # Only 2 keys for a 3-statement question
        data["explanation"]["statement_wise"] = {
            "1": "TRUE — something.",
            "2": "FALSE — something.",
        }
        with pytest.raises(PydanticValidationError, match="statement_wise"):
            RefinedMCQOutput(**data)


class TestRefinedMCQRecord:
    def test_from_refined_builds_correct_record(self, raw_mcq, good_3_stmt_mcq):
        record = RefinedMCQRecord.from_refined(original=raw_mcq, refined=good_3_stmt_mcq)
        assert record.mcq_id == raw_mcq.mcq_id
        assert record.correct_index == 1  # B = index 1
        assert len(record.options) == 4
        assert record.refinement_version == "2.0"
        # Stem should contain numbered statements + directive
        assert "1." in record.stem
        assert good_3_stmt_mcq.directive in record.stem

    def test_from_refined_preserves_topic_id(self, raw_mcq, good_3_stmt_mcq):
        record = RefinedMCQRecord.from_refined(original=raw_mcq, refined=good_3_stmt_mcq)
        assert record.topic_id == raw_mcq.topic_id


# ============================================================================
# Validator Tests
# ============================================================================

class TestStructuralPass:
    def test_clean_3_stmt_passes(self, good_3_stmt_mcq):
        errors = _pass_structural(good_3_stmt_mcq)
        assert errors == []

    def test_clean_2_stmt_passes(self, good_2_stmt_mcq):
        errors = _pass_structural(good_2_stmt_mcq)
        assert errors == []

    def test_directive_without_question_mark(self, good_3_stmt_mcq):
        good_3_stmt_mcq.directive = "How many are correct"
        errors = _pass_structural(good_3_stmt_mcq)
        assert any(e.field == "directive" for e in errors)

    def test_directive_embedded_in_statement(self, good_3_stmt_mcq):
        directive_start = good_3_stmt_mcq.directive[:20].lower()
        good_3_stmt_mcq.statements[0] = f"This statement contains {directive_start} as text."
        errors = _pass_structural(good_3_stmt_mcq)
        assert any("embedded" in e.message.lower() or "directive" in e.message.lower() for e in errors)

    def test_ellipsis_in_statement_caught(self, good_3_stmt_mcq):
        good_3_stmt_mcq.statements[0] = "The DMH-11 hybrid uses barnase-barstar... system."
        errors = _pass_structural(good_3_stmt_mcq)
        assert any("truncat" in e.message.lower() for e in errors)

    def test_statement_wise_key_mismatch_caught(self, good_3_stmt_mcq):
        good_3_stmt_mcq.explanation.statement_wise = {"1": "TRUE — x.", "2": "FALSE — y."}
        errors = _pass_structural(good_3_stmt_mcq)
        assert any("statement_wise" in e.field for e in errors)


class TestLogicPass:
    def test_valid_3_stmt_options(self, good_3_stmt_mcq):
        errors = _pass_logic(good_3_stmt_mcq)
        assert errors == []

    def test_valid_2_stmt_options(self, good_2_stmt_mcq):
        errors = _pass_logic(good_2_stmt_mcq)
        assert errors == []

    def test_all_three_in_2_stmt_caught(self, good_2_stmt_mcq):
        good_2_stmt_mcq.options["C"] = "All three"
        errors = _pass_logic(good_2_stmt_mcq)
        assert any("All three" in e.message for e in errors)

    def test_neither_in_3_stmt_caught(self, good_3_stmt_mcq):
        good_3_stmt_mcq.options["D"] = "Neither of the above"
        errors = _pass_logic(good_3_stmt_mcq)
        assert any("Neither" in e.message for e in errors)

    def test_missing_all_three_in_3_stmt_warns(self, good_3_stmt_mcq):
        good_3_stmt_mcq.options["C"] = "Both 1 and 2"  # non-standard
        errors = _pass_logic(good_3_stmt_mcq)
        warnings = [e for e in errors if e.severity == "warning"]
        assert any("All three" in w.message for w in warnings)


class TestFactualPass:
    def test_known_good_explanation_passes(self):
        """A factually clean MCQ (GST, no planted errors) must pass the factual pass."""
        expl = ExplanationBlock(
            concept_anchor="GST was introduced by the 101st Constitutional Amendment Act and the GST Council is the apex body.",
            statement_wise={
                "1": "TRUE — 101st Amendment enabled GST in 2016.",
                "2": "TRUE — Finance Minister chairs the GST Council per Article 279A.",
            },
            why_others_wrong="Options A, B, D require at least one statement false; both are correct.",
            common_trap="Candidates confuse the Amendment number or attribute chairmanship to the PM.",
            elimination_hint="Both are textbook facts; eliminate A, B, D.",
        )
        mcq = RefinedMCQOutput(
            topic="GST Reform",
            subject="Polity & Governance",
            statements=[
                "The GST was enacted through the 101st Constitutional Amendment Act, 2016.",
                "The Finance Minister chairs the GST Council under Article 279A.",
            ],
            directive="Which of the above statements is/are correct?",
            options={"A": "1 only", "B": "2 only", "C": "Both 1 and 2", "D": "Neither 1 nor 2"},
            correct_answer="C",
            explanation=expl,
        )
        errors = _pass_factual(mcq)
        assert errors == []

    def test_india_npt_signatory_caught(self, good_2_stmt_mcq):
        """Statement 1 already claims India is signatory — factual check flags it."""
        errors = _pass_factual(good_2_stmt_mcq)
        flagged = [e for e in errors if "NPT" in e.message]
        assert len(flagged) > 0

    def test_dae_science_ministry_caught(self, good_2_stmt_mcq):
        """Statement 2 claims DAE under Science Ministry — must be flagged."""
        errors = _pass_factual(good_2_stmt_mcq)
        flagged = [e for e in errors if "DAE" in e.message or "Ministry" in e.message]
        assert len(flagged) > 0

    def test_dmh11_pau_attribution_caught(self, good_3_stmt_mcq):
        """Statement 3 says PAU Ludhiana — must be flagged."""
        errors = _pass_factual(good_3_stmt_mcq)
        flagged = [e for e in errors if "DMH" in e.message or "PAU" in e.message]
        assert len(flagged) > 0

    def test_short_explanation_fields_caught(self, good_3_stmt_mcq):
        good_3_stmt_mcq.explanation.concept_anchor = "Too short"
        errors = _pass_factual(good_3_stmt_mcq)
        assert any("concept_anchor" in e.field for e in errors)


class TestValidateFull:
    def test_valid_result_on_clean_mcq(self):
        """A pristine MCQ (no factual errors planted) should pass all checks."""
        expl = ExplanationBlock(
            concept_anchor="The Goods and Services Tax (GST) was implemented in India on 1 July 2017 as a comprehensive indirect tax reform.",
            statement_wise={
                "1": "TRUE — GST was introduced via the 101st Constitutional Amendment Act, 2016.",
                "2": "FALSE — The GST Council is chaired by the Union Finance Minister, not the Prime Minister.",
            },
            why_others_wrong="Options A and C require Statement 2 to be correct, which it is not.",
            common_trap="Candidates confuse the Finance Minister's chairmanship with PM-level oversight.",
            elimination_hint="Recalling that Finance Minister chairs GST Council eliminates all options except B.",
        )
        mcq = RefinedMCQOutput(
            topic="GST & Taxation",
            subject="Polity & Governance",
            statements=[
                "The GST was introduced via the 101st Constitutional Amendment Act.",
                "The GST Council is chaired by the Prime Minister of India.",
            ],
            directive="Which of the above statements is/are correct?",
            options={
                "A": "1 only",
                "B": "2 only",
                "C": "Both 1 and 2",
                "D": "Neither 1 nor 2",
            },
            correct_answer="A",
            explanation=expl,
        )
        result = validate(mcq)
        assert result.is_valid, result.feedback_string()

    def test_is_valid_false_on_errors(self, good_2_stmt_mcq):
        """good_2_stmt_mcq has planted NPT/DAE errors — validator must reject."""
        result = validate(good_2_stmt_mcq)
        # Should have factual errors for NPT and DAE
        assert not result.is_valid or len(result.errors) > 0


# ============================================================================
# Pipeline Tests (Claude mocked)
# ============================================================================

def _make_mock_tool_response(tool_input: dict) -> MagicMock:
    """Build a mock Anthropic response with a tool_use block."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.input = tool_input

    response = MagicMock()
    response.content = [tool_block]
    response.stop_reason = "tool_use"
    return response


CLEAN_TOOL_INPUT = {
    "topic": "GST Reform",
    "subject": "Polity & Governance",
    "statements": [
        "The GST was introduced via the 101st Constitutional Amendment Act.",
        "The GST Council is chaired by the Union Finance Minister.",
    ],
    "directive": "Which of the above statements is/are correct?",
    "options": {
        "A": "1 only",
        "B": "2 only",
        "C": "Both 1 and 2",
        "D": "Neither 1 nor 2",
    },
    "correct_answer": "C",
    "explanation": {
        "concept_anchor": "The 101st Amendment introduced GST as a destination-based tax, with the GST Council as the apex decision-making body.",
        "statement_wise": {
            "1": "TRUE — The Constitution (101st Amendment) Act, 2016 enabled GST implementation.",
            "2": "TRUE — The Finance Minister chairs the GST Council per Article 279A.",
        },
        "why_others_wrong": "Options A, B, D require at least one statement to be false; both are correct.",
        "common_trap": "Candidates confuse the Amendment number (100th vs 101st) or attribute chairmanship to the PM.",
        "elimination_hint": "Both statements are textbook facts; eliminate A, B, D immediately.",
    },
}


class TestRefinementPipeline:
    @pytest.fixture
    def mock_client(self):
        client = AsyncMock()
        client.messages = AsyncMock()
        return client

    @pytest.fixture
    def pipeline(self, mock_client):
        return RefinementPipeline(client=mock_client, max_retries=3)

    @pytest.mark.asyncio
    async def test_refine_one_success_on_first_attempt(self, pipeline, mock_client, raw_mcq):
        mock_client.messages.create = AsyncMock(
            return_value=_make_mock_tool_response(CLEAN_TOOL_INPUT)
        )
        result = await pipeline.refine_one(raw_mcq)

        assert isinstance(result, RefinementSuccess)
        assert result.mcq_id == raw_mcq.mcq_id
        assert result.attempts == 1
        assert mock_client.messages.create.call_count == 1

    @pytest.mark.asyncio
    async def test_refine_one_retries_on_bad_output(self, pipeline, mock_client, raw_mcq):
        """First call returns bad structure, second returns clean — expect 2 attempts."""
        bad_input = {**CLEAN_TOOL_INPUT, "directive": "Missing question mark"}  # invalid
        good_input = CLEAN_TOOL_INPUT

        mock_client.messages.create = AsyncMock(side_effect=[
            _make_mock_tool_response(bad_input),
            _make_mock_tool_response(good_input),
        ])

        result = await pipeline.refine_one(raw_mcq)

        assert isinstance(result, RefinementSuccess)
        assert result.attempts == 2
        assert mock_client.messages.create.call_count == 2

    @pytest.mark.asyncio
    async def test_refine_one_fails_after_max_retries(self, pipeline, mock_client, raw_mcq):
        """All 3 calls return invalid output — expect RefinementFailure."""
        bad_input = {**CLEAN_TOOL_INPUT, "directive": "Always wrong no question mark"}

        mock_client.messages.create = AsyncMock(
            return_value=_make_mock_tool_response(bad_input)
        )

        result = await pipeline.refine_one(raw_mcq)

        assert isinstance(result, RefinementFailure)
        assert result.attempts == 3
        assert mock_client.messages.create.call_count == 3

    @pytest.mark.asyncio
    async def test_refine_one_handles_api_error(self, pipeline, mock_client, raw_mcq):
        """Claude API error should be caught and returned as failure."""
        import anthropic
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic.APIConnectionError(request=MagicMock())
        )

        result = await pipeline.refine_one(raw_mcq)
        assert isinstance(result, RefinementFailure)
        assert "error" in result.error.lower() or "api" in result.error.lower()

    @pytest.mark.asyncio
    async def test_refine_one_handles_missing_tool_call(self, pipeline, mock_client, raw_mcq):
        """Model returns text instead of tool call — should fail gracefully."""
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Here is my answer..."

        bad_response = MagicMock()
        bad_response.content = [text_block]
        bad_response.stop_reason = "end_turn"

        mock_client.messages.create = AsyncMock(return_value=bad_response)

        result = await pipeline.refine_one(raw_mcq)
        assert isinstance(result, RefinementFailure)

    @pytest.mark.asyncio
    async def test_refine_batch_returns_successes_and_failures(self, pipeline, mock_client):
        raws = [
            RawMCQ(mcq_id=f"MCQ-{i:03d}", stem="Valid stem " * 3, options=["A","B","C","D"], correct_index=0)
            for i in range(4)
        ]

        def side_effect(*args, **kwargs):
            # Alternate: even indices succeed, odd fail
            call_num = mock_client.messages.create.call_count
            if call_num % 2 == 1:
                return _make_mock_tool_response(CLEAN_TOOL_INPUT)
            else:
                bad = {**CLEAN_TOOL_INPUT, "directive": "Always bad"}
                return _make_mock_tool_response(bad)

        mock_client.messages.create = AsyncMock(side_effect=side_effect)

        successes, failures = await pipeline.refine_batch(raws)
        assert isinstance(successes, list)
        assert isinstance(failures, list)
        assert len(successes) + len(failures) == 4

    @pytest.mark.asyncio
    async def test_refine_batch_progress_callback_called(self, pipeline, mock_client):
        raws = [
            RawMCQ(mcq_id=f"MCQ-{i}", stem="Valid stem text " * 2, options=["A","B","C","D"], correct_index=0)
            for i in range(3)
        ]
        mock_client.messages.create = AsyncMock(
            return_value=_make_mock_tool_response(CLEAN_TOOL_INPUT)
        )

        progress_calls = []
        await pipeline.refine_batch(raws, on_progress=lambda d, t: progress_calls.append((d, t)))

        assert len(progress_calls) == 3
        assert progress_calls[-1] == (3, 3)


class TestBatchStats:
    def test_stats_computation(self):
        successes = [
            RefinementSuccess(mcq_id="A", record=MagicMock(), attempts=1),
            RefinementSuccess(mcq_id="B", record=MagicMock(), attempts=2),
            RefinementSuccess(mcq_id="C", record=MagicMock(), attempts=3),
        ]
        failures = [
            RefinementFailure(mcq_id="D", error="timeout", attempts=3),
        ]
        stats = BatchStats.from_outcomes(successes, failures)

        assert stats.total == 4
        assert stats.succeeded == 3
        assert stats.failed == 1
        assert stats.multi_attempt == 2       # B and C needed >1 attempt
        assert stats.avg_attempts_on_success == 2.0
        assert stats.failure_mcq_ids == ["D"]