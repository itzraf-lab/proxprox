---
name: LiteLLM openai/ prefix for custom providers
description: LiteLLM's /model/new silently discards custom models unless litellm_params.model starts with "openai/" for OpenAI-compatible endpoints.
---

## Rule
When registering a model with LiteLLM via `POST /model/new`, the `litellm_params.model` field **must** be prefixed with `openai/` for custom OpenAI-compatible endpoints. Without it, LiteLLM returns 200 OK but the model does not appear in `/model/info` and chat completions fail with "Invalid model name".

**Why:** LiteLLM uses the prefix to determine the provider protocol. Without a recognized prefix, it treats the model as unknown. The model is accepted (200 OK) but isn't persisted to its PostgreSQL DB and won't route requests.

**How to apply:**
- Provider type `custom` or `openai` → prefix with `openai/`
- Provider type `anthropic` → prefix with `anthropic/`
- If value already starts with `openai/` or `anthropic/`, don't double-prefix
- This applies in: startup sync (`sync.ts`), provider creation with auto-models, and manual model creation endpoint

**Implementation:** `litellmModelString(litellmModel, providerType)` in `artifacts/api-server/src/lib/sync.ts`

**Verification:** After registration, `/model/info` should show `"db_model": true` for the model and it should appear in `/v1/models`.
