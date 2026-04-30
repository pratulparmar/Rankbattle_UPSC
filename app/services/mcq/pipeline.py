"""
MCQ Refinement Pipeline
=======================
Orchestrates the full refinement loop:

    RawMCQ  →  Claude (tool_use)  →  Schema validation  →  3-pass validation
             ↑                                                      |
             └──────────── retry with feedback (max 3) ────────────┘
                                     ↓
                            RefinedMCQRecord  →  DB upsert

Usage
-----
    from app.services.mcq.pipeline import RefinementPipeline

    pipeline = RefinementPipeline()
    result = await pipeline.refine_one(raw_mcq)      # single question
    results = await pipeline.refine_batch(raw_mcqs)  # batch with rate-limit
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import anthropic

from app.services.mcq.prompts import (
    SYSTEM_PROMPT,
    REFINEMENT_TOOL,
    FEW_SHOT_EXAMPLES,
    build_refinement_prompt,
)
from app.services.mcq.schemas import RawMCQ, RefinedMCQOutput, RefinedMCQRecord
from app.services.mcq.validator import ValidationResult, validate

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL = "claude-haiku-4-5"
MAX_TOKENS = 2048
MAX_RETRIES = 3
BATCH_CONCURRENCY = 5        # parallel Claude calls per batch
RETRY_DELAY_SECONDS = 1.0    # base delay; doubles each retry


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class RefinementSuccess:
    mcq_id: str
    record: RefinedMCQRecord
    attempts: int
    warnings: list = field(default_factory=list)


@dataclass
class RefinementFailure:
    mcq_id: str
    error: str
    attempts: int
    last_validation: Optional[ValidationResult] = None


RefinementOutcome = RefinementSuccess | RefinementFailure


# ---------------------------------------------------------------------------
# Pipeline class
# ---------------------------------------------------------------------------

class RefinementPipeline:
    """
    Stateless orchestrator. Instantiate once and reuse across requests.

    Parameters
    ----------
    client : anthropic.AsyncAnthropic, optional
        Inject a custom client (useful for testing with mocks).
    model : str
        Claude model to use. Defaults to claude-haiku-4-5.
    max_retries : int
        Maximum refinement attempts per question on validation failure.
    """

    def __init__(
        self,
        client: Optional[anthropic.AsyncAnthropic] = None,
        model: str = MODEL,
        max_retries: int = MAX_RETRIES,
    ) -> None:
        self._client = client or anthropic.AsyncAnthropic()
        self._model = model
        self._max_retries = max_retries

    # -----------------------------------------------------------------------
    # Single-question refinement
    # -----------------------------------------------------------------------

    async def refine_one(self, raw: RawMCQ) -> RefinementOutcome:
        """
        Refine a single RawMCQ.

        Makes up to `max_retries` Claude calls, feeding validation errors
        back as user messages on each retry.
        """
        messages = self._build_initial_messages(raw)
        last_validation: Optional[ValidationResult] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                refined_output, raw_tool_input = await self._call_claude(messages)
            except _ClaudeCallError as exc:
                logger.warning(
                    "mcq_id=%s attempt=%d Claude call failed: %s",
                    raw.mcq_id, attempt, exc,
                )
                if attempt < self._max_retries:
                    await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)
                    continue
                return RefinementFailure(
                    mcq_id=raw.mcq_id,
                    error=f"Claude API error after {attempt} attempts: {exc}",
                    attempts=attempt,
                )

            # Schema parse
            try:
                mcq = RefinedMCQOutput(**raw_tool_input)
            except Exception as exc:
                logger.warning(
                    "mcq_id=%s attempt=%d schema parse failed: %s",
                    raw.mcq_id, attempt, exc,
                )
                feedback = f"Schema validation failed: {exc}. Correct the tool call structure and retry."
                messages = self._append_retry(messages, raw_tool_input, feedback)
                await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)
                continue

            # 3-pass validation
            validation = validate(mcq)
            last_validation = validation

            if validation.is_valid:
                record = RefinedMCQRecord.from_refined(original=raw, refined=mcq)
                logger.info(
                    "mcq_id=%s refined successfully in %d attempt(s). warnings=%d",
                    raw.mcq_id, attempt, len(validation.warnings),
                )
                return RefinementSuccess(
                    mcq_id=raw.mcq_id,
                    record=record,
                    attempts=attempt,
                    warnings=[w.as_feedback() for w in validation.warnings],
                )

            # Validation failed — build feedback and retry
            feedback = validation.feedback_string()
            logger.warning(
                "mcq_id=%s attempt=%d validation failed (%d errors). Retrying.",
                raw.mcq_id, attempt, len(validation.errors),
            )
            messages = self._append_retry(messages, raw_tool_input, feedback)
            await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)

        # All retries exhausted
        error_summary = (
            last_validation.feedback_string()
            if last_validation
            else "Unknown validation failure"
        )
        return RefinementFailure(
            mcq_id=raw.mcq_id,
            error=f"Exceeded {self._max_retries} retries. Last errors:\n{error_summary}",
            attempts=self._max_retries,
            last_validation=last_validation,
        )

    # -----------------------------------------------------------------------
    # Batch refinement
    # -----------------------------------------------------------------------

    async def refine_batch(
        self,
        raws: List[RawMCQ],
        *,
        on_progress: Optional[callable] = None,
    ) -> Tuple[List[RefinementSuccess], List[RefinementFailure]]:
        """
        Refine a list of questions with bounded concurrency.

        Parameters
        ----------
        raws : list of RawMCQ
        on_progress : callable(done: int, total: int) → None, optional
            Called after each question completes (for progress tracking).

        Returns
        -------
        (successes, failures)
        """
        semaphore = asyncio.Semaphore(BATCH_CONCURRENCY)
        total = len(raws)
        done_count = 0
        lock = asyncio.Lock()

        async def _bounded(raw: RawMCQ) -> RefinementOutcome:
            nonlocal done_count
            async with semaphore:
                result = await self.refine_one(raw)
                async with lock:
                    done_count += 1
                    if on_progress:
                        on_progress(done_count, total)
                return result

        outcomes = await asyncio.gather(*[_bounded(r) for r in raws])

        successes = [o for o in outcomes if isinstance(o, RefinementSuccess)]
        failures = [o for o in outcomes if isinstance(o, RefinementFailure)]

        logger.info(
            "Batch complete: %d/%d succeeded, %d failed.",
            len(successes), total, len(failures),
        )
        return successes, failures

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _build_initial_messages(self, raw: RawMCQ) -> list:
        """
        Assemble the full messages list:
            [few-shot examples...] + [actual question]
        """
        user_prompt = build_refinement_prompt(
            raw_stem=raw.stem,
            raw_options=raw.options,
            subject=raw.subject,
        )
        return [
            *FEW_SHOT_EXAMPLES,
            {"role": "user", "content": user_prompt},
        ]

    async def _call_claude(
        self, messages: list
    ) -> Tuple[None, dict]:
        """
        Make a Claude tool_use call and extract the tool input dict.
        Raises _ClaudeCallError on any API or response-format problem.
        """
        try:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                tools=[REFINEMENT_TOOL],
                tool_choice={"type": "any"},   # force tool use
                messages=messages,
            )
        except anthropic.APIError as exc:
            raise _ClaudeCallError(str(exc)) from exc

        # Extract tool_use block
        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )
        if tool_block is None:
            text_preview = " ".join(
                b.text for b in response.content if hasattr(b, "text")
            )[:200]
            raise _ClaudeCallError(
                f"Model did not call the tool. stop_reason={response.stop_reason!r}. "
                f"Text preview: {text_preview!r}"
            )

        return None, tool_block.input  # tool_block.input is already a dict

    def _append_retry(
        self,
        messages: list,
        raw_tool_input: dict,
        feedback: str,
    ) -> list:
        """
        Append the model's last (bad) tool call and a tool_result rejection
        to the conversation, so the model sees exactly what was wrong.
        tool_use MUST be immediately followed by tool_result — Anthropic API rule.
        """
        return messages + [
            {
                "role": "assistant",
                "content": [
                    {
                        "type": "tool_use",
                        "id": "retry_call",
                        "name": "output_refined_mcq",
                        "input": raw_tool_input,
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "retry_call",
                        "content": f"REJECTED. {feedback}\n\nFix ALL listed issues and call the tool again.",
                    }
                ],
            },
        ]


# ---------------------------------------------------------------------------
# Private exception
# ---------------------------------------------------------------------------

class _ClaudeCallError(Exception):
    """Raised when a Claude API call fails or returns unexpected content."""


# ---------------------------------------------------------------------------
# Batch stats helper
# ---------------------------------------------------------------------------

@dataclass
class BatchStats:
    total: int
    succeeded: int
    failed: int
    multi_attempt: int          # required >1 attempt to succeed
    avg_attempts_on_success: float
    failure_mcq_ids: List[str]

    @classmethod
    def from_outcomes(
        cls,
        successes: List[RefinementSuccess],
        failures: List[RefinementFailure],
    ) -> "BatchStats":
        total = len(successes) + len(failures)
        multi_attempt = sum(1 for s in successes if s.attempts > 1)
        avg = (
            sum(s.attempts for s in successes) / len(successes)
            if successes else 0.0
        )
        return cls(
            total=total,
            succeeded=len(successes),
            failed=len(failures),
            multi_attempt=multi_attempt,
            avg_attempts_on_success=round(avg, 2),
            failure_mcq_ids=[f.mcq_id for f in failures],
        )