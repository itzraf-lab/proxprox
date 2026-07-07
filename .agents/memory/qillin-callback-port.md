---
name: Qillin callback port
description: Root cause of request logs not incrementing / Qredits not decreasing — wrong port in LiteLLM callback default.
---

## Rules

1. `QILLIN_INTERNAL_URL` in `qillin_callback.py` must point at port **8080**, not 3001.
2. All internal references to LiteLLM must use `http://127.0.0.1:8000`, not `http://localhost:8000`.
3. LiteLLM puts request headers and `user_api_key_user_id` in `kwargs["litellm_params"]["metadata"]` — **NOT** in `kwargs["metadata"]`. The callback must read `lp_meta = kwargs["litellm_params"]["metadata"]` to find `x-user-id` and `user_api_key_user_id`.

**Why:**
- Port 3001 default: API server artifact is pinned to `localPort = 8080` in artifact.toml — old default caused silent ECONNREFUSED on every callback.
- Wrong metadata nesting: the old code read `kwargs["metadata"]["headers"]` but LiteLLM stores all incoming request headers under `kwargs["litellm_params"]["metadata"]["headers"]`. This made every request appear as "no user_id found" and return early, so no log was written and no Qredits were deducted.
- `localhost` vs `127.0.0.1`: LiteLLM binds to `127.0.0.1` via `--host 127.0.0.1`; IPv6-first environments resolve `localhost` → `::1` which misses it.

**How to apply:** If tracking stops working again, first check LiteLLM logs for `[QillinLogger] No user_id found`. If present, print `kwargs["litellm_params"]["metadata"]` keys to find where the ID actually is. Never log raw header values (auth token leakage risk — log only keys).
