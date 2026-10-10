from typing import Any

import sentry_sdk

from app.core.config import Settings

SCRUBBED = "[scrubbed]"


def scrub_event(event: Any, _hint: Any) -> Any:
    request = event.get("request")
    if isinstance(request, dict) and "data" in request:
        request["data"] = SCRUBBED
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.release,
        send_default_pii=False,
        traces_sample_rate=0.1,
        before_send=scrub_event,
    )
