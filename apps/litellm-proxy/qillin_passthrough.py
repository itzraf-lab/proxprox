"""
Qillin parameter passthrough — active only when `drop_params` is OFF.

This module wraps LiteLLM's two provider families Qillin routes through
(Qillin only ever emits `openai/...` or `anthropic/...` model strings) and
makes the `drop_params` setting (config.yaml → litellm_settings.drop_params)
a real three-way toggle, read at REQUEST time:

  drop_params = true   → stock LiteLLM behavior, untouched: params outside a
                         provider's static allowlist are silently dropped.
  drop_params = false  → full passthrough: every user param is forwarded
                         verbatim and the PROVIDER's own error answers bad
                         params (never LiteLLM's narrower static allowlist).

Why the passthrough mode exists: with stock `drop_params=false`, LiteLLM
validates params against a STATIC per-provider allowlist that lags behind
what provider APIs actually accept, so valid parameters (reasoning_effort /
thinking / verbosity on OpenAI-compatible endpoints, metadata / service_tier
on Anthropic) fail with UnsupportedParamsError before reaching the provider.

How passthrough mode works when enabled:

  1. `get_supported_openai_params` is extended with the full LiteLLM param
     registry, so the static gate never fires for registry params. (Params
     outside the registry were never gated at all — they already pass through
     via extra_body / optional_params.)
  2. `OpenAIGPTConfig.map_openai_params` is wrapped so any param the
     installed OpenAI SDK does not accept as a keyword argument is relocated
     into `extra_body` (merged into the JSON body upstream) instead of
     crashing the SDK client or being lost.
  3. `AnthropicConfig.map_openai_params` is wrapped so any param the
     translator does not consume is copied into `optional_params`, which
     LiteLLM spreads into the Anthropic JSON body ({**optional_params}).

Value-level validation on params LiteLLM actively translates (e.g. invalid
reasoning_effort values on Anthropic) is unchanged in both modes.

Loaded at proxy startup via qillin_callback.py (which config.yaml imports).
"""
import typing

import litellm
from litellm.constants import DEFAULT_CHAT_COMPLETION_PARAM_VALUES
from litellm.llms.openai.chat.gpt_transformation import OpenAIGPTConfig
from litellm.llms.anthropic.chat.transformation import AnthropicConfig


def _drop_enabled(call_time_value) -> bool:
    """Resolve the effective drop_params flag: an explicit per-request value
    (users may send drop_params in the request body) wins over the global
    config setting (config.yaml → litellm_settings.drop_params)."""
    if isinstance(call_time_value, bool):
        return call_time_value
    return bool(getattr(litellm, "drop_params", False))

# Registry keys that are LiteLLM-internal and never belong in a provider call.
_INTERNAL_KEYS = {
    "messages",
    "model",
    "custom_llm_provider",
    "api_version",
    "drop_params",
    "allowed_openai_params",
    "additional_drop_params",
    "max_retries",
    "extra_headers",
}

# Parameters a user may send that LiteLLM knows about. Anything outside this
# set already flows through LiteLLM's own extra_body/optional_params copying.
REGISTRY_PARAMS = set(DEFAULT_CHAT_COMPLETION_PARAM_VALUES.keys()) - _INTERNAL_KEYS


# ── 1. Extend the static supported-params allowlists (passthrough mode only) ─

# Stock lists, saved before wrapping, so drop mode can be reproduced exactly.
_ORIG_GPT_SUPPORTED = OpenAIGPTConfig.get_supported_openai_params
_ORIG_ANTH_SUPPORTED = AnthropicConfig.get_supported_openai_params

# Keys the stock gate never drops (mirrors the special cases inside
# LiteLLM's _check_valid_arg).
_GATE_EXEMPT = {"user", "stream", "stream_options", "max_retries"}


def _extend_supported(original):
    def wrapped(self, model):
        base = original(self, model) or []
        # drop_params ON → stock gate: unsupported params are dropped silently.
        if _drop_enabled(None):
            return base
        return sorted(set(base) | REGISTRY_PARAMS)
    return wrapped


OpenAIGPTConfig.get_supported_openai_params = _extend_supported(
    OpenAIGPTConfig.get_supported_openai_params
)
AnthropicConfig.get_supported_openai_params = _extend_supported(
    AnthropicConfig.get_supported_openai_params
)


def _apply_stock_drop(stock_supported_fn, self, model, non_default_params):
    """Reproduce the stock gate's popping for requests where drop_params
    resolves True. Needed for the global-false / per-request-true combination:
    the gate checked against the EXTENDED list (global mode) and kept
    everything, so the mapper must drop against the STOCK list instead.
    When the global flag is true the gate already popped — this is a no-op."""
    stock = set(stock_supported_fn(self, model) or [])
    return {
        k: v
        for k, v in (non_default_params or {}).items()
        if k in stock or k in _GATE_EXEMPT or (k == "n" and v == 1)
    }


# ── 2. OpenAI family: relocate SDK-unknown kwargs into extra_body ────────────

