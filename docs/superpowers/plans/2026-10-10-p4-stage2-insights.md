# P4 Stage 2 Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage 2 — `GET /api/v1/insights?language=` turns each entry's latest succeeded analysis into error rates, trends, recurring categories and deterministic summary sentences, and an Insights screen shows them as a headline, a dependency-free SVG line chart and a category table.

**Architecture:** One repository query (`InsightsRepository.entry_errors`) returns, per entry whose newest *succeeded* analysis exists, its `created_at`, the word count of the analysed snapshot, and its `error` mistakes grouped by category with the first one in the text as example. Pure functions in `app/services/insights/calculations.py` (windows, pooled rates, trend thresholds, recurring) and `summary.py` (template sentences) turn those rows into an `Insights` dataclass; `InsightsService` composes them and the route validates the dataclass straight into `InsightsOut`. The frontend reads it through `useInsightsQuery`, the run-analysis mutation invalidates every insights key, and MSW serves a TypeScript port of the same rules over the in-memory store so dev, Vitest, Playwright and the Lighthouse mock build see the numbers the real API would send.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.1 async (Postgres `DISTINCT ON`, `regexp_split_to_array`), pytest against real Postgres · React 19, TypeScript 6, Tailwind v4 tokens (`stroke-*`/`fill-*` colour-role utilities for SVG), TanStack Query 5.104.0, ky 2.1.0, React Router 8.4.0, MSW 2.15.0, Vitest 5 + Testing Library, Playwright 1.63 + axe.

**Spec:** `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§2 decisions, §4 "Insights read only the latest succeeded analysis per entry", §5 `GET /insights?language=`, §7 Insights screen, §8 Stage 2 logic, §10 Stage 2 tests, §13 P4 exit). Interfaces consumed are the real code on `main` (P3 done), not the earlier plans.

## Global Constraints

- P4 exit (spec §13): calc + endpoint + UI tests green. `make verify` (needs `make db`) ends with `ALL GATES GREEN` at the end of **every** task; Task 6 and Task 7 also run `make e2e-stack`.
- Stage 2 rules, verbatim from spec §8 — every one is a named, documented constant or a tested function:
  - Only `kind = error` counts. Suggestions and `vocab_help` never do.
  - Only the latest **succeeded** analysis per entry counts, so re-analysis never double-counts. Decision (spec §4 wording): a newer `failed` or `pending` attempt does **not** hide an older succeeded one — the entry keeps its last good feedback. Entries with no succeeded analysis are left out.
  - Rate = errors per 100 words, pooled per window: Σ errors / Σ words × 100. Words are those of the analysed snapshot (`analyses.input_text`), not the entry's current text.
  - Order entries by `created_at` (tie-break `entry_id`); `recent` = last ⌈n/2⌉ (cap 5), `earlier` = the ⌊n/2⌋ before it (cap 5).
  - n < 3 → `insufficient_data`. n = 3 → totals + recurring only (`totals_only`). n ≥ 4 → `trends`.
  - Trend: `delta = recent − earlier`; threshold `max(0.5, 0.25 × earlier)`; `delta ≤ −threshold` improving, `delta ≥ threshold` worsening, else stable. Decided on unrounded rates.
  - Recurring: category present in ≥ 3 of the last 5 entries.
  - Summary: template sentences from the computed numbers; rates shown with one decimal, rounded half-up once in the API so sentences and UI show the same digits.
- Payload `InsightsOut` (why each field exists): `status` lets the UI pick its state without re-deriving thresholds · `entry_count`, `total_words`, `total_errors`, `error_rate` feed the headline · `earlier_rate`, `recent_rate`, `trend` are the overall comparison (headline + chart description) · `recurring_window` = min(n, 5) so the UI can say "3 of last 5" without copying a constant · `points[]` (one per entry: `entry_id, created_at, word_count, error_count, rate`) draw the chart and its text alternative · `categories[]` (`category, occurrences, recent_entries, recurring, earlier_rate, recent_rate, trend, latest_example{original, correction}`) fill the table · `summary[]` are the server's sentences. `language` is not echoed — the client asked for it.
- Backend layers stay `api → services → repositories → db` (import-linter). Repositories query and shape rows, no thresholds; calculations do no I/O; the service logs one line (`insights_computed`: language, status, counts — never example text, which is entry text).
- Frontend hard limits (eslint, never disabled): file ≤200 lines, function ≤60, complexity ≤10 (counts `?.`, `??`, `&&`, ternaries), cognitive ≤12, depth 3. Folder boundaries: features reach data only via `hooks/queries|mutations`; pages are thin; `components/` pure.
- Styling: tokens only — no arbitrary values, no palette classes, no `dark:`, no raw `z-*`, no inline `style`. SVG colours via `stroke-primary`, `fill-primary`, `stroke-border`, `fill-none`, widths via `stroke-1`/`stroke-2` (verified against the installed Tailwind 4.3.3). Every button is `<Button>`. No chart dependency (spec §7). No animation, so `prefers-reduced-motion` holds trivially.
- No new dependencies in this phase.
- Server data lives only in the TanStack Query cache; the language filter lives only in the URL.
- Never log entry text or send it to Sentry. Never open or print the real env file.
- Tests: Python — behaviour names, parametrized tables, Postgres only, `FakeProvider` only. Frontend — AAA comments, role queries, `userEvent.setup()`, MSW for the network, coverage band 65–85%; Playwright calls `expectNoA11yViolations` + `expectButtonsShowPointer` after each meaningful state, desktop + 375px mobile.
- Comments explain why, never what. Commits: plain message, no `Co-Authored-By`, no AI attribution, files staged explicitly with `git add <paths>`, no `git push`. `.github/workflows/ci.yml` is local-only — never stage it.
- The words banned by `scripts/check-hygiene.sh` never appear in code, tests, copy or docs. No absolute home-directory paths anywhere.
- Copy: "Insights", "Summary", "Errors by category", "Loading insights…", "Not enough entries yet", "Write an entry", "Recurring · N of last M", trend words "Improving" / "Steady" / "Getting worse", single `…` and `—` characters.

## Review Focus

- A re-check fails (or never finishes) after an earlier success → Insights keep that entry's earlier errors; the entry neither vanishes nor counts twice. (Task 2 repository + API tests; Task 3 mock test.)
- The learner edits an entry and the re-check never succeeds → the rate's denominator is the word count of the text that was analysed, not the edited text. (Task 2 repository test.)
- A new analysis lands while Insights are cached (the app's `staleTime` is 30 s) → Insights refresh without a reload. (Task 3 mutation test; Task 5 e2e journey.)
- Every rate is zero, or an entry has no words → no division by zero in the API, the chart stays on its baseline with no `NaN`, the table shows "—". (Task 1 zero-words test; Task 5 `chartGeometry` + `RateChart` tests.)
- Languages and insights both fail (`?mock=error`), or the URL holds `?language=xx` → exactly one "Try again" on screen; the unknown code is dropped and never reaches the API. (Task 4 HistoryList test; Task 5 InsightsScreen tests + e2e.)

## File map

```
backend/
  app/repositories/insights.py            row shapes (T1) + the one query (T2)
  app/services/insights/{__init__,calculations,summary}.py                  (T1)
  app/services/insights/service.py                                          (T2)
  app/api/schemas/insights.py · app/api/routes/insights.py · app/api/deps.py · app/api/v1.py      (T2)
  tests/unit/test_insights_{calculations,summary}.py                        (T1)
  tests/integration/test_insights_{repository,api}.py · tests/support.py    (T2)
docs/superpowers/specs/2026-10-10-ai-language-journal-design.md (§8 two clarifications)          (T2)
frontend/
  src/types/insights.ts · src/utils/endpoints.ts · src/hooks/queries/{journalKeys,useInsightsQuery}.ts
  src/hooks/mutations/useRunAnalysisMutation.ts · src/mocks/{db,responses,handlers,insights}.ts   (T3)
  src/features/languages/{useLanguageFilter.ts,LanguageFiltered.tsx} · src/features/history/HistoryList.tsx
  src/features/entry-detail/EntryDetail.tsx · src/pages/EntryDetailPage.tsx                       (T4)
  src/features/insights/{format,chartGeometry}.ts
  src/features/insights/{RateTable,RateChart,TrendCells,CategoryTable,InsightsReport,InsightsResults,InsightsScreen}.tsx
  src/pages/InsightsPage.tsx · src/AppRoutes.tsx · src/features/shell/AppShell.tsx · src/utils/formatter.ts
  e2e/insights.spec.ts · DESIGN.md                                                                (T5)
  e2e-stack/insights.spec.ts                                                                      (T6)
docs/superpowers/plans/2026-10-10-00-index.md · docs/qa/p4-*.png                                  (T7)
```

Tasks: 1 pure calculations + summary · 2 repository query + endpoint · 3 frontend data layer + in-memory insights · 4 shared language filter + P3 carry-overs · 5 Insights screen + e2e · 6 full-stack insights journey · 7 phase checkpoint.

---

### Task 1: Pure insight calculations and summary sentences

**Files:**
- Create: `backend/app/repositories/insights.py` (row shapes only; Task 2 adds the query), `backend/app/services/insights/__init__.py`, `backend/app/services/insights/calculations.py`, `backend/app/services/insights/summary.py`
- Test: `backend/tests/unit/test_insights_calculations.py`, `backend/tests/unit/test_insights_summary.py`

**Interfaces:**
- Consumes: `journal_ai.Category` (StrEnum, values like `"verb_conjugation"`).
- Produces:
  - `app.repositories.insights`: `Example(original: str, correction: str)`, `CategoryErrors(count: int, example: Example)`, `EntryErrors(entry_id: UUID, created_at: datetime, word_count: int, errors: dict[Category, CategoryErrors])` with property `error_count -> int`. All frozen dataclasses.
  - `app.services.insights.calculations`: constants `MIN_ENTRIES = 3`, `MIN_ENTRIES_FOR_TRENDS = 4`, `WINDOW_CAP = 5`, `RECURRING_WINDOW = 5`, `RECURRING_MIN = 3`, `TREND_FLOOR = 0.5`, `TREND_SHARE = 0.25`, `RATE_UNIT_WORDS = 100`; `InsightsStatus` (StrEnum `insufficient_data|totals_only|trends`); `Trend` (StrEnum `improving|stable|worsening`); dataclasses `Windows(earlier, recent)`, `RatePoint(entry_id, created_at, word_count, error_count, rate: float | None)`, `CategoryInsight(category, occurrences, recent_entries, recurring, earlier_rate, recent_rate, trend: Trend | None, latest_example: Example)`, `Insights(status, entry_count, total_words, total_errors, error_rate, earlier_rate, recent_rate, trend, recurring_window, points: tuple[RatePoint, ...], categories: tuple[CategoryInsight, ...], summary: tuple[str, ...] = ())`; functions `rate(errors, words) -> float | None`, `pooled_rate(entries, category=None) -> float | None`, `split_windows(ordered) -> Windows`, `classify_trend(earlier, recent) -> Trend | None`, `round_rate(value) -> float | None`, `compute_insights(entries) -> Insights` (summary left empty).
  - `app.services.insights.summary`: `category_label(category) -> str`, `summarize(insights: Insights) -> tuple[str, ...]`.

- [ ] **Step 1: Write the failing calculation tests**

`backend/tests/unit/test_insights_calculations.py`:
```python
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
```

- [ ] **Step 2: Write the failing summary tests**

`backend/tests/unit/test_insights_summary.py`:
```python
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.insights import CategoryErrors, EntryErrors, Example
from app.services.insights.calculations import compute_insights
from app.services.insights.summary import category_label, summarize
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
```

- [ ] **Step 3: Run them to see them fail**

Run: `uv run pytest backend/tests/unit/test_insights_calculations.py backend/tests/unit/test_insights_summary.py -q`
Expected: collection errors — `ModuleNotFoundError: No module named 'app.repositories.insights'`.

- [ ] **Step 4: Row shapes**

`backend/app/repositories/insights.py` (Task 2 replaces this file with the query added):
```python
import uuid
from dataclasses import dataclass
from datetime import datetime

from journal_ai import Category


@dataclass(frozen=True)
class Example:
    original: str
    correction: str


@dataclass(frozen=True)
class CategoryErrors:
    count: int
    example: Example


@dataclass(frozen=True)
class EntryErrors:
    entry_id: uuid.UUID
    created_at: datetime
    word_count: int
    errors: dict[Category, CategoryErrors]

    @property
    def error_count(self) -> int:
        return sum(item.count for item in self.errors.values())
