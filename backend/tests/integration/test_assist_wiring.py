import json
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app import main
from app.api.deps import get_session
from app.core.config import Settings
from journal_ai import NoopTracer
from journal_ai.providers.fake import FakeProvider
from tests.support import ClientFactory, rephrase_reply

LIVE_MODEL = "m-live"


class _SpyTracer(NoopTracer):
    def __init__(self) -> None:
        self.started = 0

    def start(self, *, language: str) -> Any:
        self.started += 1
        return super().start(language=language)


async def test_rephrase_and_complete_use_the_live_model_provider_and_start_no_trace(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, make_client: ClientFactory
) -> None:
    main_provider = FakeProvider([])
    live_providers: list[FakeProvider] = []
    tracer = _SpyTracer()

    def pick(_name: Any, **kwargs: Any) -> FakeProvider:
        if kwargs["model"] != LIVE_MODEL:
            return main_provider
        provider = FakeProvider([rephrase_reply("Hoy estoy feliz."), json.dumps({"completion": " y más."})])
        live_providers.append(provider)
        return provider

    monkeypatch.setattr(main, "build_provider", pick)
    monkeypatch.setattr(main, "build_tracer", lambda **_kwargs: tracer)
    app = main.create_app(
        Settings(_env_file=None, log_format="console", sentry_dsn=None, ai_live_model=LIVE_MODEL)
    )
    app.dependency_overrides[get_session] = lambda: db_session

    async with make_client(app) as client:
        rephrased = await client.post(
            "/api/v1/rephrase", json={"language": "es", "text": "Hoy yo es feliz.", "start": 0, "end": 16}
        )
        completed = await client.post(
            "/api/v1/complete", json={"language": "es", "text": "Hoy fui al mercado"}
        )

    assert (rephrased.status_code, completed.status_code) == (200, 200)
    assert sum(len(p.calls) for p in live_providers) == 2
    assert main_provider.calls == []
    assert tracer.started == 0
