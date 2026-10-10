from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from tests.support import ClientFactory

# Settings tests assert defaults, so a developer's shell must not leak into them.
_SETTINGS_ENV_VARS = (
    "ANTHROPIC_API_KEY",
    "AI_PROVIDER",
    "AI_MODEL",
    "AI_EFFORT",
    "LOG_FORMAT",
    "LOG_LEVEL",
    "CORS_ORIGINS",
    "SENTRY_DSN",
)


@pytest.fixture(autouse=True)
def _isolated_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in _SETTINGS_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, log_format="console", sentry_dsn=None)


@pytest.fixture
def make_client() -> ClientFactory:
    @asynccontextmanager
    async def factory(app: FastAPI) -> AsyncIterator[AsyncClient]:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    return factory
