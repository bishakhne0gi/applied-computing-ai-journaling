import unicodedata

from journal_ai.text import normalize_text


def test_normalize_text_composes_accents() -> None:
    decomposed = unicodedata.normalize("NFD", "café")

    assert normalize_text(decomposed) == "café"
    assert len(normalize_text(decomposed)) == 4


def test_normalize_text_unifies_line_endings_and_trims() -> None:
    assert normalize_text("  Hola\r\nmundo\r ") == "Hola\nmundo"
