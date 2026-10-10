import json
import uuid
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from app.api.schemas.insights import InsightsOut
from app.repositories.insights import ErrorRow
from app.services.insights.calculations import compute_insights
from app.services.insights.service import group_entries
from app.services.insights.summary import summarize
from journal_ai import Category

# fixtures/insights-golden.json is shared with frontend/src/mocks/insights.golden.test.ts, so the Python rules
# and the mock API cannot drift apart: both must produce the file's `expected` for the same entries.
GOLDEN = json.loads((Path(__file__).parents[3] / "fixtures" / "insights-golden.json").read_text())["cases"]


def counted_rows(entries: list[dict[str, Any]]) -> list[ErrorRow]:
    rows: list[ErrorRow] = []
    for entry in entries:
        succeeded = [a for a in entry["analyses"] if a["status"] == "succeeded"]
        if not succeeded:
            continue
        # The repository's ordering: newest succeeded analysis, the higher id winning a tie.
        analysis = max(succeeded, key=lambda a: (a["created_at"], a["id"]))
        text = " ".join(["w"] * analysis["words"])
        created_at = datetime.fromisoformat(entry["created_at"])
        entry_id = uuid.UUID(entry["id"])
        if not analysis["errors"]:
            rows.append(ErrorRow(entry_id, created_at, text, None, None, None))
        rows.extend(
            ErrorRow(
                entry_id,
                created_at,
                text,
                Category(error["category"]),
                error["original"],
                error["correction"],
            )
            for error in analysis["errors"]
            for _ in range(error["count"])
        )
    return rows


@pytest.mark.parametrize("case", GOLDEN, ids=[case["name"] for case in GOLDEN])
def test_insights_match_the_golden_output(case: dict[str, Any]) -> None:
    insights = compute_insights(group_entries(counted_rows(case["entries"])))

    actual = InsightsOut.model_validate(replace(insights, summary=summarize(insights))).model_dump(
        mode="json"
    )

    assert actual == case["expected"]
