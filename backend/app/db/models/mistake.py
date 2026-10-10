import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models._common import str_enum
from journal_ai.schema import Category, MistakeKind

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
