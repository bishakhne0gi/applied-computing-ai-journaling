import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models._common import str_enum, utcnow
from journal_ai.schema import FailureCode

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
