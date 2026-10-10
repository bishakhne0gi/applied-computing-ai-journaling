# P2 Backend Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Stage 1 REST API — create, list, read and revise entries, run synchronous AI analyses, and persist every outcome (success or failure) with its mistakes.

**Architecture:** Three tables (`entries`, `analyses`, `mistakes`) behind repositories; `EntryService` and `AnalysisService` own transactions and depend on an `AnalyzerPort` protocol satisfied by `journal_ai.Analyzer`; thin `/api/v1` routes convert ORM objects to response schemas. The analysis row is committed as `pending` before the AI call so no transaction is held open while the model runs.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2 async (asyncpg), Alembic, structlog, sentry-sdk, `journal_ai`, pytest + httpx against real Postgres.

**Spec:** `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§4 data model, §5 API, §6 AI pipeline, §9 observability, §10 testing)

## Global Constraints

- Layers: `app.api` → `app.services` → `app.repositories` → `app.db` (import-linter). Routes never touch the ORM query API; repositories never commit; services commit once per use case. `app` never imports `anthropic`.
- Services depend on the `AnalyzerPort` protocol, never on a provider. The concrete `Analyzer` is built in `create_app` and reached only through `app.api.deps.get_analyzer`.
- Text: 1–5000 characters after trimming; stored as `journal_ai.normalize_text(text)`. Languages: `journal_ai.SUPPORTED_LANGUAGES` only.
- Errors: RFC 7807 problem+json via the existing handlers (`AppError` subclasses from services). Unknown id → 404; malformed id or invalid body/query → 422; invalid cursor → 400.
- A failed AI call is persisted (`status=failed`, `error_code`, `error_detail`) and returned with 201. API responses never include `raw_response` or `error_detail`.
- Never log entry text, corrected text or mistake text — only ids, counts, timings, codes.
- Paging: cursor on `(created_at, id)` descending; `limit` default 20, max 50.
- Tests run on Postgres only (`db_session` rolled back per test); the AI is always `journal_ai.providers.fake.FakeProvider`.
- Backend coverage floor 85% (`make test-backend`).
- Comments explain why, never what. Commits: plain message, no `Co-Authored-By`, no AI attribution; stage files explicitly; push after each commit when the remote accepts it.

## Review Focus

- The AI call times out or returns garbage → the entry is still saved, the analysis row exists with `status=failed` and its `error_code`, the response is 201, and a second POST succeeds and becomes the latest analysis. (Task 4 test)
- The learner edits an entry after it was analysed → the old analysis keeps its own `input_text` so its offsets still slice correctly, and the entry's latest analysis is the newest one. (Task 3 + Task 4 tests)
- Entry text arrives with decomposed accents or CRLF line endings → stored text is NFC with `\n`, and every returned offset slices the analysis `input_text` to exactly the mistake's `original`. (Task 3 test)
- A client sends a garbage cursor, `limit=0` or `limit=51` → 400/422 problem+json, never a 500. (Task 4 test)
- An analysis runs end to end → no log line contains the entry text. (Task 3 test)

---

### Task 1: ORM models and the first migration

**Files:**
- Create: `backend/app/db/models/_common.py`, `backend/app/db/models/entry.py`, `backend/app/db/models/analysis.py`, `backend/app/db/models/mistake.py`
- Modify: `backend/app/db/models/__init__.py`, `backend/migrations/script.py.mako`, `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§4)
- Create (generated, then reviewed): `backend/migrations/versions/<date>_<rev>_create_journal_tables.py`
- Test: `backend/tests/integration/test_models.py`

**Interfaces:**
- Consumes: `app.db.base.Base`; `journal_ai.SUPPORTED_LANGUAGES`, `journal_ai.MistakeKind`, `journal_ai.Category`, `journal_ai.FailureCode`.
- Produces (exported from `app.db.models`): `Entry`, `Analysis`, `AnalysisStatus` (StrEnum `pending|succeeded|failed`), `Mistake`, and `utcnow() -> datetime` (in `_common`).
  - `Entry(id: UUID, language: str, text: str, word_count: int, created_at, updated_at)`; relationship `analyses` (lazy="raise").
  - `Analysis(id, entry_id, status: AnalysisStatus, input_text: str, corrected_text: str | None, feedback_summary: str | None, model: str | None, prompt_version: str, raw_response: str | None, error_code: FailureCode | None, error_detail: str | None, latency_ms: int | None, input_tokens: int, output_tokens: int, retried: bool, dropped_mistakes: int, created_at, completed_at: datetime | None)`; relationships `entry` (lazy="raise"), `mistakes` (lazy="selectin", ordered by `position`).
  - `Mistake(id, analysis_id, kind: MistakeKind, category: Category, original: str, correction: str, explanation: str, start_offset: int | None, end_offset: int | None, position: int)`.

- [ ] **Step 1: Tidy the migration template**

Replace `backend/migrations/script.py.mako` with:
```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
${imports if imports else ""}
revision: str = ${repr(up_revision)}
down_revision: str | Sequence[str] | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 2: Write failing model tests**

`backend/tests/integration/test_models.py`:
```python
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, FailureCode, MistakeKind


def _entry(language: str = "es") -> Entry:
    return Entry(language=language, text="Ayer yo es feliz.", word_count=4)


async def test_an_entry_analysis_and_mistakes_round_trip(db_session: AsyncSession) -> None:
    entry = _entry()
    analysis = Analysis(
        entry=entry,
        status=AnalysisStatus.SUCCEEDED,
        input_text=entry.text,
        prompt_version="v1",
        model="fake",
        error_code=None,
        mistakes=[
            Mistake(
                kind=MistakeKind.ERROR,
                category=Category.VERB_CONJUGATION,
                original="yo es",
                correction="yo soy",
                explanation="Ser with yo is soy.",
                start_offset=5,
                end_offset=10,
                position=0,
            )
        ],
    )
    db_session.add(analysis)
    await db_session.flush()
    db_session.expunge_all()

    stored = await db_session.scalar(select(Analysis).where(Analysis.id == analysis.id))

    assert stored is not None
    assert stored.status is AnalysisStatus.SUCCEEDED
    assert stored.mistakes[0].category is Category.VERB_CONJUGATION
    assert stored.mistakes[0].start_offset == 5
    assert stored.created_at.tzinfo is not None


async def test_unsupported_languages_are_rejected_by_the_database(db_session: AsyncSession) -> None:
    db_session.add(_entry(language="xx"))

    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_failure_codes_are_stored_as_their_values(db_session: AsyncSession) -> None:
    entry = _entry()
    analysis = Analysis(
        entry=entry,
        status=AnalysisStatus.FAILED,
        input_text=entry.text,
        prompt_version="v1",
        error_code=FailureCode.PROVIDER_TIMEOUT,
        mistakes=[],
    )
    db_session.add(analysis)
    await db_session.flush()

    raw = await db_session.scalar(text("SELECT error_code FROM analyses WHERE id = :id"), {"id": analysis.id})

    assert raw == "provider_timeout"
    assert type(raw) is str


async def test_deleting_an_entry_cascades_to_its_analyses_and_mistakes(db_session: AsyncSession) -> None:
    entry = _entry()
    db_session.add(
        Analysis(
            entry=entry,
            status=AnalysisStatus.PENDING,
            input_text=entry.text,
            prompt_version="v1",
            mistakes=[],
        )
    )
    await db_session.flush()

    await db_session.delete(entry)
    await db_session.flush()

    assert await db_session.scalar(select(Analysis.id)) is None
