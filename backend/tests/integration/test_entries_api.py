import uuid

import pytest
from httpx import AsyncClient


async def _create(client: AsyncClient, text: str = "Hola mundo", language: str = "es") -> dict[str, object]:
    response = await client.post("/api/v1/entries", json={"language": language, "text": text})
    assert response.status_code == 201
    return response.json()


async def test_creating_an_entry_returns_it(client: AsyncClient) -> None:
    body = await _create(client, text="  Hola mundo  ")

    assert body["text"] == "Hola mundo"
    assert body["language"] == "es"
    assert body["word_count"] == 2
    assert uuid.UUID(str(body["id"]))


@pytest.mark.parametrize(
    "payload",
    [
        {"language": "es", "text": "   "},
        {"language": "es", "text": "x" * 5001},
        {"language": "xx", "text": "Hola"},
        {"language": "es"},
    ],
    ids=["blank", "too-long", "unsupported-language", "missing-text"],
)
async def test_invalid_entries_are_rejected(client: AsyncClient, payload: dict[str, str]) -> None:
    response = await client.post("/api/v1/entries", json=payload)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


async def test_reading_an_entry_without_analyses(client: AsyncClient) -> None:
    created = await _create(client)

    response = await client.get(f"/api/v1/entries/{created['id']}")

    assert response.status_code == 200
    assert response.json()["latest_analysis"] is None


async def test_unknown_and_malformed_ids(client: AsyncClient) -> None:
    missing = await client.get(f"/api/v1/entries/{uuid.uuid4()}")
    malformed = await client.get("/api/v1/entries/not-a-uuid")

    assert missing.status_code == 404
    assert malformed.status_code == 422


async def test_patching_an_entry_updates_its_text(client: AsyncClient) -> None:
    created = await _create(client)

    response = await client.patch(f"/api/v1/entries/{created['id']}", json={"text": "Hola otra vez"})

    assert response.status_code == 200
    assert response.json()["text"] == "Hola otra vez"
    assert response.json()["word_count"] == 3


async def test_listing_pages_with_a_cursor(client: AsyncClient) -> None:
    for text in ("uno", "dos", "tres"):
        await _create(client, text=text)

    first = (await client.get("/api/v1/entries", params={"limit": 2})).json()
    second = (await client.get("/api/v1/entries", params={"limit": 2, "cursor": first["next_cursor"]})).json()

    assert [item["preview"] for item in first["items"]] == ["tres", "dos"]
    assert [item["preview"] for item in second["items"]] == ["uno"]
    assert second["next_cursor"] is None


async def test_listing_filters_by_language(client: AsyncClient) -> None:
    await _create(client, text="Hola", language="es")
    await _create(client, text="Bonjour", language="fr")

    body = (await client.get("/api/v1/entries", params={"language": "fr"})).json()

    assert [item["preview"] for item in body["items"]] == ["Bonjour"]


async def test_previews_are_truncated(client: AsyncClient) -> None:
    await _create(client, text="palabra " * 60)

    item = (await client.get("/api/v1/entries")).json()["items"][0]

    assert len(item["preview"]) <= 141
    assert item["preview"].endswith("…")


@pytest.mark.parametrize(
    ("params", "status"),
    [({"cursor": "garbage!"}, 400), ({"limit": 0}, 422), ({"limit": 51}, 422), ({"language": "xx"}, 422)],
    ids=["bad-cursor", "limit-0", "limit-51", "bad-language"],
)
async def test_bad_list_parameters_are_client_errors(
    client: AsyncClient, params: dict[str, object], status: int
) -> None:
    response = await client.get("/api/v1/entries", params=params)

    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
