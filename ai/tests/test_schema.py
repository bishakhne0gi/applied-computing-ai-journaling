import pytest
from pydantic import ValidationError

from journal_ai.schema import (
    RESPONSE_JSON_SCHEMA,
    Category,
    Mistake,
    MistakeKind,
    Usage,
)


def _mistake_schema() -> dict[str, object]:
    return RESPONSE_JSON_SCHEMA["properties"]["mistakes"]["items"]


def test_wire_schema_enums_match_the_domain_enums() -> None:
    props = _mistake_schema()["properties"]

    assert props["kind"]["enum"] == [k.value for k in MistakeKind]
    assert props["category"]["enum"] == [c.value for c in Category]


def test_wire_schema_is_strict_for_structured_outputs() -> None:
    assert RESPONSE_JSON_SCHEMA["additionalProperties"] is False
    assert _mistake_schema()["additionalProperties"] is False
    assert set(RESPONSE_JSON_SCHEMA["required"]) == {"corrected_text", "feedback_summary", "mistakes"}


def test_mistake_strips_whitespace() -> None:
    mistake = Mistake(
        kind=MistakeKind.ERROR,
        category=Category.ARTICLE,
        original="  a el ",
        correction=" al ",
        explanation=" Contract a + el. ",
    )

    assert (mistake.original, mistake.correction, mistake.explanation) == ("a el", "al", "Contract a + el.")


@pytest.mark.parametrize("field", ["original", "explanation"])
def test_mistake_rejects_blank_required_text(field: str) -> None:
    data = {
        "kind": "error",
        "category": "article",
        "original": "a el",
        "correction": "al",
        "explanation": "Contract.",
        field: "   ",
    }

    with pytest.raises(ValidationError):
        Mistake.model_validate(data)


def test_usage_adds_up_across_attempts() -> None:
    total = Usage(input_tokens=10, output_tokens=3) + Usage(input_tokens=5, output_tokens=2)

    assert total == Usage(input_tokens=15, output_tokens=5)
