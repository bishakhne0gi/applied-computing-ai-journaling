import json
from typing import Any

import pytest

from journal_ai import Usage
from journal_ai.analyzer import Analyzer
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from journal_ai.schema import AnalysisResult, FailureCode

TEXT = "Ayer yo es feliz."


def _valid(**overrides: Any) -> str:
    body = {
        "corrected_text": "Ayer yo soy feliz.",
        "feedback_summary": "Great start!",
        "mistakes": [
            {
                "kind": "error",
                "category": "verb_conjugation",
                "original": "yo es",
                "correction": "yo soy",
                "explanation": "Ser with yo is soy.",
            },
            {
                "kind": "error",
                "category": "spelling",
                "original": "",
                "correction": "x",
                "explanation": "bad",
            },
        ],
        **overrides,
    }
    return json.dumps(body)


async def test_successful_analysis_is_parsed_aligned_and_tagged() -> None:
    outcome = await Analyzer(FakeProvider([_valid()])).analyze(TEXT, "es")

    assert outcome.succeeded
    assert outcome.failure is None
    assert outcome.result is not None
    mistake = outcome.result.mistakes[0]
    assert TEXT[mistake.start : mistake.end] == "yo es"
    assert outcome.dropped_mistakes == 1
    assert outcome.prompt_version == "v1"
    assert outcome.model == "fake"
    assert outcome.retried is False
    assert outcome.raw_response == _valid()


async def test_invalid_output_is_retried_once_with_the_error() -> None:
    provider = FakeProvider(["not json", _valid()])

    outcome = await Analyzer(provider).analyze(TEXT, "es")

    assert outcome.succeeded
    assert outcome.retried is True
    assert "could not be used" in provider.calls[1][1]


async def test_invalid_output_twice_fails_with_the_last_raw_response() -> None:
    outcome = await Analyzer(FakeProvider(["nope", '{"truncated": '])).analyze(TEXT, "es")

    assert not outcome.succeeded
    assert outcome.failure is FailureCode.INVALID_OUTPUT
    assert outcome.raw_response == '{"truncated": '
    assert outcome.retried is True


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (ProviderTimeoutError("slow"), FailureCode.PROVIDER_TIMEOUT),
        (ProviderError("refused"), FailureCode.PROVIDER_ERROR),
    ],
)
async def test_provider_failures_map_to_failure_codes(error: Exception, code: FailureCode) -> None:
    outcome = await Analyzer(FakeProvider([error])).analyze(TEXT, "es")

    assert outcome.failure is code
    assert outcome.result is None
    assert outcome.raw_response is None
    assert outcome.error_detail is not None
    assert type(error).__name__ in outcome.error_detail


async def test_a_provider_failure_on_retry_keeps_the_first_raw_response() -> None:
    outcome = await Analyzer(FakeProvider(["garbage", ProviderTimeoutError("slow")])).analyze(TEXT, "es")

    assert outcome.failure is FailureCode.PROVIDER_TIMEOUT
    assert outcome.raw_response == "garbage"


async def test_text_is_normalised_before_alignment() -> None:
    outcome = await Analyzer(FakeProvider([_valid()])).analyze("  Ayer yo es feliz.\r\n", "es")

    assert outcome.result is not None
    assert outcome.result.mistakes[0].start == 5
    assert outcome.analyzed_text == "Ayer yo es feliz."


async def test_unsupported_language_raises() -> None:
    with pytest.raises(ValueError, match="Unsupported language"):
        await Analyzer(FakeProvider([])).analyze(TEXT, "xx")


async def test_unexpected_provider_exception_maps_to_provider_error() -> None:
    outcome = await Analyzer(FakeProvider([RuntimeError("boom")])).analyze(TEXT, "es")

    assert outcome.failure is FailureCode.PROVIDER_ERROR
    assert outcome.result is None
    assert outcome.analyzed_text == TEXT
    assert outcome.error_detail == "RuntimeError"


async def test_alignment_crash_maps_to_invalid_output(monkeypatch: pytest.MonkeyPatch) -> None:
    def _boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("journal_ai.analyzer.align_mistakes", _boom)

    outcome = await Analyzer(FakeProvider([_valid()])).analyze(TEXT, "es")

    assert outcome.failure is FailureCode.INVALID_OUTPUT
    assert outcome.result is None
    assert outcome.raw_response == _valid()


async def test_alignment_duplicates_count_as_dropped() -> None:
    mistake = {
        "kind": "error",
        "category": "spelling",
        "original": "la problema",
        "correction": "el problema",
        "explanation": "Problema is masculine.",
    }
    body = json.dumps(
        {"corrected_text": "el problema", "feedback_summary": "ok", "mistakes": [mistake, mistake]}
    )

    outcome = await Analyzer(FakeProvider([body])).analyze("la problema", "es")

    assert outcome.result is not None
    assert len(outcome.result.mistakes) == 1
    assert outcome.dropped_mistakes == 1


def test_usage_is_exported_from_the_package() -> None:
    assert Usage().input_tokens == 0


async def test_error_detail_never_carries_entry_text_from_a_validation_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _invalid(*_args: Any, **_kwargs: Any) -> None:
        AnalysisResult.model_validate(
            {"corrected_text": "SECRET DIARY", "feedback_summary": 1, "mistakes": []}
        )

    monkeypatch.setattr("journal_ai.analyzer.AnalysisResult", _invalid)

    outcome = await Analyzer(FakeProvider([_valid()])).analyze(TEXT, "es")

    assert outcome.error_detail is not None
    assert outcome.error_detail.startswith("ValidationError")
    assert "SECRET DIARY" not in outcome.error_detail


async def test_error_detail_for_unknown_exceptions_is_the_class_name_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _boom(*_args: Any, **_kwargs: Any) -> None:
        raise ValueError("SECRET DIARY")

    monkeypatch.setattr("journal_ai.analyzer.align_mistakes", _boom)

    outcome = await Analyzer(FakeProvider([_valid()])).analyze(TEXT, "es")

    assert outcome.error_detail == "ValueError"
