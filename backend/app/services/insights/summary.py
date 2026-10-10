from app.services.insights.calculations import (
    MIN_ENTRIES,
    MIN_ENTRIES_FOR_TRENDS,
    CategoryInsight,
    Insights,
    InsightsStatus,
    Trend,
)
from journal_ai import Category

_TREND_PHRASES = {
    Trend.IMPROVING: "is improving",
    Trend.STABLE: "is steady",
    Trend.WORSENING: "is getting worse",
}


def category_label(category: Category) -> str:
    return category.value.replace("_", " ").capitalize()


def summarize(insights: Insights) -> tuple[str, ...]:
    if insights.status is InsightsStatus.INSUFFICIENT_DATA:
        remaining = MIN_ENTRIES - insights.entry_count
        return (f"Insights start after {MIN_ENTRIES} entries with feedback — {remaining} to go.",)
    overall = _trend_sentence(
        "Overall, your error rate", insights.trend, insights.earlier_rate, insights.recent_rate
    )
    trends_note = f"Trends start at {MIN_ENTRIES_FOR_TRENDS} entries with feedback."
    return (
        _headline(insights),
        *([overall] if overall else []),
        *_category_trends(insights.categories),
        *_recurring(insights),
        *([trends_note] if insights.status is InsightsStatus.TOTALS_ONLY else []),
    )


def _headline(insights: Insights) -> str:
    noun = "error" if insights.total_errors == 1 else "errors"
    counted = f"{insights.total_errors} {noun} across {insights.entry_count} entries"
    if insights.error_rate is None:
        return f"{counted}."
    return f"{counted} — {insights.error_rate:.1f} per 100 words."


def _trend_sentence(
    subject: str, trend: Trend | None, earlier: float | None, recent: float | None
) -> str | None:
    if trend is None or earlier is None or recent is None:
        return None
    return f"{subject} {_TREND_PHRASES[trend]} ({earlier:.1f} → {recent:.1f} per 100 words)."


def _category_trends(categories: tuple[CategoryInsight, ...]) -> list[str]:
    # Steady categories stay out of the summary; the table still lists them.
    sentences = (
        _trend_sentence(category_label(item.category), item.trend, item.earlier_rate, item.recent_rate)
        for item in categories
        if item.trend is not Trend.STABLE
    )
    return [sentence for sentence in sentences if sentence is not None]


def _recurring(insights: Insights) -> list[str]:
    return [
        f"{category_label(item.category)} keeps recurring: "
        f"{item.recent_entries} of your last {insights.recurring_window} entries."
        for item in insights.categories
        if item.recurring
    ]
