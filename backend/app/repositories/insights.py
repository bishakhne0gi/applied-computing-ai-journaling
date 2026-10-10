import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, MistakeKind


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


@dataclass(frozen=True)
class AnalysedEntry:
    entry_id: uuid.UUID
    created_at: datetime
    input_text: str
    errors: dict[Category, CategoryErrors]

    @property
    def error_count(self) -> int:
        return sum(item.count for item in self.errors.values())


_Row = tuple[uuid.UUID, datetime, str, Category | None, str | None, str | None]


class InsightsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def entry_errors(self, *, language: str | None) -> list[AnalysedEntry]:
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
        return _group((await self._session.execute(stmt)).all())


def _group(rows: Iterable[_Row]) -> list[AnalysedEntry]:
    # One row per error in text order, or a single row without a category for an entry with no errors.
    grouped: dict[uuid.UUID, AnalysedEntry] = {}
    for entry_id, created_at, input_text, category, original, correction in rows:
        entry = grouped.setdefault(entry_id, AnalysedEntry(entry_id, created_at, input_text, {}))
        if category is None:
            continue
        previous = entry.errors.get(category)
        if previous is None:
            # Both columns are NOT NULL whenever a mistake row exists; `or ""` only narrows the type.
            entry.errors[category] = CategoryErrors(1, Example(original or "", correction or ""))
        else:
            entry.errors[category] = CategoryErrors(previous.count + 1, previous.example)
    return list(grouped.values())