def _openai_sdk_chat_kwargs() -> set:
    """Keyword arguments the installed openai SDK's chat.completions.create
    accepts. Introspected (not hardcoded) so it stays correct across SDK
    upgrades. On any failure, fall back to the classic stable set."""
    try:
        from openai.types.chat.completion_create_params import (
            CompletionCreateParamsNonStreaming,
            CompletionCreateParamsStreaming,
        )

        keys = set(typing.get_type_hints(CompletionCreateParamsNonStreaming).keys())
        keys |= set(typing.get_type_hints(CompletionCreateParamsStreaming).keys())
        # litellm/SDK transport-level kwargs that are legal but not body fields
        keys |= {"extra_body", "extra_query", "extra_headers", "timeout"}
        return keys
    except Exception:
        return {
            "messages", "model", "frequency_penalty", "function_call", "functions",
            "logit_bias", "logprobs", "max_completion_tokens", "max_tokens",
            "modalities", "n", "parallel_tool_calls", "prediction",
            "presence_penalty", "reasoning_effort", "response_format", "seed",
            "stop", "store", "stream", "stream_options", "temperature",
            "tool_choice", "tools", "top_logprobs", "top_p", "user",
            "extra_body", "extra_query", "extra_headers", "timeout",
        }


_SDK_KWARGS = _openai_sdk_chat_kwargs()

_original_gpt_map = OpenAIGPTConfig.map_openai_params


def _gpt_map_passthrough(self, non_default_params, optional_params, model, drop_params, **kwargs):
    # drop_params ON → stock gate semantics (covers per-request override when
    # the global flag is false), then stock mapping, nothing more to do.
    if _drop_enabled(drop_params):
        non_default_params = _apply_stock_drop(_ORIG_GPT_SUPPORTED, self, model, non_default_params)
        return _original_gpt_map(
            self,
            non_default_params=non_default_params,
            optional_params=optional_params,
            model=model,
            drop_params=drop_params,
            **kwargs,
        )
    optional_params = _original_gpt_map(
        self,
        non_default_params=non_default_params,
        optional_params=optional_params,
        model=model,
        drop_params=drop_params,
        **kwargs,
    )
    # With the allowlist extended, the original mapper copies registry params
    # verbatim into optional_params — these become SDK kwargs. The SDK rejects
    # keyword arguments it doesn't know, which would produce a client-side
    # TypeError instead of letting the provider decide. Move those into
    # extra_body, which the SDK merges into the upstream JSON body.
    extra_body = dict(optional_params.get("extra_body") or {})
    for key in list(optional_params.keys()):
        if key == "extra_body" or key in _SDK_KWARGS or key not in REGISTRY_PARAMS:
            continue
        extra_body[key] = optional_params.pop(key)
    if extra_body:
        optional_params["extra_body"] = extra_body
    return optional_params


OpenAIGPTConfig.map_openai_params = _gpt_map_passthrough


# ── 3. Anthropic family: forward params the translator didn't consume ────────

# Source params the Anthropic mapper consumes under a DIFFERENT target name.
# If the target is present after mapping, the source was consumed — do not
# also forward the source verbatim.
_RENAMED = {
    "max_completion_tokens": ("max_tokens",),
    "stop": ("stop_sequences",),
    "user": ("metadata",),
    "reasoning_effort": ("thinking",),
    "response_format": ("output_format", "json_mode", "tools"),
}

# OpenAI-protocol sugar with no Anthropic body equivalent — never forward
# verbatim (Anthropic would 400 on the unknown field):
#   user           → translated to metadata.user_id when valid; otherwise
#                    dropped (Anthropic rejects emails there too)
#   stream_options → LiteLLM-internal usage accounting, never a body field
_SKIP_VERBATIM = {"user", "stream_options"}

_original_anthropic_map = AnthropicConfig.map_openai_params


def _anthropic_map_passthrough(self, non_default_params, optional_params, model, drop_params, **kwargs):
    # drop_params ON → stock gate semantics (covers per-request override when
    # the global flag is false), then stock mapping, nothing more to do.
    if _drop_enabled(drop_params):
        non_default_params = _apply_stock_drop(_ORIG_ANTH_SUPPORTED, self, model, non_default_params)
        return _original_anthropic_map(
            self,
            non_default_params=non_default_params,
            optional_params=optional_params,
            model=model,
            drop_params=drop_params,
            **kwargs,
        )
    optional_params = _original_anthropic_map(
        self,
        non_default_params=non_default_params,
        optional_params=optional_params,
        model=model,
        drop_params=drop_params,
        **kwargs,
    )
    # optional_params becomes the Anthropic JSON body via {**optional_params}.
    # Anything the mapper didn't consume is forwarded verbatim: the provider
    # either honors it (metadata, service_tier, ...) or answers with its own
    # 400, which LiteLLM propagates faithfully.
    for key, value in (non_default_params or {}).items():
        if key not in REGISTRY_PARAMS or key in _SKIP_VERBATIM:
            continue
        # n=1 is LangChain's default and means "plain response" — the request
        # is servable, so don't forward it; n>1 goes through and lets
        # Anthropic answer faithfully (it cannot serve it).
        if key == "n" and value == 1:
            continue
        # `user` maps to metadata.user_id; an explicit `metadata` in the same
        # request must be merged, not dropped.
        if key == "metadata" and isinstance(value, dict) and isinstance(optional_params.get("metadata"), dict):
            optional_params["metadata"] = {**value, **optional_params["metadata"]}
            continue
        if key in optional_params:
            continue
        if any(target in optional_params for target in _RENAMED.get(key, ())):
            continue
        optional_params[key] = value
    return optional_params


AnthropicConfig.map_openai_params = _anthropic_map_passthrough


print(
    "[QillinPassthrough] drop_params toggle armed — "
    "drop_params=true: stock silent-drop; drop_params=false: full passthrough "
    "(user params forwarded verbatim, providers answer with their own errors)."
)
