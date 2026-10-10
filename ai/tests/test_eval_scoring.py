from evals.scoring import CaseScore, Expected, failed_case, score_case, summarise
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


def test_overlap_is_word_bounded() -> None:
    expected = [Expected(original="es", category=Category.VERB_CONJUGATION)]

    assert score_case(expected, [_predicted("después", Category.VERB_CONJUGATION)]).caught == 0
    fui = [Expected(original="fui", category=Category.VERB_TENSE)]
    assert score_case(fui, [_predicted("fui al cine", Category.VERB_TENSE)]).caught == 1


def test_failed_cases_are_excluded_from_every_rate_and_counted() -> None:
    report = summarise(
        [
            CaseScore(expected=1, caught=1, category_correct=1, false_positive=False, latency_ms=100),
            failed_case(expected=3),
            failed_case(expected=0),
        ]
    )

    assert report.failed == 2
    assert report.cases == 3
    assert (report.recall, report.category_accuracy, report.false_positive_rate) == (1.0, 1.0, 0.0)
    assert report.p50_latency_ms == 100


def test_an_all_failed_run_reports_zero_rates() -> None:
    report = summarise([failed_case(expected=2), failed_case(expected=0)])

    assert report.failed == 2
    assert (report.recall, report.category_accuracy, report.false_positive_rate) == (0.0, 0.0, 0.0)
    assert report.p50_latency_ms == 0
