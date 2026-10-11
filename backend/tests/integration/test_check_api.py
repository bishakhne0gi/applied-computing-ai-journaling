import json
from typing import Any

import pytest
import sentry_sdk
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.api.deps import get_live_analyzer, get_session
from app.core.config import Settings
from app.db.models import Analysis, Entry
from app.main import create_app
from journal_ai import Analyzer
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from tests.support import YO_ES, ClientFactory, LiveApiFactory, model_reply

DIARY_TEXT = "Ayer yo es feliz con Maribel."


def _check(text: str = "Ayer yo es feliz.", language: str = "es") -> dict[str, str]:
    return {"language": language, "text": text}


async def test_check_returns_hints_with_code_point_offsets(make_live_api: LiveApiFactory) -> None:
    async with make_live_api([model_reply(YO_ES)]) as client:
        response = await client.post("/api/v1/check", json=_check())

    body = response.json()
    assert response.status_code == 200
    assert body["analyzed_text"] == "Ayer yo es feliz."
    assert body["hints"] == [{**YO_ES, "start": 5, "end": 10}]
    assert "raw_response" not in body


async def test_check_stores_nothing(make_live_api: LiveApiFactory, db_session: AsyncSession) -> None:
    async with make_live_api([model_reply(YO_ES)]) as client:
        await client.post("/api/v1/check", json=_check())

    entries = await db_session.scalar(select(func.count()).select_from(Entry))
    analyses = await db_session.scalar(select(func.count()).select_from(Analysis))
    assert (entries, analyses) == (0, 0)


async def test_the_demo_provider_serves_hints_without_a_key(make_live_api: LiveApiFactory) -> None:
    async with make_live_api() as client:
        response = await client.post("/api/v1/check", json=_check("Hoy yo es feliz."))

    body = response.json()
    assert [(h["original"], h["start"], h["end"]) for h in body["hints"]] == [("yo es", 4, 9)]
    assert body["analyzed_text"][4:9] == "yo es"


async def test_untrimmed_text_is_analysed_trimmed_and_offsets_index_it(make_live_api: LiveApiFactory) -> None:
    async with make_live_api([model_reply(YO_ES)]) as client:
        response = await client.post("/api/v1/check", json=_check("\r\n  Ayer yo es feliz.\r\n"))

    body = response.json()
    assert body["analyzed_text"] == "Ayer yo es feliz."
    hint = body["hints"][0]
    assert body["analyzed_text"][hint["start"] : hint["end"]] == hint["original"] == "yo es"


async def test_the_limit_counts_code_points(make_live_api: LiveApiFactory) -> None:
    async with make_live_api() as client:
        at_limit = await client.post("/api/v1/check", json=_check("😀" * 5000))
        over = await client.post("/api/v1/check", json=_check("😀" * 5001))

    assert (at_limit.status_code, over.status_code) == (200, 422)


async def test_fewer_than_three_words_returns_no_hints_without_calling_the_model(
    make_live_api: LiveApiFactory,
) -> None:
    provider = FakeProvider([model_reply(YO_ES)])
    async with make_live_api(analyzer=Analyzer(provider, max_attempts=1)) as client:
        response = await client.post("/api/v1/check", json=_check("  Yo es  "))

    assert response.status_code == 200
    assert response.json() == {"analyzed_text": "Yo es", "hints": []}
    assert provider.calls == []


@pytest.mark.parametrize(
    "body",
    [_check(language="xx"), _check(text="   "), _check(text="a" * 5001), {"text": "Hola"}],
    ids=["unsupported language", "blank text", "over the limit", "no language"],
)
async def test_invalid_requests_are_422(make_live_api: LiveApiFactory, body: dict[str, Any]) -> None:
    async with make_live_api([]) as client:
        response = await client.post("/api/v1/check", json=body)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "step",
    [ProviderError("down"), ProviderTimeoutError("slow"), "not json"],
    ids=["provider error", "timeout", "unusable output"],
)
async def test_an_unavailable_live_model_is_503_problem_json(
    make_live_api: LiveApiFactory, step: str | Exception
) -> None:
    async with make_live_api([step]) as client:
        response = await client.post("/api/v1/check", json=_check())

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["title"] == "Service Unavailable"


class _CrashingAnalyzer:
    async def analyze(self, text: str, language: str) -> Any:
        raise RuntimeError(f"leaked {text}")


async def test_a_crashing_analyzer_is_503_and_logs_only_the_exception_type(
    make_live_api: LiveApiFactory,
) -> None:
    # create_app reconfigures structlog, so logs are captured only once the app exists.
    async with make_live_api(analyzer=_CrashingAnalyzer()) as client:
        with capture_logs() as logs:
            response = await client.post("/api/v1/check", json=_check(DIARY_TEXT))

    assert response.status_code == 503
    assert DIARY_TEXT not in response.text
    assert any(log.get("exception_type") == "RuntimeError" for log in logs)
    assert all(DIARY_TEXT not in str(log) and "Maribel" not in str(log) for log in logs)


@pytest.mark.parametrize(
    "script", [[model_reply(YO_ES)], [ProviderError("down")]], ids=["success", "failure"]
)
async def test_live_checks_never_log_the_text(
    make_live_api: LiveApiFactory, script: list[str | Exception]
) -> None:
    async with make_live_api(script) as client:
        with capture_logs() as logs:
            await client.post("/api/v1/check", json=_check(DIARY_TEXT))

    assert any(log["event"].startswith("live_check") for log in logs)
    assert all("Maribel" not in str(log) for log in logs)


class _Capture(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.payloads: list[Any] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        self.payloads.append(envelope.get_event() or [item.payload.json for item in envelope.items])


async def test_a_crash_reaches_sentry_without_the_text(
    settings: Settings, db_session: AsyncSession, make_client: ClientFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    transport = _Capture()
    real_init = sentry_sdk.init
    # The production init_sentry runs unchanged; only the transport is swapped so events stay in memory.
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: real_init(**kwargs, transport=transport))
    app = create_app(settings.model_copy(update={"sentry_dsn": "https://key@example.invalid/1"}))
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_live_analyzer] = _CrashingAnalyzer
    try:
        async with make_client(app) as client:
            await client.post("/api/v1/check", json=_check(DIARY_TEXT))
        sentry_sdk.flush()
    finally:
        sentry_sdk.get_client().close()

    assert transport.payloads, "the crash path must reach Sentry for this test to mean anything"
    assert "Maribel" not in json.dumps(transport.payloads, default=str)
