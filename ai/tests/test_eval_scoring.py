from evals.scoring import CaseScore, Expected, score_case, summarise
from journal_ai.schema import AlignedMistake, Category, MistakeKind


def _predicted(original: str, category: Category, kind: MistakeKind = MistakeKind.ERROR) -> AlignedMistake:
    return AlignedMistake(kind=kind, category=category, original=original, correction="x", explanation="why")


def test_a_caught_mistake_with_the_right_category_scores_fully() -> None:
    score = score_case(
        [Expected(original="la problema", category=Category.GENDER_AGREEMENT)],
        [_predicted("la problema", Category.GENDER_AGREEMENT)],
    )

    assert (score.expected, score.caught, score.category_correct, score.false_positive) == (1, 1, 1, False)


def test_overlapping_snippets_count_as_caught() -> None:
    score = score_case(
        [Expected(original="la problema", category=Category.GENDER_AGREEMENT)],
        [_predicted("problema", Category.ARTICLE)],
    )

    assert (score.caught, score.category_correct) == (1, 0)


def test_suggestions_never_count_as_catches() -> None:
    score = score_case(
        [Expected(original="yo es", category=Category.VERB_CONJUGATION)],
        [_predicted("yo es", Category.VERB_CONJUGATION, kind=MistakeKind.SUGGESTION)],
    )

    assert score.caught == 0


def test_errors_on_a_clean_entry_are_a_false_positive() -> None:
    score = score_case([], [_predicted("hola", Category.SPELLING)])

    assert score.false_positive is True


def test_summary_rates() -> None:
    report = summarise(
        [
            CaseScore(expected=2, caught=1, category_correct=1, false_positive=False, latency_ms=100),
            CaseScore(expected=0, caught=0, category_correct=0, false_positive=True, latency_ms=300),
            CaseScore(expected=0, caught=0, category_correct=0, false_positive=False, latency_ms=200),
        ]
    )

    assert report.recall == 0.5
    assert report.category_accuracy == 1.0
    assert report.false_positive_rate == 0.5
    assert report.p50_latency_ms == 200
