import unicodedata

from httpx import AsyncClient

from tests.support import YO_ES, ApiFactory, model_reply

TEXT = "Ayer yo es feliz.\r\n"


async def test_create_analyze_store_retrieve(make_api: ApiFactory) -> None:
    async with make_api([model_reply(YO_ES)]) as client:
        created = (await client.post("/api/v1/entries", json={"language": "es", "text": TEXT})).json()
        await client.post(f"/api/v1/entries/{created['id']}/analyses")
        detail = (await client.get(f"/api/v1/entries/{created['id']}")).json()
        listing = (await client.get("/api/v1/entries")).json()

    analysis = detail["latest_analysis"]
    mistake = analysis["mistakes"][0]
    assert detail["text"] == "Ayer yo es feliz."
    assert analysis["input_text"][mistake["start"] : mistake["end"]] == mistake["original"] == "yo es"
    assert analysis["corrected_text"] == "Ayer yo soy feliz."
    assert listing["items"][0]["latest_status"] == "succeeded"
    assert listing["items"][0]["error_count"] == 1


async def test_the_default_app_runs_the_demo_provider_without_a_key(client: AsyncClient) -> None:
    created = (
        await client.post("/api/v1/entries", json={"language": "es", "text": "Ayer yo es feliz."})
    ).json()

    response = await client.post(f"/api/v1/entries/{created['id']}/analyses")

    assert response.status_code == 201
    assert response.json()["status"] == "succeeded"
    assert response.json()["model"] == "fake"


async def test_decomposed_accents_keep_offsets_exact_end_to_end(make_api: ApiFactory) -> None:
    nfc = "Él está en el café y yo es feliz."
    mistake = {
        "kind": "suggestion",
        "category": "other",
        "original": "está en el café",
        "correction": "se encuentra en el café",
        "explanation": "More natural phrasing.",
    }
    async with make_api([model_reply(mistake, corrected=nfc)]) as client:
        created = (
            await client.post(
                "/api/v1/entries", json={"language": "es", "text": unicodedata.normalize("NFD", nfc)}
            )
        ).json()
        await client.post(f"/api/v1/entries/{created['id']}/analyses")
        detail = (await client.get(f"/api/v1/entries/{created['id']}")).json()

    analysis = detail["latest_analysis"]
    found = analysis["mistakes"][0]
    assert detail["text"] == nfc
    assert analysis["input_text"] == nfc
    assert analysis["input_text"][found["start"] : found["end"]] == found["original"]
