import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Mistake
from journal_ai import MistakeKind


@dataclass(frozen=True)
class AnalysisSummary:
    status: AnalysisStatus
    error_count: int


class AnalysisRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, analysis: Analysis) -> None:
        self._session.add(analysis)

    async def latest_for_entry(self, entry_id: uuid.UUID) -> Analysis | None:
        stmt = (
            select(Analysis)
            .where(Analysis.entry_id == entry_id)
            .order_by(Analysis.created_at.desc(), Analysis.id.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def list_for_entry(self, entry_id: uuid.UUID) -> list[Analysis]:
        stmt = (
            select(Analysis)
            .where(Analysis.entry_id == entry_id)
            .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def latest_summaries(self, entry_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, AnalysisSummary]:
        if not entry_ids:
            return {}
        latest = (
            select(Analysis.id, Analysis.entry_id, Analysis.status)
            .where(Analysis.entry_id.in_(entry_ids))
            .order_by(Analysis.entry_id, Analysis.created_at.desc(), Analysis.id.desc())
            .ext(distinct_on(Analysis.entry_id))
            .subquery()
        )
        error_count = (
            select(func.count(Mistake.id))
            .where(Mistake.analysis_id == latest.c.id, Mistake.kind == MistakeKind.ERROR)
            .scalar_subquery()
        )
        rows = await self._session.execute(select(latest.c.entry_id, latest.c.status, error_count))
        return {
            entry_id: AnalysisSummary(status=AnalysisStatus(status), error_count=count)
            for entry_id, status, count in rows
        }
