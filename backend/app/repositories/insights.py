import uuid
from dataclasses import dataclass
from datetime import datetime

from journal_ai import Category


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
