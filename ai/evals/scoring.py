import statistics
from collections.abc import Sequence
from dataclasses import dataclass

from journal_ai.schema import AlignedMistake, Category, MistakeKind


@dataclass(frozen=True)
class Expected:
    original: str
    category: Category


@dataclass(frozen=True)
class CaseScore:
    expected: int
    caught: int
    category_correct: int
    false_positive: bool
    latency_ms: int = 0


@dataclass(frozen=True)
class Report:
    cases: int
    recall: float
    category_accuracy: float
    false_positive_rate: float
    p50_latency_ms: int


def score_case(
    expected: Sequence[Expected], predicted: Sequence[AlignedMistake], latency_ms: int = 0
) -> CaseScore:
    errors = [p for p in predicted if p.kind is MistakeKind.ERROR]
    caught = category_correct = 0
    for item in expected:
        matches = [p for p in errors if _overlaps(item.original, p.original)]
        if matches:
            caught += 1
            category_correct += any(p.category is item.category for p in matches)
    return CaseScore(
        expected=len(expected),
        caught=caught,
        category_correct=category_correct,
        false_positive=not expected and bool(errors),
        latency_ms=latency_ms,
    )


def summarise(scores: Sequence[CaseScore]) -> Report:
    expected = sum(s.expected for s in scores)
    caught = sum(s.caught for s in scores)
    clean = [s for s in scores if s.expected == 0]
    return Report(
        cases=len(scores),
        recall=_ratio(caught, expected),
        category_accuracy=_ratio(sum(s.category_correct for s in scores), caught),
        false_positive_rate=_ratio(sum(s.false_positive for s in clean), len(clean)),
        p50_latency_ms=round(statistics.median(s.latency_ms for s in scores)) if scores else 0,
    )


def _overlaps(expected: str, predicted: str) -> bool:
    a, b = expected.casefold(), predicted.casefold()
    return a in b or b in a


def _ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0
