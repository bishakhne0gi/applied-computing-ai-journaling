import unicodedata


def normalize_text(text: str) -> str:
    unified = text.replace("\r\n", "\n").replace("\r", "\n")
    return unicodedata.normalize("NFC", unified).strip()
