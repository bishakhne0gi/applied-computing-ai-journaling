from app.core.config import Settings
from app.core.errors import NotFoundError
from app.main import create_app
from tests.support import ClientFactory

PROBLEM_JSON = "application/problem+json"


async def test_unknown_route_returns_problem_json(settings: Settings, make_client: ClientFactory) -> None:
    async with make_client(create_app(settings)) as client:
        response = await client.get("/nope")

    body = response.json()
    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM_JSON
    assert body["title"] == "Not Found"
    assert body["instance"] == "/nope"
    assert body["request_id"]


async def test_app_errors_keep_their_status_and_detail(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)

    def missing() -> None:
        raise NotFoundError("Entry 42 not found")

    app.add_api_route("/missing", missing)

    async with make_client(app) as client:
        response = await client.get("/missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Entry 42 not found"


async def test_unhandled_errors_hide_internals(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)

    def boom() -> None:
        raise RuntimeError("database password is hunter2")

    app.add_api_route("/boom", boom)

    async with make_client(app) as client:
        response = await client.get("/boom")

    assert response.status_code == 500
    assert response.headers["content-type"] == PROBLEM_JSON
    assert "hunter2" not in response.text
    assert response.json()["request_id"]


async def test_validation_errors_list_the_failing_fields(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)

    def needs_int(n: int) -> dict[str, int]:
        return {"n": n}

    app.add_api_route("/needs-int", needs_int)

    async with make_client(app) as client:
        response = await client.get("/needs-int", params={"n": "x"})

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"] == ["query", "n"]
