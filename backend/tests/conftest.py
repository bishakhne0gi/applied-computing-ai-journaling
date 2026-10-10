from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from tests.support import ClientFactory


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
