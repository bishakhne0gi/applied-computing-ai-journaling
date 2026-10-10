from types import SimpleNamespace
from typing import Any, cast

import anthropic
import httpx
import pytest
from anthropic import AsyncAnthropic

from journal_ai.providers.anthropic import AnthropicProvider
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from journal_ai.schema import RESPONSE_JSON_SCHEMA, Usage

REQUEST = httpx.Request("POST", "https://api.anthropic.com/v1/messages")


class StubMessages:
    def __init__(self, response: Any = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self.response


def _response(stop_reason: str = "end_turn", text: str = '{"ok": true}') -> SimpleNamespace:
    return SimpleNamespace(
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=120, output_tokens=40),
        model="claude-opus-5-5",
    )


def _provider(messages: StubMessages) -> AnthropicProvider:
    client = cast(AsyncAnthropic, SimpleNamespace(messages=messages))
    return AnthropicProvider(
        api_key="k", model="claude-opus-5-5", effort="medium", timeout_seconds=30, client=client
    )


async def test_sends_structured_output_request_with_explicit_effort() -> None:
    messages = StubMessages(_response())

    await _provider(messages).complete(system="sys", user="usr", schema=RESPONSE_JSON_SCHEMA)

    assert messages.kwargs["model"] == "claude-opus-5-5"
    assert messages.kwargs["system"] == "sys"
    assert messages.kwargs["messages"] == [{"role": "user", "content": "usr"}]
    assert messages.kwargs["output_config"] == {
        "effort": "medium",
        "format": {"type": "json_schema", "schema": RESPONSE_JSON_SCHEMA},
    }


async def test_returns_text_blocks_and_usage() -> None:
    completion = await _provider(StubMessages(_response())).complete(system="s", user="u", schema={})

    assert completion.text == '{"ok": true}'
    assert completion.usage == Usage(input_tokens=120, output_tokens=40)
    assert completion.model == "claude-opus-5-5"


async def test_refusals_become_provider_errors() -> None:
    with pytest.raises(ProviderError, match="refused"):
        await _provider(StubMessages(_response(stop_reason="refusal"))).complete(
            system="s", user="u", schema={}
        )


async def test_timeouts_become_provider_timeouts() -> None:
    messages = StubMessages(error=anthropic.APITimeoutError(request=REQUEST))

    with pytest.raises(ProviderTimeoutError):
        await _provider(messages).complete(system="s", user="u", schema={})


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APIConnectionError(request=REQUEST),
        anthropic.RateLimitError("slow down", response=httpx.Response(429, request=REQUEST), body=None),
        anthropic.InternalServerError("boom", response=httpx.Response(500, request=REQUEST), body=None),
    ],
    ids=["connection", "rate-limit", "server"],
)
async def test_api_errors_become_provider_errors(error: Exception) -> None:
    with pytest.raises(ProviderError):
        await _provider(StubMessages(error=error)).complete(system="s", user="u", schema={})
