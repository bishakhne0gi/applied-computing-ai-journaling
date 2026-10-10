import json

import pytest

from journal_ai.prompts.v1 import build_messages
from journal_ai.providers.base import ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from journal_ai.schema import RESPONSE_JSON_SCHEMA


async def test_scripted_responses_are_returned_in_order() -> None:
    provider = FakeProvider(["first", "second"])

    one = await provider.complete(system="s", user="u", schema=RESPONSE_JSON_SCHEMA)
    two = await provider.complete(system="s", user="u", schema=RESPONSE_JSON_SCHEMA)

    assert (one.text, two.text) == ("first", "second")
    assert provider.calls == [("s", "u"), ("s", "u")]


async def test_scripted_exceptions_are_raised() -> None:
    provider = FakeProvider([ProviderTimeoutError("slow")])

    with pytest.raises(ProviderTimeoutError):
        await provider.complete(system="s", user="u", schema=RESPONSE_JSON_SCHEMA)


async def test_demo_mode_flags_known_mistakes_and_bracketed_words() -> None:
    system, user = build_messages("Ayer yo es feliz en el [grocery store].", "es")

    completion = await FakeProvider().complete(system=system, user=user, schema=RESPONSE_JSON_SCHEMA)
    payload = json.loads(completion.text)

    kinds = {(m["kind"], m["original"]) for m in payload["mistakes"]}
    assert ("error", "yo es") in kinds
    assert ("vocab_help", "[grocery store]") in kinds
    assert "[" not in payload["corrected_text"]
    assert completion.model == "fake"


async def test_demo_mode_flags_every_occurrence_of_a_rule() -> None:
    system, user = build_messages("Ayer yo es feliz. Yo es tarde.", "es")

    completion = await FakeProvider().complete(system=system, user=user, schema=RESPONSE_JSON_SCHEMA)
    payload = json.loads(completion.text)

    originals = [m["original"] for m in payload["mistakes"] if m["kind"] == "error"]
    assert originals == ["yo es", "Yo es"]
    assert "yo es" not in payload["corrected_text"].lower()


async def test_demo_mode_records_no_calls() -> None:
    system, user = build_messages("Ayer yo es feliz.", "es")
    provider = FakeProvider()

    await provider.complete(system=system, user=user, schema=RESPONSE_JSON_SCHEMA)

    assert provider.calls == []


async def test_demo_corrections_keep_the_case_of_the_first_letter() -> None:
    system, user = build_messages("La problema es grande.", "es")

    completion = await FakeProvider().complete(system=system, user=user, schema=RESPONSE_JSON_SCHEMA)

    assert json.loads(completion.text)["corrected_text"].startswith("El problema")
