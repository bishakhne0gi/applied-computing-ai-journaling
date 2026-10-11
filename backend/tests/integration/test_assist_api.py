import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
import sentry_sdk
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.api.deps import get_session, get_writing_assist
from app.core.config import Settings
from app.db.models import Analysis, Entry
from app.main import create_app
from journal_ai import CompletionOutcome, RephraseOutcome, Rephrasing, Usage
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from tests.support import AssistApiFactory, ClientFactory, rephrase_reply

REPO_ROOT = Path(__file__).resolve().parents[3]
ENTRY = "Ayer fui al mercado. Hoy yo es feliz con Maribel."
PRIVATE_NAME = "Maribel"
COMPLETE = {"language": "es", "text": "Hoy fui al mercado con Maribel"}


def _rephrase(text: str = ENTRY, start: int = 21, end: int = 49, language: str = "es") -> dict[str, Any]:
    return {"language": language, "text": text, "start": start, "end": end}


BOTH = [("/api/v1/rephrase", _rephrase()), ("/api/v1/complete", COMPLETE)]


async def test_rephrase_returns_versions_and_vocabulary_with_sentence_offsets(
    make_assist_api: AssistApiFactory,
) -> None:
    async with make_assist_api([rephrase_reply("Hoy estoy feliz con Maribel.")]) as client:
        response = await client.post("/api/v1/rephrase", json=_rephrase())

    body = response.json()
    assert response.status_code == 200
    assert body["sentence"] == "Hoy yo es feliz con Maribel."
    assert body["versions"] == [
        {
            "text": "Hoy estoy feliz con Maribel.",
            "tone": "natural",
            "label": "More natural",
            "explanation": "Why.",
        }
    ]
    assert body["vocabulary"] == [
        {
            "original": "feliz",
            "start": 10,
            "end": 15,
            "alternatives": [{"word": "contento", "nuance": "Softer."}],
        }
    ]


async def test_offsets_count_code_points(make_assist_api: AssistApiFactory) -> None:
    text = "¿Qué tal? 😊 Hoy yo es feliz."
    start = text.index("Hoy")  # Python indexes code points: 12, while JavaScript would say 13
    async with make_assist_api([rephrase_reply("Hoy estoy feliz.")]) as client:
        response = await client.post("/api/v1/rephrase", json=_rephrase(text, start, len(text)))

    assert response.json()["sentence"] == "Hoy yo es feliz."


@pytest.mark.parametrize(
    "body",
    [
        _rephrase(language="xx"),
        _rephrase(text=" " + ENTRY, start=22, end=50),
        _rephrase(text="Café con leche y pan.", start=0, end=22),
        _rephrase(start=30, end=21),
        _rephrase(end=len(ENTRY) + 1),
        _rephrase(start=21, end=27),  # «Hoy yo»: 2 words
        _rephrase(text="a " * 260 + "b.", start=0, end=522),
        {"language": "es", "text": ENTRY},
    ],
    ids=[
        "unsupported language",
        "not trimmed",
        "not NFC",
        "reversed span",
        "past the end",
        "under 3 words",
        "over 500",
        "no span",
    ],
)
async def test_invalid_rephrase_requests_are_422(
    make_assist_api: AssistApiFactory, body: dict[str, Any]
) -> None:
    async with make_assist_api([]) as client:
        response = await client.post("/api/v1/rephrase", json=body)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"language": "xx", "text": "Hoy fui al mercado"},
        {"language": "es", "text": "   "},
        {"language": "es", "text": "a" * 5001},
        {"text": "Hoy fui al mercado"},
    ],
    ids=["unsupported language", "blank", "over the limit", "no language"],
)
async def test_invalid_complete_requests_are_422(
    make_assist_api: AssistApiFactory, body: dict[str, Any]
) -> None:
    async with make_assist_api([]) as client:
        response = await client.post("/api/v1/complete", json=body)

    assert response.status_code == 422


