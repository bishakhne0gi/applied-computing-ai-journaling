import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from journal_ai.assist_parsing import finish_completion, parse_rephrasing
from journal_ai.parsing import InvalidOutputError
from journal_ai.prompts.assist_v1 import build_completion_messages, build_rephrase_messages
from journal_ai.providers.base import Completion, CompletionProvider, ProviderTimeoutError
from journal_ai.schema import (
    COMPLETION_JSON_SCHEMA,
    REPHRASE_JSON_SCHEMA,
    CompletionOutcome,
    FailureCode,
    RephraseOutcome,
    Usage,
)


@dataclass
class _Call:
    completion: Completion | None
    failure: FailureCode | None
    latency_ms: int


def _elapsed(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


class WritingAssist:
    """Rephrase and autocomplete on the live model. One attempt each: a retried answer is stale."""

    def __init__(self, provider: CompletionProvider) -> None:
        self._provider = provider

    async def aclose(self) -> None:
        await self._provider.aclose()

    async def rephrase(self, text: str, start: int, end: int, language: str) -> RephraseOutcome:
        sentence = text[start:end]
        system, user = build_rephrase_messages(text, sentence, language)
        call = await self._call(system, user, REPHRASE_JSON_SCHEMA)
        result, failure = None, call.failure
        if call.completion is not None:
            try:
                result = parse_rephrasing(call.completion.text, sentence)
            except InvalidOutputError:
                failure = FailureCode.INVALID_OUTPUT
        return RephraseOutcome(result=result, failure=failure, **self._meta(call))

    async def complete(self, prefix: str, language: str) -> CompletionOutcome:
        system, user = build_completion_messages(prefix, language)
        call = await self._call(system, user, COMPLETION_JSON_SCHEMA)
        completion, failure = None, call.failure
        if call.completion is not None:
            try:
                completion = finish_completion(prefix, call.completion.text)
            except InvalidOutputError:
                failure = FailureCode.INVALID_OUTPUT
        return CompletionOutcome(completion=completion, failure=failure, **self._meta(call))

    async def _call(self, system: str, user: str, schema: Mapping[str, Any]) -> _Call:
        started = time.perf_counter()
        try:
            completion = await self._provider.complete(system=system, user=user, schema=schema)
        except ProviderTimeoutError:
            return _Call(None, FailureCode.PROVIDER_TIMEOUT, _elapsed(started))
        except Exception:  # never the message: provider errors can quote the prompt
            return _Call(None, FailureCode.PROVIDER_ERROR, _elapsed(started))
        return _Call(completion, None, _elapsed(started))

    def _meta(self, call: _Call) -> dict[str, Any]:
        served = call.completion.model if call.completion else self._provider.model
        usage = call.completion.usage if call.completion else Usage()
        return {"model": served, "latency_ms": call.latency_ms, "usage": usage}
