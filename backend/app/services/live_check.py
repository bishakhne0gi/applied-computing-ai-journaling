import asyncio
from dataclasses import dataclass

import structlog

from app.core.errors import ServiceUnavailableError
from app.services.analyses import AnalyzerPort
from app.services.entries import count_words
from app.services.slots import claim_slot
from journal_ai import AlignedMistake, normalize_text

logger = structlog.get_logger()

MIN_WORDS = 3
MAX_CONCURRENT_CHECKS = 2
UNAVAILABLE = "Live hints are unavailable right now"


@dataclass(frozen=True)
class LiveCheck:
    analyzed_text: str
    mistakes: tuple[AlignedMistake, ...]


# Hints for text that is not saved yet: nothing is stored, nothing reaches insights, and the text never
# reaches a log line, exception messages included, since a provider error can quote the prompt.
class LiveCheckService:
    def __init__(self, analyzer: AnalyzerPort, slots: asyncio.Semaphore) -> None:
        self._analyzer = analyzer
        self._slots = slots

    async def check(self, text: str, language: str) -> LiveCheck:
        normalised = normalize_text(text)
        if count_words(normalised) < MIN_WORDS:
            return LiveCheck(analyzed_text=normalised, mistakes=())
        async with claim_slot(self._slots, UNAVAILABLE):
            return await self._run(normalised, language)

    async def _run(self, text: str, language: str) -> LiveCheck:
        try:
            outcome = await self._analyzer.analyze(text, language)
        except Exception as exc:
            logger.warning("live_check_crashed", language=language, exception_type=type(exc).__name__)
            raise ServiceUnavailableError(UNAVAILABLE) from None
        logger.info(
            "live_check_completed",
            language=language,
            model=outcome.model,
            latency_ms=outcome.latency_ms,
            hints=len(outcome.result.mistakes) if outcome.result else 0,
            error_code=outcome.failure.value if outcome.failure else None,
        )
        if outcome.result is None:
            raise ServiceUnavailableError(UNAVAILABLE)
        return LiveCheck(analyzed_text=outcome.analyzed_text, mistakes=outcome.result.mistakes)