```

`backend/app/services/insights/__init__.py`: empty file.

- [ ] **Step 5: Calculations**

`backend/app/services/insights/calculations.py`:
```python
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
```

- [ ] **Step 6: Summary sentences**

`backend/app/services/insights/summary.py`:
```python
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
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `uv run pytest backend/tests/unit/test_insights_calculations.py backend/tests/unit/test_insights_summary.py -q`
Expected: `45 passed`.

- [ ] **Step 8: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` (ruff, mypy strict, import-linter "3 kept, 0 broken", backend coverage ≥85%).

- [ ] **Step 9: Commit**

```bash
git add backend/app/repositories/insights.py backend/app/services/insights \
  backend/tests/unit/test_insights_calculations.py backend/tests/unit/test_insights_summary.py
git commit -m "feat(backend): pure Stage 2 insight calculations and summary sentences"
```

---

### Task 2: The insights query and `GET /api/v1/insights`

**Files:**
- Modify: `backend/app/repositories/insights.py` (add `InsightsRepository`), `backend/app/api/deps.py`, `backend/app/api/v1.py`, `backend/tests/support.py`, `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§8)
- Create: `backend/app/services/insights/service.py`, `backend/app/api/schemas/insights.py`, `backend/app/api/routes/insights.py`
- Test: `backend/tests/integration/test_insights_repository.py`, `backend/tests/integration/test_insights_api.py`

**Interfaces:**
- Consumes: Task 1 (`EntryErrors`, `CategoryErrors`, `Example`, `compute_insights`, `summarize`, `Insights`, `InsightsStatus`, `Trend`); `app.db.models.{Analysis, AnalysisStatus, Entry, Mistake}`; `app.api.schemas.entries.LanguageCode`; fixtures `db_session`, `client`, `make_api` (`backend/tests/integration/conftest.py`); helpers `entry_at`, `analysis_for`, `YO_ES`, `model_reply`, `ApiFactory` (`backend/tests/support.py`); demo `FakeProvider` rules (`ai/journal_ai/providers/fake.py`): «la problema» → gender_agreement, «yo es» → verb_conjugation, «a el» and «à le» → article, `[word]` → vocab_help.
- Produces:
  - `InsightsRepository(session).entry_errors(*, language: str | None) -> list[EntryErrors]` — oldest first, one per entry with a succeeded analysis.
  - `InsightsService(session).get(*, language: str | None) -> Insights` (summary filled).
  - `GET /api/v1/insights?language=` → 200 `InsightsOut`; unsupported or empty `language` → 422 problem+json.
  - Test helper `mistake(category, *, kind=ERROR, original="x", correction="y", position=0) -> Mistake`; `analysis_for(..., mistakes: Sequence[Mistake] = ())`.

- [ ] **Step 1: Extend the test helpers**

In `backend/tests/support.py`, replace `analysis_for` (and add `mistake` above it) with:
```python
def mistake(
    category: Category,
    *,
    kind: MistakeKind = MistakeKind.ERROR,
    original: str = "x",
    correction: str = "y",
    position: int = 0,
) -> Mistake:
    return Mistake(
        kind=kind,
        category=category,
        original=original,
        correction=correction,
        explanation="z",
        position=position,
    )


def analysis_for(
    entry: Entry,
    *,
    status: AnalysisStatus,
    created_at: datetime,
    errors: int = 0,
    suggestions: int = 0,
    mistakes: Sequence[Mistake] = (),
) -> Analysis:
    kinds = [MistakeKind.ERROR] * errors + [MistakeKind.SUGGESTION] * suggestions
    generated = [mistake(Category.OTHER, kind=kind, position=index) for index, kind in enumerate(kinds)]
    return Analysis(
        entry=entry,
        status=status,
        input_text=entry.text,
        prompt_version="v1",
        created_at=created_at,
        mistakes=[*generated, *mistakes],
    )
```
(`Sequence` is already imported from `collections.abc`; existing callers keep working.)

- [ ] **Step 2: Write the failing repository tests**

`backend/tests/integration/test_insights_repository.py`:
```python
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisStatus
from app.repositories.insights import CategoryErrors, EntryErrors, Example, InsightsRepository
from journal_ai import Category, MistakeKind
from tests.support import analysis_for, entry_at, mistake

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
LATER = T0 + timedelta(minutes=5)
SUCCEEDED = AnalysisStatus.SUCCEEDED


async def _entry_errors(db_session: AsyncSession, language: str | None = None) -> list[EntryErrors]:
    await db_session.flush()
    return await InsightsRepository(db_session).entry_errors(language=language)


async def test_only_the_newest_succeeded_analysis_of_an_entry_counts(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=SUCCEEDED, created_at=T0, errors=3),
            analysis_for(entry, status=SUCCEEDED, created_at=LATER, errors=1),
        ]
    )

    [row] = await _entry_errors(db_session)

    assert row.error_count == 1


@pytest.mark.parametrize("newer", [AnalysisStatus.FAILED, AnalysisStatus.PENDING])
async def test_a_newer_failed_or_unfinished_analysis_keeps_the_previous_success(
    db_session: AsyncSession, newer: AnalysisStatus
) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=SUCCEEDED, created_at=T0, errors=2),
            analysis_for(entry, status=newer, created_at=LATER),
        ]
    )

    [row] = await _entry_errors(db_session)

    assert row.error_count == 2


async def test_entries_without_a_succeeded_analysis_are_left_out(db_session: AsyncSession) -> None:
    failed_only, never_analysed = entry_at(T0), entry_at(LATER)
    failed = analysis_for(failed_only, status=AnalysisStatus.FAILED, created_at=T0)
    db_session.add_all([failed, never_analysed])

    assert await _entry_errors(db_session) == []


async def test_suggestions_and_word_help_are_not_errors(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    word_help = mistake(Category.VOCABULARY, kind=MistakeKind.VOCAB_HELP, position=1)
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0, suggestions=1, mistakes=[word_help]))

    [row] = await _entry_errors(db_session)

    assert row.errors == {}
    assert row.word_count == 2


async def test_errors_are_counted_per_category_with_the_first_one_in_the_text_as_example(
    db_session: AsyncSession,
) -> None:
    entry = entry_at(T0)
    mistakes = [
        mistake(Category.ARTICLE, original="a el", correction="al", position=2),
        mistake(Category.ARTICLE, original="de el", correction="del", position=0),
        mistake(Category.PREPOSITION, original="en", correction="a", position=1),
    ]
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0, mistakes=mistakes))

    [row] = await _entry_errors(db_session)

    assert row.errors == {
        Category.ARTICLE: CategoryErrors(2, Example("de el", "del")),
        Category.PREPOSITION: CategoryErrors(1, Example("en", "a")),
    }


async def test_entries_come_oldest_first_and_can_be_filtered_by_language(db_session: AsyncSession) -> None:
    newest, oldest, french = entry_at(T0 + timedelta(hours=2)), entry_at(T0), entry_at(LATER, language="fr")
    db_session.add_all(
        [analysis_for(item, status=SUCCEEDED, created_at=T0) for item in (newest, oldest, french)]
    )

    spanish = await _entry_errors(db_session, language="es")
    every = await _entry_errors(db_session)

    assert [row.entry_id for row in spanish] == [oldest.id, newest.id]
    assert [row.entry_id for row in every] == [oldest.id, french.id, newest.id]


async def test_the_word_count_is_that_of_the_analysed_text_not_of_a_later_edit(
    db_session: AsyncSession,
) -> None:
    entry = entry_at(T0, text="Hola  mundo\nqué\ttal")
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0))
    await db_session.flush()
    entry.text, entry.word_count = "Hola", 1

    [row] = await _entry_errors(db_session)

    assert row.word_count == 4
```

- [ ] **Step 3: Write the failing API tests**

`backend/tests/integration/test_insights_api.py`:
```python
import pytest
from httpx import AsyncClient

from journal_ai.providers.base import ProviderError
from tests.support import YO_ES, ApiFactory, model_reply

# The demo FakeProvider flags «la problema», «yo es» and «a el»; the third entry has nothing to fix.
FOUR_ENTRIES = ("Hoy la problema es grande.", "Ayer yo es feliz.", "Mi casa es bonita.", "Voy a el cine.")


async def _write(api: AsyncClient, text: str, language: str = "es") -> str:
    created = await api.post("/api/v1/entries", json={"language": language, "text": text})
    analysed = await api.post(f"/api/v1/entries/{created.json()['id']}/analyses")
    assert analysed.status_code == 201
    return str(created.json()["id"])


async def test_no_entries_yet_means_three_to_go(client: AsyncClient) -> None:
    response = await client.get("/api/v1/insights")

    assert response.status_code == 200
    assert response.json() == {
        "status": "insufficient_data",
        "entry_count": 0,
        "total_words": 0,
        "total_errors": 0,
        "error_rate": None,
        "earlier_rate": None,
        "recent_rate": None,
        "trend": None,
        "recurring_window": 0,
        "points": [],
        "categories": [],
        "summary": ["Insights start after 3 entries with feedback — 3 to go."],
    }


async def test_four_analysed_entries_report_trends_from_their_errors(make_api: ApiFactory) -> None:
    async with make_api() as api:
        for text in FOUR_ENTRIES:
            await _write(api, text)
        body = (await api.get("/api/v1/insights")).json()

    categories = {item["category"]: item for item in body["categories"]}
    assert (body["status"], body["entry_count"], body["total_words"], body["total_errors"]) == (
        "trends",
        4,
        17,
        3,
    )
    assert (body["earlier_rate"], body["recent_rate"], body["trend"]) == (22.2, 12.5, "improving")
    assert categories["article"]["trend"] == "worsening"
    assert categories["article"]["latest_example"] == {"original": "a el", "correction": "al"}
    assert categories["gender_agreement"]["trend"] == "improving"
    assert [point["error_count"] for point in body["points"]] == [1, 1, 0, 1]
    assert body["summary"][0] == "3 errors across 4 entries — 17.6 per 100 words."


async def test_re_analysing_an_entry_never_counts_it_twice(make_api: ApiFactory) -> None:
    async with make_api() as api:
        first = await _write(api, "Ayer yo es feliz.")
        for _ in range(2):
            await _write(api, "Hoy yo es feliz.")
        await api.post(f"/api/v1/entries/{first}/analyses")
        body = (await api.get("/api/v1/insights")).json()

    assert (body["status"], body["entry_count"], body["total_errors"]) == ("totals_only", 3, 3)
    assert "Verb conjugation keeps recurring: 3 of your last 3 entries." in body["summary"]


async def test_a_failed_re_analysis_keeps_the_earlier_feedback_in_insights(make_api: ApiFactory) -> None:
    script: list[str | Exception] = [*[model_reply(YO_ES)] * 3, ProviderError("down")]
    async with make_api(script) as api:
        ids = [await _write(api, "Ayer yo es feliz.") for _ in range(3)]
        failed = await api.post(f"/api/v1/entries/{ids[0]}/analyses")
        body = (await api.get("/api/v1/insights")).json()

    assert failed.json()["status"] == "failed"
    assert (body["entry_count"], body["total_errors"]) == (3, 3)


async def test_insights_can_be_narrowed_to_one_language(make_api: ApiFactory) -> None:
    async with make_api() as api:
        for _ in range(3):
            await _write(api, "Ayer yo es feliz.")
        await _write(api, "Je vais à le parc.", language="fr")
        french = (await api.get("/api/v1/insights", params={"language": "fr"})).json()
        spanish = (await api.get("/api/v1/insights", params={"language": "es"})).json()

    assert (french["status"], french["entry_count"]) == ("insufficient_data", 1)
    assert (spanish["status"], spanish["entry_count"]) == ("totals_only", 3)


@pytest.mark.parametrize("language", ["xx", ""])
async def test_an_unsupported_language_is_rejected(client: AsyncClient, language: str) -> None:
    response = await client.get("/api/v1/insights", params={"language": language})

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
```
Numbers in the trends test, by hand: words 5 + 4 + 4 + 4 = 17; earlier = first two entries, 2 errors / 9 words = 22.2; recent = last two, 1 / 8 = 12.5; delta −9.7 ≤ −max(0.5, 5.6) → improving; article 0 → 12.5 worsening; gender 11.1 → 0 improving; 3 / 17 = 17.6.

- [ ] **Step 4: Run them to see them fail**

Run: `make db` (if not running), then `uv run pytest backend/tests/integration/test_insights_repository.py backend/tests/integration/test_insights_api.py -q`
Expected: repository tests fail with `ImportError: cannot import name 'InsightsRepository'`; API tests fail with `404` (no route).