```

- [ ] **Step 3: Run them to see them fail**

Run: `uv run pytest backend/tests/integration/test_models.py -q`
Expected: FAIL — `ImportError: cannot import name 'Analysis' from 'app.db.models'`.

- [ ] **Step 4: Implement the models**

`backend/app/db/models/_common.py`:
```python
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Enum


def utcnow() -> datetime:
    return datetime.now(UTC)


def str_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    # VARCHAR + CHECK instead of a native Postgres enum: adding a value later is a one-line migration.
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda members: [member.value for member in members],
    )
```

`backend/app/db/models/entry.py`:
```python
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models._common import utcnow
from journal_ai import SUPPORTED_LANGUAGES

if TYPE_CHECKING:
    from app.db.models.analysis import Analysis

_LANGUAGE_LIST = ", ".join(f"'{code}'" for code in SUPPORTED_LANGUAGES)


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint(f"language IN ({_LANGUAGE_LIST})", name="language_supported"),
        Index("ix_entries_language_created_at", "language", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    language: Mapped[str] = mapped_column(String(8))
    text: Mapped[str] = mapped_column(Text)
    word_count: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    analyses: Mapped[list["Analysis"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan", passive_deletes=True, lazy="raise"
    )
```

`backend/app/db/models/analysis.py`:
```python
import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models._common import str_enum, utcnow
from journal_ai import FailureCode

if TYPE_CHECKING:
    from app.db.models.entry import Entry
    from app.db.models.mistake import Mistake


class AnalysisStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (Index("ix_analyses_entry_id_created_at", "entry_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("entries.id", ondelete="CASCADE"))
    status: Mapped[AnalysisStatus] = mapped_column(str_enum(AnalysisStatus, "analysis_status"))
    input_text: Mapped[str] = mapped_column(Text)
    corrected_text: Mapped[str | None] = mapped_column(Text)
    feedback_summary: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(100))
    prompt_version: Mapped[str] = mapped_column(String(20))
    raw_response: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[FailureCode | None] = mapped_column(str_enum(FailureCode, "analysis_error_code"))
    error_detail: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None]
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    retried: Mapped[bool] = mapped_column(default=False)
    dropped_mistakes: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    entry: Mapped["Entry"] = relationship(back_populates="analyses", lazy="raise")
    mistakes: Mapped[list["Mistake"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Mistake.position",
        lazy="selectin",
    )
```

`backend/app/db/models/mistake.py`:
```python
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models._common import str_enum
from journal_ai import Category, MistakeKind

if TYPE_CHECKING:
    from app.db.models.analysis import Analysis


class Mistake(Base):
    __tablename__ = "mistakes"
    __table_args__ = (
        Index("ix_mistakes_analysis_id", "analysis_id"),
        Index("ix_mistakes_category", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"))
    kind: Mapped[MistakeKind] = mapped_column(str_enum(MistakeKind, "mistake_kind"))
    category: Mapped[Category] = mapped_column(str_enum(Category, "mistake_category"))
    original: Mapped[str] = mapped_column(Text)
    correction: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    start_offset: Mapped[int | None]
    end_offset: Mapped[int | None]
    position: Mapped[int]

    analysis: Mapped["Analysis"] = relationship(back_populates="mistakes")
```

`backend/app/db/models/__init__.py`:
```python
from app.db.models._common import utcnow
from app.db.models.analysis import Analysis, AnalysisStatus
from app.db.models.entry import Entry
from app.db.models.mistake import Mistake

__all__ = ["Analysis", "AnalysisStatus", "Entry", "Mistake", "utcnow"]
```

- [ ] **Step 5: Run the model tests to see them pass**

Run: `uv run pytest backend/tests/integration/test_models.py -q`
Expected: 4 passed. (The session-scoped `_schema` fixture recreates tables from `Base.metadata`.)

- [ ] **Step 6: Generate and review the migration**

Run: `make db && make migrate && make revision m="create journal tables"`
Open the generated file under `backend/migrations/versions/` and check it creates `entries`, `analyses`, `mistakes` with: the `language_supported` check, the four `ck_*` enum checks, both FKs with `ondelete="CASCADE"`, and the indexes `ix_entries_language_created_at`, `ix_analyses_entry_id_created_at`, `ix_mistakes_analysis_id`, `ix_mistakes_category`; `downgrade()` drops them in reverse order. Remove any autogenerate comment lines (`# ### commands auto generated ...`).
Run: `cd backend && uv run alembic upgrade head && uv run alembic check && uv run alembic downgrade base && uv run alembic upgrade head; cd ..`
Expected: `No new upgrade operations detected.`; downgrade and re-upgrade succeed.

- [ ] **Step 7: Align the spec with the model**

In spec §4 update the `analyses` row so it lists `model (nullable until completed)`, `error_detail (text, sanitised, never shown to users)` and keeps `raw_response (text, nullable)`; add one sentence under the table: "The API never returns `raw_response` or `error_detail`; they exist for debugging."

- [ ] **Step 8: Gates and commit**

Run: `make lint typecheck test-backend`
```bash
git add backend/app/db/models backend/migrations backend/tests/integration/test_models.py docs/superpowers/specs/2026-10-10-ai-language-journal-design.md
git commit -m "feat(backend): entries, analyses and mistakes tables with the first migration"
git push
```

---

### Task 2: Repositories

**Files:**
- Create: `backend/app/repositories/entries.py`, `backend/app/repositories/analyses.py`
- Modify: `backend/tests/support.py`
- Test: `backend/tests/integration/test_repositories.py`

**Interfaces:**
- Consumes: models from Task 1.
- Produces:
  - `app.repositories.entries.EntryCursor(created_at: datetime, id: UUID)` (frozen dataclass).
  - `EntryRepository(session)` with `add(entry: Entry) -> None`, `async get(entry_id: UUID) -> Entry | None`, `async list_page(*, language: str | None, before: EntryCursor | None, limit: int) -> list[Entry]` (newest first by `(created_at, id)`).
  - `app.repositories.analyses.AnalysisSummary(status: AnalysisStatus, error_count: int)` (frozen dataclass).
  - `AnalysisRepository(session)` with `add(analysis: Analysis) -> None`, `async latest_for_entry(entry_id: UUID) -> Analysis | None`, `async list_for_entry(entry_id: UUID) -> list[Analysis]` (newest first), `async latest_summaries(entry_ids: Sequence[UUID]) -> dict[UUID, AnalysisSummary]` (latest analysis per entry; `error_count` counts only `kind=error`).
  - Test helpers in `backend/tests/support.py`: `entry_at(created_at: datetime, language: str = "es", text: str = "Hola mundo") -> Entry` and `analysis_for(entry: Entry, *, status: AnalysisStatus, created_at: datetime, errors: int = 0, suggestions: int = 0) -> Analysis`.

- [ ] **Step 1: Test helpers**

Append to `backend/tests/support.py`:
```python
from datetime import datetime

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, MistakeKind


def entry_at(created_at: datetime, language: str = "es", text: str = "Hola mundo") -> Entry:
    return Entry(
        language=language, text=text, word_count=len(text.split()), created_at=created_at, updated_at=created_at
    )


def analysis_for(
    entry: Entry, *, status: AnalysisStatus, created_at: datetime, errors: int = 0, suggestions: int = 0
) -> Analysis:
    kinds = [MistakeKind.ERROR] * errors + [MistakeKind.SUGGESTION] * suggestions
    mistakes = [
        Mistake(
            kind=kind,
            category=Category.OTHER,
            original="x",
            correction="y",
            explanation="z",
            position=index,
        )
        for index, kind in enumerate(kinds)
    ]
    return Analysis(
        entry=entry,
        status=status,
        input_text=entry.text,
        prompt_version="v1",
        created_at=created_at,
        mistakes=mistakes,
    )
```
(Keep the existing `ClientFactory` definition and merge imports at the top of the file.)

- [ ] **Step 2: Write failing repository tests**

`backend/tests/integration/test_repositories.py`:
```python
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisStatus
from app.repositories.analyses import AnalysisRepository, AnalysisSummary
from app.repositories.entries import EntryCursor, EntryRepository
from tests.support import analysis_for, entry_at

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


async def test_list_page_is_newest_first_and_filters_by_language(db_session: AsyncSession) -> None:
    older, newer, french = entry_at(T0), entry_at(T0 + timedelta(hours=1)), entry_at(T0, language="fr")
    db_session.add_all([older, newer, french])
    await db_session.flush()

    page = await EntryRepository(db_session).list_page(language="es", before=None, limit=10)

    assert [e.id for e in page] == [newer.id, older.id]


async def test_list_page_continues_after_the_cursor(db_session: AsyncSession) -> None:
    entries = [entry_at(T0 + timedelta(minutes=i)) for i in range(3)]
    db_session.add_all(entries)
    await db_session.flush()
    repo = EntryRepository(db_session)

    first = await repo.list_page(language=None, before=None, limit=2)
    rest = await repo.list_page(language=None, before=EntryCursor(first[-1].created_at, first[-1].id), limit=2)

    assert [e.id for e in first] == [entries[2].id, entries[1].id]
    assert [e.id for e in rest] == [entries[0].id]


async def test_list_page_breaks_timestamp_ties_by_id(db_session: AsyncSession) -> None:
    twins = [entry_at(T0), entry_at(T0)]
    db_session.add_all(twins)
    await db_session.flush()
    repo = EntryRepository(db_session)

    first = await repo.list_page(language=None, before=None, limit=1)
    second = await repo.list_page(language=None, before=EntryCursor(first[0].created_at, first[0].id), limit=1)

    assert {first[0].id, second[0].id} == {twins[0].id, twins[1].id}


async def test_latest_for_entry_returns_the_newest_analysis_with_mistakes(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=AnalysisStatus.FAILED, created_at=T0),
            analysis_for(entry, status=AnalysisStatus.SUCCEEDED, created_at=T0 + timedelta(minutes=5), errors=2),
        ]
    )
    await db_session.flush()

    latest = await AnalysisRepository(db_session).latest_for_entry(entry.id)

    assert latest is not None
    assert latest.status is AnalysisStatus.SUCCEEDED
    assert len(latest.mistakes) == 2


async def test_list_for_entry_is_newest_first(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    first = analysis_for(entry, status=AnalysisStatus.FAILED, created_at=T0)
    second = analysis_for(entry, status=AnalysisStatus.SUCCEEDED, created_at=T0 + timedelta(minutes=1))
    db_session.add_all([first, second])
    await db_session.flush()

    history = await AnalysisRepository(db_session).list_for_entry(entry.id)

    assert [a.id for a in history] == [second.id, first.id]


async def test_latest_summaries_count_only_errors_of_the_latest_analysis(db_session: AsyncSession) -> None:
    analysed, failed, untouched = entry_at(T0), entry_at(T0), entry_at(T0)
    db_session.add_all(
        [
            analysis_for(analysed, status=AnalysisStatus.SUCCEEDED, created_at=T0, errors=5),
            analysis_for(
                analysed, status=AnalysisStatus.SUCCEEDED, created_at=T0 + timedelta(minutes=1), errors=1, suggestions=3
            ),
            analysis_for(failed, status=AnalysisStatus.FAILED, created_at=T0),
            untouched,
        ]
    )
    await db_session.flush()

    summaries = await AnalysisRepository(db_session).latest_summaries([analysed.id, failed.id, untouched.id])

    assert summaries == {
        analysed.id: AnalysisSummary(status=AnalysisStatus.SUCCEEDED, error_count=1),
        failed.id: AnalysisSummary(status=AnalysisStatus.FAILED, error_count=0),
    }


async def test_latest_summaries_of_no_entries_is_empty(db_session: AsyncSession) -> None:
    assert await AnalysisRepository(db_session).latest_summaries([]) == {}
```

- [ ] **Step 3: Run them to see them fail**

Run: `uv run pytest backend/tests/integration/test_repositories.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories.analyses'`.

- [ ] **Step 4: Implement**

`backend/app/repositories/entries.py`:
```python
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Entry


@dataclass(frozen=True)
class EntryCursor:
    created_at: datetime
    id: uuid.UUID


class EntryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, entry: Entry) -> None:
        self._session.add(entry)

    async def get(self, entry_id: uuid.UUID) -> Entry | None:
        return await self._session.get(Entry, entry_id)

    async def list_page(self, *, language: str | None, before: EntryCursor | None, limit: int) -> list[Entry]:
        stmt = select(Entry).order_by(Entry.created_at.desc(), Entry.id.desc()).limit(limit)
        if language is not None:
            stmt = stmt.where(Entry.language == language)
        if before is not None:
            stmt = stmt.where(tuple_(Entry.created_at, Entry.id) < tuple_(before.created_at, before.id))
        return list((await self._session.scalars(stmt)).all())
```

`backend/app/repositories/analyses.py`:
```python
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import func, select
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
            .distinct(Analysis.entry_id)
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
```

- [ ] **Step 5: Run them to see them pass**

Run: `uv run pytest backend/tests/integration/test_repositories.py -q`
Expected: 7 passed.

- [ ] **Step 6: Gates and commit**

Run: `make lint typecheck test-backend`
```bash
git add backend/app/repositories/entries.py backend/app/repositories/analyses.py backend/tests/support.py backend/tests/integration/test_repositories.py
git commit -m "feat(backend): entry and analysis repositories with cursor paging and latest summaries"
git push
```

---

### Task 3: Services

**Files:**
- Create: `backend/app/services/entries.py`, `backend/app/services/analyses.py`
- Modify: `backend/tests/support.py`
- Test: `backend/tests/integration/test_entry_service.py`, `backend/tests/integration/test_analysis_service.py`

**Interfaces:**
- Consumes: repositories (Task 2), models (Task 1), `app.core.errors.NotFoundError`, `journal_ai.normalize_text`, `journal_ai.AnalysisOutcome`, `journal_ai.FailureCode`, `journal_ai.PROMPT_VERSION`.
- Produces:
  - `app.services.entries`: `count_words(text: str) -> int`; `EntrySummary(entry: Entry, latest_status: AnalysisStatus | None, error_count: int)`; `EntryPage(items: list[EntrySummary], next_cursor: EntryCursor | None)`; `EntryService(session)` with `async create(*, language: str, text: str) -> Entry`, `async get(entry_id: UUID) -> Entry` (raises `NotFoundError`), `async get_detail(entry_id: UUID) -> tuple[Entry, Analysis | None]`, `async update_text(entry_id: UUID, text: str) -> Entry`, `async list_page(*, language: str | None, cursor: EntryCursor | None, limit: int) -> EntryPage`.
  - `app.services.analyses`: `AnalyzerPort` Protocol (`async analyze(text: str, language: str) -> AnalysisOutcome`); `AnalysisService(session, analyzer: AnalyzerPort)` with `async run(entry_id: UUID) -> Analysis` and `async list_for_entry(entry_id: UUID) -> list[Analysis]` (raises `NotFoundError` for unknown entries).
  - Test helper in `backend/tests/support.py`: `model_reply(*mistakes: dict[str, str], corrected: str = "Ayer yo soy feliz.", summary: str = "Nice work!") -> str` and `YO_ES = {"kind": "error", "category": "verb_conjugation", "original": "yo es", "correction": "yo soy", "explanation": "Ser with yo is soy."}`.

- [ ] **Step 1: Test helper**

Append to `backend/tests/support.py`:
```python
import json

YO_ES = {
    "kind": "error",
    "category": "verb_conjugation",
    "original": "yo es",
    "correction": "yo soy",
    "explanation": "Ser with yo is soy.",
}


def model_reply(*mistakes: dict[str, str], corrected: str = "Ayer yo soy feliz.", summary: str = "Nice work!") -> str:
    return json.dumps({"corrected_text": corrected, "feedback_summary": summary, "mistakes": list(mistakes)})
```

- [ ] **Step 2: Write failing service tests**

`backend/tests/integration/test_entry_service.py`:
```python
import unicodedata
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.services.entries import EntryService, count_words


@pytest.mark.parametrize(("text", "expected"), [("Hola mundo", 2), ("  uno\n dos\ttres ", 3), ("¡Hola!", 1)])
def test_count_words_splits_on_any_whitespace(text: str, expected: int) -> None:
    assert count_words(text) == expected


async def test_create_normalises_and_counts_words(db_session: AsyncSession) -> None:
    text = unicodedata.normalize("NFD", "  Él está en el café.\r\nAdiós ")

    entry = await EntryService(db_session).create(language="es", text=text)

    assert entry.text == "Él está en el café.\nAdiós"
    assert entry.text == unicodedata.normalize("NFC", entry.text)
    assert entry.word_count == 6
    assert entry.id is not None


async def test_get_unknown_entry_raises_not_found(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await EntryService(db_session).get(uuid.uuid4())


async def test_update_text_renormalises_and_recounts(db_session: AsyncSession) -> None:
    service = EntryService(db_session)
    entry = await service.create(language="es", text="Hola")

    updated = await service.update_text(entry.id, "Hola de nuevo\r\n")

    assert updated.text == "Hola de nuevo"
    assert updated.word_count == 3
    assert updated.updated_at >= entry.created_at


async def test_list_page_returns_a_cursor_only_when_more_entries_exist(db_session: AsyncSession) -> None:
    service = EntryService(db_session)
    for text in ("uno", "dos", "tres"):
        await service.create(language="es", text=text)

    first = await service.list_page(language=None, cursor=None, limit=2)
    second = await service.list_page(language=None, cursor=first.next_cursor, limit=2)

    assert [s.entry.text for s in first.items] == ["tres", "dos"]
    assert first.next_cursor is not None
    assert [s.entry.text for s in second.items] == ["uno"]
    assert second.next_cursor is None
    assert first.items[0].latest_status is None
    assert first.items[0].error_count == 0
```

`backend/tests/integration/test_analysis_service.py`:
```python
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.errors import NotFoundError
from app.db.models import AnalysisStatus
from app.services.analyses import AnalysisService
from app.services.entries import EntryService
from journal_ai import Analyzer, FailureCode
from journal_ai.providers.base import ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from tests.support import YO_ES, model_reply

ENTRY_TEXT = "Ayer yo es feliz."


async def _entry_id(session: AsyncSession, text: str = ENTRY_TEXT) -> uuid.UUID:
    return (await EntryService(session).create(language="es", text=text)).id


def _service(session: AsyncSession, *script: str | Exception) -> AnalysisService:
    return AnalysisService(session, Analyzer(FakeProvider(list(script))))


async def test_a_successful_analysis_is_stored_with_aligned_mistakes(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, model_reply(YO_ES)).run(entry_id)

    assert analysis.status is AnalysisStatus.SUCCEEDED
    assert analysis.corrected_text == "Ayer yo soy feliz."
    assert analysis.model == "fake"
    assert analysis.prompt_version == "v1"
    assert analysis.completed_at is not None
    mistake = analysis.mistakes[0]
    assert analysis.input_text[mistake.start_offset : mistake.end_offset] == "yo es"


async def test_a_failed_analysis_is_persisted_with_its_error_code(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, ProviderTimeoutError("slow")).run(entry_id)

    assert analysis.status is AnalysisStatus.FAILED
    assert analysis.error_code is FailureCode.PROVIDER_TIMEOUT
    assert analysis.error_detail is not None
    assert analysis.mistakes == []
    history = await _service(db_session).list_for_entry(entry_id)
    assert [a.id for a in history] == [analysis.id]


async def test_the_raw_response_is_kept_when_output_is_invalid(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, "not json", '{"truncated": ').run(entry_id)

    assert analysis.error_code is FailureCode.INVALID_OUTPUT
    assert analysis.raw_response == '{"truncated": '
    assert analysis.retried is True


async def test_a_revised_entry_gets_a_new_analysis_and_the_old_one_keeps_its_text(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)
    first = await _service(db_session, model_reply(YO_ES)).run(entry_id)
    await EntryService(db_session).update_text(entry_id, "Hoy yo es feliz otra vez.")

    second = await _service(db_session, model_reply(YO_ES, corrected="Hoy yo soy feliz otra vez.")).run(entry_id)

    _, latest = await EntryService(db_session).get_detail(entry_id)
    assert latest is not None and latest.id == second.id
    assert first.input_text == ENTRY_TEXT
    old = first.mistakes[0]
    new = second.mistakes[0]
    assert first.input_text[old.start_offset : old.end_offset] == "yo es"
    assert second.input_text[new.start_offset : new.end_offset] == "yo es"


async def test_analysing_an_unknown_entry_raises_not_found(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await _service(db_session).run(uuid.uuid4())


async def test_the_analysis_log_line_has_metrics_and_no_entry_text(db_session: AsyncSession) -> None:
    secret = "Mi secreto: yo es feliz."
    entry_id = await _entry_id(db_session, text=secret)

    with capture_logs() as logs:
        await _service(db_session, model_reply(YO_ES, corrected="Mi secreto: yo soy feliz.")).run(entry_id)

    line = next(log for log in logs if log["event"] == "analysis_completed")
    assert line["status"] == "succeeded"
    assert line["mistakes_kept"] == 1
    assert {"analysis_id", "entry_id", "latency_ms", "input_tokens", "retried", "prompt_version"} <= line.keys()
    assert "secreto" not in str(logs)


async def test_invalid_output_is_reported_to_sentry_as_a_warning(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        "app.services.analyses.sentry_sdk.capture_message",
        lambda message, **kwargs: captured.append((message, kwargs)),
    )
    entry_id = await _entry_id(db_session)

    await _service(db_session, "bad", "bad").run(entry_id)

    assert captured[0][0] == "analysis_invalid_output"
    assert captured[0][1]["level"] == "warning"
```

- [ ] **Step 3: Run them to see them fail**

Run: `uv run pytest backend/tests/integration/test_entry_service.py backend/tests/integration/test_analysis_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.entries'`.

- [ ] **Step 4: Implement `EntryService`**

`backend/app/services/entries.py`:
```python
import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Analysis, AnalysisStatus, Entry
from app.repositories.analyses import AnalysisRepository
from app.repositories.entries import EntryCursor, EntryRepository
from journal_ai import normalize_text

logger = structlog.get_logger()


def count_words(text: str) -> int:
    return len(text.split())


@dataclass(frozen=True)
class EntrySummary:
    entry: Entry
    latest_status: AnalysisStatus | None
    error_count: int


@dataclass(frozen=True)
class EntryPage:
    items: list[EntrySummary]
    next_cursor: EntryCursor | None


class EntryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._entries = EntryRepository(session)
        self._analyses = AnalysisRepository(session)

    async def create(self, *, language: str, text: str) -> Entry:
        normalized = normalize_text(text)
        entry = Entry(language=language, text=normalized, word_count=count_words(normalized))
        self._entries.add(entry)
        await self._session.commit()
        logger.info("entry_created", entry_id=str(entry.id), language=language, word_count=entry.word_count)
        return entry

    async def get(self, entry_id: uuid.UUID) -> Entry:
        entry = await self._entries.get(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found")
        return entry

    async def get_detail(self, entry_id: uuid.UUID) -> tuple[Entry, Analysis | None]:
        entry = await self.get(entry_id)
        return entry, await self._analyses.latest_for_entry(entry_id)

    async def update_text(self, entry_id: uuid.UUID, text: str) -> Entry:
        entry = await self.get(entry_id)
        entry.text = normalize_text(text)
        entry.word_count = count_words(entry.text)
        await self._session.commit()
        logger.info("entry_updated", entry_id=str(entry.id), word_count=entry.word_count)
        return entry

    async def list_page(self, *, language: str | None, cursor: EntryCursor | None, limit: int) -> EntryPage:
        # One extra row tells us whether another page exists without a COUNT query.
        rows = await self._entries.list_page(language=language, before=cursor, limit=limit + 1)
        entries, has_more = rows[:limit], len(rows) > limit
        summaries = await self._analyses.latest_summaries([e.id for e in entries])
        items = [
            EntrySummary(
                entry=e,
                latest_status=summaries[e.id].status if e.id in summaries else None,
                error_count=summaries[e.id].error_count if e.id in summaries else 0,
            )
            for e in entries
        ]
        last = entries[-1] if has_more else None
        return EntryPage(items=items, next_cursor=EntryCursor(last.created_at, last.id) if last else None)
```

- [ ] **Step 5: Implement `AnalysisService`**

`backend/app/services/analyses.py`:
```python
import uuid
from typing import Protocol

import sentry_sdk
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Analysis, AnalysisStatus, Mistake, utcnow
from app.repositories.analyses import AnalysisRepository
from app.repositories.entries import EntryRepository
from journal_ai import PROMPT_VERSION, AnalysisOutcome, FailureCode

logger = structlog.get_logger()


class AnalyzerPort(Protocol):
    async def analyze(self, text: str, language: str) -> AnalysisOutcome: ...


class AnalysisService:
    def __init__(self, session: AsyncSession, analyzer: AnalyzerPort) -> None:
        self._session = session
        self._analyzer = analyzer
        self._entries = EntryRepository(session)
        self._analyses = AnalysisRepository(session)

    async def run(self, entry_id: uuid.UUID) -> Analysis:
        entry = await self._entries.get(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found")

        # Committed before the model call so no transaction stays open for the tens of seconds it can take.
        # `mistakes=[]` marks the collection as loaded, so extending it later triggers no lazy load.
        analysis = Analysis(
            entry_id=entry.id,
            status=AnalysisStatus.PENDING,
            input_text=entry.text,
            prompt_version=PROMPT_VERSION,
            mistakes=[],
        )
        self._analyses.add(analysis)
        await self._session.commit()

        outcome = await self._analyzer.analyze(entry.text, entry.language)
        _apply(analysis, outcome)
        await self._session.commit()
        _report(analysis, outcome)
        return analysis

    async def list_for_entry(self, entry_id: uuid.UUID) -> list[Analysis]:
        if await self._entries.get(entry_id) is None:
            raise NotFoundError(f"Entry {entry_id} not found")
        return await self._analyses.list_for_entry(entry_id)


def _apply(analysis: Analysis, outcome: AnalysisOutcome) -> None:
    analysis.status = AnalysisStatus.SUCCEEDED if outcome.succeeded else AnalysisStatus.FAILED
    analysis.input_text = outcome.analyzed_text
    analysis.model = outcome.model
    analysis.prompt_version = outcome.prompt_version
    analysis.raw_response = outcome.raw_response
    analysis.error_code = outcome.failure
    analysis.error_detail = outcome.error_detail
    analysis.latency_ms = outcome.latency_ms
    analysis.input_tokens = outcome.usage.input_tokens
    analysis.output_tokens = outcome.usage.output_tokens
    analysis.retried = outcome.retried
    analysis.dropped_mistakes = outcome.dropped_mistakes
    analysis.completed_at = utcnow()
    if outcome.result is None:
        return
    analysis.corrected_text = outcome.result.corrected_text
    analysis.feedback_summary = outcome.result.feedback_summary
    analysis.mistakes.extend(
        Mistake(
            kind=m.kind,
            category=m.category,
            original=m.original,
            correction=m.correction,
            explanation=m.explanation,
            start_offset=m.start,
            end_offset=m.end,
            position=index,
        )
        for index, m in enumerate(outcome.result.mistakes)
    )


def _report(analysis: Analysis, outcome: AnalysisOutcome) -> None:
    logger.info(
        "analysis_completed",
        analysis_id=str(analysis.id),
        entry_id=str(analysis.entry_id),
        status=analysis.status.value,
        error_code=outcome.failure.value if outcome.failure else None,
        error_detail=outcome.error_detail,
        model=outcome.model,
        prompt_version=outcome.prompt_version,
        latency_ms=outcome.latency_ms,
        input_tokens=outcome.usage.input_tokens,
        output_tokens=outcome.usage.output_tokens,
        mistakes_kept=len(analysis.mistakes),
        mistakes_dropped=outcome.dropped_mistakes,
        retried=outcome.retried,
    )
    if outcome.failure is FailureCode.INVALID_OUTPUT:
        sentry_sdk.capture_message(
            "analysis_invalid_output",
            level="warning",
            tags={"analysis_id": str(analysis.id), "prompt_version": outcome.prompt_version},
        )
```

- [ ] **Step 6: Run the service tests to see them pass**

Run: `uv run pytest backend/tests/integration/test_entry_service.py backend/tests/integration/test_analysis_service.py -q`
Expected: all pass.

- [ ] **Step 7: Gates and commit**

Run: `make lint typecheck test-backend`
```bash
git add backend/app/services/entries.py backend/app/services/analyses.py backend/tests/support.py backend/tests/integration/test_entry_service.py backend/tests/integration/test_analysis_service.py
git commit -m "feat(backend): entry and analysis services with persisted failures and structured analysis logs"
git push
```

---

### Task 4: API — schemas, routes, wiring and the end-to-end flow

**Files:**
- Create: `backend/app/api/cursor.py`, `backend/app/api/schemas/entries.py`, `backend/app/api/schemas/analyses.py`, `backend/app/api/schemas/languages.py`, `backend/app/api/routes/entries.py`, `backend/app/api/routes/analyses.py`, `backend/app/api/routes/languages.py`, `backend/app/api/v1.py`
- Modify: `backend/app/api/deps.py`, `backend/app/main.py`, `backend/tests/integration/conftest.py`
- Test: `backend/tests/unit/test_cursor.py`, `backend/tests/integration/test_entries_api.py`, `backend/tests/integration/test_analyses_api.py`, `backend/tests/integration/test_languages_api.py`, `backend/tests/integration/test_journal_flow.py`

**Interfaces:**
- Consumes: services (Task 3), `EntryCursor` (Task 2), `journal_ai.Analyzer`, `journal_ai.build_provider`, `journal_ai.SUPPORTED_LANGUAGES`, `journal_ai.providers.fake.FakeProvider`, `tests.support.model_reply`/`YO_ES`.
- Produces:
  - `app.api.cursor`: `encode_cursor(cursor: EntryCursor) -> str`, `decode_cursor(raw: str) -> EntryCursor` (raises `InvalidCursorError`, an `AppError` with status 400, title "Bad Request").
  - `app.api.deps`: `get_analyzer(request) -> AnalyzerPort`, `get_entry_service`, `get_analysis_service`, aliases `EntryServiceDep`, `AnalysisServiceDep`.
  - `app.api.v1.api_router` mounted at `/api/v1` in `create_app`; `create_app` sets `app.state.analyzer`.
  - Endpoints exactly as spec §5: `GET /api/v1/languages`, `POST/GET /api/v1/entries`, `GET/PATCH /api/v1/entries/{entry_id}`, `POST/GET /api/v1/entries/{entry_id}/analyses`.
  - `ApiFactory` Protocol in `backend/tests/support.py`; integration fixture `make_api(script: Sequence[str | Exception] | None = None) -> AsyncContextManager[AsyncClient]` in `backend/tests/integration/conftest.py`.

- [ ] **Step 1: Cursor codec — failing unit tests**

`backend/tests/unit/test_cursor.py`:
```python
import uuid
from datetime import UTC, datetime

import pytest

from app.api.cursor import InvalidCursorError, decode_cursor, encode_cursor
from app.repositories.entries import EntryCursor


def test_cursors_round_trip() -> None:
    cursor = EntryCursor(datetime(2026, 10, 1, 9, 30, 15, 123456, tzinfo=UTC), uuid.uuid4())

    assert decode_cursor(encode_cursor(cursor)) == cursor


def test_encoded_cursors_are_url_safe() -> None:
    raw = encode_cursor(EntryCursor(datetime(2026, 10, 1, tzinfo=UTC), uuid.uuid4()))

    assert set(raw) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")


@pytest.mark.parametrize("raw", ["", "not-base64!", "e30", "eyJjIjogMX0", "aGVsbG8"])
def test_garbage_cursors_are_rejected(raw: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(raw)
```
Run: `uv run pytest backend/tests/unit/test_cursor.py -q` → FAIL (`ModuleNotFoundError: app.api.cursor`).

- [ ] **Step 2: Cursor codec — implement**

`backend/app/api/cursor.py`:
```python
import base64
import binascii
import json
import uuid
from datetime import datetime
from http import HTTPStatus

from app.core.errors import AppError
from app.repositories.entries import EntryCursor


class InvalidCursorError(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    title = "Bad Request"


def encode_cursor(cursor: EntryCursor) -> str:
    payload = json.dumps({"c": cursor.created_at.isoformat(), "i": str(cursor.id)})
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def decode_cursor(raw: str) -> EntryCursor:
    try:
        padded = raw + "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        return EntryCursor(created_at=datetime.fromisoformat(payload["c"]), id=uuid.UUID(payload["i"]))
    except (binascii.Error, UnicodeDecodeError, ValueError, KeyError, TypeError) as exc:
        raise InvalidCursorError("Invalid cursor") from exc
```
Run the unit tests again → PASS.

- [ ] **Step 3: Integration fixture**

Append to `backend/tests/support.py` (merge imports at the top):
```python
from collections.abc import Sequence
from contextlib import AbstractAsyncContextManager
from typing import Protocol


class ApiFactory(Protocol):
    def __call__(
        self, script: Sequence[str | Exception] | None = None
    ) -> AbstractAsyncContextManager[AsyncClient]: ...
```

Add to `backend/tests/integration/conftest.py` (keep the existing fixtures):
```python
from collections.abc import Sequence
from contextlib import asynccontextmanager

from app.api.deps import get_analyzer
from journal_ai import Analyzer
from journal_ai.providers.fake import FakeProvider
from tests.support import ApiFactory


@pytest.fixture
def make_api(settings: Settings, db_session: AsyncSession, make_client: ClientFactory) -> ApiFactory:
    @asynccontextmanager
    async def factory(script: Sequence[str | Exception] | None = None) -> AsyncIterator[AsyncClient]:
        app = create_app(settings)
        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_analyzer] = lambda: Analyzer(FakeProvider(script))
        async with make_client(app) as http:
            yield http

    return factory
```
Merge the new imports into the file's existing import block. Tests import `ApiFactory` from `tests.support`, never from a conftest.

- [ ] **Step 4: Write failing API tests**

`backend/tests/integration/test_languages_api.py`:
```python
from httpx import AsyncClient


async def test_languages_lists_every_supported_language(client: AsyncClient) -> None:
    response = await client.get("/api/v1/languages")

    assert response.status_code == 200
    assert {"code": "es", "name": "Spanish"} in response.json()
    assert len(response.json()) == 5
```

`backend/tests/integration/test_entries_api.py`:
```python
import uuid

import pytest
from httpx import AsyncClient


async def _create(client: AsyncClient, text: str = "Hola mundo", language: str = "es") -> dict[str, object]:
    response = await client.post("/api/v1/entries", json={"language": language, "text": text})
    assert response.status_code == 201
    return response.json()


async def test_creating_an_entry_returns_it(client: AsyncClient) -> None:
    body = await _create(client, text="  Hola mundo  ")

    assert body["text"] == "Hola mundo"
    assert body["language"] == "es"
    assert body["word_count"] == 2
    assert uuid.UUID(str(body["id"]))


@pytest.mark.parametrize(
    "payload",
    [
        {"language": "es", "text": "   "},
        {"language": "es", "text": "x" * 5001},
        {"language": "xx", "text": "Hola"},
        {"language": "es"},
    ],
    ids=["blank", "too-long", "unsupported-language", "missing-text"],
)
async def test_invalid_entries_are_rejected(client: AsyncClient, payload: dict[str, str]) -> None:
    response = await client.post("/api/v1/entries", json=payload)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


async def test_reading_an_entry_without_analyses(client: AsyncClient) -> None:
    created = await _create(client)

    response = await client.get(f"/api/v1/entries/{created['id']}")

    assert response.status_code == 200
    assert response.json()["latest_analysis"] is None


async def test_unknown_and_malformed_ids(client: AsyncClient) -> None:
    missing = await client.get(f"/api/v1/entries/{uuid.uuid4()}")
    malformed = await client.get("/api/v1/entries/not-a-uuid")

    assert missing.status_code == 404
    assert malformed.status_code == 422


async def test_patching_an_entry_updates_its_text(client: AsyncClient) -> None:
    created = await _create(client)

    response = await client.patch(f"/api/v1/entries/{created['id']}", json={"text": "Hola otra vez"})

    assert response.status_code == 200
    assert response.json()["text"] == "Hola otra vez"
    assert response.json()["word_count"] == 3


async def test_listing_pages_with_a_cursor(client: AsyncClient) -> None:
    for text in ("uno", "dos", "tres"):
        await _create(client, text=text)

    first = (await client.get("/api/v1/entries", params={"limit": 2})).json()
    second = (await client.get("/api/v1/entries", params={"limit": 2, "cursor": first["next_cursor"]})).json()

    assert [item["preview"] for item in first["items"]] == ["tres", "dos"]
    assert [item["preview"] for item in second["items"]] == ["uno"]
    assert second["next_cursor"] is None


async def test_listing_filters_by_language(client: AsyncClient) -> None:
    await _create(client, text="Hola", language="es")
    await _create(client, text="Bonjour", language="fr")

    body = (await client.get("/api/v1/entries", params={"language": "fr"})).json()

    assert [item["preview"] for item in body["items"]] == ["Bonjour"]


async def test_previews_are_truncated(client: AsyncClient) -> None:
    await _create(client, text="palabra " * 60)

    item = (await client.get("/api/v1/entries")).json()["items"][0]

    assert len(item["preview"]) <= 141
    assert item["preview"].endswith("…")


@pytest.mark.parametrize(
    ("params", "status"),
    [({"cursor": "garbage!"}, 400), ({"limit": 0}, 422), ({"limit": 51}, 422), ({"language": "xx"}, 422)],
    ids=["bad-cursor", "limit-0", "limit-51", "bad-language"],
)
async def test_bad_list_parameters_are_client_errors(
    client: AsyncClient, params: dict[str, object], status: int
) -> None:
    response = await client.get("/api/v1/entries", params=params)

    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
```

`backend/tests/integration/test_analyses_api.py`:
```python
import uuid

from httpx import AsyncClient

from journal_ai.providers.base import ProviderTimeoutError
from tests.support import ApiFactory
from tests.support import YO_ES, model_reply


async def _entry(client: AsyncClient, text: str = "Ayer yo es feliz.") -> str:
    response = await client.post("/api/v1/entries", json={"language": "es", "text": text})
    return str(response.json()["id"])


async def test_analysing_returns_the_stored_analysis(make_api: ApiFactory) -> None:
    async with make_api([model_reply(YO_ES)]) as client:
        entry_id = await _entry(client)
        response = await client.post(f"/api/v1/entries/{entry_id}/analyses")

    body = response.json()
    assert response.status_code == 201
    assert body["status"] == "succeeded"
    assert body["mistakes"][0]["start"] == 5
    assert body["mistakes"][0]["end"] == 10
    assert "raw_response" not in body
    assert "error_detail" not in body


async def test_a_failed_analysis_is_201_with_its_error_code(make_api: ApiFactory) -> None:
    async with make_api([ProviderTimeoutError("slow")]) as client:
        entry_id = await _entry(client)
        response = await client.post(f"/api/v1/entries/{entry_id}/analyses")
        entry = await client.get(f"/api/v1/entries/{entry_id}")

    assert response.status_code == 201
    assert response.json()["status"] == "failed"
    assert response.json()["error_code"] == "provider_timeout"
    assert entry.status_code == 200
    assert entry.json()["latest_analysis"]["status"] == "failed"


async def test_retrying_after_a_failure_makes_the_new_analysis_latest(make_api: ApiFactory) -> None:
    async with make_api([ProviderTimeoutError("slow"), model_reply(YO_ES)]) as client:
        entry_id = await _entry(client)
        await client.post(f"/api/v1/entries/{entry_id}/analyses")
        retry = await client.post(f"/api/v1/entries/{entry_id}/analyses")
        history = await client.get(f"/api/v1/entries/{entry_id}/analyses")
        detail = await client.get(f"/api/v1/entries/{entry_id}")

    assert retry.json()["status"] == "succeeded"
    assert [a["status"] for a in history.json()] == ["succeeded", "failed"]
    assert detail.json()["latest_analysis"]["id"] == retry.json()["id"]


async def test_analysing_an_unknown_entry_is_404(make_api: ApiFactory) -> None:
    async with make_api() as client:
        response = await client.post(f"/api/v1/entries/{uuid.uuid4()}/analyses")

    assert response.status_code == 404
```

`backend/tests/integration/test_journal_flow.py`:
```python
from httpx import AsyncClient

from tests.support import ApiFactory
from tests.support import YO_ES, model_reply

TEXT = "Ayer yo es feliz.\r\n"


async def test_create_analyze_store_retrieve(make_api: ApiFactory) -> None:
    async with make_api([model_reply(YO_ES)]) as client:
        created = (await client.post("/api/v1/entries", json={"language": "es", "text": TEXT})).json()
        await client.post(f"/api/v1/entries/{created['id']}/analyses")
        detail = (await client.get(f"/api/v1/entries/{created['id']}")).json()
        listing = (await client.get("/api/v1/entries")).json()

    analysis = detail["latest_analysis"]
    mistake = analysis["mistakes"][0]
    assert detail["text"] == "Ayer yo es feliz."
    assert analysis["input_text"][mistake["start"] : mistake["end"]] == mistake["original"] == "yo es"
    assert analysis["corrected_text"] == "Ayer yo soy feliz."
    assert listing["items"][0]["latest_status"] == "succeeded"
    assert listing["items"][0]["error_count"] == 1


async def test_the_default_app_runs_the_demo_provider_without_a_key(client: AsyncClient) -> None:
    created = (
        await client.post("/api/v1/entries", json={"language": "es", "text": "Ayer yo es feliz."})
    ).json()

    response = await client.post(f"/api/v1/entries/{created['id']}/analyses")

    assert response.status_code == 201
    assert response.json()["status"] == "succeeded"
    assert response.json()["model"] == "fake"
```

Run: `uv run pytest backend/tests/integration -q` → the new API tests FAIL with 404s (routes not mounted) or import errors.

- [ ] **Step 5: Schemas**

`backend/app/api/schemas/languages.py`:
```python
from pydantic import BaseModel


class LanguageOut(BaseModel):
    code: str
    name: str
```

`backend/app/api/schemas/entries.py`:
```python
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.api.schemas.analyses import AnalysisOut
from app.db.models import AnalysisStatus
from journal_ai import SUPPORTED_LANGUAGES


def _supported(code: str) -> str:
    if code not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {code}")
    return code


LanguageCode = Annotated[str, AfterValidator(_supported)]
EntryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class EntryCreate(BaseModel):
    language: LanguageCode
    text: EntryText


class EntryUpdate(BaseModel):
    text: EntryText


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    language: str
    text: str
    word_count: int
    created_at: datetime
    updated_at: datetime


class EntryDetailOut(EntryOut):
    latest_analysis: AnalysisOut | None


class EntrySummaryOut(BaseModel):
    id: uuid.UUID
    language: str
    preview: str
    word_count: int
    created_at: datetime
    latest_status: AnalysisStatus | None
    error_count: int


class EntryPageOut(BaseModel):
    items: list[EntrySummaryOut]
    next_cursor: str | None
```

`backend/app/api/schemas/analyses.py`:
```python
import uuid
from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.db.models import AnalysisStatus
from journal_ai import Category, FailureCode, MistakeKind


class MistakeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: MistakeKind
    category: Category
    original: str
    correction: str
    explanation: str
    start: int | None = Field(validation_alias=AliasChoices("start_offset", "start"))
    end: int | None = Field(validation_alias=AliasChoices("end_offset", "end"))


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_id: uuid.UUID
    status: AnalysisStatus
    input_text: str
    corrected_text: str | None
    feedback_summary: str | None
    model: str | None
    prompt_version: str
    error_code: FailureCode | None
    latency_ms: int | None
    created_at: datetime
    completed_at: datetime | None
    mistakes: list[MistakeOut]
```

- [ ] **Step 6: Dependencies and routes**

Replace `backend/app/api/deps.py` with:
```python
from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analyses import AnalysisService, AnalyzerPort
from app.services.entries import EntryService


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_analyzer(request: Request) -> AnalyzerPort:
    return cast(AnalyzerPort, request.app.state.analyzer)


def get_entry_service(session: SessionDep) -> EntryService:
    return EntryService(session)


def get_analysis_service(
    session: SessionDep, analyzer: Annotated[AnalyzerPort, Depends(get_analyzer)]
) -> AnalysisService:
    return AnalysisService(session, analyzer)


EntryServiceDep = Annotated[EntryService, Depends(get_entry_service)]
AnalysisServiceDep = Annotated[AnalysisService, Depends(get_analysis_service)]
```

`backend/app/api/routes/languages.py`:
```python
from fastapi import APIRouter

from app.api.schemas.languages import LanguageOut
from journal_ai import SUPPORTED_LANGUAGES

router = APIRouter(prefix="/languages", tags=["languages"])


@router.get("", response_model=list[LanguageOut])
async def list_languages() -> list[LanguageOut]:
    return [LanguageOut(code=code, name=name) for code, name in SUPPORTED_LANGUAGES.items()]
```

`backend/app/api/routes/entries.py`:
```python
import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.cursor import decode_cursor, encode_cursor
from app.api.deps import EntryServiceDep
from app.api.schemas.analyses import AnalysisOut
from app.api.schemas.entries import (
    EntryCreate,
    EntryDetailOut,
    EntryOut,
    EntryPageOut,
    EntrySummaryOut,
    EntryUpdate,
    LanguageCode,
)
from app.services.entries import EntrySummary

router = APIRouter(prefix="/entries", tags=["entries"])
PREVIEW_LENGTH = 140


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EntryOut)
async def create_entry(body: EntryCreate, service: EntryServiceDep) -> EntryOut:
    entry = await service.create(language=body.language, text=body.text)
    return EntryOut.model_validate(entry)


@router.get("", response_model=EntryPageOut)
async def list_entries(
    service: EntryServiceDep,
    language: Annotated[LanguageCode | None, Query()] = None,
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> EntryPageOut:
    page = await service.list_page(
        language=language, cursor=decode_cursor(cursor) if cursor else None, limit=limit
    )
    return EntryPageOut(
        items=[_summary(item) for item in page.items],
        next_cursor=encode_cursor(page.next_cursor) if page.next_cursor else None,
    )


@router.get("/{entry_id}", response_model=EntryDetailOut)
async def get_entry(entry_id: uuid.UUID, service: EntryServiceDep) -> EntryDetailOut:
    entry, latest = await service.get_detail(entry_id)
    return EntryDetailOut(
        **EntryOut.model_validate(entry).model_dump(),
        latest_analysis=AnalysisOut.model_validate(latest) if latest else None,
    )


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(entry_id: uuid.UUID, body: EntryUpdate, service: EntryServiceDep) -> EntryOut:
    return EntryOut.model_validate(await service.update_text(entry_id, body.text))


def _summary(item: EntrySummary) -> EntrySummaryOut:
    text = item.entry.text
    preview = text if len(text) <= PREVIEW_LENGTH else text[:PREVIEW_LENGTH].rstrip() + "…"
    return EntrySummaryOut(
        id=item.entry.id,
        language=item.entry.language,
        preview=preview,
        word_count=item.entry.word_count,
        created_at=item.entry.created_at,
        latest_status=item.latest_status,
        error_count=item.error_count,
    )
```

`backend/app/api/routes/analyses.py`:
```python
import uuid

from fastapi import APIRouter, status

from app.api.deps import AnalysisServiceDep
from app.api.schemas.analyses import AnalysisOut

router = APIRouter(prefix="/entries/{entry_id}/analyses", tags=["analyses"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AnalysisOut)
async def analyze_entry(entry_id: uuid.UUID, service: AnalysisServiceDep) -> AnalysisOut:
    # 201 even when the model failed: the analysis is a stored resource and its failure is part of its data.
    return AnalysisOut.model_validate(await service.run(entry_id))


@router.get("", response_model=list[AnalysisOut])
async def list_analyses(entry_id: uuid.UUID, service: AnalysisServiceDep) -> list[AnalysisOut]:
    return [AnalysisOut.model_validate(a) for a in await service.list_for_entry(entry_id)]
```

`backend/app/api/v1.py`:
```python
from fastapi import APIRouter

from app.api.routes import analyses, entries, languages

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(languages.router)
api_router.include_router(entries.router)
api_router.include_router(analyses.router)
```

In `backend/app/main.py`: add imports `from app.api.v1 import api_router` and `from journal_ai import Analyzer, build_provider`; inside `create_app`, after `register_exception_handlers(app)`:
```python
    api_key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None
    app.state.analyzer = Analyzer(
        build_provider(
            settings.resolved_ai_provider,
            api_key=api_key,
            model=settings.ai_model,
            effort=settings.ai_effort,
            timeout_seconds=settings.ai_timeout_seconds,
            workspace_id=settings.anthropic_workspace_id,
        )
    )
    app.include_router(health.router)
    app.include_router(api_router)
```
(replace the existing single `app.include_router(health.router)` line).

- [ ] **Step 7: Run everything to see it pass**

Run: `uv run pytest backend -q`
Expected: all pass. If `EntryDetailOut(**EntryOut...model_dump(), ...)` trips mypy, build it with `EntryDetailOut.model_validate({**EntryOut.model_validate(entry).model_dump(), "latest_analysis": ...})` — same behaviour.

- [ ] **Step 8: Smoke the real stack**

Run:
```bash
docker compose up -d --build
./scripts/wait-for-url.sh http://localhost:8080/health 180
curl -fsS -X POST http://localhost:8080/api/v1/entries -H 'content-type: application/json' -d '{"language":"es","text":"Ayer yo es feliz en el [grocery store]."}' | tee /tmp/entry.json
curl -fsS -X POST "http://localhost:8080/api/v1/entries/$(python3 -c 'import json;print(json.load(open("/tmp/entry.json"))["id"])')/analyses"
docker compose down
docker compose up -d db
```
Expected: an entry JSON, then a 201 analysis. With no key configured it is `"status":"succeeded"` with two demo mistakes; with the current (not workspace-scoped) key it is `"status":"failed"`, `"error_code":"provider_error"` — both prove the flow persists outcomes. Paste both responses in the report and say which case you hit.

- [ ] **Step 9: Gates and commit**

Run: `make lint typecheck test-backend`
```bash
git add backend/app/api backend/app/main.py backend/tests
git commit -m "feat(backend): /api/v1 entries, analyses and languages endpoints with the end-to-end flow"
git push
```

- [ ] **Step 10: Phase checkpoint**

Dispatch the project `reviewer` agent on the P2 commit range. Fix BLOCKING findings; record SHOULDs for P3. Mark P2 done in the plan index.
