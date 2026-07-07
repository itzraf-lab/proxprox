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

QILLIN_INTERNAL_URL = os.environ.get("QILLIN_INTERNAL_URL", "http://localhost:8080")
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
            print(f"[QillinLogger] _fire called, model={kwargs.get('model')}")
            # User ID lookup order:
            # 1. "user" field in the OpenAI request body (set by LiteLLM from virtual-key user association)
            # 2. litellm_params["user"] (same, different nesting)
            # 3. metadata["user_id"] (explicit metadata injection)
            # 4. metadata["headers"]["x-user-id"] — the header Qillin's proxy middleware sets
            #    LiteLLM stores all request headers in kwargs["metadata"]["headers"]
            # 5. user_api_key_user_id from LiteLLM key auth
            metadata = kwargs.get("metadata") or {}
            headers = metadata.get("headers") or {}
            user_id = (
                kwargs.get("user")
                or kwargs.get("litellm_params", {}).get("user")
                or metadata.get("user_id")
                or headers.get("x-user-id")
                or metadata.get("user_api_key_user_id")
            )
            if not user_id:
                lp = kwargs.get("litellm_params") or {}
                lp_meta = lp.get("metadata") or {}
                lp_headers = lp_meta.get("headers") or {}
                slo = kwargs.get("standard_logging_object") or {}
                # Log only header keys (never values) to avoid leaking auth tokens.
                print(
                    f"[QillinLogger] No user_id found — skipping event. "
                    f"header_keys={sorted(lp_headers.keys())!r} "
                    f"lp_meta.user_api_key_user_id={'present' if lp_meta.get('user_api_key_user_id') else 'absent'} "
                    f"slo.user_api_key_user_id={'present' if slo.get('user_api_key_user_id') else 'absent'}"
                )
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

# LiteLLM proxy uses async completions, so callbacks must be in
# litellm._async_success_callback — the sync success_callback list is never
# invoked for proxy requests.  We self-register here to guarantee placement.
try:
    import litellm as _litellm
    if qillin_logger not in _litellm._async_success_callback:
        _litellm._async_success_callback.append(qillin_logger)
    print("[QillinLogger] Registered in litellm._async_success_callback")
except Exception as _e:
    print(f"[QillinLogger] Could not self-register in async callback list: {_e}")
