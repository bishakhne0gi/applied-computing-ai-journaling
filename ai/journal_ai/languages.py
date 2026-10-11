import re

SUPPORTED_LANGUAGES: dict[str, str] = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
}


def is_supported(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES


def language_of(prompt: str) -> str:
    # The target language is named first in every prompt; later names only appear in examples.
    # Matches names, not any one prompt's wording, so every prompt the fake provider serves resolves alike.
    found = [
        (m.start(), code)
        for code, name in SUPPORTED_LANGUAGES.items()
        if (m := re.search(rf"\b{name}\b", prompt))
    ]
    if not found:
        raise ValueError("no supported language in the prompt")
    return min(found)[1]