- [ ] **Step 5: The query**

Replace `backend/app/repositories/insights.py` with:
```python
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, MistakeKind

# Any run of whitespace, like `str.split()` in `count_words`; the stored text is already trimmed.
_WHITESPACE_RUN = "[[:space:]]+"


@dataclass(frozen=True)
class Example:
    original: str
    correction: str


@dataclass(frozen=True)
class CategoryErrors:
    count: int
    example: Example


@dataclass(frozen=True)
class EntryErrors:
    entry_id: uuid.UUID
    created_at: datetime
    word_count: int
    errors: dict[Category, CategoryErrors]

    @property
    def error_count(self) -> int:
        return sum(item.count for item in self.errors.values())


_Row = tuple[uuid.UUID, datetime, int, Category | None, str | None, str | None]


class InsightsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def entry_errors(self, *, language: str | None) -> list[EntryErrors]:
        # The newest *succeeded* analysis per entry, even when a later attempt failed or never finished:
        # a failed re-check must not erase feedback the learner already has (spec §4).
        latest = (
            select(
                Analysis.id.label("analysis_id"),
                Analysis.entry_id,
                # Words of the analysed snapshot, not of the current text: an edit that was never re-checked
                # must not change the denominator of errors counted on the old text.
                func.array_length(func.regexp_split_to_array(Analysis.input_text, _WHITESPACE_RUN), 1).label(
                    "word_count"
                ),
            )
            .where(Analysis.status == AnalysisStatus.SUCCEEDED)
            .order_by(Analysis.entry_id, Analysis.created_at.desc(), Analysis.id.desc())
            .ext(distinct_on(Analysis.entry_id))
            .subquery("latest_succeeded")
        )
        stmt = (
            select(
                Entry.id,
                Entry.created_at,
                latest.c.word_count,
                Mistake.category,
                Mistake.original,
                Mistake.correction,
            )
            .join(latest, latest.c.entry_id == Entry.id)
            .outerjoin(
                Mistake, and_(Mistake.analysis_id == latest.c.analysis_id, Mistake.kind == MistakeKind.ERROR)
            )
            .order_by(Entry.created_at, Entry.id, Mistake.position)
        )
        if language is not None:
            stmt = stmt.where(Entry.language == language)
        return _group((await self._session.execute(stmt)).tuples())


def _group(rows: Iterable[_Row]) -> list[EntryErrors]:
    # One row per error in text order, or a single row without a category for an entry with no errors.
    grouped: dict[uuid.UUID, EntryErrors] = {}
    for entry_id, created_at, word_count, category, original, correction in rows:
        entry = grouped.setdefault(entry_id, EntryErrors(entry_id, created_at, word_count, {}))
        if category is None:
            continue
        previous = entry.errors.get(category)
        if previous is None:
            # Both columns are NOT NULL whenever a mistake row exists; `or ""` only narrows the type.
            entry.errors[category] = CategoryErrors(1, Example(original or "", correction or ""))
        else:
            entry.errors[category] = CategoryErrors(previous.count + 1, previous.example)
    return list(grouped.values())
```
The compiled SQL is one statement: `entries JOIN (SELECT DISTINCT ON (entry_id) … WHERE status = 'succeeded' ORDER BY entry_id, created_at DESC, id DESC) latest_succeeded LEFT OUTER JOIN mistakes ON analysis_id = … AND kind = 'error' [WHERE language = …] ORDER BY entries.created_at, entries.id, mistakes.position`. It is served by the existing `ix_analyses_entry_id_created_at` and `ix_mistakes_analysis_id` indexes; no migration.

- [ ] **Step 6: Service, schema, route, wiring**

`backend/app/services/insights/service.py`:
```python
from dataclasses import replace

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.insights import InsightsRepository
from app.services.insights.calculations import Insights, compute_insights
from app.services.insights.summary import summarize

logger = structlog.get_logger()


class InsightsService:
    def __init__(self, session: AsyncSession) -> None:
        self._insights = InsightsRepository(session)

    async def get(self, *, language: str | None) -> Insights:
        insights = compute_insights(await self._insights.entry_errors(language=language))
        logger.info(
            "insights_computed",
            language=language,
            status=insights.status.value,
            entry_count=insights.entry_count,
            category_count=len(insights.categories),
        )
        return replace(insights, summary=summarize(insights))
```

`backend/app/api/schemas/insights.py`:
```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.services.insights.calculations import InsightsStatus, Trend
from journal_ai import Category


class ExampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    original: str
    correction: str


class RatePointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entry_id: uuid.UUID
    created_at: datetime
    word_count: int
    error_count: int
    rate: float | None


class CategoryInsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: Category
    occurrences: int
    recent_entries: int
    recurring: bool
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    latest_example: ExampleOut


class InsightsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: InsightsStatus
    entry_count: int
    total_words: int
    total_errors: int
    error_rate: float | None
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    recurring_window: int
    points: list[RatePointOut]
    categories: list[CategoryInsightOut]
    summary: list[str]
```
(`from_attributes` validates the frozen dataclasses directly, nested tuples included — verified with Pydantic 2.14.)

`backend/app/api/routes/insights.py`:
```python
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import InsightsServiceDep
from app.api.schemas.entries import LanguageCode
from app.api.schemas.insights import InsightsOut

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=InsightsOut)
async def get_insights(
    service: InsightsServiceDep, language: Annotated[LanguageCode | None, Query()] = None
) -> InsightsOut:
    return InsightsOut.model_validate(await service.get(language=language))
```

In `backend/app/api/deps.py`: add `from app.services.insights.service import InsightsService` after the `EntryService` import; add before the `EntryServiceDep` line
```python
def get_insights_service(session: SessionDep) -> InsightsService:
    return InsightsService(session)


```
and append
```python
InsightsServiceDep = Annotated[InsightsService, Depends(get_insights_service)]
```

`backend/app/api/v1.py`:
```python
from fastapi import APIRouter

from app.api.routes import analyses, entries, insights, languages

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(languages.router)
api_router.include_router(entries.router)
api_router.include_router(analyses.router)
api_router.include_router(insights.router)
```

- [ ] **Step 7: Record the two decisions in the spec**

In `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` §8, after the "Only `kind = error` counts." sentence, add:
```markdown
- "Latest succeeded" is literal: a newer `failed` or `pending` attempt never hides an entry's last good feedback;
  entries with no succeeded analysis are left out.
- Words are counted on the analysed snapshot (`analyses.input_text`), so an edit that was never re-checked does
  not change the denominator.
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `uv run pytest backend/tests/integration/test_insights_repository.py backend/tests/integration/test_insights_api.py -q`
Expected: `15 passed`.

- [ ] **Step 9: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` (import-linter: `Backend layers KEPT`; backend coverage ≥85%).

- [ ] **Step 10: Commit**

```bash
git add backend/app/repositories/insights.py backend/app/services/insights/service.py \
  backend/app/api/schemas/insights.py backend/app/api/routes/insights.py backend/app/api/deps.py backend/app/api/v1.py \
  backend/tests/support.py backend/tests/integration/test_insights_repository.py backend/tests/integration/test_insights_api.py \
  docs/superpowers/specs/2026-10-10-ai-language-journal-design.md
git commit -m "feat(backend): GET /api/v1/insights from each entry's latest succeeded analysis"
```

---

### Task 3: Frontend data layer and the in-memory insights API

**Files:**
- Create: `frontend/src/types/insights.ts`, `frontend/src/hooks/queries/useInsightsQuery.ts`, `frontend/src/mocks/insights.ts`
- Modify: `frontend/src/utils/endpoints.ts`, `frontend/src/hooks/queries/journalKeys.ts`, `frontend/src/hooks/mutations/useRunAnalysisMutation.ts`, `frontend/src/mocks/db.ts`, `frontend/src/mocks/responses.ts`, `frontend/src/mocks/handlers.ts`
- Test: `frontend/src/mocks/insights.test.ts`, `frontend/src/hooks/queries/queries.test.tsx`, `frontend/src/hooks/mutations/mutations.test.tsx`

**Interfaces:**
- Consumes: Task 2's `InsightsOut` JSON; `client`, `ENDPOINTS`, `journalKeys`; mock store helpers `analysesOf`, `addAnalysis`, `findEntry`; `failedAnalysis`; `SEEDED`; `countWords`, `pluralize`, `categoryLabel` (`@/features/feedback/labels`); `invalidParam`, `LANGUAGES`; test helpers `renderHookWithProviders`.
- Produces:
  - Types `InsightsStatus`, `Trend`, `RatePointOut`, `CategoryInsightOut`, `InsightsOut` (`@/types/insights`).
  - `ENDPOINTS.insights = 'insights'`; `journalKeys.insightsAll = ['insights']`, `journalKeys.insights(language: string | null)`.
  - `useInsightsQuery(language: string | null)` → `UseQueryResult<InsightsOut>`.
  - `useRunAnalysisMutation` also invalidates `journalKeys.insightsAll`.
  - Mocks: `analysedEntries(language: string | null): AnalysedEntry[]` and `interface AnalysedEntry { entry; analysis }` in `db.ts`; `parseLanguage(params): string | null | Response` in `responses.ts`; `computeInsights(analysed: AnalysedEntry[]): InsightsOut` in `insights.ts`; handler `GET insights` honouring `?mock=slow|error|empty`.
  - Seeded mock numbers later tasks assert: all languages → 11 entries, `trends`, summary `["6 errors across 11 entries — 7.6 per 100 words.", "Overall, your error rate is steady (8.8 → 7.7 per 100 words).", "Verb conjugation is getting worse (2.9 → 5.1 per 100 words).", "Article is improving (2.9 → 0.0 per 100 words)."]`; `es` → 8 entries with "Verb conjugation keeps recurring: 3 of your last 5 entries."; `fr` → `totals_only`, 0 errors, `["0 errors across 3 entries — 0.0 per 100 words.", "Trends start at 4 entries with feedback."]`; `de` → `insufficient_data`, "— 3 to go."

- [ ] **Step 1: Write the failing mock-insights tests**

`frontend/src/mocks/insights.test.ts`:
```ts
import { isHTTPError } from 'ky'
import { describe, expect, it } from 'vitest'
import type { InsightsOut } from '@/types/insights'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { failedAnalysis } from './analyzer'
import { addAnalysis, analysedEntries, findEntry } from './db'
import { computeInsights } from './insights'
import { SEEDED } from './seed'

const insightsFor = (language: string | null) => computeInsights(analysedEntries(language))

describe('mock insights', () => {
  it('reports trends across every language from the seeded entries', () => {
    // Arrange
    const language = null
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'trends', entry_count: 11, total_errors: 6, earlier_rate: 8.8, recent_rate: 7.7, trend: 'stable' })
    expect(insights.summary).toEqual([
      '6 errors across 11 entries — 7.6 per 100 words.',
      'Overall, your error rate is steady (8.8 → 7.7 per 100 words).',
      'Verb conjugation is getting worse (2.9 → 5.1 per 100 words).',
      'Article is improving (2.9 → 0.0 per 100 words).',
    ])
  })

  it('finds a recurring category within one language', () => {
    // Arrange
    const language = 'es'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights.summary).toEqual([
      '6 errors across 8 entries — 9.8 per 100 words.',
      'Overall, your error rate is getting worse (3.8 → 14.3 per 100 words).',
      'Verb conjugation is getting worse (0.0 → 8.6 per 100 words).',
      'Gender agreement is improving (3.8 → 2.9 per 100 words).',
      'Article is getting worse (0.0 → 2.9 per 100 words).',
      'Verb conjugation keeps recurring: 3 of your last 5 entries.',
    ])
    expect(insights.categories[0]).toMatchObject({ category: 'verb_conjugation', recurring: true, latest_example: { original: 'yo es', correction: 'yo soy' } })
  })

  it('gives totals only for three entries, counting the revised entry’s latest feedback', () => {
    // Arrange
    const language = 'fr'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'totals_only', entry_count: 3, total_errors: 0, categories: [], trend: null })
    expect(insights.points).toHaveLength(3)
    expect(insights.summary).toEqual(['0 errors across 3 entries — 0.0 per 100 words.', 'Trends start at 4 entries with feedback.'])
  })

  it('says how many entries are still needed below three', () => {
    // Arrange
    const language = 'de'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'insufficient_data', entry_count: 0, points: [], categories: [] })
    expect(insights.summary).toEqual(['Insights start after 3 entries with feedback — 3 to go.'])
  })

  it('keeps an entry’s last good feedback when a newer analysis failed', () => {
    // Arrange
    addAnalysis(failedAnalysis(SEEDED.emoji, findEntry(SEEDED.emoji)?.text ?? '', '2026-10-10T00:00:00.000Z'))
    // Act
    const insights = insightsFor('es')
    // Assert
    expect(insights).toMatchObject({ entry_count: 8, total_errors: 6 })
  })

  it('serves insights over the API and rejects an unsupported language like the backend', async () => {
    // Arrange
    const searchParams = { language: 'xx' }
    // Act
    const french = await client.get(ENDPOINTS.insights, { searchParams: { language: 'fr' } }).json<InsightsOut>()
    const rejected = await client.get(ENDPOINTS.insights, { searchParams }).catch((error: unknown) => error)
    // Assert
    expect(french.status).toBe('totals_only')
    expect(isHTTPError(rejected) && rejected.response.status).toBe(422)
  })
})
```
The expected numbers were worked out by hand from `src/mocks/seed.ts` (succeeded latest analyses only: `failed`, `unanalysed` and `interrupted` drop out; `revisedFrench` counts its revised, error-free analysis) and match what the backend rules give for the same entries.

