import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, MistakeKind


@dataclass(frozen=True)
class ErrorRow:
    # One row per error of the entry's counted analysis, or a single row with no category when it has none.
    entry_id: uuid.UUID
    created_at: datetime
    input_text: str
    category: Category | None
    original: str | None
    correction: str | None


class InsightsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def entry_errors(self, *, language: str | None) -> list[ErrorRow]:
        # The newest *succeeded* analysis per entry, even when a later attempt failed or never finished:
        # a failed re-check must not erase feedback the learner already has (spec section 4).
        latest = (
            select(Analysis.id.label("analysis_id"), Analysis.entry_id, Analysis.input_text)
            .where(Analysis.status == AnalysisStatus.SUCCEEDED)
            .order_by(Analysis.entry_id, Analysis.created_at.desc(), Analysis.id.desc())
            .ext(distinct_on(Analysis.entry_id))
            .subquery("latest_succeeded")
        )
        stmt = (
            select(
                Entry.id,
                Entry.created_at,
                latest.c.input_text,
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
        result = await self._session.execute(stmt)
        return [ErrorRow(*row) for row in result.all()]
