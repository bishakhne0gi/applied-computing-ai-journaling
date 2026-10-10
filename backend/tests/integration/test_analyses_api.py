import uuid

from httpx import AsyncClient
from structlog.testing import capture_logs

from journal_ai.providers.base import ProviderTimeoutError
from tests.support import YO_ES, ApiFactory, model_reply


async def _entry(client: AsyncClient, text: str = "Ayer yo es feliz.") -> str:
    response = await client.post("/api/v1/entries", json={"language": "es", "text": text})
    return str(response.json()["id"])


async def test_analysing_returns_the_stored_analysis(make_api: ApiFactory) -> None:
    async with make_api([model_reply(YO_ES)]) as client:
        entry_id = await _entry(client)
        response = await client.post(f"/api/v1/entries/{entry_id}/analyses")

    body = response.json()
    assert response.status_code == 201
    assert body["status"] == "succeeded"
    assert body["mistakes"][0]["start"] == 5
    assert body["mistakes"][0]["end"] == 10
    assert "raw_response" not in body
    assert "error_detail" not in body


async def test_a_failed_analysis_is_201_with_its_error_code(make_api: ApiFactory) -> None:
    async with make_api([ProviderTimeoutError("slow")]) as client:
        entry_id = await _entry(client)
        response = await client.post(f"/api/v1/entries/{entry_id}/analyses")
        entry = await client.get(f"/api/v1/entries/{entry_id}")

    assert response.status_code == 201
    assert response.json()["status"] == "failed"
    assert response.json()["error_code"] == "provider_timeout"
    assert entry.status_code == 200
    assert entry.json()["latest_analysis"]["status"] == "failed"


async def test_retrying_after_a_failure_makes_the_new_analysis_latest(make_api: ApiFactory) -> None:
    async with make_api([ProviderTimeoutError("slow"), model_reply(YO_ES)]) as client:
        entry_id = await _entry(client)
        await client.post(f"/api/v1/entries/{entry_id}/analyses")
        retry = await client.post(f"/api/v1/entries/{entry_id}/analyses")
        history = await client.get(f"/api/v1/entries/{entry_id}/analyses")
        detail = await client.get(f"/api/v1/entries/{entry_id}")

    assert retry.json()["status"] == "succeeded"
    assert [a["status"] for a in history.json()] == ["succeeded", "failed"]
    assert detail.json()["latest_analysis"]["id"] == retry.json()["id"]


async def test_analysing_an_unknown_entry_is_404(make_api: ApiFactory) -> None:
    async with make_api() as client:
        response = await client.post(f"/api/v1/entries/{uuid.uuid4()}/analyses")

    assert response.status_code == 404


async def test_listing_analyses_of_an_unknown_entry_is_404(make_api: ApiFactory) -> None:
    async with make_api() as client:
        response = await client.get(f"/api/v1/entries/{uuid.uuid4()}/analyses")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"


async def test_a_crashing_analyzer_is_a_failed_201_and_leaks_no_entry_text(make_api: ApiFactory) -> None:
    diary_text = "Mi secreto: yo es feliz."
    async with make_api([RuntimeError(f"boom while reading {diary_text}")]) as client:
        entry_id = await _entry(client, diary_text)
        with capture_logs() as logs:
            response = await client.post(f"/api/v1/entries/{entry_id}/analyses")

    assert response.status_code == 201
    assert response.json()["status"] == "failed"
    assert response.json()["error_code"] == "provider_error"
    assert "secreto" not in str(logs)
