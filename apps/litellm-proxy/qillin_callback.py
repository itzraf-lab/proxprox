"""
Qillin LiteLLM CustomLogger

After every LLM response (and after streams that break mid-flight), this
callback POSTs usage data to the Qillin API server's internal endpoint.
The API server then:
  - Inserts the record into activity_log
  - Deducts Qredits from the user's balance

Token counts and spend come straight from LiteLLM:
  - usage is provider-reported (config.yaml sets always_include_stream_usage,
    so even OpenAI-style streams carry a final usage chunk), and
  - response_cost is computed by LiteLLM from the per-token prices Qillin
    pushes into every deployment (including cache read/write prices).
Qillin never estimates or recomputes either.

Registered in litellm-proxy/config.yaml as:
  litellm_settings:
    success_callback: ["qillin_callback.qillin_logger"]
"""
import os
import time
import threading
from litellm.integrations.custom_logger import CustomLogger

# Imported for its startup side effect: disables LiteLLM's static per-provider
# param gates so user payloads pass through verbatim (see qillin_passthrough.py).
import qillin_passthrough  # noqa: F401

QILLIN_INTERNAL_URL = os.environ.get("QILLIN_INTERNAL_URL", "http://localhost:8080")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")

_MAX_POST_ATTEMPTS = 3


def _post_event_sync(payload: dict) -> None:
    """HTTP POST using urllib (no extra deps), with bounded retries.

    Every attempt runs in a daemon thread so LiteLLM's response loop is never
    blocked. Retries matter: a lost event means unbilled usage. Only
    transient failures are retried (network errors, timeouts, 5xx); a 4xx
    means the payload itself is rejected and retrying would not help.
    """
    import urllib.request
    import urllib.error
    import json

    url = f"{QILLIN_INTERNAL_URL}/api/internal/litellm-event"
    data = json.dumps(payload).encode("utf-8")

    for attempt in range(_MAX_POST_ATTEMPTS):
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
                return
        except urllib.error.HTTPError as exc:
            if 400 <= exc.code < 500:
                print(f"[QillinLogger] Event rejected (HTTP {exc.code}) — not retrying")
                return
            if attempt == _MAX_POST_ATTEMPTS - 1:
                print(f"[QillinLogger] Failed to post event after {_MAX_POST_ATTEMPTS} attempts: {exc}")
            else:
                time.sleep(0.5 * (2 ** attempt))
        except Exception as exc:
            if attempt == _MAX_POST_ATTEMPTS - 1:
                print(f"[QillinLogger] Failed to post event after {_MAX_POST_ATTEMPTS} attempts: {exc}")
            else:
                time.sleep(0.5 * (2 ** attempt))


