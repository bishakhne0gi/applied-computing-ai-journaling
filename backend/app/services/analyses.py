import uuid
from typing import Protocol

import sentry_sdk
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Analysis, AnalysisStatus, Mistake, utcnow
from app.repositories.analyses import AnalysisRepository
from app.repositories.entries import EntryRepository
from journal_ai import PROMPT_VERSION, AnalysisOutcome, FailureCode

logger = structlog.get_logger()


class AnalyzerPort(Protocol):
    async def analyze(self, text: str, language: str) -> AnalysisOutcome: ...


class AnalysisService:
    def __init__(self, session: AsyncSession, analyzer: AnalyzerPort) -> None:
        self._session = session
        self._analyzer = analyzer
        self._entries = EntryRepository(session)
        self._analyses = AnalysisRepository(session)

    async def run(self, entry_id: uuid.UUID) -> Analysis:
        entry = await self._entries.get(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found")

        # Committed before the model call so no transaction stays open for the tens of seconds it can take.
        # `mistakes=[]` marks the collection as loaded, so extending it later triggers no lazy load.
        analysis = Analysis(
            entry_id=entry.id,
            status=AnalysisStatus.PENDING,
            input_text=entry.text,
            prompt_version=PROMPT_VERSION,
            mistakes=[],
        )
        self._analyses.add(analysis)
        await self._session.commit()

        try:
            outcome = await self._analyzer.analyze(entry.text, entry.language)
        except Exception as exc:
            # The Analyzer reports expected failures as outcomes; anything raised here is a bug or an
            # unmapped provider error, and must not leave the committed pending row behind forever.
            # Only the class name is stored so entry text can never leak through an exception message.
            await self._fail(analysis, exc)
            raise
        _apply(analysis, outcome)
        await self._session.commit()
        _report(analysis, outcome)
        return analysis

    async def _fail(self, analysis: Analysis, exc: Exception) -> None:
        analysis.status = AnalysisStatus.FAILED
        analysis.error_code = FailureCode.PROVIDER_ERROR
        analysis.error_detail = type(exc).__name__
        analysis.completed_at = utcnow()
        await self._session.commit()
        _report(analysis, outcome=None)

    async def list_for_entry(self, entry_id: uuid.UUID) -> list[Analysis]:
        if await self._entries.get(entry_id) is None:
            raise NotFoundError(f"Entry {entry_id} not found")
        return await self._analyses.list_for_entry(entry_id)


def _apply(analysis: Analysis, outcome: AnalysisOutcome) -> None:
    analysis.status = AnalysisStatus.SUCCEEDED if outcome.succeeded else AnalysisStatus.FAILED
    analysis.input_text = outcome.analyzed_text
    analysis.model = outcome.model
    analysis.prompt_version = outcome.prompt_version
    analysis.raw_response = outcome.raw_response
    analysis.error_code = outcome.failure
    analysis.error_detail = outcome.error_detail
    analysis.latency_ms = outcome.latency_ms
    analysis.input_tokens = outcome.usage.input_tokens
    analysis.output_tokens = outcome.usage.output_tokens
    analysis.retried = outcome.retried
    analysis.dropped_mistakes = outcome.dropped_mistakes
    analysis.completed_at = utcnow()
    if outcome.result is None:
        return
    analysis.corrected_text = outcome.result.corrected_text
    analysis.feedback_summary = outcome.result.feedback_summary
    analysis.mistakes.extend(
        Mistake(
            kind=m.kind,
            category=m.category,
            original=m.original,
            correction=m.correction,
            explanation=m.explanation,
            start_offset=m.start,
            end_offset=m.end,
            position=index,
        )
        for index, m in enumerate(outcome.result.mistakes)
    )


def _report(analysis: Analysis, outcome: AnalysisOutcome | None) -> None:
    if outcome is None:
        logger.info(
            "analysis_completed",
            analysis_id=str(analysis.id),
            entry_id=str(analysis.entry_id),
            status=analysis.status.value,
            error_code=analysis.error_code.value if analysis.error_code else None,
            error_detail=analysis.error_detail,
            prompt_version=analysis.prompt_version,
        )
        return
    logger.info(
        "analysis_completed",
        analysis_id=str(analysis.id),
        entry_id=str(analysis.entry_id),
        status=analysis.status.value,
        error_code=outcome.failure.value if outcome.failure else None,
        error_detail=outcome.error_detail,
        model=outcome.model,
        prompt_version=outcome.prompt_version,
        latency_ms=outcome.latency_ms,
        input_tokens=outcome.usage.input_tokens,
        output_tokens=outcome.usage.output_tokens,
        mistakes_kept=len(analysis.mistakes),
        mistakes_dropped=outcome.dropped_mistakes,
        retried=outcome.retried,
    )
    if outcome.failure is FailureCode.INVALID_OUTPUT:
        sentry_sdk.capture_message(
            "analysis_invalid_output",
            level="warning",
            tags={"analysis_id": str(analysis.id), "prompt_version": outcome.prompt_version},
        )
