import unicodedata


def unify_text(text: str) -> str:
    """Line endings and NFC only: a completion prefix must keep its trailing space."""
    unified = text.replace("\r\n", "\n").replace("\r", "\n")
    return unicodedata.normalize("NFC", unified)


def normalize_text(text: str) -> str:
    return unify_text(text).strip()
