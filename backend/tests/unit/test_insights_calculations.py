import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.insights import CategoryErrors, EntryErrors, Example
from app.services.insights.calculations import (
    InsightsStatus,
    Trend,
    classify_trend,
    compute_insights,
    pooled_rate,
    rate,
    round_rate,
    split_windows,
)
from journal_ai import Category

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


def entry(index: int, words: int = 100, **errors: int) -> EntryErrors:
    return EntryErrors(
        entry_id=uuid.UUID(int=index + 1),
        created_at=T0 + timedelta(days=index),
        word_count=words,
        errors={
            Category(name): CategoryErrors(count, Example(f"{name} {index}", "fixed"))
            for name, count in errors.items()
            if count
        },
    )


def history(*article_errors: int, words: int = 100) -> list[EntryErrors]:
    return [entry(index, words, article=count) for index, count in enumerate(article_errors)]


def positions(entries: Sequence[EntryErrors]) -> list[int]:
    return [item.entry_id.int - 1 for item in entries]


@pytest.mark.parametrize(
    ("n", "earlier", "recent"),
    [
        (4, [0, 1], [2, 3]),
        (5, [0, 1], [2, 3, 4]),
        (9, [0, 1, 2, 3], [4, 5, 6, 7, 8]),
        (10, [0, 1, 2, 3, 4], [5, 6, 7, 8, 9]),
        (11, [1, 2, 3, 4, 5], [6, 7, 8, 9, 10]),
        (20, [10, 11, 12, 13, 14], [15, 16, 17, 18, 19]),
    ],
)
def test_split_windows_takes_the_last_half_rounded_up_and_caps_each_window_at_five(
    n: int, earlier: list[int], recent: list[int]
) -> None:
    windows = split_windows(history(*[0] * n))

    assert positions(windows.earlier) == earlier
    assert positions(windows.recent) == recent


@pytest.mark.parametrize(
    ("n", "status"),
    [
        (0, InsightsStatus.INSUFFICIENT_DATA),
        (2, InsightsStatus.INSUFFICIENT_DATA),
        (3, InsightsStatus.TOTALS_ONLY),
        (4, InsightsStatus.TRENDS),
        (11, InsightsStatus.TRENDS),
    ],
)
def test_status_depends_on_how_many_entries_have_feedback(n: int, status: InsightsStatus) -> None:
    assert compute_insights(history(*[1] * n)).status is status


def test_insufficient_data_reports_counts_but_computes_nothing_when_fewer_than_three_entries() -> None:
    insights = compute_insights(history(2, 1))

    assert (insights.entry_count, insights.total_errors, insights.total_words) == (2, 3, 200)
    assert insights.error_rate is None
    assert insights.points == ()
    assert insights.categories == ()


def test_three_entries_give_totals_and_recurring_but_no_trends() -> None:
    insights = compute_insights(history(1, 2, 1))
    [article] = insights.categories

    assert insights.error_rate == pytest.approx(1.3)
    assert (insights.earlier_rate, insights.recent_rate, insights.trend) == (None, None, None)
    assert (article.earlier_rate, article.recent_rate, article.trend) == (None, None, None)
    assert article.recurring is True
    assert len(insights.points) == 3


def test_window_rates_pool_errors_over_words_instead_of_averaging_entry_rates() -> None:
    entries = [entry(0, words=50, article=1), entry(1, words=150), entry(2, words=100), entry(3, words=100)]

    insights = compute_insights(entries)

    assert insights.earlier_rate == pytest.approx(0.5)
    assert pooled_rate(entries[:2]) == pytest.approx(0.5)


def test_rates_are_none_when_there_are_no_words() -> None:
    insights = compute_insights([entry(index, words=0) for index in range(4)])

    assert rate(3, 0) is None
    assert pooled_rate([]) is None
    assert (insights.error_rate, insights.earlier_rate, insights.trend) == (None, None, None)
    assert [point.rate for point in insights.points] == [None, None, None, None]


@pytest.mark.parametrize(
    ("earlier", "recent", "expected"),
    [
        (2.0, 1.5, Trend.IMPROVING),
        (2.0, 1.51, Trend.STABLE),
        (2.0, 2.5, Trend.WORSENING),
        (2.0, 2.49, Trend.STABLE),
        (4.0, 3.0, Trend.IMPROVING),
        (4.0, 3.01, Trend.STABLE),
        (4.0, 5.0, Trend.WORSENING),
        (4.0, 4.99, Trend.STABLE),
        (0.0, 0.5, Trend.WORSENING),
        (0.0, 0.49, Trend.STABLE),
        (0.0, 0.0, Trend.STABLE),
        (None, 1.0, None),
        (1.0, None, None),
    ],
)
def test_trend_threshold_is_the_larger_of_half_a_point_and_a_quarter_of_the_earlier_rate(
    earlier: float | None, recent: float | None, expected: Trend | None
) -> None:
    assert classify_trend(earlier, recent) is expected


def test_a_drop_of_exactly_the_threshold_between_pooled_windows_is_improving() -> None:
    insights = compute_insights(history(2, 2, 1, 2))
    [article] = insights.categories

    assert (article.earlier_rate, article.recent_rate) == (2.0, 1.5)
    assert article.trend is Trend.IMPROVING
    assert insights.trend is Trend.IMPROVING


@pytest.mark.parametrize(
    ("article_errors", "recurring", "recent_entries"),
    [((1, 0, 1, 0, 1, 1), True, 3), ((1, 1, 0, 0, 1, 0), False, 2)],
    ids=["three-of-the-last-five", "two-of-the-last-five"],
)
def test_a_category_recurs_when_it_appears_in_three_of_the_last_five_entries(
    article_errors: tuple[int, ...], recurring: bool, recent_entries: int
) -> None:
    [article] = compute_insights(history(*article_errors)).categories

    assert article.recurring is recurring
    assert article.recent_entries == recent_entries


def test_recurring_counts_entries_not_errors() -> None:
    [article] = compute_insights(history(0, 0, 5)).categories

    assert article.occurrences == 5
    assert article.recurring is False


def test_categories_list_only_errors_seen_most_frequent_first_with_the_newest_example() -> None:
    entries = [
        entry(0, preposition=1, article=1),
        entry(1, article=2),
        entry(2, spelling=1),
        entry(3, preposition=1),
    ]

    categories = compute_insights(entries).categories

    assert [(item.category, item.occurrences) for item in categories] == [
        (Category.ARTICLE, 3),
        (Category.PREPOSITION, 2),
        (Category.SPELLING, 1),
    ]
    assert categories[0].latest_example == Example("article 1", "fixed")
    assert categories[1].latest_example == Example("preposition 3", "fixed")


def test_entries_are_ordered_by_creation_time_whatever_order_they_arrive_in() -> None:
    ordered = history(4, 4, 0, 0)

    insights = compute_insights(list(reversed(ordered)))

    assert [point.entry_id for point in insights.points] == [item.entry_id for item in ordered]
    assert insights.trend is Trend.IMPROVING


@pytest.mark.parametrize(("value", "expected"), [(2.25, 2.3), (0.05, 0.1), (100 / 3, 33.3), (None, None)])
def test_rates_round_half_up_to_one_decimal(value: float | None, expected: float | None) -> None:
    assert round_rate(value) == expected
