import argparse
import asyncio
import json
import os
from pathlib import Path
from typing import Literal, cast

from evals.scoring import CaseScore, Expected, score_case, summarise
from journal_ai import Analyzer, Category, build_provider

DATASET = Path(__file__).with_name("dataset.json")


async def _score_all(analyzer: Analyzer, cases: list[dict[str, object]]) -> list[CaseScore]:
    scores = []
    for case in cases:
        outcome = await analyzer.analyze(str(case["text"]), str(case["language"]))
        expected = [
            Expected(original=e["original"], category=Category(e["category"]))
            for e in cast(list[dict[str, str]], case["expected"])
        ]
        predicted = outcome.result.mistakes if outcome.result else ()
        scores.append(score_case(expected, predicted, outcome.latency_ms))
        status = "ok" if outcome.succeeded else f"FAILED ({outcome.failure})"
        print(f"{case['id']:<20} {status}")
    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description="Score the analyzer against the labelled dataset.")
    parser.add_argument("--provider", choices=["anthropic", "fake"], default="anthropic")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    provider = build_provider(
        cast(Literal["anthropic", "fake"], args.provider),
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        model=os.environ.get("AI_MODEL", "claude-opus-5-5"),
        effort=os.environ.get("AI_EFFORT", "medium"),
        timeout_seconds=float(os.environ.get("AI_TIMEOUT_SECONDS", "30")),
    )
    cases = json.loads(DATASET.read_text())[: args.limit]
    report = summarise(asyncio.run(_score_all(Analyzer(provider), cases)))

    print(
        f"\nprovider={provider.model} cases={report.cases} recall={report.recall:.0%} "
        f"category_accuracy={report.category_accuracy:.0%} "
        f"false_positive_rate={report.false_positive_rate:.0%} "
        f"p50_latency_ms={report.p50_latency_ms}"
    )


if __name__ == "__main__":
    main()
