import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.services.insights.calculations import compute_insights
from app.services.insights.summary import category_label, summarize
from app.services.insights.types import CategoryErrors, EntryErrors, Example
from journal_ai import Category

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


def entries(*errors_per_entry: dict[Category, int], words: int = 100) -> list[EntryErrors]:
    return [
        EntryErrors(
            entry_id=uuid.UUID(int=index + 1),
            created_at=T0 + timedelta(days=index),
            word_count=words,
            errors={category: CategoryErrors(count, Example("x", "y")) for category, count in errors.items()},
        )
        for index, errors in enumerate(errors_per_entry)
    ]


ARTICLE = Category.ARTICLE
PREPOSITION = Category.PREPOSITION


@pytest.mark.parametrize(("count", "remaining"), [(0, 3), (2, 1)])
def test_below_three_entries_the_summary_says_how_many_are_still_needed(count: int, remaining: int) -> None:
    summary = summarize(compute_insights(entries(*[{}] * count)))

    assert summary == (f"Insights start after 3 entries with feedback — {remaining} to go.",)


def test_three_entries_summarise_totals_and_recurring_categories_only() -> None:
    summary = summarize(compute_insights(entries({PREPOSITION: 1}, {PREPOSITION: 1}, {PREPOSITION: 1})))

    assert summary == (
        "3 errors across 3 entries — 1.0 per 100 words.",
        "Preposition keeps recurring: 3 of your last 3 entries.",
        "Trends start at 4 entries with feedback.",
    )


def test_trends_summarise_the_overall_rate_each_moving_category_and_recurring_ones() -> None:
    insights = compute_insights(
        entries({ARTICLE: 2}, {ARTICLE: 2, PREPOSITION: 1}, {ARTICLE: 1}, {ARTICLE: 2, PREPOSITION: 1})
    )

    assert summarize(insights) == (
        "9 errors across 4 entries — 2.3 per 100 words.",
        "Overall, your error rate is steady (2.5 → 2.0 per 100 words).",
        "Article is improving (2.0 → 1.5 per 100 words).",
        "Article keeps recurring: 4 of your last 4 entries.",
    )


def test_a_rising_category_is_called_out_as_getting_worse() -> None:
    insights = compute_insights(entries({}, {}, {ARTICLE: 1}, {ARTICLE: 2}))

    assert "Article is getting worse (0.0 → 1.5 per 100 words)." in summarize(insights)


def test_one_error_is_singular_and_no_errors_needs_no_further_sentences() -> None:
    one = summarize(compute_insights(entries({ARTICLE: 1}, {}, {})))
    none = summarize(compute_insights(entries({}, {}, {})))

    assert one[0] == "1 error across 3 entries — 0.3 per 100 words."
    assert none == (
        "0 errors across 3 entries — 0.0 per 100 words.",
        "Trends start at 4 entries with feedback.",
    )


def test_category_labels_read_as_words() -> None:
    assert category_label(Category.VERB_CONJUGATION) == "Verb conjugation"