- [ ] **Step 2: Write the failing hook tests**

Append inside the `describe` of `frontend/src/hooks/queries/queries.test.tsx` (and add `import { useInsightsQuery } from './useInsightsQuery'` after the `useEntryQuery` import):
```tsx
  it('loads insights for one language', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useInsightsQuery('fr'))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data).toMatchObject({ status: 'totals_only', entry_count: 3 })
  })
```

Append inside the `describe` of `frontend/src/hooks/mutations/mutations.test.tsx` (and add `import { useInsightsQuery } from '@/hooks/queries/useInsightsQuery'` after the `useEntryQuery` import):
```tsx
  it('running an analysis refreshes insights, which are otherwise cached', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => ({ insights: useInsightsQuery('es'), analyze: useRunAnalysisMutation() }))
    await waitFor(() => expect(result.current.insights.data?.entry_count).toBe(8))
    // Act
    await act(() => result.current.analyze.mutateAsync(SEEDED.unanalysed))
    // Assert
    await waitFor(() => expect(result.current.insights.data?.entry_count).toBe(9))
  })
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm -C frontend exec vitest run src/mocks/insights.test.ts src/hooks`
Expected: FAIL — `Failed to resolve import "./insights"` / `"./useInsightsQuery"`.

- [ ] **Step 4: Types, endpoint, keys, query hook, invalidation**

`frontend/src/types/insights.ts`:
```ts
import type { Category } from './analysis'

// Mirrors backend/app/api/schemas/insights.py.
export type InsightsStatus = 'insufficient_data' | 'totals_only' | 'trends'
export type Trend = 'improving' | 'stable' | 'worsening'

export interface RatePointOut {
  entry_id: string
  created_at: string
  word_count: number
  error_count: number
  rate: number | null
}

export interface CategoryInsightOut {
  category: Category
  occurrences: number
  recent_entries: number
  recurring: boolean
  earlier_rate: number | null
  recent_rate: number | null
  trend: Trend | null
  latest_example: { original: string; correction: string }
}

export interface InsightsOut {
  status: InsightsStatus
  entry_count: number
  total_words: number
  total_errors: number
  error_rate: number | null
  earlier_rate: number | null
  recent_rate: number | null
  trend: Trend | null
  recurring_window: number
  points: RatePointOut[]
  categories: CategoryInsightOut[]
  summary: string[]
}
```

`frontend/src/utils/endpoints.ts`:
```ts
// One map of API paths — never inline URLs in hooks. No leading slash, so each path extends API_BASE.
export const ENDPOINTS = {
  languages: 'languages',
  entries: 'entries',
  entry: (id: string) => `entries/${id}`,
  analyses: (entryId: string) => `entries/${entryId}/analyses`,
  insights: 'insights',
} as const
```

`frontend/src/hooks/queries/journalKeys.ts`:
```ts
// Query-key factory shared by queries and mutations. `entry(id)` prefixes `analyses(id)`, and `insightsAll` prefixes
// every `insights(language)`, so one invalidation covers each family.
export const journalKeys = {
  languages: ['languages'] as const,
  entryLists: ['entries', 'list'] as const,
  entryList: (language: string | null) => ['entries', 'list', { language }] as const,
  entry: (id: string) => ['entries', 'detail', id] as const,
  analyses: (id: string) => ['entries', 'detail', id, 'analyses'] as const,
  insightsAll: ['insights'] as const,
  insights: (language: string | null) => ['insights', { language }] as const,
}
```

`frontend/src/hooks/queries/useInsightsQuery.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import type { InsightsOut } from '@/types/insights'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useInsightsQuery(language: string | null) {
  return useQuery({
    queryKey: journalKeys.insights(language),
    queryFn: () => client.get(ENDPOINTS.insights, { searchParams: language ? { language } : {} }).json<InsightsOut>(),
  })
}
```

In `frontend/src/hooks/mutations/useRunAnalysisMutation.ts`, after the line `void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })`, add:
```ts
      // Any new analysis can move every insights view, filtered or not.
      void queryClient.invalidateQueries({ queryKey: journalKeys.insightsAll })
```

- [ ] **Step 5: In-memory insights**

In `frontend/src/mocks/db.ts`, insert before `export function createEntry(`:
```ts
export interface AnalysedEntry {
  entry: EntryOut
  analysis: AnalysisOut
}

// Like the backend: each entry's newest succeeded analysis, even when a later attempt failed or never finished.
export function analysedEntries(language: string | null): AnalysedEntry[] {
  return store.entries
    .filter((entry) => !language || entry.language === language)
    .flatMap((entry) => {
      const analysis = analysesOf(entry.id).find((item) => item.status === 'succeeded')
      return analysis ? [{ entry, analysis }] : []
    })
}

```

In `frontend/src/mocks/responses.ts`, replace `parseListQuery` with:
```ts
// Mirrors the backend's supported-language check on `?language=`.
export function parseLanguage(params: URLSearchParams): string | null | Response {
  const language = params.get('language')
  if (language !== null && !LANGUAGES.some((item) => item.code === language)) {
    return invalidParam('query', 'language', 'Unsupported language')
  }
  return language
}

// Mirrors the backend's Query(ge=1, le=50) and supported-language check.
export function parseListQuery(params: URLSearchParams): ListQuery {
  const rawLimit = params.get('limit') ?? '20'
  const limit = /^[+-]?\d+$/u.test(rawLimit) ? Number(rawLimit) : Number.NaN
  if (!(limit >= 1 && limit <= 50)) return invalidParam('query', 'limit', 'limit must be an integer between 1 and 50')
  const language = parseLanguage(params)
  if (language instanceof Response) return language
  return { language, cursor: params.get('cursor'), limit }
}
```

`frontend/src/mocks/insights.ts`:
```ts
import { categoryLabel } from '@/features/feedback/labels'
import type { Category } from '@/types/analysis'
import type { CategoryInsightOut, InsightsOut, InsightsStatus, RatePointOut, Trend } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { countWords } from '@/utils/text'
import type { AnalysedEntry } from './db'

// A port of backend/app/services/insights/{calculations,summary}.py, so dev, tests and e2e see the numbers the
// real API would send for the same entries. Change both together.
const MIN_ENTRIES = 3
const MIN_ENTRIES_FOR_TRENDS = 4
const WINDOW_CAP = 5
const RECURRING_WINDOW = 5
const RECURRING_MIN = 3
const TREND_FLOOR = 0.5
const TREND_SHARE = 0.25

interface Counted {
  id: string
  createdAt: string
  words: number
  errors: Map<Category, { count: number; original: string; correction: string }>
}

type Windows = readonly [earlier: Counted[], recent: Counted[]]
type Body = Omit<InsightsOut, 'summary'>

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const errorsIn = (item: Counted, category?: Category) =>
  category ? (item.errors.get(category)?.count ?? 0) : sum([...item.errors.values()].map((error) => error.count))
const rate = (errors: number, words: number) => (words > 0 ? (errors * 100) / words : null)
const pooled = (items: Counted[], category?: Category) =>
  rate(sum(items.map((item) => errorsIn(item, category))), sum(items.map((item) => item.words)))
const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10)

function toCounted({ entry, analysis }: AnalysedEntry): Counted {
  const errors: Counted['errors'] = new Map()
  for (const mistake of analysis.mistakes.filter((item) => item.kind === 'error')) {
    const previous = errors.get(mistake.category)
    const first = { count: 1, original: mistake.original, correction: mistake.correction }
    errors.set(mistake.category, previous ? { ...previous, count: previous.count + 1 } : first)
  }
  return { id: entry.id, createdAt: entry.created_at, words: countWords(analysis.input_text), errors }
}

function splitWindows(items: Counted[]): Windows {
  const recentSize = Math.min(Math.ceil(items.length / 2), WINDOW_CAP)
  const earlierSize = Math.min(Math.floor(items.length / 2), WINDOW_CAP)
  const start = items.length - recentSize
  return [items.slice(start - earlierSize, start), items.slice(start)]
}

function classifyTrend(earlier: number | null, recent: number | null): Trend | null {
  if (earlier === null || recent === null) return null
  const threshold = Math.max(TREND_FLOOR, TREND_SHARE * earlier)
  if (recent - earlier <= -threshold) return 'improving'
  return recent - earlier >= threshold ? 'worsening' : 'stable'
}

function statusOf(count: number): InsightsStatus {
  if (count < MIN_ENTRIES) return 'insufficient_data'
  return count < MIN_ENTRIES_FOR_TRENDS ? 'totals_only' : 'trends'
}

const windowRates = (windows: Windows | null, category?: Category) =>
  windows ? ([pooled(windows[0], category), pooled(windows[1], category)] as const) : ([null, null] as const)

function categoryInsight(category: Category, items: Counted[], windows: Windows | null): CategoryInsightOut {
  const recentEntries = items.slice(-RECURRING_WINDOW).filter((item) => item.errors.has(category)).length
  const [earlier, recent] = windowRates(windows, category)
  const latest = items.findLast((item) => item.errors.has(category))?.errors.get(category)
  return {
    category,
    occurrences: sum(items.map((item) => errorsIn(item, category))),
    recent_entries: recentEntries,
    recurring: recentEntries >= RECURRING_MIN,
    earlier_rate: round(earlier),
    recent_rate: round(recent),
    trend: classifyTrend(earlier, recent),
    latest_example: { original: latest?.original ?? '', correction: latest?.correction ?? '' },
  }
}

function categoriesOf(items: Counted[], windows: Windows | null): CategoryInsightOut[] {
  const seen = new Set(items.flatMap((item) => [...item.errors.keys()]))
  // Most frequent first, then by category code — the backend's order exactly.
  return [...seen]
    .map((category) => categoryInsight(category, items, windows))
    .sort((a, b) => b.occurrences - a.occurrences || (a.category < b.category ? -1 : 1))
}

const toPoint = (item: Counted): RatePointOut => ({
  entry_id: item.id,
  created_at: item.createdAt,
  word_count: item.words,
  error_count: errorsIn(item),
  rate: round(rate(errorsIn(item), item.words)),
})

const PHRASES: Record<Trend, string> = { improving: 'is improving', stable: 'is steady', worsening: 'is getting worse' }

function trendSentence(subject: string, trend: Trend | null, earlier: number | null, recent: number | null): string[] {
  if (trend === null || earlier === null || recent === null) return []
  return [`${subject} ${PHRASES[trend]} (${earlier.toFixed(1)} → ${recent.toFixed(1)} per 100 words).`]
}

function summarise(body: Body): string[] {
  if (body.status === 'insufficient_data') {
    return [`Insights start after ${MIN_ENTRIES} entries with feedback — ${MIN_ENTRIES - body.entry_count} to go.`]
  }
  const perHundred = body.error_rate === null ? '' : ` — ${body.error_rate.toFixed(1)} per 100 words`
  const moving = body.categories.filter((item) => item.trend !== 'stable')
  return [
    `${pluralize(body.total_errors, 'error')} across ${body.entry_count} entries${perHundred}.`,
    ...trendSentence('Overall, your error rate', body.trend, body.earlier_rate, body.recent_rate),
    ...moving.flatMap((item) => trendSentence(categoryLabel(item.category), item.trend, item.earlier_rate, item.recent_rate)),
    ...body.categories
      .filter((item) => item.recurring)
      .map((item) => `${categoryLabel(item.category)} keeps recurring: ${item.recent_entries} of your last ${body.recurring_window} entries.`),
    ...(body.status === 'totals_only' ? [`Trends start at ${MIN_ENTRIES_FOR_TRENDS} entries with feedback.`] : []),
  ]
}

export function computeInsights(analysed: AnalysedEntry[]): InsightsOut {
  const items = analysed.map(toCounted).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const status = statusOf(items.length)
  const windows = status === 'trends' ? splitWindows(items) : null
  const computed = status !== 'insufficient_data'
  const [earlier, recent] = windowRates(windows)
  const body: Body = {
    status,
    entry_count: items.length,
    total_words: sum(items.map((item) => item.words)),
    total_errors: sum(items.map((item) => errorsIn(item))),
    error_rate: computed ? round(pooled(items)) : null,
    earlier_rate: round(earlier),
    recent_rate: round(recent),
    trend: classifyTrend(earlier, recent),
    recurring_window: Math.min(items.length, RECURRING_WINDOW),
    points: computed ? items.map(toPoint) : [],
    categories: computed ? categoriesOf(items, windows) : [],
  }
  return { ...body, summary: summarise(body) }
}
```

