import json
from collections.abc import Callable, Sequence
from contextlib import AbstractAsyncContextManager
from datetime import datetime
from typing import Protocol

from fastapi import FastAPI
from httpx import AsyncClient

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, MistakeKind

ClientFactory = Callable[[FastAPI], AbstractAsyncContextManager[AsyncClient]]


class ApiFactory(Protocol):
    def __call__(
        self, script: Sequence[str | Exception] | None = None
    ) -> AbstractAsyncContextManager[AsyncClient]: ...


class LiveApiFactory(Protocol):
    def __call__(
        self, script: Sequence[str | Exception] | None = None, *, analyzer: object | None = None
    ) -> AbstractAsyncContextManager[AsyncClient]: ...


def entry_at(created_at: datetime, language: str = "es", text: str = "Hola mundo") -> Entry:
    return Entry(
        language=language,
        text=text,
        word_count=len(text.split()),
        created_at=created_at,
        updated_at=created_at,
    )


def mistake(
    category: Category,
    *,
    kind: MistakeKind = MistakeKind.ERROR,
    original: str = "x",
    correction: str = "y",
    position: int = 0,
) -> Mistake:
    return Mistake(
        kind=kind,
        category=category,
        original=original,
        correction=correction,
        explanation="z",
        position=position,
    )


def analysis_for(
    entry: Entry,
    *,
    status: AnalysisStatus,
    created_at: datetime,
    errors: int = 0,
    suggestions: int = 0,
    mistakes: Sequence[Mistake] = (),
) -> Analysis:
    kinds = [MistakeKind.ERROR] * errors + [MistakeKind.SUGGESTION] * suggestions
    generated = [mistake(Category.OTHER, kind=kind, position=index) for index, kind in enumerate(kinds)]
    return Analysis(
        entry=entry,
        status=status,
        input_text=entry.text,
        prompt_version="v1",
        created_at=created_at,
        mistakes=[*generated, *mistakes],
    )


YO_ES = {
    "kind": "error",
    "category": "verb_conjugation",
    "original": "yo es",
    "correction": "yo soy",
    "explanation": "Ser with yo is soy.",
}


def model_reply(
    *mistakes: dict[str, str], corrected: str = "Ayer yo soy feliz.", summary: str = "Nice work!"
) -> str:
    return json.dumps({"corrected_text": corrected, "feedback_summary": summary, "mistakes": list(mistakes)})
