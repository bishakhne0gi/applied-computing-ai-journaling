import pytest
from structlog.testing import capture_logs

from app.core.config import Settings
from app.core.request_context import REQUEST_ID_HEADER
from app.main import create_app
from tests.support import ClientFactory


async def test_generates_a_request_id_and_echoes_it(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping")

    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_honours_a_valid_incoming_request_id(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping", headers={REQUEST_ID_HEADER: "abc-123"})

    assert response.headers[REQUEST_ID_HEADER] == "abc-123"


@pytest.mark.parametrize("hostile", ["a b", "x" * 65, "<script>", "../../etc"])
async def test_replaces_a_hostile_request_id(
    settings: Settings, make_client: ClientFactory, hostile: str
) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping", headers={REQUEST_ID_HEADER: hostile})

    assert response.headers[REQUEST_ID_HEADER] != hostile
    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_logs_one_line_per_request_with_the_request_id(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    with capture_logs() as logs:
        async with make_client(app) as client:
            response = await client.get("/ping")

    request_logs = [log for log in logs if log["event"] == "request"]
    assert len(request_logs) == 1
    assert request_logs[0]["status"] == 200
    assert request_logs[0]["path"] == "/ping"
    assert request_logs[0]["request_id"] == response.headers[REQUEST_ID_HEADER]


async def test_logs_the_request_even_when_the_handler_crashes(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)

    def boom() -> None:
        raise RuntimeError("kaboom")

    app.add_api_route("/boom", boom)

    with capture_logs() as logs:
        async with make_client(app) as client:
            response = await client.get("/boom")

    request_logs = [log for log in logs if log["event"] == "request"]
    assert len(request_logs) == 1
    assert request_logs[0]["status"] == 500
    assert request_logs[0]["request_id"] == response.json()["request_id"]
    assert "duration_ms" in request_logs[0]