In `frontend/src/mocks/handlers.ts`:
- replace the `./db` import with `import { addAnalysis, analysedEntries, analysesOf, createEntry, entryDetail, findEntry, listEntries, updateEntry } from './db'` and add `import { computeInsights } from './insights'` below it;
- add `parseLanguage` to the `./responses` import list (between `notFound` and `parseListQuery`);
- add before `export const handlers = [`:
```ts
function insights(requestUrl: string): Response {
  const language = parseLanguage(new URL(requestUrl).searchParams)
  if (language instanceof Response) return language
  return HttpResponse.json(computeInsights(mockMode() === 'empty' ? [] : analysedEntries(language)))
}

```
- add as the last array element:
```ts
  http.get(url(ENDPOINTS.insights), async ({ request }) => (await forcedResponse()) ?? insights(request.url)),
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm -C frontend exec vitest run src/mocks src/hooks`
Expected: all pass, including the 6 new mock tests and the 2 new hook tests. Check the invalidation test bites: temporarily remove the new `invalidateQueries` line — `running an analysis refreshes insights…` must fail — then restore it.

- [ ] **Step 7: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/insights.ts frontend/src/utils/endpoints.ts frontend/src/hooks/queries/journalKeys.ts \
  frontend/src/hooks/queries/useInsightsQuery.ts frontend/src/hooks/mutations/useRunAnalysisMutation.ts \
  frontend/src/mocks/db.ts frontend/src/mocks/responses.ts frontend/src/mocks/handlers.ts frontend/src/mocks/insights.ts \
  frontend/src/mocks/insights.test.ts frontend/src/hooks/queries/queries.test.tsx frontend/src/hooks/mutations/mutations.test.tsx
git commit -m "feat(frontend): insights query, refresh after analysis and an in-memory insights API"
```

---

### Task 4: Shared URL language filter with one retry; name the missing-entry page

Folds both P3 carry-overs: `/entries?mock=error` showed two "Try again" boxes (the language list and the entry list both failing), and a missing entry's page heading read "Entry".

**Files:**
- Create: `frontend/src/features/languages/useLanguageFilter.ts`, `frontend/src/features/languages/LanguageFiltered.tsx`
- Modify: `frontend/src/features/history/HistoryList.tsx`, `frontend/src/features/entry-detail/EntryDetail.tsx`, `frontend/src/pages/EntryDetailPage.tsx`
- Test: `frontend/src/features/history/HistoryList.test.tsx`, `frontend/src/features/entry-detail/EntryDetail.test.tsx`

**Interfaces:**
- Consumes: `useLanguagesQuery`, `LanguageSelect`, `LoadingState`, `PageHeading`; existing `FilteredHistory`, `EntryNotFound`, `isMissing`, `useEntryQuery`, `useAnalysesQuery`; helpers `setMockMode`, `clearMockMode`.
- Produces:
  - `useLanguageFilter(): { language: string | null; state: 'pending' | 'failed' | 'ready'; changeLanguage(code: string): void }` — URL-owned, drops codes the server does not offer.
  - `<LanguageFiltered id loadingLabel>{(language) => ReactNode}</LanguageFiltered>` — renders the language select, then results only when `ready`, a `LoadingState` while `pending`, nothing extra when `failed`.
  - `EntryDetail` renders the page `<title>` and `<h1>` itself: "Entry" or "Entry not found".

- [ ] **Step 1: Write the failing tests**

In `frontend/src/features/history/HistoryList.test.tsx`, add `clearMockMode` to the `@/test/helpers` import and add before the "keeps the loaded entries…" test:
```tsx
  it('shows a single retry when the languages cannot load either', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderHistory()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    clearMockMode()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
  })
