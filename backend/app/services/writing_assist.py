import asyncio
from typing import Protocol

import structlog

from app.core.errors import ServiceUnavailableError
from app.services.entries import count_words
from app.services.slots import claim_slot
from journal_ai import CompletionOutcome, RephraseOutcome, Rephrasing, unify_text

logger = structlog.get_logger()

MIN_WORDS = 3
MAX_CONCURRENT_CALLS = 2
REPHRASE_UNAVAILABLE = "Rephrasing is unavailable right now"
COMPLETE_UNAVAILABLE = "Autocomplete is unavailable right now"


class RephraserPort(Protocol):
    async def rephrase(self, text: str, start: int, end: int, language: str) -> RephraseOutcome: ...


class CompleterPort(Protocol):
    async def complete(self, prefix: str, language: str) -> CompletionOutcome: ...


# Suggestions for text that is not saved: nothing is stored, and no text reaches a log line or Sentry,
# exception messages included, since a provider error can quote the prompt.
class RephraseService:
    def __init__(self, rephraser: RephraserPort, slots: asyncio.Semaphore) -> None:
        self._rephraser = rephraser
        self._slots = slots

    async def rephrase(self, text: str, start: int, end: int, language: str) -> Rephrasing:
        async with claim_slot(self._slots, REPHRASE_UNAVAILABLE):
            try:
                outcome = await self._rephraser.rephrase(text, start, end, language)
            except Exception as exc:
                logger.warning("rephrase_crashed", language=language, exception_type=type(exc).__name__)
                raise ServiceUnavailableError(REPHRASE_UNAVAILABLE) from None
        result = outcome.result
        logger.info(
            "rephrase_completed",
            language=language,
            model=outcome.model,
            latency_ms=outcome.latency_ms,
            versions=len(result.versions) if result else 0,
            vocabulary=len(result.vocabulary) if result else 0,
            error_code=outcome.failure.value if outcome.failure else None,
        )
        if result is None:
            raise ServiceUnavailableError(REPHRASE_UNAVAILABLE)
        return result


class CompletionService:
    def __init__(self, completer: CompleterPort, slots: asyncio.Semaphore) -> None:
        self._completer = completer
        self._slots = slots

    async def complete(self, text: str, language: str) -> str:
        prefix = unify_text(text)
        if count_words(prefix) < MIN_WORDS:
            return ""
        async with claim_slot(self._slots, COMPLETE_UNAVAILABLE):
            try:
                outcome = await self._completer.complete(prefix, language)
            except Exception as exc:
                logger.warning("completion_crashed", language=language, exception_type=type(exc).__name__)
                raise ServiceUnavailableError(COMPLETE_UNAVAILABLE) from None
        completion = outcome.completion
        logger.info(
            "completion_completed",
            language=language,
            model=outcome.model,
            latency_ms=outcome.latency_ms,
            words=len(completion.split()) if completion else 0,
            error_code=outcome.failure.value if outcome.failure else None,
        )
        if completion is None:
            raise ServiceUnavailableError(COMPLETE_UNAVAILABLE)
        return completion
