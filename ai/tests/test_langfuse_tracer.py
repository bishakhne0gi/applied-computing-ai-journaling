import asyncio
import json
from typing import Any, cast

import pytest
from langfuse import Langfuse

from journal_ai import langfuse_tracer
from journal_ai.analyzer import Analyzer
from journal_ai.langfuse_tracer import LangfuseTracer, build_tracer
from journal_ai.providers.base import ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from journal_ai.tracing import NoopTracer

TEXT = "Hoy tengo la problema con mi coche."
REPLY = json.dumps(
    {
        "corrected_text": "Hoy tengo el problema con mi coche.",
        "feedback_summary": "Nice description of your day!",
        "mistakes": [
            {
                "kind": "error",
                "category": "gender_agreement",
                "original": "la problema",
                "correction": "el problema",
                "explanation": "Problema is masculine.",
            }
        ],
    }
)


class FakeGeneration:
    def __init__(self, **started: Any) -> None:
        self.started = started
        self.updates: list[dict[str, Any]] = []
        self.ended = False

    def update(self, **fields: Any) -> "FakeGeneration":
        self.updates.append(fields)
        return self

    def end(self) -> "FakeGeneration":
        self.ended = True
        return self


class FakeLangfuse:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs
        self.generations: list[FakeGeneration] = []
        self.shut_down = False

    def start_observation(self, **kwargs: Any) -> FakeGeneration:
        generation = FakeGeneration(**kwargs)
        self.generations.append(generation)
        return generation

    def shutdown(self) -> None:
        self.shut_down = True


def _traced(client: FakeLangfuse) -> LangfuseTracer:
    return LangfuseTracer(cast(Langfuse, client))


@pytest.mark.parametrize(
    ("public_key", "secret_key", "host"),
    [
        (None, None, None),
        ("pk", None, None),
        ("pk", "sk", None),
        ("pk", "sk", ""),
        ("", "sk", "https://lf.test"),
    ],
)
def test_tracing_stays_off_unless_all_three_settings_are_present(
    public_key: str | None, secret_key: str | None, host: str | None
) -> None:
    assert isinstance(build_tracer(public_key=public_key, secret_key=secret_key, host=host), NoopTracer)


def test_all_three_settings_build_a_langfuse_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(langfuse_tracer, "Langfuse", FakeLangfuse)

    settings: dict[str, str] = {"public_key": "pk", "secret_key": "sk", "host": "https://lf.test"}

    tracer = build_tracer(**settings, environment="production", release="abc")

    assert isinstance(tracer, LangfuseTracer)
    assert cast(FakeLangfuse, tracer.client).kwargs == {
        "public_key": "pk",
        "secret_key": "sk",
        "base_url": "https://lf.test",
        "environment": "production",
        "release": "abc",
    }


async def test_a_successful_analysis_becomes_one_generation_with_usage() -> None:
    client = FakeLangfuse()

    await Analyzer(FakeProvider([REPLY]), _traced(client)).analyze(TEXT, "es")

    (generation,) = client.generations
    assert generation.started["as_type"] == "generation"
    assert generation.started["name"] == "analyze_entry"
    assert generation.started["version"] == "v1"
    (update,) = generation.updates
    assert update["model"] == "fake"
    assert update["usage_details"] == {"input": 0, "output": 0}
    assert update["level"] == "DEFAULT"
    assert update["status_message"] is None
    assert update["metadata"]["status"] == "succeeded"
    assert generation.ended


async def test_a_failed_analysis_is_an_error_level_generation() -> None:
    client = FakeLangfuse()

    await Analyzer(FakeProvider([ProviderTimeoutError("slow")]), _traced(client)).analyze(TEXT, "es")

    (update,) = client.generations[0].updates
    assert update["level"] == "ERROR"
    assert update["status_message"] == "provider_timeout"


async def test_traces_never_carry_entry_text() -> None:
    client = FakeLangfuse()

    await Analyzer(FakeProvider([REPLY]), _traced(client)).analyze(TEXT, "es")

    sent = repr([(g.started, g.updates) for g in client.generations])
    private_strings = (
        TEXT,
        "la problema",
        "el problema",
        "Nice description of your day!",
        "Problema is masculine.",
    )
    for private in private_strings:
        assert private not in sent
    assert "input" not in client.generations[0].started
    assert "output" not in client.generations[0].updates[0]


def test_shutdown_flushes_the_client() -> None:
    client = FakeLangfuse()

    _traced(client).shutdown()

    assert client.shut_down


def test_a_client_that_cannot_start_falls_back_to_the_noop_tracer(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def explode(**_: Any) -> None:
        raise ValueError("bad environment: leaky-value")

    monkeypatch.setattr(langfuse_tracer, "Langfuse", explode)

    settings: dict[str, str] = {"public_key": "pk", "secret_key": "leaky-value", "host": "https://lf.test"}

    tracer = build_tracer(**settings)

    assert isinstance(tracer, NoopTracer)
    assert "ValueError" in caplog.text
    assert "leaky-value" not in caplog.text


@pytest.mark.parametrize("interruption", [asyncio.CancelledError, KeyboardInterrupt])
async def test_an_interrupted_analysis_still_ends_its_generation(interruption: type[BaseException]) -> None:
    client = FakeLangfuse()

    class Interrupted(FakeProvider):
        async def complete(self, **_: Any) -> Any:
            raise interruption

    with pytest.raises(interruption):
        await Analyzer(Interrupted([]), _traced(client)).analyze(TEXT, "es")

    (generation,) = client.generations
    assert generation.ended
    assert generation.updates[-1]["level"] == "ERROR"
