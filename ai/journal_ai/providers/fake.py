import json
import re
from collections import deque
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from journal_ai.prompts.v1 import extract_entry
from journal_ai.providers.base import Completion
from journal_ai.schema import Category, Usage

# Deterministic demo rules so the app is explorable without an API key.
_DEMO_RULES: tuple[tuple[str, str, Category, str], ...] = (
    (
        "la problema",
        "el problema",
        Category.GENDER_AGREEMENT,
        "«Problema» is masculine even though it ends in -a.",
    ),
    ("yo es", "yo soy", Category.VERB_CONJUGATION, "With «yo», «ser» is conjugated «soy»."),
    ("a el", "al", Category.ARTICLE, "«A» + «el» always contracts to «al»."),
    ("à le", "au", Category.ARTICLE, "«À» + «le» always contracts to «au»."),
)
_BRACKETED = re.compile(r"\[([^\[\]]+)\]")


class FakeProvider:
    def __init__(self, script: Sequence[str | Exception] | None = None) -> None:
        self._script = deque(script) if script is not None else None
        self.calls: list[tuple[str, str]] = []

    @property
    def model(self) -> str:
        return "fake"

    async def aclose(self) -> None:
        return None

    async def complete(self, *, system: str, user: str, schema: Mapping[str, Any]) -> Completion:
        # Demo mode runs in a long-lived backend; recording there would leak memory and retain entry text.
        if self._script is not None:
            self.calls.append((system, user))
        if self._script is None:
            return Completion(text=_demo_response(extract_entry(user)), usage=Usage(), model=self.model)
        step = self._script.popleft()
        if isinstance(step, Exception):
            raise step
        return Completion(text=step, usage=Usage(), model=self.model)


def _demo_response(entry: str) -> str:
    mistakes: list[dict[str, str]] = []
    corrected = entry
    for wrong, right, category, explanation in _DEMO_RULES:
        pattern = re.compile(rf"\b{re.escape(wrong)}\b", re.IGNORECASE)
        for found in pattern.finditer(entry):
            mistakes.append(_item("error", category, found.group(0), right, explanation))
        corrected = pattern.sub(_case_preserving(right), corrected)
    for match in _BRACKETED.finditer(entry):
        explanation = "Demo mode cannot translate — set ANTHROPIC_API_KEY for real help."
        mistakes.append(_item("vocab_help", Category.VOCABULARY, match.group(0), match.group(1), explanation))
    corrected = _BRACKETED.sub(r"\1", corrected)
    summary = "Demo feedback — configure Claude for real corrections."
    return json.dumps({"corrected_text": corrected, "feedback_summary": summary, "mistakes": mistakes})


def _case_preserving(replacement: str) -> Callable[[re.Match[str]], str]:
    # Sentence-initial matches ("La problema") must stay capitalised after correction.
    def substitute(found: re.Match[str]) -> str:
        return replacement[0].upper() + replacement[1:] if found.group(0)[0].isupper() else replacement

    return substitute


def _item(kind: str, category: Category, original: str, correction: str, explanation: str) -> dict[str, str]:
    return {
        "kind": kind,
        "category": category.value,
        "original": original,
        "correction": correction,
        "explanation": explanation,
    }
