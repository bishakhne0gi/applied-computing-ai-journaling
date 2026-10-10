from collections.abc import Mapping
from typing import Any, cast

import anthropic
from anthropic import AsyncAnthropic
from anthropic.types import OutputConfigParam

from journal_ai.providers.base import Completion, ProviderError, ProviderTimeoutError
from journal_ai.schema import Usage

MAX_TOKENS = 16_000


class AnthropicProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        effort: str,
        timeout_seconds: float,
        client: AsyncAnthropic | None = None,
    ) -> None:
        self._model = model
        self._effort = effort
        # One SDK retry keeps a synchronous request's worst case bounded; the analyzer adds one parse retry.
        self._client = client or AsyncAnthropic(api_key=api_key, timeout=timeout_seconds, max_retries=1)

    @property
    def model(self) -> str:
        return self._model

    async def complete(self, *, system: str, user: str, schema: Mapping[str, Any]) -> Completion:
        output_config = cast(
            OutputConfigParam,
            {"effort": self._effort, "format": {"type": "json_schema", "schema": dict(schema)}},
        )
        try:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config=output_config,
            )
        except anthropic.APITimeoutError as exc:
            raise ProviderTimeoutError(str(exc)) from exc
        except anthropic.APIError as exc:
            raise ProviderError(str(exc)) from exc

        if response.stop_reason == "refusal":
            raise ProviderError("model refused the request")
        text = "".join(block.text for block in response.content if block.type == "text")
        usage = Usage(input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens)
        return Completion(text=text, usage=usage, model=response.model)
