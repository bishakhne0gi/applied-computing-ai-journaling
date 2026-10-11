import json

import pytest

from journal_ai.assist_parsing import finish_completion, parse_rephrasing
from journal_ai.parsing import InvalidOutputError

SENTENCE = "Hoy yo es muy feliz con mi familia."


def _reply(versions: list[object], vocabulary: list[object] | None = None) -> str:
    return json.dumps({"versions": versions, "vocabulary": vocabulary or []})


def _version(text: str, tone: str = "natural") -> dict[str, str]:
    return {"text": text, "tone": tone, "label": "More natural", "explanation": "Why."}


def test_versions_equal_to_the_sentence_duplicates_and_bad_items_are_dropped() -> None:
    raw = _reply(
        [
            _version(SENTENCE),
            _version("Hoy estoy feliz."),
            _version("Hoy estoy feliz."),
            {"text": 3},
            _version("B", "loud"),
        ]
    )

    result = parse_rephrasing(raw, SENTENCE)

    assert [v.text for v in result.versions] == ["Hoy estoy feliz."]


def test_at_most_three_versions_and_four_vocabulary_items_are_kept() -> None:
    words = ["Hoy", "yo", "es", "muy", "feliz", "con"]
    versions = [_version(f"Version {n}.") for n in range(5)]
    vocabulary = [{"original": w, "alternatives": [{"word": f"x{w}", "nuance": "n"}]} for w in words]

    result = parse_rephrasing(_reply(versions, vocabulary), SENTENCE)

    assert len(result.versions) == 3
    assert [i.original for i in result.vocabulary] == ["Hoy", "yo", "es", "muy"]


def test_no_usable_version_is_invalid_output() -> None:
    with pytest.raises(InvalidOutputError):
        parse_rephrasing(_reply([_version(SENTENCE)]), SENTENCE)


def test_vocabulary_is_placed_by_whole_word_in_the_sentence_and_unplaceable_items_are_dropped() -> None:
    raw = _reply(
        [_version("Hoy estoy feliz.")],
        [
            {"original": "feliz", "alternatives": [{"word": "contento", "nuance": "Softer."}]},
            {"original": "es", "alternatives": [{"word": "está", "nuance": "x"}]},
            {"original": "fel", "alternatives": [{"word": "x", "nuance": "x"}]},
            {"original": "casa", "alternatives": [{"word": "hogar", "nuance": "x"}]},
        ],
    )

    result = parse_rephrasing(raw, SENTENCE)

    assert [(i.original, i.start, i.end) for i in result.vocabulary] == [("es", 7, 9), ("feliz", 14, 19)]


def test_alternatives_equal_to_the_original_are_dropped_and_an_item_without_any_is_dropped() -> None:
    raw = _reply(
        [_version("Hoy estoy feliz.")],
        [
            {
                "original": "feliz",
                "alternatives": [{"word": "Feliz", "nuance": "same"}, {"word": "alegre", "nuance": "n"}],
            },
            {"original": "muy", "alternatives": [{"word": "muy", "nuance": "same"}]},
        ],
    )

    result = parse_rephrasing(raw, SENTENCE)

    assert [(i.original, [a.word for a in i.alternatives]) for i in result.vocabulary] == [
        ("feliz", ["alegre"])
    ]


@pytest.mark.parametrize(
    ("prefix", "raw", "expected"),
    [
        ("Hoy fui al mercado", " con mi madre.", " con mi madre."),
        ("Hoy fui al mercado ", " con mi madre.", "con mi madre."),
        ("Hoy fui al merc", "ado con mi madre.", "ado con mi madre."),
        ("Hoy fui", "   a la playa", " a la playa"),
        ("Hoy fui", " a la playa\ny luego a casa", " a la playa"),
        (
            "Hoy fui",
            " uno dos tres cuatro cinco seis siete ocho nueve diez",
            " uno dos tres cuatro cinco seis siete ocho",
        ),
        ("Hoy fui", "", ""),
        ("Hoy fui", "   ", ""),
    ],
    ids=[
        "new word",
        "prefix ends in space",
        "mid-word",
        "spaces collapse",
        "first line only",
        "eight words",
        "empty",
        "blank",
    ],
)
def test_completions_are_cut_and_joined_to_the_prefix(prefix: str, raw: str, expected: str) -> None:
    assert finish_completion(prefix, json.dumps({"completion": raw})) == expected


def test_a_completion_that_is_not_a_string_is_invalid_output() -> None:
    with pytest.raises(InvalidOutputError):
        finish_completion("Hoy fui", json.dumps({"completion": 3}))
