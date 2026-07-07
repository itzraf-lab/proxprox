"""
Qillin LiteLLM CustomLogger

After every successful LLM response, this callback POSTs usage data to the
Qillin API server's internal endpoint. The API server then:
  - Inserts the record into activity_log
  - Deducts Qredits from the user's balance

Registered in litellm-proxy/config.yaml as:
  litellm_settings:
    success_callback: ["qillin_callback.qillin_logger"]
"""
import os
import asyncio
import threading
from litellm.integrations.custom_logger import CustomLogger

QILLIN_INTERNAL_URL = os.environ.get("QILLIN_INTERNAL_URL", "http://localhost:3001")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")


def _post_event_sync(payload: dict) -> None:
    """Fire-and-forget HTTP POST using urllib (no extra deps)."""
    import urllib.request
    import urllib.error
    import json

    url = f"{QILLIN_INTERNAL_URL}/api/internal/litellm-event"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_MASTER_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as _:
            pass
    except Exception as exc:
        print(f"[QillinLogger] Failed to post event: {exc}")


class QillinLogger(CustomLogger):
    """Send per-request usage + cost data to Qillin after every success."""

    def _fire(self, kwargs: dict, response_obj, start_time, end_time) -> None:
        try:
            # User ID injected by the Qillin proxy as x-user-id header,
            # which LiteLLM surfaces as kwargs["user"].
            user_id = (
                kwargs.get("user")
                or kwargs.get("litellm_params", {}).get("user")
                or kwargs.get("metadata", {}).get("user_id")
            )
            if not user_id:
                return  # anonymous or non-tracked request

            model = kwargs.get("model", "unknown")
            response_cost = kwargs.get("response_cost") or 0.0

            usage = getattr(response_obj, "usage", None)
            tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0)
            tokens_out = int(getattr(usage, "completion_tokens", 0) or 0)

            latency_ms = 0
            if start_time and end_time:
                try:
                    latency_ms = int((end_time - start_time).total_seconds() * 1000)
                except Exception:
                    latency_ms = 0

            payload = {
                "userId": user_id,
                "model": model,
                "tokensIn": tokens_in,
                "tokensOut": tokens_out,
                "spend": float(response_cost),
                "latencyMs": latency_ms,
            }

            # Post in a background thread so we never block LiteLLM's response loop
            threading.Thread(
                target=_post_event_sync, args=(payload,), daemon=True
            ).start()
        except Exception as exc:
            print(f"[QillinLogger] Unexpected error in _fire: {exc}")

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._fire(kwargs, response_obj, start_time, end_time)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._fire(kwargs, response_obj, start_time, end_time)


# LiteLLM loads this instance via the module path "qillin_callback.qillin_logger"
qillin_logger = QillinLogger()
