from typing import Literal

from journal_ai.providers.anthropic import AnthropicProvider
from journal_ai.providers.base import CompletionProvider
from journal_ai.providers.fake import FakeProvider

_EFFORTS = ("low", "medium", "high")


def build_provider(
    name: Literal["anthropic", "fake"],
    *,
    api_key: str | None,
    model: str,
    effort: str,
    timeout_seconds: float,
) -> CompletionProvider:
    if effort not in _EFFORTS:
        raise ValueError(f"AI_EFFORT must be one of {', '.join(_EFFORTS)}, got {effort!r}")
    if name == "fake":
        return FakeProvider()
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is required for the anthropic provider")
    return AnthropicProvider(api_key=api_key, model=model, effort=effort, timeout_seconds=timeout_seconds)