async def test_the_demo_provider_rephrases_without_a_key(make_assist_api: AssistApiFactory) -> None:
    golden = json.loads((REPO_ROOT / "fixtures" / "assist-demo.json").read_text())["rephrase"][0]
    async with make_assist_api() as client:
        response = await client.post(
            "/api/v1/rephrase", json={k: golden[k] for k in ("language", "text", "start", "end")}
        )

    assert response.json() == golden["expected"]


async def test_complete_returns_the_completion(make_assist_api: AssistApiFactory) -> None:
    async with make_assist_api([json.dumps({"completion": " con mi madre."})]) as client:
        response = await client.post(
            "/api/v1/complete", json={"language": "es", "text": "Hoy fui al mercado"}
        )

    assert response.json() == {"completion": " con mi madre."}


async def test_complete_keeps_the_trailing_space_it_was_sent(make_assist_api: AssistApiFactory) -> None:
    async with make_assist_api([json.dumps({"completion": " con mi madre."})]) as client:
        response = await client.post(
            "/api/v1/complete", json={"language": "es", "text": "Hoy fui al mercado "}
        )

    assert response.json() == {"completion": "con mi madre."}


async def test_fewer_than_three_words_complete_to_nothing_without_calling_the_model(
    make_assist_api: AssistApiFactory,
) -> None:
    async with make_assist_api([]) as client:  # an empty script raises if the model were called
        response = await client.post("/api/v1/complete", json={"language": "es", "text": "Hoy fui"})

    assert response.json() == {"completion": ""}


@pytest.mark.parametrize(
    ("path", "body", "detail"),
    [(*BOTH[0], "Rephrasing is unavailable right now"), (*BOTH[1], "Autocomplete is unavailable right now")],
)
@pytest.mark.parametrize(
    "step",
    [ProviderError("down"), ProviderTimeoutError("slow"), "not json"],
    ids=["error", "timeout", "unusable"],
)
async def test_an_unavailable_model_is_503_problem_json(
    make_assist_api: AssistApiFactory, path: str, body: dict[str, Any], detail: str, step: str | Exception
) -> None:
    async with make_assist_api([step]) as client:
        response = await client.post(path, json=body)

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["title"] == "Service Unavailable"
    assert response.json()["detail"] == detail


class _GatedAssist:
    """Holds every call open until released, recording how many are in flight."""

    def __init__(self, *, gate: tuple[str, ...] = ("rephrase", "complete")) -> None:
        self.release = asyncio.Event()
        self.entered = 0
        self.two_in = asyncio.Event()
        self._gate = gate

    async def _wait(self) -> None:
        self.entered += 1
        if self.entered == 2:
            self.two_in.set()
        await self.release.wait()

    async def rephrase(self, text: str, start: int, end: int, language: str) -> Any:
        if "rephrase" in self._gate:
            await self._wait()
        return RephraseOutcome(
            result=Rephrasing(sentence=text[start:end], versions=(), vocabulary=()),
            failure=None,
            model="m",
            latency_ms=1,
            usage=Usage(),
        )

    async def complete(self, prefix: str, language: str) -> Any:
        if "complete" in self._gate:
            await self._wait()
        return CompletionOutcome(completion="x", failure=None, model="m", latency_ms=1, usage=Usage())


async def test_a_third_concurrent_rephrase_is_refused_at_once(make_assist_api: AssistApiFactory) -> None:
    gated = _GatedAssist()

    async def post(client: Any) -> int:
        return (await client.post("/api/v1/rephrase", json=_rephrase())).status_code

    async with make_assist_api(assist=gated) as client:
        first = asyncio.create_task(post(client))
        second = asyncio.create_task(post(client))
        await gated.two_in.wait()
        # A queueing claim_slot would hang here rather than refuse.
        refused = await asyncio.wait_for(client.post("/api/v1/rephrase", json=_rephrase()), timeout=1)
        gated.release.set()
        statuses = [await first, await second]

    assert refused.status_code == 503
    assert gated.entered == 2
    assert statuses == [200, 200]