```
(`findByRole`/`getByRole` throw on a second alert or button; the `status` check fails on the old code, which renders "Loading entries…" beside the alert.)

In `frontend/src/features/entry-detail/EntryDetail.test.tsx`, add before the `it.each([['a missing entry', …` block:
```tsx
  it('names the page for what happened when the entry is missing', async () => {
    // Arrange + Act
    renderDetail('ffffffff-ffff-4fff-8fff-ffffffffffff')
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Entry not found · Language Journal'))
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -C frontend exec vitest run src/features/history/HistoryList.test.tsx src/features/entry-detail/EntryDetail.test.tsx`
Expected: 2 failures — a `status` element is present; no level-1 heading "Entry not found".

- [ ] **Step 3: The shared filter**

`frontend/src/features/languages/useLanguageFilter.ts`:
```ts
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

type LanguageFilterState = 'pending' | 'failed' | 'ready'

function stateOf(failed: boolean, settled: boolean): LanguageFilterState {
  if (failed) return 'failed'
  return settled ? 'ready' : 'pending'
}

// The filter lives in the URL so Back and shared links keep it; a code the server does not offer is not a filter.
export function useLanguageFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const languages = useLanguagesQuery()
  const requested = searchParams.get('language')
  const known = languages.data?.some((language) => language.code === requested) ?? false
  const staleParam = languages.isSuccess && requested !== null && !known

  useEffect(() => {
    if (staleParam) setSearchParams({}, { replace: true })
  }, [staleParam, setSearchParams])

  return {
    language: known ? requested : null,
    // "ready" waits for the language list, so an unknown code never reaches the API.
    state: stateOf(languages.isError, languages.isSuccess && !staleParam),
    changeLanguage: (code: string) => setSearchParams(code ? { language: code } : {}),
  }
}
```

`frontend/src/features/languages/LanguageFiltered.tsx`:
```tsx
import type { ReactNode } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { LanguageSelect } from './LanguageSelect'
import { useLanguageFilter } from './useLanguageFilter'

export interface LanguageFilteredProps {
  id: string
  loadingLabel: string
  children: (language: string | null) => ReactNode
}

// When the language list fails, LanguageSelect owns the only error and retry: results that fail beside it
// would put a second "Try again" on the same screen.
export function LanguageFiltered({ id, loadingLabel, children }: LanguageFilteredProps) {
  const filter = useLanguageFilter()
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <LanguageSelect id={id} label="Language" value={filter.language ?? ''} onChange={filter.changeLanguage} allLabel="All languages" />
      </div>
      {filter.state === 'ready' && children(filter.language)}
      {filter.state === 'pending' && <LoadingState label={loadingLabel} />}
    </div>
  )
}
```

`frontend/src/features/history/HistoryList.tsx`:
```tsx
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { FilteredHistory } from './FilteredHistory'

export function HistoryList() {
  return (
    <LanguageFiltered id="history-language" loadingLabel="Loading entries…">
      {(language) => <FilteredHistory language={language} />}
    </LanguageFiltered>
  )
}
```

- [ ] **Step 4: The missing-entry heading**

`frontend/src/features/entry-detail/EntryDetail.tsx`:
```tsx
import { useState } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeading } from '@/components/ui/PageHeading'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryNotFound } from './EntryNotFound'
import { isMissing } from './isMissing'
import { AnalysisSwitcher } from './AnalysisSwitcher'
import { DetailAnalysis } from './DetailAnalysis'
import { EntryHeader } from './EntryHeader'

export interface EntryDetailProps {
  entryId: string
}

interface EntryDetailBodyProps {
  entry: ReturnType<typeof useEntryQuery>
  analyses: ReturnType<typeof useAnalysesQuery>
}

function EntryDetailReady({ entry, analyses }: { entry: EntryDetailOut; analyses: AnalysisOut[] }) {
  // null means "the newest", so a new analysis is selected as soon as it lands in the cache.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = analyses.find((analysis) => analysis.id === selectedId) ?? analyses[0] ?? null
  return (
    <div className="flex flex-col gap-6">
      <EntryHeader entry={entry} />
      {analyses.length > 1 && <AnalysisSwitcher analyses={analyses} value={selected?.id ?? ''} onChange={setSelectedId} />}
      <DetailAnalysis key={selected?.id ?? 'none'} entry={entry} analysis={selected} onNewAnalysis={() => setSelectedId(null)} />
    </div>
  )
}

function EntryDetailBody({ entry, analyses }: EntryDetailBodyProps) {
  // Cached data outranks a failed background refresh: only a first load with nothing to show is an error screen.
  if (entry.isError && !entry.data) {
    return <ErrorState message={toErrorMessage(entry.error)} onRetry={() => void entry.refetch()} />
  }
  if (analyses.isError && !analyses.data) {
    return <ErrorState message={toErrorMessage(analyses.error)} onRetry={() => void analyses.refetch()} />
  }
  if (!entry.data || !analyses.data) return <LoadingState label="Loading entry…" />
  return <EntryDetailReady entry={entry.data} analyses={analyses.data} />
}

export function EntryDetail({ entryId }: EntryDetailProps) {
  const entry = useEntryQuery(entryId)
  const analyses = useAnalysesQuery(entryId)
  const missing = entry.isError && !entry.data && isMissing(entry.error)
  const title = missing ? 'Entry not found' : 'Entry'
  // One heading element in every state: the route change focused it, and swapping it would drop that focus.
  return (
    <div className="flex flex-col gap-6">
      <title>{`${title} · Language Journal`}</title>
      <PageHeading>{title}</PageHeading>
      {missing ? <EntryNotFound /> : <EntryDetailBody entry={entry} analyses={analyses} />}
    </div>
  )
}
```

`frontend/src/pages/EntryDetailPage.tsx`:
```tsx
import { useParams } from 'react-router'
import { EntryDetail } from '@/features/entry-detail/EntryDetail'

export function EntryDetailPage() {
  const { entryId = '' } = useParams()
  return <EntryDetail key={entryId} entryId={entryId} />
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm -C frontend exec vitest run src/features src/AppRoutes.test.tsx`
Expected: all pass (existing History, Detail and route tests unchanged).

- [ ] **Step 6: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` (the e2e "an unknown entry offers the way back" still passes: focus lands on the same `h1`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/languages/useLanguageFilter.ts frontend/src/features/languages/LanguageFiltered.tsx \
  frontend/src/features/history/HistoryList.tsx frontend/src/features/history/HistoryList.test.tsx \
  frontend/src/features/entry-detail/EntryDetail.tsx frontend/src/features/entry-detail/EntryDetail.test.tsx \
  frontend/src/pages/EntryDetailPage.tsx
git commit -m "fix(frontend): one retry when languages fail, and a missing entry's page says so"
```

---

### Task 5: The Insights screen

**Files:**
- Create: `frontend/src/features/insights/{format.ts,chartGeometry.ts,RateTable.tsx,RateChart.tsx,TrendCells.tsx,CategoryTable.tsx,InsightsReport.tsx,InsightsResults.tsx,InsightsScreen.tsx}`, `frontend/src/pages/InsightsPage.tsx`, `frontend/e2e/insights.spec.ts`
- Modify: `frontend/src/AppRoutes.tsx`, `frontend/src/features/shell/AppShell.tsx`, `frontend/src/utils/formatter.ts`, `frontend/DESIGN.md`
- Test: `frontend/src/features/insights/{chartGeometry.test.ts,format.test.ts,RateChart.test.tsx,CategoryTable.test.tsx,InsightsScreen.test.tsx}`, `frontend/src/AppRoutes.test.tsx`, `frontend/src/utils/formatter.test.ts`

**Interfaces:**
- Consumes: Task 3 (`useInsightsQuery`, `InsightsOut`, `RatePointOut`, `CategoryInsightOut`, `Trend`, seeded mock numbers); Task 4 (`LanguageFiltered`); primitives `Badge` (+ `BadgeProps`), `EmptyState`, `ErrorState`, `LoadingState`, `TextLink`, `PageHeading`; `Correction` (`@/features/feedback/Correction`, renders `original → should be correction`), `categoryLabel`; `pluralize`, `formatDateTime`, `toErrorMessage`, `cn`.
- Produces: route `/insights` (title "Insights · Language Journal"), nav item "Insights"; `formatDate(iso): string`; `InsightsScreen`, `InsightsResults({ language })`, `InsightsReport({ insights })`, `RateChart({ points, trend })`, `RateTable({ points })`, `CategoryTable({ categories, recurringWindow })`, `RateChange`, `TrendBadge`; `CHART`, `plotRates`, `polylinePoints`, `highestRate`; `formatRate`, `describeRates`, `TREND_TEXT`.

- [ ] **Step 1: Write the failing unit and component tests**

`frontend/src/features/insights/chartGeometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { CHART, highestRate, plotRates, polylinePoints } from './chartGeometry'

const points = (...rates: (number | null)[]): RatePointOut[] =>
  rates.map((rate, index) => ({ entry_id: `e${index}`, created_at: '2026-10-09T18:00:00Z', word_count: 10, error_count: 1, rate }))

describe('chart geometry', () => {
  it('spaces entries evenly and puts the highest rate at the top', () => {
    // Arrange
    const rates = points(0, 5, 10)
    // Act
    const plotted = plotRates(rates)
    // Assert
    expect(plotted.map(({ x, y }) => [x, y])).toEqual([
      [CHART.inset, 192],
      [320, 100],
      [CHART.width - CHART.inset, CHART.inset],
    ])
  })

  it('keeps an all-zero line on the baseline instead of dividing by zero', () => {
    // Arrange
    const rates = points(0, 0, 0)
    // Act
    const line = polylinePoints(plotRates(rates))
    // Assert
    expect(line).toBe('8,192 320,192 632,192')
  })

  it('leaves a gap for an entry without a rate but keeps the others in place', () => {
    // Arrange
    const rates = points(1, null, 2)
    // Act
    const plotted = plotRates(rates)
    // Assert
    expect(plotted.map((point) => [point.id, point.x])).toEqual([
      ['e0', 8],
      ['e2', 632],
    ])
  })

  it('centres a single entry', () => {
    // Arrange
    const rates = points(3)
    // Act
    const [only] = plotRates(rates)
    // Assert
    expect(only?.x).toBe(CHART.width / 2)
  })

  it('reports the highest rate, or zero when nothing was measured', () => {
    // Arrange
    const measured = points(1.5, 4.2, null)
    // Act + Assert
    expect(highestRate(measured)).toBe(4.2)
    expect(highestRate(points(null))).toBe(0)
  })
})
```

`frontend/src/features/insights/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { describeRates, formatRate } from './format'

const point = (rate: number | null): RatePointOut => ({ entry_id: String(rate), created_at: '2026-10-09T18:00:00Z', word_count: 10, error_count: 1, rate })

describe('insights formatting', () => {
  it.each([
    [2, '2.0'],
    [14.3, '14.3'],
    [null, '—'],
  ])('shows the rate %s as "%s"', (rate, expected) => {
    // Arrange + Act
    const text = formatRate(rate)
    // Assert
    expect(text).toBe(expected)
  })

  it('describes the line in words, with the overall trend when there is one', () => {
    // Arrange
    const points = [point(1.5), point(0), point(3)]
    // Act
    const description = describeRates(points, 'improving')
    // Assert
    expect(description).toBe('Errors per 100 words across 3 entries, oldest to newest: lowest 0.0, highest 3.0, latest 3.0. Overall: improving.')
  })

  it('says when no entry had words to measure', () => {
    // Arrange
    const points = [point(null)]
    // Act
    const description = describeRates(points, null)
    // Assert
    expect(description).toBe('Errors per 100 words across 1 entry, oldest to newest: no words to measure.')
  })
})
```

`frontend/src/features/insights/RateChart.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { RateChart } from './RateChart'

const points: RatePointOut[] = [
  { entry_id: 'a', created_at: '2026-10-01T09:00:00Z', word_count: 10, error_count: 2, rate: 20 },
  { entry_id: 'b', created_at: '2026-10-02T09:00:00Z', word_count: 8, error_count: 0, rate: 0 },
  { entry_id: 'c', created_at: '2026-10-03T09:00:00Z', word_count: 0, error_count: 0, rate: null },
]

describe('RateChart', () => {
  it('is one image whose name summarises the line and its trend', () => {
    // Arrange + Act
    render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Errors per 100 words across 3 entries, oldest to newest: lowest 0.0, highest 20.0, latest 0.0. Overall: improving.',
    )
  })

  it('lists every entry’s numbers in a table for screen readers', () => {
    // Arrange + Act
    render(<RateChart points={points} trend={null} />)
    // Assert
    const table = screen.getByRole('table', { name: 'Errors per 100 words for each entry' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('—')
  })
})
```

`frontend/src/features/insights/CategoryTable.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CategoryInsightOut } from '@/types/insights'
import { CategoryTable } from './CategoryTable'

const verbs: CategoryInsightOut = {
  category: 'verb_conjugation',
  occurrences: 3,
  recent_entries: 3,
  recurring: true,
  earlier_rate: 0,
  recent_rate: 8.6,
  trend: 'worsening',
  latest_example: { original: 'yo es', correction: 'yo soy' },
}
const articles: CategoryInsightOut = { ...verbs, category: 'article', occurrences: 1, recent_entries: 1, recurring: false, trend: 'improving' }

describe('CategoryTable', () => {
  it('shows the rate change, a worded trend and the latest example for each category', () => {
    // Arrange + Act
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} />)
    // Assert
    const row = screen.getByRole('row', { name: /Verb conjugation/ })
    expect(row).toHaveTextContent(/0\.0 →\s?to 8\.6/)
    expect(row).toHaveTextContent('Getting worse')
    expect(row).toHaveTextContent(/yo es →\s?should be yo soy/)
    expect(screen.getByRole('row', { name: /Article/ })).toHaveTextContent('Improving')
  })

  it('marks only recurring categories, with how often they appeared', () => {
    // Arrange + Act
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} />)
    // Assert
    expect(screen.getByText('Recurring · 3 of last 5')).toBeInTheDocument()
    expect(screen.getAllByText(/^Recurring/)).toHaveLength(1)
  })

  it('says there is no trend yet instead of showing blank cells', () => {
    // Arrange
    const early = { ...verbs, earlier_rate: null, recent_rate: null, trend: null }
    // Act
    render(<CategoryTable categories={[early]} recurringWindow={3} />)
    // Assert
    expect(screen.getAllByText('Not enough entries yet')).toHaveLength(2)
  })
})
```

`frontend/src/features/insights/InsightsScreen.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { clearMockMode, failWith, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { InsightsScreen } from './InsightsScreen'

const renderInsights = (route = '/insights') => renderWithProviders(<InsightsScreen />, { route })
const summary = async () => within(await screen.findByRole('region', { name: 'Summary' })).getAllByRole('listitem')

describe('InsightsScreen', () => {
  it('shows a loading state, then the summary, chart and categories for every language', async () => {
    // Arrange + Act
    renderInsights()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading insights…')
    expect((await summary())[0]).toHaveTextContent('6 errors across 11 entries — 7.6 per 100 words.')
    expect(screen.getByRole('img', { name: /across 11 entries/ })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Errors by category' })).toBeInTheDocument()
  })

  it('narrows to one language from the filter', async () => {
    // Arrange
    const user = userEvent.setup()
    renderInsights()
    await waitForLanguages()
    // Act
    await user.selectOptions(screen.getByLabelText('Language'), 'es')
    // Assert
    expect(await screen.findByText('Verb conjugation keeps recurring: 3 of your last 5 entries.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Verb conjugation/ })).toHaveTextContent('Recurring · 3 of last 5')
  })

  it('explains that trends need a fourth entry and that there is nothing to break down', async () => {
    // Arrange + Act
    renderInsights('/insights?language=fr')
    // Assert
    expect(await screen.findByText('Trends start at 4 entries with feedback.')).toBeInTheDocument()
    expect(screen.getByText('No errors in these entries — nothing to work on yet.')).toBeInTheDocument()
  })

  it.each([
    ['fewer than three entries', '/insights?language=de', ''],
    ['no entries at all', '/insights', 'empty'],
  ])('shows an empty state with a way to write for %s', async (_label, route, mode) => {
    // Arrange
    if (mode) setMockMode(mode)
    // Act
    renderInsights(route)
    // Assert
    expect(await screen.findByText('Not enough entries yet')).toBeInTheDocument()
    expect(screen.getByText('Insights start after 3 entries with feedback — 3 to go.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write an entry' })).toHaveAttribute('href', '/')
  })

  it('offers a retry when insights cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.insights)
    const user = userEvent.setup()
    renderInsights()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await summary()).not.toHaveLength(0)
  })

  it('shows a single retry when the languages cannot load either', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderInsights()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    clearMockMode()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await summary()).not.toHaveLength(0)
  })

  it('ignores a language code the server does not offer', async () => {
    // Arrange + Act
    renderInsights('/insights?language=xx')
    // Assert
    expect((await summary())[0]).toHaveTextContent('6 errors across 11 entries')
  })
})
```

In `frontend/src/AppRoutes.test.tsx`, add before the "shows a not-found page…" test:
```tsx
  it('opens Insights at /insights and marks it current in the navigation', () => {
    // Arrange
    const route = '/insights'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page')
  })
