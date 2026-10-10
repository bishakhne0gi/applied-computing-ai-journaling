import pytest
from httpx import AsyncClient

from journal_ai.providers.base import ProviderError
from tests.support import YO_ES, ApiFactory, model_reply

# The demo FakeProvider flags «la problema», «yo es» and «a el»; the third entry has nothing to fix.
FOUR_ENTRIES = ("Hoy la problema es grande.", "Ayer yo es feliz.", "Mi casa es bonita.", "Voy a el cine.")


async def _write(api: AsyncClient, text: str, language: str = "es") -> str:
    created = await api.post("/api/v1/entries", json={"language": language, "text": text})
    analysed = await api.post(f"/api/v1/entries/{created.json()['id']}/analyses")
    assert analysed.status_code == 201
    return str(created.json()["id"])


async def test_no_entries_yet_means_three_to_go(client: AsyncClient) -> None:
    response = await client.get("/api/v1/insights")

    assert response.status_code == 200
    assert response.json() == {
        "status": "insufficient_data",
        "entry_count": 0,
        "total_words": 0,
        "total_errors": 0,
        "error_rate": None,
        "earlier_rate": None,
        "recent_rate": None,
        "trend": None,
        "recurring_window": 0,
        "points": [],
        "categories": [],
        "summary": ["Insights start after 3 entries with feedback — 3 to go."],
    }


async def test_four_analysed_entries_report_trends_from_their_errors(make_api: ApiFactory) -> None:
    async with make_api() as api:
        for text in FOUR_ENTRIES:
            await _write(api, text)
        body = (await api.get("/api/v1/insights")).json()

    categories = {item["category"]: item for item in body["categories"]}
    assert (body["status"], body["entry_count"], body["total_words"], body["total_errors"]) == (
        "trends",
        4,
        17,
        3,
    )
    assert (body["earlier_rate"], body["recent_rate"], body["trend"]) == (22.2, 12.5, "improving")
    assert categories["article"]["trend"] == "worsening"
    assert categories["article"]["latest_example"] == {"original": "a el", "correction": "al"}
    assert categories["gender_agreement"]["trend"] == "improving"
    assert [point["error_count"] for point in body["points"]] == [1, 1, 0, 1]
    assert body["summary"][0] == "3 errors across 4 entries — 17.6 per 100 words."


async def test_re_analysing_an_entry_never_counts_it_twice(make_api: ApiFactory) -> None:
    async with make_api() as api:
        first = await _write(api, "Ayer yo es feliz.")
        for _ in range(2):
            await _write(api, "Hoy yo es feliz.")
        await api.post(f"/api/v1/entries/{first}/analyses")
        body = (await api.get("/api/v1/insights")).json()

    assert (body["status"], body["entry_count"], body["total_errors"]) == ("totals_only", 3, 3)
    assert "Verb conjugation keeps recurring: 3 of your last 3 entries." in body["summary"]


async def test_a_failed_re_analysis_keeps_the_earlier_feedback_in_insights(make_api: ApiFactory) -> None:
    script: list[str | Exception] = [*[model_reply(YO_ES)] * 3, ProviderError("down")]
    async with make_api(script) as api:
        ids = [await _write(api, "Ayer yo es feliz.") for _ in range(3)]
        failed = await api.post(f"/api/v1/entries/{ids[0]}/analyses")
        body = (await api.get("/api/v1/insights")).json()

    assert failed.json()["status"] == "failed"
    assert (body["entry_count"], body["total_errors"]) == (3, 3)


async def test_insights_can_be_narrowed_to_one_language(make_api: ApiFactory) -> None:
    async with make_api() as api:
        for _ in range(3):
            await _write(api, "Ayer yo es feliz.")
        await _write(api, "Je vais à le parc.", language="fr")
        french = (await api.get("/api/v1/insights", params={"language": "fr"})).json()
        spanish = (await api.get("/api/v1/insights", params={"language": "es"})).json()

    assert (french["status"], french["entry_count"]) == ("insufficient_data", 1)
    assert (spanish["status"], spanish["entry_count"]) == ("totals_only", 3)


@pytest.mark.parametrize("language", ["xx", ""])
async def test_an_unsupported_language_is_rejected(client: AsyncClient, language: str) -> None:
    response = await client.get("/api/v1/insights", params={"language": language})

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
