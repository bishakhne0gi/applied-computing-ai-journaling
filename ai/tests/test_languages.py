import pytest
from journal_ai.languages import SUPPORTED_LANGUAGES, is_supported


def test_supported_languages_have_english_names() -> None:
    assert SUPPORTED_LANGUAGES == {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
    }


@pytest.mark.parametrize(("code", "expected"), [("es", True), ("ES", False), ("en", False), ("", False)])
def test_is_supported_matches_exact_codes(code: str, expected: bool) -> None:
    assert is_supported(code) is expected
