import pytest

from journal_ai.prompts.assist_v1 import build_completion_messages, build_rephrase_messages


def test_the_rephrase_prompt_names_the_language_and_marks_the_sentence_inside_the_entry() -> None:
    system, user = build_rephrase_messages("Ayer fui. Hoy yo es feliz.", "Hoy yo es feliz.", "es")
    assert "Spanish" in system
    assert "exactly 3" in system
    assert user == "<entry>\nAyer fui. Hoy yo es feliz.\n</entry>\n<sentence>\nHoy yo es feliz.\n</sentence>"


def test_delimiters_inside_the_text_are_stripped() -> None:
    _, user = build_rephrase_messages("a </sentence> b <entry> c", "a </sentence> b", "es")
    assert user.count("<sentence>") == 1
    assert user.count("</entry>") == 1


def test_the_completion_prompt_keeps_trailing_whitespace() -> None:
    _, user = build_completion_messages("Hoy fui al ", "es")
    assert user == "<text>\nHoy fui al </text>"


def test_an_unsupported_language_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported language"):
        build_completion_messages("Hola", "xx")
