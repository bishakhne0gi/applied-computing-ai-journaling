from typing import Protocol

from journal_ai.schema import AnalysisOutcome

TraceValue = str | int | bool | None


class Trace(Protocol):
    def finish(self, outcome: AnalysisOutcome) -> None: ...


class Tracer(Protocol):
    def start(self, *, language: str) -> Trace: ...

    def shutdown(self) -> None: ...


class _NoopTrace:
    def finish(self, outcome: AnalysisOutcome) -> None:
        return None


NOOP_TRACE = _NoopTrace()


class NoopTracer:
    def start(self, *, language: str) -> Trace:
        return NOOP_TRACE

    def shutdown(self) -> None:
        return None


def trace_metadata(outcome: AnalysisOutcome, language: str) -> dict[str, TraceValue]:
    # An allow-list, not a dump: entry text, corrections, summaries, raw output and error_detail stay in our
    # database. The model provider is the only third party that ever sees the learner's words.
    return {
        "language": language,
        "prompt_version": outcome.prompt_version,
        "status": "succeeded" if outcome.succeeded else "failed",
        "failure": outcome.failure.value if outcome.failure else None,
        "retried": outcome.retried,
        "mistakes": len(outcome.result.mistakes) if outcome.result else 0,
        "dropped_mistakes": outcome.dropped_mistakes,
        "latency_ms": outcome.latency_ms,
    }
