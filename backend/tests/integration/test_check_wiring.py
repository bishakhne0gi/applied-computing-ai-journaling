import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import main
from app.api.deps import get_session
from app.core.config import Settings
from journal_ai import NoopTracer, Usage
from journal_ai.providers.base import Completion
from journal_ai.providers.fake import FakeProvider
from journal_ai.tracing import Trace
from tests.support import YO_ES, ClientFactory, model_reply

LIVE_MODEL = "m-live"


class _SpyTracer(NoopTracer):
    def __init__(self) -> None:
        self.started = 0

    def start(self, *, language: str) -> Trace:
        self.started += 1
        return super().start(language=language)


class _Wiring:
    def __init__(self) -> None:
        self.main_provider = FakeProvider([model_reply(YO_ES)] * 5)
        self.live_provider = FakeProvider(["not json", model_reply(YO_ES)])
        self.tracer = _SpyTracer()


@pytest.fixture
def wiring(monkeypatch: pytest.MonkeyPatch) -> _Wiring:
    wired = _Wiring()

    def pick(_name: Any, **kwargs: Any) -> FakeProvider:
        return wired.live_provider if kwargs["model"] == LIVE_MODEL else wired.main_provider

    monkeypatch.setattr(main, "build_provider", pick)
    monkeypatch.setattr(main, "build_tracer", lambda **_kwargs: wired.tracer)
    return wired


async def test_check_uses_the_real_live_analyzer_one_attempt_untraced(
    wiring: _Wiring, db_session: AsyncSession, make_client: ClientFactory
) -> None:
    settings = Settings(_env_file=None, log_format="console", sentry_dsn=None, ai_live_model=LIVE_MODEL)
    app = main.create_app(settings)
    app.dependency_overrides[get_session] = lambda: db_session

    async with make_client(app) as client:
        response = await client.post("/api/v1/check", json={"language": "es", "text": "Ayer yo es feliz."})

    assert response.status_code == 503
    assert len(wiring.live_provider.calls) == 1
    assert wiring.main_provider.calls == []
    assert wiring.tracer.started == 0


class _SlowProvider(FakeProvider):
    def __init__(self, release: asyncio.Event) -> None:
        super().__init__([model_reply(YO_ES)] * 10)
        self.release = release
        self.both_in = asyncio.Event()
        self.entered = 0

    async def complete(self, *, system: str, user: str, schema: Any) -> Completion:
        self.entered += 1
        if self.entered == 2:
            self.both_in.set()
        await self.release.wait()
        return Completion(text=model_reply(YO_ES), usage=Usage(), model="fake")


async def test_a_third_concurrent_check_is_503_without_calling_the_model(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, make_client: ClientFactory
) -> None:
    release = asyncio.Event()
    slow = _SlowProvider(release)
    monkeypatch.setattr(main, "build_provider", lambda _name, **_kw: slow)
    app = main.create_app(Settings(_env_file=None, log_format="console", sentry_dsn=None))
    app.dependency_overrides[get_session] = lambda: db_session
    body = {"language": "es", "text": "Ayer yo es feliz."}

    async def post(client: AsyncClient) -> int:
        return (await client.post("/api/v1/check", json=body)).status_code

    async with make_client(app) as client:
        first = asyncio.create_task(post(client))
        second = asyncio.create_task(post(client))
        await slow.both_in.wait()
        refused = await client.post("/api/v1/check", json=body)
        release.set()
        statuses = [await first, await second]

    assert refused.status_code == 503
    assert refused.headers["content-type"].startswith("application/problem+json")
    assert slow.entered == 2
    assert statuses == [200, 200]


async def test_slots_free_up_after_a_check_finishes(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, make_client: ClientFactory
) -> None:
    release = asyncio.Event()
    release.set()
    monkeypatch.setattr(main, "build_provider", lambda _name, **_kw: _SlowProvider(release))
    app = main.create_app(Settings(_env_file=None, log_format="console", sentry_dsn=None))
    app.dependency_overrides[get_session] = lambda: db_session

    body = {"language": "es", "text": "Ayer yo es feliz."}
    async with make_client(app) as client:
        codes = [(await client.post("/api/v1/check", json=body)).status_code for _ in range(4)]

    assert codes == [200] * 4