```
and add the row `['/insights', 'Insights · Language Journal'],` to the `it.each` title table after the entry-detail row.

In `frontend/src/utils/formatter.test.ts`, import `formatDate` too and append:
```ts
describe('formatDate', () => {
  it('shows a short, readable date without the time', () => {
    // Arrange
    const iso = '2026-10-09T12:00:00Z'
    // Act
    const label = formatDate(iso)
    // Assert
    expect(label).toMatch(/^Oct \d{1,2}, 2026$/)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -C frontend exec vitest run src/features/insights src/AppRoutes.test.tsx src/utils/formatter.test.ts`
Expected: FAIL — unresolved imports (`./chartGeometry`, `./InsightsScreen`, …), no "Insights" heading, `formatDate` not exported.

- [ ] **Step 3: Formatting and geometry**

Append to `frontend/src/utils/formatter.ts`:
```ts

const dateOnly = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}
```

`frontend/src/features/insights/format.ts`:
```ts
import type { RatePointOut, Trend } from '@/types/insights'
import { pluralize } from '@/utils/formatter'

export const TREND_TEXT: Record<Trend, string> = { improving: 'Improving', stable: 'Steady', worsening: 'Getting worse' }

// The API already rounds to one decimal; toFixed only pads "2" to "2.0".
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : rate.toFixed(1)
}

export function describeRates(points: RatePointOut[], trend: Trend | null): string {
  const rates = points.flatMap((point) => (point.rate === null ? [] : [point.rate]))
  const latest = rates.at(-1)
  const range =
    latest === undefined
      ? 'no words to measure'
      : `lowest ${formatRate(Math.min(...rates))}, highest ${formatRate(Math.max(...rates))}, latest ${formatRate(latest)}`
  const overall = trend ? ` Overall: ${TREND_TEXT[trend].toLowerCase()}.` : ''
  return `Errors per 100 words across ${pluralize(points.length, 'entry', 'entries')}, oldest to newest: ${range}.${overall}`
}
```

`frontend/src/features/insights/chartGeometry.ts`:
```ts
import type { RatePointOut } from '@/types/insights'

export const CHART = { width: 640, height: 200, inset: 8 } as const

export interface PlottedPoint {
  id: string
  x: number
  y: number
}

export function highestRate(points: RatePointOut[]): number {
  return Math.max(0, ...points.map((point) => point.rate ?? 0))
}

// Spaced by entry, not by date: the windows count entries, and a week off writing would squash the rest together.
export function plotRates(points: RatePointOut[]): PlottedPoint[] {
  const top = highestRate(points) || 1
  const step = points.length > 1 ? (CHART.width - 2 * CHART.inset) / (points.length - 1) : 0
  const plotHeight = CHART.height - 2 * CHART.inset
  return points.flatMap((point, index) => {
    if (point.rate === null) return []
    const x = points.length > 1 ? CHART.inset + index * step : CHART.width / 2
    return [{ id: point.entry_id, x, y: CHART.height - CHART.inset - (point.rate / top) * plotHeight }]
  })
}

export function polylinePoints(plotted: PlottedPoint[]): string {
  return plotted.map((point) => `${point.x},${point.y}`).join(' ')
}
```

- [ ] **Step 4: Chart, table and cells**

`frontend/src/features/insights/RateTable.tsx`:
```tsx
import type { RatePointOut } from '@/types/insights'
import { formatDateTime } from '@/utils/formatter'
import { formatRate } from './format'

export interface RateTableProps {
  points: RatePointOut[]
}

// The chart's text alternative: hidden visually, read in full by screen readers.
export function RateTable({ points }: RateTableProps) {
  return (
    <table className="sr-only">
      <caption>Errors per 100 words for each entry</caption>
      <thead>
        <tr>
          <th scope="col">Written</th>
          <th scope="col">Words</th>
          <th scope="col">Errors</th>
          <th scope="col">Per 100 words</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.entry_id}>
            <td>{formatDateTime(point.created_at)}</td>
            <td>{point.word_count}</td>
            <td>{point.error_count}</td>
            <td>{formatRate(point.rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

`frontend/src/features/insights/RateChart.tsx`:
```tsx
import type { RatePointOut, Trend } from '@/types/insights'
import { formatDate } from '@/utils/formatter'
import { CHART, highestRate, plotRates, polylinePoints } from './chartGeometry'
import { describeRates, formatRate } from './format'
import { RateTable } from './RateTable'

export interface RateChartProps {
  points: RatePointOut[]
  trend: Trend | null
}

const baseline = CHART.height - CHART.inset

// No chart library (spec §7). The SVG is one labelled image; RateTable carries the numbers for screen readers,
// so the visible axis labels are hidden from them to avoid reading everything twice.
export function RateChart({ points, trend }: RateChartProps) {
  const plotted = plotRates(points)
  const first = points[0]
  const last = points.at(-1)
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-medium">Errors per 100 words, oldest entry to newest</figcaption>
      <p aria-hidden="true" className="text-xs text-muted">
        Highest: {formatRate(highestRate(points))}
      </p>
      <svg role="img" aria-label={describeRates(points, trend)} viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-auto w-full overflow-visible">
        <line x1={CHART.inset} x2={CHART.width - CHART.inset} y1={baseline} y2={baseline} vectorEffect="non-scaling-stroke" className="stroke-border stroke-1" />
        <polyline points={polylinePoints(plotted)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-primary stroke-2" />
        {plotted.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r={5} className="fill-primary" />
        ))}
      </svg>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>{first ? formatDate(first.created_at) : ''}</span>
        <span>{last ? formatDate(last.created_at) : ''}</span>
      </div>
      <RateTable points={points} />
    </figure>
  )
}
```

`frontend/src/features/insights/TrendCells.tsx`:
```tsx
import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { Trend } from '@/types/insights'
import { formatRate, TREND_TEXT } from './format'

const TONES = { improving: 'success', stable: 'neutral', worsening: 'danger' } as const satisfies Record<Trend, BadgeProps['tone']>
const ARROWS: Record<Trend, string> = { improving: '↓', stable: '→', worsening: '↑' }

function NotYet() {
  return (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not enough entries yet</span>
    </span>
  )
}

export function RateChange({ earlier, recent }: { earlier: number | null; recent: number | null }) {
  if (earlier === null || recent === null) return <NotYet />
  return (
    <>
      {formatRate(earlier)} <span aria-hidden="true">→</span>
      <span className="sr-only">to</span> {formatRate(recent)}
    </>
  )
}

// The arrow is decoration: the word carries the meaning for screen readers and for anyone who can't tell the tones apart.
export function TrendBadge({ trend }: { trend: Trend | null }) {
  if (trend === null) return <NotYet />
  return (
    <Badge tone={TONES[trend]}>
      <span aria-hidden="true">{ARROWS[trend]}</span>&nbsp;{TREND_TEXT[trend]}
    </Badge>
  )
}
```

`frontend/src/features/insights/CategoryTable.tsx`:
```tsx
import { Badge } from '@/components/ui/Badge'
import { Correction } from '@/features/feedback/Correction'
import { categoryLabel } from '@/features/feedback/labels'
import type { CategoryInsightOut } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { RateChange, TrendBadge } from './TrendCells'

export interface CategoryTableProps {
  categories: CategoryInsightOut[]
  recurringWindow: number
}

const headClass = 'px-1.5 pb-2 text-left font-medium text-muted md:px-2'
const cellClass = 'border-t border-border px-1.5 py-3 align-top md:px-2'

function CategoryRow({ item, recurringWindow }: { item: CategoryInsightOut; recurringWindow: number }) {
  return (
    <tr>
      <th scope="row" className={cn(cellClass, 'text-left font-medium')}>
        <span className="flex flex-col items-start gap-1">
          {categoryLabel(item.category)}
          <span className="font-normal text-muted">{pluralize(item.occurrences, 'error')}</span>
          {item.recurring && (
            <Badge tone="warning">
              Recurring · {item.recent_entries} of last {recurringWindow}
            </Badge>
          )}
        </span>
      </th>
      <td className={cellClass}>
        <RateChange earlier={item.earlier_rate} recent={item.recent_rate} />
      </td>
      <td className={cellClass}>
        <TrendBadge trend={item.trend} />
      </td>
      <td className={cellClass}>
        <Correction original={item.latest_example.original} correction={item.latest_example.correction} />
      </td>
    </tr>
  )
}

export function CategoryTable({ categories, recurringWindow }: CategoryTableProps) {
  return (
    <table className="w-full text-xs md:text-sm">
      <caption className="pb-2 text-left text-base font-medium">Errors by category</caption>
      <thead>
        <tr>
          <th scope="col" className={headClass}>Category</th>
          <th scope="col" className={headClass}>
            Earlier <span aria-hidden="true">→</span>
            <span className="sr-only">to</span> recent, per 100 words
          </th>
          <th scope="col" className={headClass}>Trend</th>
          <th scope="col" className={headClass}>Latest example</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((item) => (
          <CategoryRow key={item.category} item={item} recurringWindow={recurringWindow} />
        ))}
      </tbody>
    </table>
  )
}
```
Four columns that all wrap (text-xs on mobile) fit 375px without horizontal scroll — verified in the e2e below.

- [ ] **Step 5: Report, results, screen, page, route, nav**

`frontend/src/features/insights/InsightsReport.tsx`:
```tsx
import type { InsightsOut } from '@/types/insights'
import { CategoryTable } from './CategoryTable'
import { RateChart } from './RateChart'

export interface InsightsReportProps {
  insights: InsightsOut
}

export function InsightsReport({ insights }: InsightsReportProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="insights-summary" className="flex flex-col gap-2">
        <h2 id="insights-summary" className="text-lg font-semibold">
          Summary
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {insights.summary.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </section>
      <RateChart points={insights.points} trend={insights.trend} />
      {insights.categories.length > 0 ? (
        <CategoryTable categories={insights.categories} recurringWindow={insights.recurring_window} />
      ) : (
        <p className="text-muted">No errors in these entries — nothing to work on yet.</p>
      )}
    </div>
  )
}
```

`frontend/src/features/insights/InsightsResults.tsx`:
```tsx
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { TextLink } from '@/components/ui/TextLink'
import { useInsightsQuery } from '@/hooks/queries/useInsightsQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { InsightsReport } from './InsightsReport'

export interface InsightsResultsProps {
  language: string | null
}

export function InsightsResults({ language }: InsightsResultsProps) {
  const insights = useInsightsQuery(language)
  const { data } = insights
  // Cached insights outrank a failed background refresh, as in History.
  if (!data) {
    if (insights.isError) return <ErrorState message={toErrorMessage(insights.error)} onRetry={() => void insights.refetch()} />
    return <LoadingState label="Loading insights…" />
  }
  if (data.status === 'insufficient_data') {
    return (
      <EmptyState title="Not enough entries yet">
        <p className="text-sm text-muted">{data.summary[0]}</p>
        <TextLink to="/">Write an entry</TextLink>
      </EmptyState>
    )
  }
  return <InsightsReport insights={data} />
}
```

`frontend/src/features/insights/InsightsScreen.tsx`:
```tsx
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { InsightsResults } from './InsightsResults'

export function InsightsScreen() {
  return (
    <LanguageFiltered id="insights-language" loadingLabel="Loading insights…">
      {(language) => <InsightsResults language={language} />}
    </LanguageFiltered>
  )
}
```

`frontend/src/pages/InsightsPage.tsx`:
```tsx
import { PageHeading } from '@/components/ui/PageHeading'
import { InsightsScreen } from '@/features/insights/InsightsScreen'

export function InsightsPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Insights · Language Journal</title>
      <div className="flex flex-col gap-1">
        <PageHeading>Insights</PageHeading>
        <p className="text-muted">How your errors change as you write. Suggestions and word help don’t count.</p>
      </div>
      <InsightsScreen />
    </div>
  )
}
```

`frontend/src/AppRoutes.tsx`:
```tsx
import { Route, Routes } from 'react-router'
import { AppShell } from '@/features/shell/AppShell'
import { EntryDetailPage } from '@/pages/EntryDetailPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WritePage } from '@/pages/WritePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WritePage />} />
        <Route path="entries" element={<HistoryPage />} />
        <Route path="entries/:entryId" element={<EntryDetailPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
```

In `frontend/src/features/shell/AppShell.tsx`, delete the comment line `// One list so a later phase adds a section (Insights) as one item.` and make `NAV_ITEMS`:
```tsx
const NAV_ITEMS = [
  { to: '/', label: 'Write', end: true },
  { to: '/entries', label: 'History', end: false },
  { to: '/insights', label: 'Insights', end: false },
] as const
```

In `frontend/DESIGN.md` §3 Composition, append:
```markdown

Charts are plain SVG (no chart library): colour-role utilities `stroke-primary`, `fill-primary`, `stroke-border`,
`fill-none`, widths `stroke-1`/`stroke-2`, `vectorEffect="non-scaling-stroke"` on lines. The `<svg>` is
`role="img"` with an `aria-label` that states the numbers in words, and an `sr-only` table carries every value.
```

- [ ] **Step 6: Run the unit and component tests to see them pass**

Run: `pnpm -C frontend exec vitest run`
Expected: all pass (~258 tests).

- [ ] **Step 7: Write the e2e spec**

`frontend/e2e/insights.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const summary = (page: Page) => page.getByRole('region', { name: 'Summary' })
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name })

test('insights summarise every language, chart the rate and break errors down by category', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await nav(page, 'Insights').click()
  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights')
  await expect(summary(page)).toContainText('6 errors across 11 entries — 7.6 per 100 words.')
  await expect(page.getByRole('img', { name: /across 11 entries.*Overall: steady/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Verb conjugation/ })).toContainText('Getting worse')
  await expect(page.getByRole('row', { name: /Article/ })).toContainText('Improving')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
})

test('the language filter narrows insights and below three entries offers a way to write', async ({ page }) => {
  // Arrange
  await page.goto('/insights')
  await expect(summary(page)).toBeVisible()
  // Act
  await page.getByLabel('Language').selectOption('es')
  // Assert
  await expect(page).toHaveURL(/language=es/)
  await expect(summary(page)).toContainText('Verb conjugation keeps recurring: 3 of your last 5 entries.')
  await expect(page.getByRole('row', { name: /Verb conjugation/ })).toContainText('Recurring · 3 of last 5')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
  await page.getByLabel('Language').selectOption('de')
  await expect(page.getByText('Insights start after 3 entries with feedback — 3 to go.')).toBeVisible()
  await expectHealthy(page)
  await page.getByRole('link', { name: 'Write an entry' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
})

test('a new entry with feedback changes insights that were already loaded', async ({ page }) => {
  // Arrange
  await page.goto('/insights?language=fr')
  await expect(summary(page)).toContainText('0 errors across 3 entries')
  await nav(page, 'Write').click()
  // Wait for the new page: the Insights filter is also labelled "Language" until it unmounts.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
  await page.getByLabel('Language').selectOption('fr')
  await page.getByLabel('Your entry').fill('Je vais à le cinéma ce soir.')
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await nav(page, 'Insights').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights')
  await page.getByLabel('Language').selectOption('fr')
  // Assert
  await expect(summary(page)).toContainText('Article is getting worse (0.0 → 6.7 per 100 words).')
  await expectHealthy(page)
})

test('insights show loading, a single retry on failure and an empty state', async ({ page }) => {
  // Arrange
  await page.goto('/insights?mock=slow')
  // Act
  const loading = page.getByRole('status').filter({ hasText: 'Loading insights…' })
  // Assert
  await expect(loading).toBeVisible()
  await page.goto('/insights?mock=error')
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0)
  await expectHealthy(page)
  await page.goto('/insights?mock=empty')
  await expect(page.getByText('Not enough entries yet')).toBeVisible()
  await expectHealthy(page)
})
```
The third journey's numbers: the new entry has 7 words and one «à le»; French becomes 4 entries — earlier 0 / 10 words, recent 1 / 15 words = 6.7. The app's `staleTime` is 30 s, so the French insights cached on the first visit only change because the run-analysis mutation invalidates them.

- [ ] **Step 8: Run the e2e spec**

Run: `pnpm -C frontend exec playwright test e2e/insights.spec.ts`
Expected: `8 passed` (4 journeys × desktop + mobile).

- [ ] **Step 9: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` (38 Playwright tests; Lighthouse on `/` unchanged).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/insights frontend/src/pages/InsightsPage.tsx frontend/src/AppRoutes.tsx \
  frontend/src/AppRoutes.test.tsx frontend/src/features/shell/AppShell.tsx frontend/src/utils/formatter.ts \
  frontend/src/utils/formatter.test.ts frontend/e2e/insights.spec.ts frontend/DESIGN.md
git commit -m "feat(frontend): Insights screen with summary, SVG rate chart and category table"
```

---

### Task 6: Full-stack insights journey

**Files:**
- Create: `frontend/e2e-stack/insights.spec.ts`

**Interfaces:**
- Consumes: the Compose stack started by `make e2e-stack` (`scripts/e2e-stack.sh`, project `journal-e2e`, `AI_PROVIDER=fake`, fresh volume); `frontend/playwright.stack.config.ts` (projects `desktop` + `mobile`, `workers: 1`, shared database); the demo `FakeProvider` (`ai/journal_ai/providers/fake.py`): «yo es» → «yo soy» (verb_conjugation), «la problema» → «el problema» (gender_agreement), both `error`; `expectNoA11yViolations`, `expectButtonsShowPointer`; Task 2's API and Task 5's screen.
- Produces: `make e2e-stack` runs 6 tests (3 journeys × 2 projects).

- [ ] **Step 1: Write the spec**

`frontend/e2e-stack/insights.spec.ts`:
```ts
import { expect, test, type APIRequestContext } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'

// Every entry has «yo es» and the last two «la problema», which the demo FakeProvider marks as errors.
const ENTRIES = [
  'Hoy yo es feliz y tranquilo.',
  'Mañana yo es estudiante otra vez.',
  'Ayer yo es feliz con la problema.',
  'Creo que yo es listo pero la problema sigue aquí.',
]

interface InsightsBody {
  status: string
  entry_count: number
  summary: string[]
}

async function writeAnalysed(request: APIRequestContext, language: string, text: string): Promise<void> {
  const created = await request.post('/api/v1/entries', { data: { language, text } })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  const analysed = await request.post(`/api/v1/entries/${id}/analyses`)
  expect(analysed.status()).toBe(201)
}

test('the real stack turns analysed entries into insights', async ({ page, request }, testInfo) => {
  // Arrange — a language of its own per project, because both projects share the stack's database.
  const language = testInfo.project.name === 'mobile' ? 'pt' : 'it'
  for (const text of ENTRIES) await writeAnalysed(request, language, text)
  const response = await request.get('/api/v1/insights', { params: { language } })
  const expected = (await response.json()) as InsightsBody
  expect(expected.status).toBe('trends')
  // Act
  await page.goto('/insights')
  await page.getByLabel('Language').selectOption(language)
  // Assert
  const summary = page.getByRole('region', { name: 'Summary' })
  for (const sentence of expected.summary) await expect(summary).toContainText(sentence)
  await expect(page.getByRole('img', { name: new RegExp(`across ${expected.entry_count} entries`) })).toBeVisible()
  const verbs = page.getByRole('row', { name: /Verb conjugation/ })
  await expect(verbs).toContainText(/Recurring · \d of last \d/)
  await expect(verbs).toContainText('yo es')
  await expect(verbs).toContainText('yo soy')
  await expect(page.getByRole('row', { name: /Gender agreement/ })).toContainText('el problema')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
```
On the fresh `make e2e-stack` volume the numbers are exact (4 entries; verb conjugation 16.7 → 11.8 improving, gender agreement 0.0 → 11.8 getting worse, overall 16.7 → 23.5 getting worse, "Verb conjugation keeps recurring: 4 of your last 4 entries."); asserting the API's own sentences keeps a rerun against a running stack green too.

- [ ] **Step 2: Run it against the stack**

Run: `make e2e-stack` (Docker running; ports 5432/8000/8080 free — stop any `make up` / `make db` containers first)
Expected: `6 passed`, then the `journal-e2e` containers and volume are removed.

- [ ] **Step 3: Gates**

Run: `make verify` (restart `make db` first)
Expected: `ALL GATES GREEN`.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e-stack/insights.spec.ts
git commit -m "test(e2e): full-stack insights journey against the fake AI provider"
```

---

### Task 7: Phase checkpoint

**Files:**
- Modify: `docs/superpowers/plans/2026-10-10-00-index.md`; any file a BLOCKING finding names.
- Create: `docs/qa/p4-*.png` (ui-qa screenshots).

**Interfaces:**
- Consumes: everything above.
- Produces: P4 marked done in the index, with evidence.

- [ ] **Step 1: Full gate**

Run: `make verify`, then `make e2e-stack`
Expected: `ALL GATES GREEN`, then `6 passed`. Keep both outputs for the report.

- [ ] **Step 2: ui-qa**

Dispatch the `ui-qa` agent (it builds `--mode mock` and serves `http://localhost:4173`) with these acceptance criteria at 1280×800 and 375×812, keyboard pass included. `?mock=` modes apply only to the URL they are loaded on, so load each URL directly.
1. Navigation: "Insights" is the third Main nav item, reachable by Tab, marked current on `/insights`; the page title is "Insights · Language Journal" and focus moves to the "Insights" heading after clicking the link.
2. All languages (`/insights`): Summary lists "6 errors across 11 entries — 7.6 per 100 words.", "Overall, your error rate is steady (8.8 → 7.7 per 100 words).", "Verb conjugation is getting worse (2.9 → 5.1 per 100 words).", "Article is improving (2.9 → 0.0 per 100 words).".
3. Chart: a line with 11 dots, "Highest: 20.0" above it, the first and last entry dates below; no text inside the SVG; the line stays visible with `prefers-color-scheme: dark`.
4. Category table "Errors by category": rows Verb conjugation (3 errors, "↑ Getting worse"), Gender agreement ("→ Steady"), Article ("↓ Improving"); every trend has a word, not only an arrow; each row shows its latest example struck through → correction.
5. Filter: choosing Spanish puts `?language=es` in the URL, the summary adds "Verb conjugation keeps recurring: 3 of your last 5 entries." and the row shows a "Recurring · 3 of last 5" badge; Back returns to all languages.
6. French (`/insights?language=fr`): "0 errors across 3 entries — 0.0 per 100 words.", "Trends start at 4 entries with feedback.", a flat line on the baseline, and "No errors in these entries — nothing to work on yet." instead of the table.
7. Empty: German and `/insights?mock=empty` show "Not enough entries yet", "Insights start after 3 entries with feedback — 3 to go." and a "Write an entry" link that opens Write.
8. States: `/insights?mock=slow` shows "Loading insights…"; `/insights?mock=error` and `/entries?mock=error` each show exactly one error box with one "Try again".
9. Live refresh: open French insights, write the French entry "Je vais à le cinéma ce soir." on Write, get feedback, return via the nav and choose French — "Article is getting worse (0.0 → 6.7 per 100 words)." without a reload.
10. Missing entry: `/entries/ffffffff-ffff-4fff-8fff-ffffffffffff` has the heading "Entry not found", the title "Entry not found · Language Journal" and "Back to history".
11. Everywhere: no horizontal scroll at 375px; focus always visible; the hidden per-entry table exists in the DOM under the chart; no console errors outside `?mock=error`.
12. Real stack (the controller brings it up on `http://localhost:8080` with the fake provider): write four Italian entries containing «yo es» (two also «la problema») on Write, open Insights, choose Italian — status shows trends, Verb conjugation is "Recurring · 4 of last 4" with "yo es → yo soy", Gender agreement shows "el problema"; no console errors.

- [ ] **Step 3: Reviewer**

Dispatch the `reviewer` agent on the P4 commit range (Task 1 commit through Task 6 commit) with this plan and the spec. Fix every BLOCKING finding — failing test first, `make verify` green — one commit per fix (`fix(<area>): <finding>`), then re-run the affected ui-qa criteria. Record SHOULD findings in the index row for P5.

- [ ] **Step 4: Mark P4 done**

In `docs/superpowers/plans/2026-10-10-00-index.md`, replace the P4 row with (fill the counts from the Step 1 output):
```
| P4 Stage 2 insights | `2026-10-10-p4-stage2-insights.md` | done (<n> backend tests, <n> Vitest, <n> Playwright + axe, full-stack smoke 6/6, ui-qa <n>/12) |
```

```bash
git add docs/superpowers/plans/2026-10-10-00-index.md docs/qa
git commit -m "docs: P4 stage 2 insights done"
```
Paste the `make verify` tail, the `make e2e-stack` result, the ui-qa table and the reviewer verdict into the phase report.

---

## Self-review notes

- Spec §8, rule by rule: only `kind = error` (T2 query filter + `test_suggestions_and_word_help_are_not_errors`); latest succeeded per entry (T2 `DISTINCT ON … WHERE status = 'succeeded'` + three repository tests + the API failed-re-check test); pooled rates (T1 `pooled_rate` + pooled-vs-mean test); ⌈n/2⌉/⌊n/2⌋ windows capped at 5 (T1 table incl. n = 11 and 20); n < 3 / n = 3 / n ≥ 4 (T1 status table + both summary shapes); threshold `max(0.5, 0.25 × earlier)` exactly at ±threshold, earlier rate 0 (T1 `classify_trend` table + pooled-window edge); recurring at exactly 3/5 and 2/5 (T1); zero words (T1); deterministic sentences (T1 summary tests, mirrored by T3 mock tests); named, documented constants (T1 `calculations.py` header).
- Spec §5 `GET /insights?language=`: T2 route, 422 for unsupported/empty language. Spec §7 Insights screen: language filter in the URL (T4/T5), headline summary (T5 `InsightsReport`), errors-per-100-words SVG line with no chart dependency (T5 `RateChart`), category table with earlier vs recent rate, trend arrow + word, recurring badge, latest example (T5 `CategoryTable`), empty state below 3 entries with a link to Write (T5 `InsightsResults`). Spec §10 Stage 2 + full stack: T1, T2, T5, T6. Spec §13 P4 exit: T7.
- P3 carry-overs: single "Try again" when languages fail (T4, also covers Insights via the shared `LanguageFiltered`); missing-entry heading (T4). The third ledger carry-over (provider client close on shutdown) is backend lifecycle work outside Stage 2 and stays with P5.
- Type names across tasks: `EntryErrors`, `CategoryErrors`, `Example`, `InsightsRepository.entry_errors`, `Insights`, `InsightsStatus`, `Trend`, `CategoryInsight`, `RatePoint`, `compute_insights`, `summarize`, `category_label`, `InsightsService.get`, `InsightsOut`; frontend `InsightsOut`, `RatePointOut`, `CategoryInsightOut`, `journalKeys.insights` / `insightsAll`, `useInsightsQuery`, `analysedEntries`, `AnalysedEntry`, `parseLanguage`, `computeInsights`, `useLanguageFilter`, `LanguageFiltered`, `plotRates`, `polylinePoints`, `highestRate`, `CHART`, `formatRate`, `describeRates`, `TREND_TEXT`, `RateChange`, `TrendBadge`, `formatDate`.
- Verified before writing: the backend code of T1/T2 passes ruff, ruff format, mypy strict and import-linter, and the T1 unit tests pass (the T2 SQL compiles to the statement quoted in Task 2; its integration tests could not run while Postgres was down). The frontend code of T3–T5 passes `tsc -b`, eslint, fallow dupes, the full Vitest suite and the full Playwright suite (desktop + 375px, axe, pointer checks) on a scratch copy.
