import uuid
from datetime import UTC, datetime

from app.repositories.insights import ErrorRow
from app.services.insights.service import group_entries
from app.services.insights.types import CategoryErrors, Example
from journal_ai import Category

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
FIRST, SECOND = uuid.UUID(int=1), uuid.UUID(int=2)


def row(entry_id: uuid.UUID, category: Category | None = None, original: str = "x") -> ErrorRow:
    return ErrorRow(entry_id, T0, "Hola  mundo\nqué\ttal", category, original if category else None, "y")


def test_errors_are_counted_per_category_with_the_first_row_as_the_example() -> None:
    rows = [
        row(FIRST, Category.ARTICLE, "de el"),
        row(FIRST, Category.PREPOSITION, "en"),
        row(FIRST, Category.ARTICLE, "a el"),
    ]

    [entry] = group_entries(rows)

    assert entry.errors == {
        Category.ARTICLE: CategoryErrors(2, Example("de el", "y")),
        Category.PREPOSITION: CategoryErrors(1, Example("en", "y")),
    }


def test_an_entry_without_errors_is_kept_with_the_word_count_of_its_analysed_text() -> None:
    [entry] = group_entries([row(FIRST)])

    assert (entry.errors, entry.word_count) == ({}, 4)


def test_rows_are_grouped_by_entry_in_arrival_order() -> None:
    entries = group_entries([row(SECOND, Category.ARTICLE), row(FIRST), row(FIRST, Category.OTHER)])

    assert [item.entry_id for item in entries] == [SECOND, FIRST]
