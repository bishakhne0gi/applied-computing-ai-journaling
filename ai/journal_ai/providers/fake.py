import json
import re
from collections import deque
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from journal_ai.languages import language_of
from journal_ai.prompts.assist_v1 import extract_sentence
from journal_ai.prompts.v2 import extract_entry
from journal_ai.providers.base import Completion
from journal_ai.providers.demo_assist import demo_completion, demo_rephrase
from journal_ai.schema import COMPLETION_JSON_SCHEMA, REPHRASE_JSON_SCHEMA, Category, Usage

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
_DEMO_FOREIGN: dict[str, dict[str, str]] = {
    "es": {"market": "mercado", "beach": "playa", "happy": "feliz"},
    "fr": {"market": "marché", "beach": "plage", "happy": "heureux"},
}


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
            return Completion(text=_demo(system, user, schema), usage=Usage(), model=self.model)
        step = self._script.popleft()
        if isinstance(step, Exception):
            raise step
        return Completion(text=step, usage=Usage(), model=self.model)


def _demo(system: str, user: str, schema: Mapping[str, Any]) -> str:
    # Dispatch on the schema object so the analysis path stays exactly as it was.
    if schema is REPHRASE_JSON_SCHEMA:
        sentence = extract_sentence(user)
        return demo_rephrase(language_of(system), sentence, _correct(sentence))
    if schema is COMPLETION_JSON_SCHEMA:
        return demo_completion(language_of(system))
    return _demo_response(extract_entry(user), language_of(system))


def _correct(text: str) -> str:
    for wrong, right, _category, _explanation in _DEMO_RULES:
        text = re.sub(rf"\b{re.escape(wrong)}\b", _case_preserving(right), text, flags=re.IGNORECASE)
    return text


def _demo_response(entry: str, language: str) -> str:
    mistakes: list[dict[str, str]] = []
    for wrong, right, category, explanation in _DEMO_RULES:
        for found in re.finditer(rf"\b{re.escape(wrong)}\b", entry, re.IGNORECASE):
            mistakes.append(_item("error", category, found.group(0), right, explanation))
    for match in _BRACKETED.finditer(entry):
        explanation = "Demo mode cannot translate. Set ANTHROPIC_API_KEY for real help."
        mistakes.append(_item("vocab_help", Category.VOCABULARY, match.group(0), match.group(1), explanation))
    for found, native in _foreign_words(entry, language):
        explanation = f"Demo mode: «{found.group(0)}» is English; this is the word to use."
        mistakes.append(_item("vocab_help", Category.VOCABULARY, found.group(0), native, explanation))
    corrected = _BRACKETED.sub(r"\1", _replace_foreign(_correct(entry), language))
    summary = "Demo feedback. Configure Claude for real corrections."
    return json.dumps({"corrected_text": corrected, "feedback_summary": summary, "mistakes": mistakes})


def _foreign_words(text: str, language: str) -> list[tuple[re.Match[str], str]]:
    # Words inside [brackets] are already bracket help, so they are left to that rule.
    spans = [m.span() for m in _BRACKETED.finditer(text)]
    found = []
    for english, native in _DEMO_FOREIGN.get(language, {}).items():
        for match in re.finditer(rf"(?<![\[\w]){english}(?![\w\]])", text, re.IGNORECASE):
            if not any(start <= match.start() < end for start, end in spans):
                found.append((match, native))
    return found


def _replace_foreign(text: str, language: str) -> str:
    for match, native in sorted(_foreign_words(text, language), key=lambda pair: -pair[0].start()):
        text = text[: match.start()] + native + text[match.end() :]
    return text


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
