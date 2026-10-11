import unicodedata

from journal_ai.alignment import _find_spans, align_mistakes, find_word_span
from journal_ai.schema import Category, Mistake, MistakeKind


def _m(original: str, correction: str = "X", category: Category = Category.OTHER) -> Mistake:
    return Mistake(
        kind=MistakeKind.ERROR,
        category=category,
        original=original,
        correction=correction,
        explanation="Why.",
    )


def _spans(text: str, *mistakes: Mistake) -> list[tuple[int | None, int | None]]:
    return [(m.start, m.end) for m in align_mistakes(text, mistakes).mistakes]


def test_offsets_slice_back_to_the_original_snippet() -> None:
    text = "Ayer yo es muy feliz."

    aligned = align_mistakes(text, [_m("yo es", "yo soy")]).mistakes[0]

    assert aligned.start is not None
    assert aligned.end is not None
    assert text[aligned.start : aligned.end] == "yo es"


def test_repeated_snippets_map_to_distinct_occurrences() -> None:
    text = "la problema y la problema"

    assert _spans(text, _m("la problema"), _m("la problema")) == [(0, 11), (14, 25)]


def test_a_third_listing_of_a_twice_occurring_snippet_is_a_duplicate() -> None:
    text = "la problema y la problema"

    alignment = align_mistakes(text, [_m("la problema")] * 3)

    assert len(alignment.mistakes) == 2
    assert alignment.duplicates == 1


def test_overlapping_snippets_leave_the_later_one_unaligned() -> None:
    text = "Tengo la problema."

    assert _spans(text, _m("la problema"), _m("problema", "problemas")) == [(6, 17), (None, None)]


def test_same_span_with_a_different_correction_is_kept_unaligned() -> None:
    text = "Tengo la problema."

    alignment = align_mistakes(text, [_m("la", "el"), _m("la", "una")])

    assert [(m.start, m.correction) for m in alignment.mistakes] == [(6, "el"), (None, "una")]
    assert alignment.duplicates == 0


def test_falls_back_to_a_case_and_whitespace_insensitive_match() -> None:
    text = "Hoy  Fui a el parque."

    assert _spans(text, _m("hoy fui")) == [(0, 8)]


def test_decomposed_snippets_match_composed_text() -> None:
    text = "Él está en el café."
    snippet = unicodedata.normalize("NFD", "café")

    assert _spans(text, _m(snippet)) == [(14, 18)]


def test_offsets_are_code_points_after_emoji() -> None:
    text = "🎉🎉 yo es feliz"

    aligned = align_mistakes(text, [_m("yo es")]).mistakes[0]

    assert (aligned.start, aligned.end) == (3, 8)
    assert text[3:8] == "yo es"


def test_unfound_snippets_are_kept_without_offsets() -> None:
    assert _spans("Hola mundo", _m("adiós")) == [(None, None)]


def test_results_are_ordered_by_position_with_unaligned_last() -> None:
    text = "uno dos tres"

    alignment = align_mistakes(text, [_m("tres"), _m("nada"), _m("uno")])

    assert [m.original for m in alignment.mistakes] == ["uno", "tres", "nada"]


def test_word_bounded_match_wins_over_an_in_word_occurrence() -> None:
    text = "Voy a la plaza con la amiga"

    assert _spans(text, _m("la"), _m("la")) == [(6, 8), (19, 21)]


def test_snippet_found_only_inside_a_word_still_aligns() -> None:
    assert _spans("superbien", _m("bien")) == [(5, 9)]


def test_exact_case_match_is_preferred_over_a_case_only_match() -> None:
    assert _spans("Casa y casa", _m("casa")) == [(7, 11)]


def test_accented_word_boundary_is_respected() -> None:
    assert _spans("él está", _m("está")) == [(3, 7)]


def test_whitespace_only_snippet_yields_no_span() -> None:
    # Mistake and AlignedMistake both reject whitespace-only originals, so guard the helper directly.
    assert _find_spans("Hola mundo", "   ") == []


def test_find_word_span_takes_the_first_whole_word_and_never_matches_inside_a_word() -> None:
    assert find_word_span("casada y casa", "casa") == (9, 13)
    assert find_word_span("superbien", "bien") is None
