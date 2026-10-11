from dataclasses import dataclass

import structlog

from app.core.errors import ServiceUnavailableError
from app.services.analyses import AnalyzerPort
from journal_ai import AlignedMistake

logger = structlog.get_logger()

UNAVAILABLE = "Live hints are unavailable right now"


@dataclass(frozen=True)
class LiveCheck:
    analyzed_text: str
    mistakes: tuple[AlignedMistake, ...]


# Hints for text that is not saved yet: nothing is stored, nothing reaches insights, and the text never
# reaches a log line, exception messages included, since a provider error can quote the prompt.
class LiveCheckService:
    def __init__(self, analyzer: AnalyzerPort) -> None:
        self._analyzer = analyzer

    async def check(self, text: str, language: str) -> LiveCheck:
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
