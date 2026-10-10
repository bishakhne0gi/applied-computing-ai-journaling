from collections import defaultdict
from collections.abc import Sequence
from itertools import zip_longest
from pathlib import Path
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from evals.scoring import contains_phrase
from journal_ai import SUPPORTED_LANGUAGES, Category

DATASET = Path(__file__).with_name("dataset.json")


class ExpectedMistake(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    original: str = Field(min_length=1)
    categories: tuple[Category, ...] = Field(min_length=1)


class EvalCase(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str = Field(pattern=r"^[a-z]{2}-[a-z]+-\d+$")
    language: str
    text: str = Field(min_length=1)
    expected: tuple[ExpectedMistake, ...]

    @model_validator(mode="after")
    def _labels_match_the_text(self) -> Self:
        # A label that is not in the text can never be caught, so it would silently lower recall.
        if self.language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"{self.id}: unsupported language {self.language!r}")
        if not self.id.startswith(f"{self.language}-"):
            raise ValueError(f"{self.id}: id must start with {self.language}-")
        for item in self.expected:
            if not contains_phrase(self.text, item.original):
                raise ValueError(f"{self.id}: {item.original!r} is not in the text")
        return self


_CASES = TypeAdapter(tuple[EvalCase, ...])


def load_dataset(path: Path = DATASET) -> tuple[EvalCase, ...]:
    cases = _CASES.validate_json(path.read_bytes())
    ids = [case.id for case in cases]
    duplicates = sorted({case_id for case_id in ids if ids.count(case_id) > 1})
    if duplicates:
        raise ValueError(f"duplicate case ids: {', '.join(duplicates)}")
    return cases


def interleave(cases: Sequence[EvalCase]) -> tuple[EvalCase, ...]:
    # `--limit N` should sample every language, not the first N cases of whichever language comes first.
    by_language: dict[str, list[EvalCase]] = defaultdict(list)
    for case in cases:
        by_language[case.language].append(case)
    rounds = zip_longest(*by_language.values())
    return tuple(case for round_ in rounds for case in round_ if case is not None)
