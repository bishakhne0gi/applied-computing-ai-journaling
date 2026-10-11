import argparse
import asyncio
import os
import sys
from collections.abc import Sequence
from typing import Literal, cast

from evals.dataset import EvalCase, interleave, load_dataset
from evals.scoring import CaseScore, Expected, failed_case, score_case, summarise
from journal_ai import Analyzer, build_provider, build_tracer


async def _score_all(analyzer: Analyzer, cases: Sequence[EvalCase]) -> list[CaseScore]:
    scores = []
    for case in cases:
        outcome = await analyzer.analyze(case.text, case.language)
        expected = [Expected(original=e.original, categories=frozenset(e.categories)) for e in case.expected]
        predicted = outcome.result.mistakes if outcome.result else ()
        if outcome.succeeded:
            scores.append(score_case(expected, predicted, outcome.latency_ms))
        else:
            scores.append(failed_case(len(expected)))
        status = "ok" if outcome.succeeded else f"FAILED ({outcome.failure}) {outcome.error_detail}"
        print(f"{case.id:<20} {status}")
    return scores


async def _evaluate(analyzer: Analyzer, cases: Sequence[EvalCase]) -> list[CaseScore]:
    try:
        return await _score_all(analyzer, cases)
    finally:
        await analyzer.aclose()


def _positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{value!r} is not an integer") from None
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def main() -> None:
    parser = argparse.ArgumentParser(description="Score the analyzer against the labelled dataset.")
    parser.add_argument("--provider", choices=["anthropic", "fake"], default="anthropic")
    parser.add_argument(
        "--limit", type=_positive_int, default=None, help="first N cases, languages interleaved"
    )
    args = parser.parse_args()

    provider = build_provider(
        cast(Literal["anthropic", "fake"], args.provider),
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        workspace_id=os.environ.get("ANTHROPIC_WORKSPACE_ID"),
        model=os.environ.get("AI_MODEL", "claude-opus-5-5"),
        effort=os.environ.get("AI_EFFORT", "medium"),
        timeout_seconds=float(os.environ.get("AI_TIMEOUT_SECONDS", "30")),
    )
    cases = interleave(load_dataset())[: args.limit]
    tracer = build_tracer(
        public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
        host=os.environ.get("LANGFUSE_HOST"),
        environment="eval",
    )
    report = summarise(asyncio.run(_evaluate(Analyzer(provider, tracer), cases)))

    print(
        f"\nprovider={provider.model} cases={report.cases} failed={report.failed} recall={report.recall:.0%} "
        f"category_accuracy={report.category_accuracy:.0%} "
        f"false_positive_rate={report.false_positive_rate:.0%} "
        f"p50_latency_ms={report.p50_latency_ms}"
    )
    if report.failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
