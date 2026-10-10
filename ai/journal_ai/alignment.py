import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass

from journal_ai.schema import AlignedMistake, Mistake

Span = tuple[int, int]


@dataclass(frozen=True)
class Alignment:
    mistakes: tuple[AlignedMistake, ...]
    duplicates: int


def align_mistakes(text: str, mistakes: Sequence[Mistake]) -> Alignment:
    placed: dict[Span, Mistake] = {}
    aligned: list[AlignedMistake] = []
    duplicates = 0

    for mistake in mistakes:
        spans = _find_spans(text, mistake.original)
        free = next((s for s in spans if not any(_overlaps(s, p) for p in placed)), None)
        if free is not None:
            placed[free] = mistake
            aligned.append(_with_span(mistake, free))
        elif _is_duplicate(mistake, spans, placed):
            duplicates += 1
        else:
            aligned.append(_with_span(mistake, None))

    aligned.sort(key=lambda m: (m.start is None, m.start or 0))
    return Alignment(tuple(aligned), duplicates)


def _find_spans(text: str, snippet: str) -> list[Span]:
    snippet = unicodedata.normalize("NFC", snippet)
    exact = [(m.start(), m.end()) for m in re.finditer(re.escape(snippet), text)]
    if exact:
        return exact
    loose = re.compile(r"\s+".join(re.escape(part) for part in snippet.split()), re.IGNORECASE)
    return [(m.start(), m.end()) for m in loose.finditer(text)]


def _overlaps(a: Span, b: Span) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _is_duplicate(mistake: Mistake, spans: list[Span], placed: dict[Span, Mistake]) -> bool:
    # Only an exact repeat (every occurrence already taken by the same correction) is noise worth dropping.
    taken = [placed[s] for s in spans if s in placed]
    return bool(spans) and len(taken) == len(spans) and any(m.correction == mistake.correction for m in taken)


def _with_span(mistake: Mistake, span: Span | None) -> AlignedMistake:
    start, end = span if span is not None else (None, None)
    return AlignedMistake(**mistake.model_dump(), start=start, end=end)
