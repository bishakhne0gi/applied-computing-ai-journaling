import math
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

from app.repositories.insights import EntryErrors, Example
from journal_ai import Category

# Below this many entries with feedback any rate is noise, so nothing is computed (spec §8).
MIN_ENTRIES = 3
# Trends compare two windows; with three entries the earlier window would hold a single entry.
MIN_ENTRIES_FOR_TRENDS = 4
# Each window holds at most this many entries, so a trend describes recent writing, not the whole history.
WINDOW_CAP = 5
# A category recurs when it appears in at least RECURRING_MIN of the last RECURRING_WINDOW entries.
RECURRING_WINDOW = 5
RECURRING_MIN = 3
# A change is a trend only beyond max(TREND_FLOOR, TREND_SHARE * earlier rate): the floor keeps one extra
# error in a short entry from reading as progress; the share raises the bar for learners with high rates.
TREND_FLOOR = 0.5
TREND_SHARE = 0.25
RATE_UNIT_WORDS = 100


class InsightsStatus(StrEnum):
    INSUFFICIENT_DATA = "insufficient_data"
    TOTALS_ONLY = "totals_only"
    TRENDS = "trends"


class Trend(StrEnum):
    IMPROVING = "improving"
    STABLE = "stable"
    WORSENING = "worsening"


@dataclass(frozen=True)
class Windows:
    earlier: Sequence[EntryErrors]
    recent: Sequence[EntryErrors]


@dataclass(frozen=True)
class RatePoint:
    entry_id: uuid.UUID
    created_at: datetime
    word_count: int
    error_count: int
    rate: float | None


@dataclass(frozen=True)
class CategoryInsight:
    category: Category
    occurrences: int
    recent_entries: int
    recurring: bool
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    latest_example: Example


@dataclass(frozen=True)
class Insights:
    status: InsightsStatus
    entry_count: int
    total_words: int
    total_errors: int
    error_rate: float | None
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    recurring_window: int
    points: tuple[RatePoint, ...]
    categories: tuple[CategoryInsight, ...]
    summary: tuple[str, ...] = ()


def rate(errors: int, words: int) -> float | None:
    # Multiplying first keeps exact inputs exact: 3 errors in 200 words is 1.5, not 1.5000000000000002.
    return errors * RATE_UNIT_WORDS / words if words > 0 else None


def pooled_rate(entries: Sequence[EntryErrors], category: Category | None = None) -> float | None:
    errors = sum(_errors(entry, category) for entry in entries)
    return rate(errors, sum(entry.word_count for entry in entries))


def split_windows(ordered: Sequence[EntryErrors]) -> Windows:
    n = len(ordered)
    recent_size = min(math.ceil(n / 2), WINDOW_CAP)
    earlier_size = min(n // 2, WINDOW_CAP)
    recent_start = n - recent_size
    return Windows(earlier=ordered[recent_start - earlier_size : recent_start], recent=ordered[recent_start:])


def classify_trend(earlier: float | None, recent: float | None) -> Trend | None:
    if earlier is None or recent is None:
        return None
    threshold = max(TREND_FLOOR, TREND_SHARE * earlier)
    delta = recent - earlier
    if delta <= -threshold:
        return Trend.IMPROVING
    if delta >= threshold:
        return Trend.WORSENING
    return Trend.STABLE


def round_rate(value: float | None) -> float | None:
    # Half-up to one decimal, once, so the summary sentences and the UI show the same digits.
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def compute_insights(entries: Sequence[EntryErrors]) -> Insights:
    ordered = sorted(entries, key=lambda entry: (entry.created_at, entry.entry_id))
    status = _status(len(ordered))
    windows = split_windows(ordered) if status is InsightsStatus.TRENDS else None
    computed = status is not InsightsStatus.INSUFFICIENT_DATA
    earlier_rate, recent_rate = _window_rates(windows, category=None)
    return Insights(
        status=status,
        entry_count=len(ordered),
        total_words=sum(entry.word_count for entry in ordered),
        total_errors=sum(entry.error_count for entry in ordered),
        error_rate=round_rate(pooled_rate(ordered)) if computed else None,
        earlier_rate=round_rate(earlier_rate),
        recent_rate=round_rate(recent_rate),
        trend=classify_trend(earlier_rate, recent_rate),
        recurring_window=min(len(ordered), RECURRING_WINDOW),
        points=tuple(_point(entry) for entry in ordered) if computed else (),
        categories=_categories(ordered, windows) if computed else (),
    )


def _status(n: int) -> InsightsStatus:
    if n < MIN_ENTRIES:
        return InsightsStatus.INSUFFICIENT_DATA
    if n < MIN_ENTRIES_FOR_TRENDS:
        return InsightsStatus.TOTALS_ONLY
    return InsightsStatus.TRENDS


def _errors(entry: EntryErrors, category: Category | None) -> int:
    if category is None:
        return entry.error_count
    found = entry.errors.get(category)
    return found.count if found else 0


def _window_rates(windows: Windows | None, *, category: Category | None) -> tuple[float | None, float | None]:
    if windows is None:
        return None, None
    return pooled_rate(windows.earlier, category), pooled_rate(windows.recent, category)


def _point(entry: EntryErrors) -> RatePoint:
    return RatePoint(
        entry_id=entry.entry_id,
        created_at=entry.created_at,
        word_count=entry.word_count,
        error_count=entry.error_count,
        rate=round_rate(rate(entry.error_count, entry.word_count)),
    )


def _categories(ordered: Sequence[EntryErrors], windows: Windows | None) -> tuple[CategoryInsight, ...]:
    seen = {category for entry in ordered for category in entry.errors}
    insights = [_category(category, ordered, windows) for category in seen]
    # Most frequent first; the category value breaks ties so the order never depends on set order.
    return tuple(sorted(insights, key=lambda item: (-item.occurrences, item.category.value)))


def _category(category: Category, ordered: Sequence[EntryErrors], windows: Windows | None) -> CategoryInsight:
    recent_entries = sum(category in entry.errors for entry in ordered[-RECURRING_WINDOW:])
    earlier_rate, recent_rate = _window_rates(windows, category=category)
    latest = next(entry.errors[category] for entry in reversed(ordered) if category in entry.errors)
    return CategoryInsight(
        category=category,
        occurrences=sum(_errors(entry, category) for entry in ordered),
        recent_entries=recent_entries,
        recurring=recent_entries >= RECURRING_MIN,
        earlier_rate=round_rate(earlier_rate),
        recent_rate=round_rate(recent_rate),
        trend=classify_trend(earlier_rate, recent_rate),
        latest_example=latest.example,
    )
