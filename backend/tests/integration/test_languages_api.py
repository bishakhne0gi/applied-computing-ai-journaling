from httpx import AsyncClient


async def test_languages_lists_every_supported_language(client: AsyncClient) -> None:
    response = await client.get("/api/v1/languages")

    assert response.status_code == 200
    assert {"code": "es", "name": "Spanish"} in response.json()
    assert len(response.json()) == 5
