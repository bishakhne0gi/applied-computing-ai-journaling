import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.services.insights.calculations import InsightsStatus, Trend
from journal_ai import Category


class ExampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    original: str
    correction: str


class RatePointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entry_id: uuid.UUID
    created_at: datetime
    word_count: int
    error_count: int
    rate: float | None


class CategoryInsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: Category
    occurrences: int
    recent_entries: int
    recurring: bool
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    latest_example: ExampleOut


class InsightsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: InsightsStatus
    entry_count: int
    total_words: int
    total_errors: int
    error_rate: float | None
    earlier_rate: float | None
    recent_rate: float | None
    trend: Trend | None
    recurring_window: int
    points: list[RatePointOut]
    categories: list[CategoryInsightOut]
    summary: list[str]
