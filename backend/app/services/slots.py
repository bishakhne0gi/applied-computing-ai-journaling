import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.core.errors import ServiceUnavailableError


# A cancelled client does not cancel its handler, so superseded calls are still paid for; the slots cap
# concurrent paid calls per process. Refusing beats queueing: a queued hint or completion is stale when it
# arrives.
@asynccontextmanager
async def claim_slot(slots: asyncio.Semaphore, message: str) -> AsyncIterator[None]:
    if slots.locked():
        raise ServiceUnavailableError(message)
    async with slots:
        yield
