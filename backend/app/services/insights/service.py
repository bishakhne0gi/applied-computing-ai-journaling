import uuid
from collections.abc import Iterable
from dataclasses import replace

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.insights import ErrorRow, InsightsRepository
from app.services.entries import count_words
from app.services.insights.calculations import Insights, compute_insights
from app.services.insights.summary import summarize
from app.services.insights.types import CategoryErrors, EntryErrors, Example
from journal_ai import Category

logger = structlog.get_logger()


class InsightsService:
    def __init__(self, session: AsyncSession) -> None:
        self._insights = InsightsRepository(session)

    async def get(self, *, language: str | None) -> Insights:
        rows = await self._insights.entry_errors(language=language)
        insights = compute_insights(group_entries(rows))
        logger.info(
            "insights_computed",
            language=language,
            status=insights.status.value,
            entry_count=insights.entry_count,
            category_count=len(insights.categories),
        )
        return replace(insights, summary=summarize(insights))


def group_entries(rows: Iterable[ErrorRow]) -> list[EntryErrors]:
    # Rows arrive in text order per entry, so the first error seen in a category is its example.
    # Words come from the analysed snapshot, not the current text: an edit that was never re-checked must
    # not change the denominator of errors counted on the old text.
    heads: dict[uuid.UUID, ErrorRow] = {}
    errors: dict[uuid.UUID, dict[Category, CategoryErrors]] = {}
    for row in rows:
        heads.setdefault(row.entry_id, row)
        per_entry = errors.setdefault(row.entry_id, {})
        if row.category is None:
            continue
        previous = per_entry.get(row.category)
        if previous is None:
            # Both columns are NOT NULL whenever a mistake row exists; `or ""` only narrows the type.
            example = Example(row.original or "", row.correction or "")
            per_entry[row.category] = CategoryErrors(1, example)
        else:
            per_entry[row.category] = CategoryErrors(previous.count + 1, previous.example)
    return [
        EntryErrors(head.entry_id, head.created_at, count_words(head.input_text), errors[entry_id])
        for entry_id, head in heads.items()
    ]
