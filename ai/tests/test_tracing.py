import json

import pytest

from journal_ai.analyzer import Analyzer
from journal_ai.providers.base import ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from journal_ai.schema import AnalysisOutcome, FailureCode
from journal_ai.tracing import NoopTracer, trace_metadata

TEXT = "Ayer yo es feliz."
REPLY = json.dumps(
    {
        "corrected_text": "Ayer yo soy feliz.",
        "feedback_summary": "Lovely little entry!",
        "mistakes": [
            {
                "kind": "error",
                "category": "verb_conjugation",
                "original": "yo es",
                "correction": "yo soy",
                "explanation": "Ser with yo is soy.",
            }
        ],
    }
)


class RecordingTrace:
    def __init__(self, finished: list[AnalysisOutcome]) -> None:
        self._finished = finished

    def finish(self, outcome: AnalysisOutcome) -> None:
        self._finished.append(outcome)


class RecordingTracer:
    def __init__(self) -> None:
        self.started: list[str] = []
        self.finished: list[AnalysisOutcome] = []
        self.shut_down = False

    def start(self, *, language: str) -> RecordingTrace:
        self.started.append(language)
        return RecordingTrace(self.finished)

    def shutdown(self) -> None:
        self.shut_down = True


class BrokenTrace:
    def finish(self, outcome: AnalysisOutcome) -> None:
        raise RuntimeError("exporter down")


class BrokenTracer:
    def __init__(self, *, on: str) -> None:
        self._on = on

    def start(self, *, language: str) -> BrokenTrace:
        if self._on == "start":
            raise RuntimeError("exporter down")
        return BrokenTrace()

    def shutdown(self) -> None:
        raise RuntimeError("exporter down")


async def test_each_analysis_is_traced_once_with_its_outcome() -> None:
    tracer = RecordingTracer()

    outcome = await Analyzer(FakeProvider([REPLY]), tracer).analyze(TEXT, "es")

    assert tracer.started == ["es"]
    assert tracer.finished == [outcome]


async def test_failed_analyses_are_traced_too() -> None:
    tracer = RecordingTracer()

    outcome = await Analyzer(FakeProvider([ProviderTimeoutError("slow")]), tracer).analyze(TEXT, "es")

    assert tracer.finished == [outcome]
    assert outcome.failure is FailureCode.PROVIDER_TIMEOUT


@pytest.mark.parametrize("on", ["start", "finish"])
async def test_a_broken_tracer_never_changes_the_outcome(on: str) -> None:
    traced = await Analyzer(FakeProvider([REPLY]), BrokenTracer(on=on)).analyze(TEXT, "es")
    plain = await Analyzer(FakeProvider([REPLY])).analyze(TEXT, "es")

    assert traced.model_dump(exclude={"latency_ms"}) == plain.model_dump(exclude={"latency_ms"})


async def test_an_unsupported_language_starts_no_trace() -> None:
    tracer = RecordingTracer()

    with pytest.raises(ValueError, match="xx"):
        await Analyzer(FakeProvider([]), tracer).analyze(TEXT, "xx")

    assert tracer.started == []


async def test_aclose_shuts_the_tracer_down() -> None:
    tracer = RecordingTracer()

    await Analyzer(FakeProvider([]), tracer).aclose()

    assert tracer.shut_down


async def test_a_tracer_that_fails_to_shut_down_does_not_block_closing() -> None:
    await Analyzer(FakeProvider([]), BrokenTracer(on="shutdown")).aclose()


async def test_trace_metadata_is_an_allow_list_without_entry_text() -> None:
    outcome = await Analyzer(FakeProvider([REPLY])).analyze(TEXT, "es")

    metadata = trace_metadata(outcome, "es")

    assert set(metadata) == {
        "language",
        "prompt_version",
        "status",
        "failure",
        "retried",
        "mistakes",
        "dropped_mistakes",
        "latency_ms",
    }
    assert metadata["status"] == "succeeded"
    assert metadata["mistakes"] == 1
    for private in (TEXT, "yo es", "yo soy", "Lovely little entry!", "Ser with yo is soy."):
        assert private not in repr(metadata)


def test_the_noop_tracer_accepts_everything() -> None:
    tracer = NoopTracer()

    tracer.start(language="es").finish(None)  # type: ignore[arg-type]  # the no-op never reads the outcome
    tracer.shutdown()
