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
