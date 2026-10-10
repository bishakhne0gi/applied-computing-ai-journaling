from typing import Any

from app.api.deps import get_session
from app.core.config import Settings
from app.main import create_app
from tests.support import ClientFactory


class UnreachableSession:
    async def execute(self, *args: Any, **kwargs: Any) -> None:
        raise ConnectionRefusedError("db down")


async def test_health_reports_degraded_when_the_database_is_down(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)
    app.dependency_overrides[get_session] = UnreachableSession

    async with make_client(app) as client:
        response = await client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "down"}
