import time
from dataclasses import dataclass, field

from journal_ai.alignment import align_mistakes
from journal_ai.parsing import InvalidOutputError, ParsedAnalysis, parse_analysis
from journal_ai.prompts.v1 import PROMPT_VERSION, build_messages, build_retry_prompt
from journal_ai.providers.base import CompletionProvider, ProviderError, ProviderTimeoutError
from journal_ai.schema import RESPONSE_JSON_SCHEMA, AnalysisOutcome, AnalysisResult, FailureCode, Usage
from journal_ai.text import normalize_text

MAX_ATTEMPTS = 2


@dataclass
class _Run:
    started: float = field(default_factory=time.perf_counter)
    attempts: int = 0
    usage: Usage = field(default_factory=Usage)
    raw_response: str | None = None


class Analyzer:
    def __init__(self, provider: CompletionProvider) -> None:
        self._provider = provider

    async def analyze(self, text: str, language: str) -> AnalysisOutcome:
        text = normalize_text(text)
        system, user = build_messages(text, language)
        run = _Run()
        prompt = user

        while run.attempts < MAX_ATTEMPTS:
            run.attempts += 1
            try:
                completion = await self._provider.complete(
                    system=system, user=prompt, schema=RESPONSE_JSON_SCHEMA
                )
            except ProviderTimeoutError:
                return self._outcome(run, failure=FailureCode.PROVIDER_TIMEOUT)
            except ProviderError:
                return self._outcome(run, failure=FailureCode.PROVIDER_ERROR)

            run.usage += completion.usage
            run.raw_response = completion.text
            try:
                parsed = parse_analysis(completion.text)
            except InvalidOutputError as exc:
                prompt = build_retry_prompt(user, str(exc))
                continue
            return self._success(run, text, parsed)

        return self._outcome(run, failure=FailureCode.INVALID_OUTPUT)

    def _success(self, run: _Run, text: str, parsed: ParsedAnalysis) -> AnalysisOutcome:
        alignment = align_mistakes(text, parsed.mistakes)
        result = AnalysisResult(
            corrected_text=parsed.corrected_text,
            feedback_summary=parsed.feedback_summary,
            mistakes=alignment.mistakes,
        )
        return self._outcome(run, result=result, dropped=parsed.dropped + alignment.duplicates)

    def _outcome(
        self,
        run: _Run,
        *,
        result: AnalysisResult | None = None,
        failure: FailureCode | None = None,
        dropped: int = 0,
    ) -> AnalysisOutcome:
        return AnalysisOutcome(
            result=result,
            failure=failure,
            raw_response=run.raw_response,
            model=self._provider.model,
            prompt_version=PROMPT_VERSION,
            usage=run.usage,
            latency_ms=round((time.perf_counter() - run.started) * 1000),
            retried=run.attempts > 1,
            dropped_mistakes=dropped,
        )
