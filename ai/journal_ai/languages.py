SUPPORTED_LANGUAGES: dict[str, str] = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
}


def is_supported(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES
