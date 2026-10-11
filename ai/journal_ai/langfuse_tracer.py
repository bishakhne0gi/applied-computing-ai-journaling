import logging

from langfuse import Langfuse, LangfuseGeneration
from langfuse.types import SpanLevel

from journal_ai.prompts.v1 import PROMPT_VERSION
from journal_ai.schema import AnalysisOutcome
from journal_ai.tracing import NoopTracer, Trace, Tracer, trace_metadata

logger = logging.getLogger(__name__)


class _LangfuseTrace:
    def __init__(self, generation: LangfuseGeneration, language: str) -> None:
        self._generation = generation
        self._language = language

    def finish(self, outcome: AnalysisOutcome) -> None:
        level: SpanLevel = "ERROR" if outcome.failure else "DEFAULT"
        self._generation.update(
            model=outcome.model,
            usage_details={"input": outcome.usage.input_tokens, "output": outcome.usage.output_tokens},
            metadata=trace_metadata(outcome, self._language),
            level=level,
            status_message=outcome.failure.value if outcome.failure else None,
        )
        self._generation.end()

    def abort(self) -> None:
        self._generation.update(level="ERROR", status_message="interrupted")
        self._generation.end()


class LangfuseTracer:
    def __init__(self, client: Langfuse) -> None:
        self.client = client

    def start(self, *, language: str) -> Trace:
        # No `input`/`output`: traces are metadata-only by design (see trace_metadata).
        generation = self.client.start_observation(
            as_type="generation",
            name="analyze_entry",
            version=PROMPT_VERSION,
            metadata={"language": language},
        )
        return _LangfuseTrace(generation, language)

    def shutdown(self) -> None:
        self.client.shutdown()


def build_tracer(
    *,
    public_key: str | None,
    secret_key: str | None,
    host: str | None,
    environment: str | None = None,
    release: str | None = None,
) -> Tracer:
    # All three or nothing: without an explicit host the SDK falls back to its US cloud, which would send an
    # EU or self-hosted user's traces to the wrong place.
    if not (public_key and secret_key and host):
        return NoopTracer()
    try:
        client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            base_url=host,
            environment=environment,
            release=release,
        )
    except Exception as exc:
        # Class name only: the message can echo the keys or host we were given.
        logger.warning("Langfuse tracing disabled: client failed to start (%s)", type(exc).__name__)
        return NoopTracer()
    return LangfuseTracer(client)
