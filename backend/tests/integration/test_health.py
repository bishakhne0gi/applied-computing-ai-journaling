from httpx import AsyncClient


async def test_health_is_ok_when_the_database_answers(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}