class QillinLogger(CustomLogger):
    """Send per-request usage + cost data to Qillin."""

    # LiteLLM fills user fields with this sentinel for master-key-authenticated
    # requests (Qillin's JWT path proxies under the master key). It is not a
    # real user id — treat it as absent so the Qillin-injected header wins.
    _LITELLM_DEFAULT_USER = "default_user_id"

    @classmethod
    def _extract_user_id(cls, kwargs: dict):
        # LiteLLM stores request headers and key metadata in litellm_params.metadata,
        # NOT in the top-level kwargs["metadata"]. Check both locations.
        lp = kwargs.get("litellm_params") or {}
        lp_meta = lp.get("metadata") or {}
        lp_headers = lp_meta.get("headers") or {}
        top_meta = kwargs.get("metadata") or {}
        top_headers = top_meta.get("headers") or {}

        def usable(value):
            return value and value != cls._LITELLM_DEFAULT_USER

        # User ID lookup order — server-attested identity first:
        # 1. x-user-id header — injected by the Qillin API server's auth
        #    middleware AFTER authentication (overwrites any client-sent value),
        #    so it is the authoritative Qillin user id.
        # 2. litellm_params.metadata["user_api_key_user_id"] — LiteLLM
        #    virtual-key owner (sk-qillin-* keys created via /key/generate).
        # 3. top-level metadata fallbacks (older LiteLLM versions).
        # The request-body "user" field is client-controlled free text: it is
        # intentionally LAST so it can never override the authenticated
        # identity (a crafted `user` value must not bill another account).
        for candidate in (
            lp_headers.get("x-user-id"),
            top_headers.get("x-user-id"),
            lp_meta.get("user_api_key_user_id"),
            lp.get("user"),
            top_meta.get("user_id"),
            top_meta.get("user_api_key_user_id"),
            kwargs.get("user"),
        ):
            if usable(candidate):
                return candidate
        return None

    @staticmethod
    def _extract_cache_tokens(usage):
        """Prompt-cache metrics. Anthropic-style usage carries
        cache_read_input_tokens / cache_creation_input_tokens; some providers
        report cached tokens via prompt_tokens_details instead."""
        cache_read_tokens = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
        cache_write_tokens = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
        if cache_read_tokens == 0:
            details = getattr(usage, "prompt_tokens_details", None)
            if details is not None:
                if isinstance(details, dict):
                    cache_read_tokens = int(details.get("cached_tokens", 0) or 0)
                else:
                    cache_read_tokens = int(getattr(details, "cached_tokens", 0) or 0)
        return cache_read_tokens, cache_write_tokens

    def _fire(self, kwargs: dict, usage, response_cost, start_time, end_time) -> None:
        try:
            user_id = self._extract_user_id(kwargs)
            if not user_id:
                slo = kwargs.get("standard_logging_object") or {}
                lp = kwargs.get("litellm_params") or {}
                lp_meta = lp.get("metadata") or {}
                lp_headers = lp_meta.get("headers") or {}
                # Log only header keys (never values) to avoid leaking auth tokens.
                print(
                    f"[QillinLogger] No user_id found — skipping event. "
                    f"lp_header_keys={sorted(lp_headers.keys())!r} "
                    f"lp_meta.user_api_key_user_id={'present' if lp_meta.get('user_api_key_user_id') else 'absent'} "
                    f"slo.user_api_key_user_id={'present' if slo.get('user_api_key_user_id') else 'absent'}"
                )
                return  # anonymous or non-tracked request

            model = kwargs.get("model", "unknown")
            tokens_in = int(getattr(usage, "prompt_tokens", 0) or 0) if usage else 0
            tokens_out = int(getattr(usage, "completion_tokens", 0) or 0) if usage else 0
            cache_read_tokens, cache_write_tokens = self._extract_cache_tokens(usage) if usage else (0, 0)

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
                "cacheReadTokens": cache_read_tokens,
                "cacheWriteTokens": cache_write_tokens,
                "spend": float(response_cost or 0.0),
                "latencyMs": latency_ms,
            }

            # Post in a background thread so we never block LiteLLM's response loop
            threading.Thread(
                target=_post_event_sync, args=(payload,), daemon=True
            ).start()
        except Exception as exc:
            print(f"[QillinLogger] Unexpected error in _fire: {exc}")

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        usage = getattr(response_obj, "usage", None)
        self._fire(kwargs, usage, kwargs.get("response_cost"), start_time, end_time)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        usage = getattr(response_obj, "usage", None)
        self._fire(kwargs, usage, kwargs.get("response_cost"), start_time, end_time)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        """Bill tokens already delivered before a stream broke mid-flight.

        LiteLLM recovers partial usage from the chunks seen so far and stashes
        it on the call details as combined_usage_object, with the partial cost
        in response_cost. Requests that failed before producing any output
        (auth errors, rate limits, pre-flight failures) carry no partial usage
        and are never billed. Qillin configures no router fallbacks, so a call
        cannot emit both a failure and a success event — no double billing.
        """
        usage = kwargs.get("combined_usage_object")
        if usage is None:
            return
        if not (getattr(usage, "prompt_tokens", 0) or getattr(usage, "completion_tokens", 0)):
            return
        self._fire(kwargs, usage, kwargs.get("response_cost"), start_time, end_time)


# LiteLLM loads this instance via the module path "qillin_callback.qillin_logger"
qillin_logger = QillinLogger()

# LiteLLM proxy uses async completions, so callbacks must be in
# litellm._async_success_callback / litellm._async_failure_callback — the sync
# success_callback list is never invoked for proxy requests. We self-register
# here to guarantee placement.
try:
    import litellm as _litellm
    if qillin_logger not in _litellm._async_success_callback:
        _litellm._async_success_callback.append(qillin_logger)
    if qillin_logger not in _litellm._async_failure_callback:
        _litellm._async_failure_callback.append(qillin_logger)
    print("[QillinLogger] Registered in litellm async success/failure callbacks")
except Exception as _e:
    print(f"[QillinLogger] Could not self-register in async callback lists: {_e}")
