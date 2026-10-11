import json
from pathlib import Path
from typing import Any

import pytest

from journal_ai.analyzer import Analyzer
from journal_ai.assist import WritingAssist
from journal_ai.providers.fake import FakeProvider

GOLDEN = json.loads((Path(__file__).parents[2] / "fixtures" / "assist-demo.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", GOLDEN["rephrase"])
async def test_demo_rephrase_matches_the_golden_fixture(case: dict[str, Any]) -> None:
    outcome = await WritingAssist(FakeProvider()).rephrase(
        case["text"], case["start"], case["end"], case["language"]
    )
    assert outcome.result is not None
    assert outcome.result.model_dump(mode="json") == case["expected"]


@pytest.mark.parametrize("case", GOLDEN["complete"])
async def test_demo_completion_matches_the_golden_fixture(case: dict[str, Any]) -> None:
    outcome = await WritingAssist(FakeProvider()).complete(case["text"], case["language"])
    assert outcome.completion == case["expected"]


async def test_the_demo_analysis_is_unchanged_by_the_dispatch() -> None:
    outcome = await Analyzer(FakeProvider()).analyze("Hoy yo es feliz.", "es")
    assert [m.original for m in outcome.result.mistakes] == ["yo es"]  # type: ignore[union-attr]
