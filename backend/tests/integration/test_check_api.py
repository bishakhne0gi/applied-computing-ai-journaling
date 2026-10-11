from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.db.models import Analysis, Entry
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from tests.support import YO_ES, LiveApiFactory, model_reply

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

    assert [hint["original"] for hint in response.json()["hints"]] == ["yo es"]


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
async def test_live_checks_never_log_or_report_the_text(
    make_live_api: LiveApiFactory, monkeypatch: pytest.MonkeyPatch, script: list[str | Exception]
) -> None:
    reported: list[Any] = []
    monkeypatch.setattr("sentry_sdk.capture_message", lambda *a, **k: reported.append((a, k)))
    monkeypatch.setattr("sentry_sdk.capture_exception", lambda *a, **k: reported.append((a, k)))
    async with make_live_api(script) as client:
        with capture_logs() as logs:
            await client.post("/api/v1/check", json=_check(DIARY_TEXT))

    assert reported == []
    assert any(log["event"].startswith("live_check") for log in logs)
    assert all("Maribel" not in str(log) for log in logs)
