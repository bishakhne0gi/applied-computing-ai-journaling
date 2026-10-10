import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from evals.dataset import EvalCase, interleave, load_dataset


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


def test_a_snippet_matches_whole_words_case_insensitively() -> None:
    case = _case(
        "es",
        1,
        text="Hoy tengo La problema.",
        expected=[{"original": "la problema", "categories": ["gender_agreement"]}],
    )

    assert case.expected[0].original == "la problema"
