---
name: LiteLLM model sync on startup
description: How Qillin keeps LiteLLM's model registry in sync with its SQLite DB across restarts.
---

## Rule
The API server runs a background model sync on every startup (`syncModelsToLiteLLM` in `src/lib/sync.ts`). This re-registers any enabled Qillin DB models that are missing from LiteLLM's PostgreSQL registry.

**Why:** Models can be added to Qillin's SQLite DB while LiteLLM is down. Those models never reach LiteLLM's registry, causing all chat completions for them to fail. The sync closes this gap on every boot.

**How it works:**
1. Waits up to 60s for LiteLLM to be ready (polls `/model/info`)
2. Fetches all model names already in LiteLLM
3. Loads all enabled models from Qillin's SQLite DB with provider info and API key
4. Skips models already in LiteLLM (by `model_name` match)
5. Registers missing ones using `litellmModelString()` for correct provider prefix

**Admin trigger:** `POST /api/admin/sync-models` (admin-only) starts a fresh sync in the background without waiting.

**Key requirement:** Models must be registered with `openai/` prefix — see `litellm-openai-prefix.md`.
