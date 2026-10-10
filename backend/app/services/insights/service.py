from dataclasses import replace

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.insights import EntryErrors, InsightsRepository
from app.services.entries import count_words
from app.services.insights.calculations import Insights, compute_insights
from app.services.insights.summary import summarize

logger = structlog.get_logger()


class InsightsService:
    def __init__(self, session: AsyncSession) -> None:
        self._insights = InsightsRepository(session)

    async def get(self, *, language: str | None) -> Insights:
        analysed = await self._insights.entry_errors(language=language)
        # Words of the analysed snapshot, not of the current text: an edit that was never re-checked must
        # not change the denominator of errors counted on the old text.
        entries = [
            EntryErrors(item.entry_id, item.created_at, count_words(item.input_text), item.errors)
            for item in analysed
        ]
        insights = compute_insights(entries)
        logger.info(
            "insights_computed",
            language=language,
            status=insights.status.value,
            entry_count=insights.entry_count,
            category_count=len(insights.categories),
        )
        return replace(insights, summary=summarize(insights))
