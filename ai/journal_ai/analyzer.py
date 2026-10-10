import time
from dataclasses import dataclass, field

from pydantic import ValidationError

from journal_ai.alignment import align_mistakes
from journal_ai.parsing import InvalidOutputError, ParsedAnalysis, parse_analysis
from journal_ai.prompts.v1 import PROMPT_VERSION, build_messages, build_retry_prompt
from journal_ai.providers.base import CompletionProvider, ProviderError, ProviderTimeoutError
from journal_ai.schema import RESPONSE_JSON_SCHEMA, AnalysisOutcome, AnalysisResult, FailureCode, Usage
from journal_ai.text import normalize_text

MAX_ATTEMPTS = 2
MAX_DETAIL_CHARS = 300


def _detail(exc: Exception) -> str:
    """Only provider and decoder messages are safe to keep; anything else may embed the learner's text."""
    if isinstance(exc, ProviderError | ProviderTimeoutError | InvalidOutputError):
        text = f"{type(exc).__name__}: {exc}"
    elif isinstance(exc, ValidationError):
        fields = "; ".join(f"{'.'.join(map(str, e['loc']))}:{e['type']}" for e in exc.errors())
        text = f"ValidationError: {fields}"
    else:
        text = type(exc).__name__
    return text[:MAX_DETAIL_CHARS]


@dataclass
class _Run:
    text: str
    started: float = field(default_factory=time.perf_counter)
    attempts: int = 0
    usage: Usage = field(default_factory=Usage)
    raw_response: str | None = None
    error_detail: str | None = None
    served_model: str | None = None


class Analyzer:
    def __init__(self, provider: CompletionProvider) -> None:
        self._provider = provider

    async def analyze(self, text: str, language: str) -> AnalysisOutcome:
        # Callers rely on analyze() never raising for provider or output problems; only a bad language does.
        text = normalize_text(text)
        system, user = build_messages(text, language)
        run = _Run(text=text)
        prompt = user

        while run.attempts < MAX_ATTEMPTS:
            run.attempts += 1
            step = await self._attempt(run, system, prompt)
            if isinstance(step, AnalysisOutcome):
                return step
            prompt = build_retry_prompt(user, step)

        return self._outcome(run, failure=FailureCode.INVALID_OUTPUT)

    async def _attempt(self, run: _Run, system: str, prompt: str) -> AnalysisOutcome | str:
        """Return a finished outcome, or the parse error text when the reply should be retried."""
        try:
            completion = await self._provider.complete(
                system=system, user=prompt, schema=RESPONSE_JSON_SCHEMA
            )
        except ProviderTimeoutError as exc:
            run.error_detail = _detail(exc)
            return self._outcome(run, failure=FailureCode.PROVIDER_TIMEOUT)
        except Exception as exc:
            run.error_detail = _detail(exc)
            return self._outcome(run, failure=FailureCode.PROVIDER_ERROR)

        run.usage += completion.usage
        run.served_model = completion.model
        run.raw_response = completion.text
        try:
            parsed = parse_analysis(completion.text)
        except InvalidOutputError as exc:
            run.error_detail = _detail(exc)
            return str(exc)
        try:
            return self._success(run, parsed)
        except Exception as exc:
            run.error_detail = _detail(exc)
            return self._outcome(run, failure=FailureCode.INVALID_OUTPUT)

    def _success(self, run: _Run, parsed: ParsedAnalysis) -> AnalysisOutcome:
        alignment = align_mistakes(run.text, parsed.mistakes)
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
            analyzed_text=run.text,
            raw_response=run.raw_response,
            model=run.served_model or self._provider.model,
            prompt_version=PROMPT_VERSION,
            usage=run.usage,
            latency_ms=round((time.perf_counter() - run.started) * 1000),
            retried=run.attempts > 1,
            dropped_mistakes=dropped,
            error_detail=run.error_detail if failure else None,
        )
