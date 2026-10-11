import re
import statistics
from collections.abc import Sequence
from dataclasses import dataclass

from journal_ai.schema import AlignedMistake, Category, MistakeKind

_COUNTED = (MistakeKind.ERROR, MistakeKind.VOCAB_HELP)


def _is_bracket_help(mistake: AlignedMistake) -> bool:
    # Help on an explicitly [bracketed] word is what the learner asked for, never a false alarm.
    return mistake.kind is MistakeKind.VOCAB_HELP and mistake.original.startswith("[")


@dataclass(frozen=True)
class Expected:
    original: str
    # More than one only where the taxonomy genuinely overlaps (contractions, subject-verb number).
    categories: frozenset[Category]


@dataclass(frozen=True)
class CaseScore:
    expected: int
    caught: int
    category_correct: int
    false_positive: bool
    latency_ms: int = 0
    failed: bool = False


@dataclass(frozen=True)
class Report:
    cases: int
    failed: int
    recall: float
    category_accuracy: float
    false_positive_rate: float
    p50_latency_ms: int


def score_case(
    expected: Sequence[Expected], predicted: Sequence[AlignedMistake], latency_ms: int = 0
) -> CaseScore:
    # Word help counts like an error: a missed foreign word is a miss, a flagged loanword is a false positive.
    errors = [p for p in predicted if p.kind in _COUNTED]
    unprompted = [p for p in errors if not _is_bracket_help(p)]
    caught = category_correct = 0
    for item in expected:
        matches = [p for p in errors if _overlaps(item.original, p.original)]
        if matches:
            caught += 1
            category_correct += any(p.category in item.categories for p in matches)
    return CaseScore(
        expected=len(expected),
        caught=caught,
        category_correct=category_correct,
        false_positive=not expected and bool(unprompted),
        latency_ms=latency_ms,
    )


def failed_case(expected: int) -> CaseScore:
    return CaseScore(expected=expected, caught=0, category_correct=0, false_positive=False, failed=True)


def summarise(all_scores: Sequence[CaseScore]) -> Report:
    scores = [s for s in all_scores if not s.failed]
    expected = sum(s.expected for s in scores)
    caught = sum(s.caught for s in scores)
    clean = [s for s in scores if s.expected == 0]
    return Report(
        cases=len(all_scores),
        failed=len(all_scores) - len(scores),
        recall=_ratio(caught, expected),
        category_accuracy=_ratio(sum(s.category_correct for s in scores), caught),
        false_positive_rate=_ratio(sum(s.false_positive for s in clean), len(clean)),
        p50_latency_ms=round(statistics.median(s.latency_ms for s in scores)) if scores else 0,
    )


def contains_phrase(text: str, phrase: str) -> bool:
    # Word-bounded so a short label like "es" never matches inside "después".
    return re.search(rf"(?<!\w){re.escape(phrase.casefold())}(?!\w)", text.casefold()) is not None


def _overlaps(expected: str, predicted: str) -> bool:
    short, long = sorted((expected, predicted), key=len)
    return contains_phrase(long, short)


def _ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0
