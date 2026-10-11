import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from evals.dataset import EvalCase, interleave, load_dataset
from evals.scoring import contains_phrase


def _case(
    language: str, number: int, *, text: str = "Hola.", expected: list[dict[str, object]] | None = None
) -> EvalCase:
    return EvalCase.model_validate(
        {"id": f"{language}-case-{number}", "language": language, "text": text, "expected": expected or []}
    )


def test_the_shipped_dataset_validates() -> None:
    assert load_dataset()


@pytest.mark.parametrize("language", ["es", "fr"])
def test_each_eval_language_has_fifteen_labelled_cases_and_clean_ones(language: str) -> None:
    cases = [case for case in load_dataset() if case.language == language]

    assert sum(bool(case.expected) for case in cases) >= 15
    assert sum(not case.expected for case in cases) >= 3


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"expected": [{"original": "adiós", "categories": ["spelling"]}]}, "not in the text"),
        (
            {"text": "Ayer después comí.", "expected": [{"original": "es", "categories": ["spelling"]}]},
            "not in the text",
        ),
        ({"expected": [{"original": "Hola", "categories": ["tone"]}]}, "categories"),
        ({"expected": [{"original": "Hola", "categories": []}]}, "categories"),
        ({"language": "xx", "id": "xx-case-1"}, "unsupported language"),
        ({"id": "fr-case-1"}, "must start with"),
        ({"id": "es case 1"}, "id"),
        ({"note": "extra"}, "note"),
    ],
)
def test_malformed_cases_are_rejected(overrides: dict[str, object], message: str) -> None:
    case = {"id": "es-case-1", "language": "es", "text": "Hola amigo.", "expected": [], **overrides}

    with pytest.raises(ValidationError, match=message):
        EvalCase.model_validate(case)


def test_duplicate_ids_are_rejected(tmp_path: Path) -> None:
    path = tmp_path / "dataset.json"
    case = {"id": "es-case-1", "language": "es", "text": "Hola.", "expected": []}
    path.write_text(json.dumps([case, case]), encoding="utf-8")

    with pytest.raises(ValueError, match="duplicate case ids: es-case-1"):
        load_dataset(path)


def test_interleave_alternates_languages_so_a_limit_samples_both() -> None:
    cases = [_case("es", 1), _case("es", 2), _case("es", 3), _case("fr", 1)]

    assert [case.id for case in interleave(cases)] == ["es-case-1", "fr-case-1", "es-case-2", "es-case-3"]


@pytest.mark.parametrize(
    ("text", "phrase", "expected"),
    [
        ("Hoy tengo La problema.", "la problema", True),
        ("Después comí.", "es", False),
        ("Voy a casa.", "casa", True),
        ("Voy a casas.", "casa", False),
        ("Il fait tres beau.", "TRES", True),
    ],
)
def test_contains_phrase_is_case_insensitive_and_whole_word(text: str, phrase: str, expected: bool) -> None:
    assert contains_phrase(text, phrase) is expected


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"text": "   "}, "text"),
        ({"text": ""}, "text"),
        (
            {"expected": [{"original": "Hola", "categories": ["spelling", "spelling"]}]},
            "duplicate categories",
        ),
        (
            {
                "expected": [
                    {"original": "Hola", "categories": ["spelling"]},
                    {"original": "hola", "categories": ["punctuation"]},
                ]
            },
            "duplicate originals",
        ),
    ],
)
def test_degenerate_labels_are_rejected(overrides: dict[str, object], message: str) -> None:
    case = {"id": "es-case-1", "language": "es", "text": "Hola amigo.", "expected": [], **overrides}

    with pytest.raises(ValidationError, match=message):
        EvalCase.model_validate(case)


def test_the_dataset_has_the_unbracketed_word_help_cases() -> None:
    by_id = {case.id: case for case in load_dataset()}

    for case_id in ("es-foreign-1", "es-foreign-2", "fr-foreign-1"):
        assert by_id[case_id].expected
    for case_id in ("es-loanword-1", "fr-loanword-1"):
        assert not by_id[case_id].expected
    assert len(by_id) == 41
