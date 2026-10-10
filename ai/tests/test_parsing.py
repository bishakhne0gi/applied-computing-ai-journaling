import json
from typing import Any

import pytest

from journal_ai.parsing import InvalidOutputError, parse_analysis
from journal_ai.schema import Category, MistakeKind


def _mistake(**overrides: Any) -> dict[str, Any]:
    base = {
        "kind": "error",
        "category": "gender_agreement",
        "original": "la problema",
        "correction": "el problema",
        "explanation": "Problema is masculine.",
    }
    return {**base, **overrides}


def _payload(*mistakes: Any, **overrides: Any) -> str:
    body = {
        "corrected_text": "Tengo el problema.",
        "feedback_summary": "Nice work!",
        "mistakes": list(mistakes),
        **overrides,
    }
    return json.dumps(body)


def test_parses_a_valid_response() -> None:
    parsed = parse_analysis(_payload(_mistake()))

    assert parsed.corrected_text == "Tengo el problema."
    assert parsed.feedback_summary == "Nice work!"
    assert parsed.mistakes[0].category is Category.GENDER_AGREEMENT
    assert parsed.dropped == 0


@pytest.mark.parametrize(
    "wrap",
    [
        lambda s: f"```json\n{s}\n```",
        lambda s: f"Here is the analysis:\n{s}\nHope it helps!",
        lambda s: f"\n\n  {s}  \n",
    ],
    ids=["code-fence", "stray-prose", "whitespace"],
)
def test_tolerates_wrapping_around_the_json(wrap: Any) -> None:
    parsed = parse_analysis(wrap(_payload(_mistake())))

    assert len(parsed.mistakes) == 1


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "no json here",
        '{"corrected_text": "x", "feedback_summary": "y", "mistakes": [',
        "[1, 2, 3]",
        json.dumps({"feedback_summary": "y", "mistakes": []}),
        json.dumps({"corrected_text": 1, "feedback_summary": "y", "mistakes": []}),
        json.dumps({"corrected_text": "x", "feedback_summary": "y", "mistakes": "none"}),
    ],
    ids=["empty", "prose", "truncated", "array", "missing-field", "wrong-type", "mistakes-not-list"],
)
def test_rejects_unusable_top_level_output(raw: str) -> None:
    with pytest.raises(InvalidOutputError):
        parse_analysis(raw)


def test_drops_invalid_mistakes_and_counts_them() -> None:
    raw = _payload(
        _mistake(),
        "not an object",
        _mistake(kind="nonsense"),
        _mistake(original=""),
        _mistake(explanation=None),
    )

    parsed = parse_analysis(raw)

    assert len(parsed.mistakes) == 1
    assert parsed.dropped == 4


@pytest.mark.parametrize("category", ["tense_errors", None, 42])
def test_maps_unknown_categories_to_other(category: Any) -> None:
    parsed = parse_analysis(_payload(_mistake(category=category)))

    assert parsed.mistakes[0].category is Category.OTHER


@pytest.mark.parametrize("category", ["Verb Conjugation", "verb-conjugation", " VERB_CONJUGATION "])
def test_normalises_category_spelling(category: str) -> None:
    parsed = parse_analysis(_payload(_mistake(category=category)))

    assert parsed.mistakes[0].category is Category.VERB_CONJUGATION


def test_drops_no_op_corrections() -> None:
    parsed = parse_analysis(_payload(_mistake(original="hola", correction=" hola ")))

    assert parsed.mistakes == ()
    assert parsed.dropped == 1


def test_vocab_help_is_always_categorised_as_vocabulary() -> None:
    vocab = _mistake(
        kind="vocab_help", category="spelling", original="[grocery store]", correction="supermercado"
    )
    parsed = parse_analysis(_payload(vocab))

    assert parsed.mistakes[0].kind is MistakeKind.VOCAB_HELP
    assert parsed.mistakes[0].category is Category.VOCABULARY


def test_keeps_deletions_with_an_empty_correction() -> None:
    parsed = parse_analysis(_payload(_mistake(original="muy", correction="", category="other")))

    assert parsed.mistakes[0].correction == ""


@pytest.mark.parametrize(
    "wrap",
    [
        lambda s: f"Note {{see below}}\n{s}",
        lambda s: f"{s}\nThat is {{it}}",
        lambda s: f'{{"note": 1}} {s}',
    ],
    ids=["braces-before", "braces-after", "unrelated-object-before"],
)
def test_finds_the_payload_amid_stray_braces_and_objects(wrap: Any) -> None:
    parsed = parse_analysis(wrap(_payload(_mistake())))

    assert parsed.corrected_text == "Tengo el problema."
    assert len(parsed.mistakes) == 1


def test_first_valid_object_wins_when_two_are_present() -> None:
    first = _payload(_mistake(), corrected_text="First.")
    second = _payload(_mistake(), corrected_text="Second.")

    parsed = parse_analysis(f"{first}\n{second}")

    assert parsed.corrected_text == "First."


@pytest.mark.parametrize(
    "raw",
    [
        '{"mistakes": ' + "[" * 100000,
        '{"mistakes": ' + "[" * 100000 + "]" * 100000 + "}",
    ],
    ids=["unterminated", "closed"],
)
def test_deeply_nested_input_raises_invalid_output(raw: str) -> None:
    with pytest.raises(InvalidOutputError):
        parse_analysis(raw)


@pytest.mark.parametrize(
    ("kind", "expected"),
    [
        ("Error", MistakeKind.ERROR),
        ("Vocab Help", MistakeKind.VOCAB_HELP),
        (" suggestion ", MistakeKind.SUGGESTION),
    ],
)
def test_normalises_kind_spelling(kind: str, expected: MistakeKind) -> None:
    parsed = parse_analysis(_payload(_mistake(kind=kind)))

    assert parsed.mistakes[0].kind is expected
    assert parsed.dropped == 0
