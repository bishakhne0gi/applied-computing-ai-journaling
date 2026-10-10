import asyncio
import os
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

import app.db.models  # noqa: F401  registers models on Base.metadata
from app.api.deps import get_session
from app.core.config import Settings
from app.db.base import Base
from app.main import create_app
from tests.support import ClientFactory

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://journal:journal@localhost:5432/journal_test"
)


@pytest.fixture(scope="session")
def _schema() -> None:
    async def reset() -> None:
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(reset())


@pytest.fixture
async def db_session(_schema: None) -> AsyncIterator[AsyncSession]:
    # Each test runs inside an outer transaction that is rolled back; service commits become savepoints.
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
async def client(
    settings: Settings, db_session: AsyncSession, make_client: ClientFactory
) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db_session
    async with make_client(app) as http:
        yield http