async def test_rephrase_and_complete_have_separate_slots(make_assist_api: AssistApiFactory) -> None:
    gated = _GatedAssist(gate=("complete",))

    async def post(client: Any) -> int:
        return (await client.post("/api/v1/complete", json=COMPLETE)).status_code

    async with make_assist_api(assist=gated) as client:
        first = asyncio.create_task(post(client))
        second = asyncio.create_task(post(client))
        await gated.two_in.wait()
        # Both completion slots are held; a rephrase must still get through on its own.
        rephrased = await asyncio.wait_for(client.post("/api/v1/rephrase", json=_rephrase()), timeout=1)
        gated.release.set()
        statuses = [await first, await second]

    assert rephrased.status_code == 200
    assert statuses == [200, 200]


class _CrashingAssist:
    async def rephrase(self, text: str, start: int, end: int, language: str) -> Any:
        raise RuntimeError(f"leaked {text}")

    async def complete(self, prefix: str, language: str) -> Any:
        raise RuntimeError(f"leaked {prefix}")


@pytest.mark.parametrize(("path", "body"), BOTH)
async def test_a_crash_is_503_and_logs_only_the_exception_type(
    make_assist_api: AssistApiFactory, path: str, body: dict[str, Any]
) -> None:
    async with make_assist_api(assist=_CrashingAssist()) as client:
        with capture_logs() as logs:
            response = await client.post(path, json=body)

    assert response.status_code == 503
    assert PRIVATE_NAME not in response.text
    assert any(log.get("exception_type") == "RuntimeError" for log in logs)
    assert all(PRIVATE_NAME not in str(log) for log in logs)


@pytest.mark.parametrize(
    ("path", "body", "reply", "event"),
    [
        (BOTH[0][0], BOTH[0][1], rephrase_reply("Hoy estoy feliz con Maribel."), "rephrase_"),
        (BOTH[1][0], BOTH[1][1], json.dumps({"completion": " y Maribel volvió."}), "completion_"),
    ],
    ids=["rephrase", "complete"],
)
@pytest.mark.parametrize("failing", [False, True], ids=["success", "failure"])
async def test_assist_calls_never_log_or_report_the_text(
    *,
    make_assist_api: AssistApiFactory,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    body: dict[str, Any],
    reply: str,
    event: str,
    failing: bool,
) -> None:
    reported: list[object] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda *args, **_kwargs: reported.append(args))
    monkeypatch.setattr(sentry_sdk, "capture_message", lambda *args, **_kwargs: reported.append(args))
    step: str | Exception = ProviderError("down") if failing else reply

    async with make_assist_api([step]) as client:
        with capture_logs() as logs:
            await client.post(path, json=body)

    assert reported == []
    assert any(log["event"].startswith(event) for log in logs)
    assert all(PRIVATE_NAME not in str(log) for log in logs)


class _Capture(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.payloads: list[Any] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        self.payloads.append(envelope.get_event() or [item.payload.json for item in envelope.items])


@pytest.mark.parametrize(("path", "body"), BOTH)
async def test_a_crash_reaches_sentry_without_the_text(
    *,
    settings: Settings,
    db_session: AsyncSession,
    make_client: ClientFactory,
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    body: dict[str, Any],
) -> None:
    transport = _Capture()
    real_init = sentry_sdk.init
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: real_init(**kwargs, transport=transport))
    app = create_app(settings.model_copy(update={"sentry_dsn": "https://key@example.invalid/1"}))
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_writing_assist] = _CrashingAssist
    try:
        async with make_client(app) as client:
            await client.post(path, json=body)
        sentry_sdk.flush()
    finally:
        sentry_sdk.get_client().close()

    assert PRIVATE_NAME not in json.dumps(transport.payloads, default=str)


@pytest.mark.parametrize(("path", "body"), BOTH)
async def test_assist_calls_store_nothing(
    make_assist_api: AssistApiFactory, db_session: AsyncSession, path: str, body: dict[str, Any]
) -> None:
    async with make_assist_api() as client:
        await client.post(path, json=body)

    entries = await db_session.scalar(select(func.count()).select_from(Entry))
    analyses = await db_session.scalar(select(func.count()).select_from(Analysis))
    assert (entries, analyses) == (0, 0)
