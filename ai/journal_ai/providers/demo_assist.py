import json

from journal_ai.alignment import find_word_span

_EXPLANATION = "Demo mode: a scripted rewrite. Set ANTHROPIC_API_KEY for real versions."

# Per language: (formal opener, casual tag).
_TONES: dict[str, tuple[str, str]] = {
    "es": ("Sinceramente, ", " sin duda"),
    "fr": ("Franchement, ", " sans doute"),
    "de": ("Ehrlich gesagt ", " ohne Zweifel"),
    "it": ("Sinceramente, ", " senza dubbio"),
    "pt": ("Sinceramente, ", " sem dúvida"),
}

_COMPLETIONS: dict[str, str] = {
    "es": " y fue un buen día.",
    "fr": " et c'était une bonne journée.",
    "de": " und es war ein schöner Tag.",
    "it": " ed è stata una bella giornata.",
    "pt": " e foi um bom dia.",
}

_SYNONYMS: dict[str, dict[str, tuple[tuple[str, str], ...]]] = {
    "es": {
        "feliz": (
            ("contento", "Demo mode: everyday and a little softer."),
            ("alegre", "Demo mode: cheerful, outgoing."),
        ),
        "bonito": (
            ("precioso", "Demo mode: more striking."),
            ("lindo", "Demo mode: warmer, more casual."),
        ),
    },
    "fr": {
        "content": (
            ("heureux", "Demo mode: a deeper, steadier happiness."),
            ("ravi", "Demo mode: delighted, a little formal."),
        ),
    },
}


def demo_completion(language: str) -> str:
    return json.dumps({"completion": _COMPLETIONS[language]})


def demo_rephrase(language: str, sentence: str, corrected: str) -> str:
    opener, tag = _TONES[language]
    candidates = (
        ("natural", "More natural", corrected),
        ("formal", "More formal", opener + corrected[:1].lower() + corrected[1:]),
        ("casual", "More casual", _before_final_punctuation(corrected, tag)),
    )
    versions = [
        {"text": text, "tone": tone, "label": label, "explanation": _EXPLANATION}
        for tone, label, text in candidates
    ]
    return json.dumps({"versions": versions, "vocabulary": _vocabulary(language, sentence)})


def _before_final_punctuation(text: str, tag: str) -> str:
    stripped = text.rstrip(".!?…")
    return stripped + tag + text[len(stripped) :]


def _vocabulary(language: str, sentence: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for word, alternatives in _SYNONYMS.get(language, {}).items():
        span = find_word_span(sentence, word)
        if span is not None:
            items.append(
                {
                    "original": sentence[span[0] : span[1]],
                    "alternatives": [{"word": w, "nuance": nuance} for w, nuance in alternatives],
                }
            )
    return items
