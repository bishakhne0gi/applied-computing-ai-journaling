import json

import pytest

from journal_ai.assist import WritingAssist
from journal_ai.languages import language_of
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from journal_ai.schema import FailureCode

ENTRY = "Ayer fui. Hoy yo es feliz."


def _good_reply() -> str:
    version = {"text": "Hoy soy feliz.", "tone": "natural", "label": "More natural", "explanation": "Why."}
    return json.dumps({"versions": [version], "vocabulary": []})


async def test_rephrase_returns_the_parsed_versions_with_the_served_model() -> None:
    outcome = await WritingAssist(FakeProvider([_good_reply()])).rephrase(ENTRY, 10, 26, "es")

    assert outcome.failure is None
    assert outcome.result is not None
    assert outcome.result.sentence == "Hoy yo es feliz."
    assert [v.text for v in outcome.result.versions] == ["Hoy soy feliz."]
    assert outcome.model == "fake"


async def test_rephrase_sends_the_whole_entry_and_the_span_as_the_sentence() -> None:
    provider = FakeProvider([_good_reply()])
    await WritingAssist(provider).rephrase(ENTRY, 10, 26, "es")
    assert "<sentence>\nHoy yo es feliz.\n</sentence>" in provider.calls[0][1]
    assert "<entry>\nAyer fui. Hoy yo es feliz.\n</entry>" in provider.calls[0][1]


@pytest.mark.parametrize(
    ("step", "failure"),
    [
        (ProviderTimeoutError("slow"), FailureCode.PROVIDER_TIMEOUT),
        (ProviderError("down"), FailureCode.PROVIDER_ERROR),
        (RuntimeError("boom"), FailureCode.PROVIDER_ERROR),
        ("not json", FailureCode.INVALID_OUTPUT),
    ],
)
async def test_rephrase_never_raises_for_provider_or_output_problems(
    step: str | Exception, failure: FailureCode
) -> None:
    outcome = await WritingAssist(FakeProvider([step])).rephrase(ENTRY, 10, 26, "es")
    assert outcome.result is None
    assert outcome.failure is failure


async def test_complete_returns_the_joined_completion() -> None:
    provider = FakeProvider([json.dumps({"completion": " y luego"})])
    outcome = await WritingAssist(provider).complete("Hoy fui al mercado", "es")
    assert outcome.completion == " y luego"
    assert outcome.failure is None


async def test_complete_makes_exactly_one_call() -> None:
    provider = FakeProvider(["not json", json.dumps({"completion": " y luego"})])
    outcome = await WritingAssist(provider).complete("Hoy fui al mercado", "es")
    assert outcome.failure is FailureCode.INVALID_OUTPUT
    assert len(provider.calls) == 1


async def test_an_unsupported_language_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported language"):
        await WritingAssist(FakeProvider([])).complete("Hola", "xx")


async def test_aclose_closes_the_provider() -> None:
    closed: list[bool] = []

    class Provider(FakeProvider):
        async def aclose(self) -> None:
            closed.append(True)

    await WritingAssist(Provider([])).aclose()
    assert closed == [True]


async def test_language_of_rejects_a_prompt_naming_no_supported_language() -> None:
    with pytest.raises(ValueError, match="no supported language"):
        language_of("nothing here")
